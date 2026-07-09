import os
import json
import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    import urllib.request

# Import local backend modules
from backend.config import load_config, save_config, AppConfig
from backend.logger import log_event, get_logs
from backend.prompt_library import load_prompt_library, save_prompt_library, get_prompt_for_event, update_prompt_for_event
from backend.queue_manager import (
    JOBS, ACTIVE_EVENTS, job_queue, queue_worker, 
    check_fooocus_online, check_gpu_status, GenerationJob, EVENTS_DATA_FILE
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background worker task
    worker_task = asyncio.create_task(queue_worker())
    yield
    # Clean up worker on shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="CBSE History Museum AI Lab Server Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local client computers in the school network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST BODY SCHEMAS ---

class GenerateImageRequest(BaseModel):
    event_id: int
    prompt: Optional[str] = None
    mode: str = "fooocus"  # "fooocus", "pollinations", "procedural"

class GenerateGifRequest(BaseModel):
    event_id: int
    prompt: Optional[str] = None
    mode: str = "fooocus"
    effect: str = "auto"

class BatchRequest(BaseModel):
    event_ids: List[int]
    job_type: str  # "batch_image", "batch_gif"
    mode: str = "fooocus"
    effect: str = "auto"
    prompt: Optional[str] = None

class SettingsUpdateRequest(BaseModel):
    fooocus_url: str
    output_image_dir: str
    output_gif_dir: str
    image_size: int
    animation_duration: int
    fps: int
    gif_quality: int
    theme: str

class PromptUpdateRequest(BaseModel):
    event_id: int
    imagePrompt: str
    animation: str

# --- REST ENDPOINTS ---

@app.get("/health")
async def health():
    config = load_config()
    is_online = await check_fooocus_online(config.fooocus_url)
    gpu = check_gpu_status()
    
    return {
        "status": "healthy",
        "gpu": gpu,
        "fooocus_status": "online" if is_online else "offline",
        "fooocus_url": config.fooocus_url,
        "data_source": f"Pragament → {PRAGAMENT_API_URL} (AI overrides from {EVENTS_DATA_FILE})"
    }

@app.post("/generate-image")
async def generate_image(req: GenerateImageRequest):
    if req.event_id in ACTIVE_EVENTS:
        raise HTTPException(status_code=400, detail="This event is already undergoing image generation.")
        
    job_id = str(uuid.uuid4())
    job = GenerationJob(
        job_id=job_id,
        event_ids=[req.event_id],
        job_type="image_only",
        mode=req.mode,
        prompt=req.prompt,
        status="queued",
        message="Image generation job queued."
    )
    
    JOBS[job_id] = job
    await job_queue.put(job_id)
    log_event("request", {"job_id": job_id, "event_id": req.event_id, "mode": req.mode})
    
    return {"job_id": job_id}

@app.post("/generate-gif")
async def generate_gif(req: GenerateGifRequest):
    if req.event_id in ACTIVE_EVENTS:
        raise HTTPException(status_code=400, detail="This event is already undergoing generation.")
        
    job_id = str(uuid.uuid4())
    job = GenerationJob(
        job_id=job_id,
        event_ids=[req.event_id],
        job_type="gif_pipeline",
        mode=req.mode,
        prompt=req.prompt,
        effect=req.effect,
        status="queued",
        message="GIF generation pipeline job queued."
    )
    
    JOBS[job_id] = job
    await job_queue.put(job_id)
    log_event("request", {"job_id": job_id, "event_id": req.event_id, "mode": req.mode, "effect": req.effect})
    
    return {"job_id": job_id}

@app.post("/batch")
async def generate_batch(req: BatchRequest):
    # Filter out events already generating
    active_conflicted = [ev for ev in req.event_ids if ev in ACTIVE_EVENTS]
    if active_conflicted:
        raise HTTPException(
            status_code=400, 
            detail=f"Events {active_conflicted} are already actively undergoing generation."
        )
        
    job_id = str(uuid.uuid4())
    job = GenerationJob(
        job_id=job_id,
        event_ids=req.event_ids,
        job_type=req.job_type,
        mode=req.mode,
        prompt=req.prompt,
        effect=req.effect,
        status="queued",
        message="Batch job queued."
    )
    
    JOBS[job_id] = job
    await job_queue.put(job_id)
    log_event("request", {"job_id": job_id, "batch_count": len(req.event_ids), "job_type": req.job_type})
    
    return {"job_id": job_id}

@app.get("/status")
async def get_job_status(job_id: Optional[str] = None):
    if job_id:
        if job_id not in JOBS:
            raise HTTPException(status_code=404, detail="Job ID not found.")
        return JOBS[job_id]
    
    # Return all recent jobs
    return list(JOBS.values())[-50:]

@app.get("/history")
async def get_history(limit: int = 100):
    logs = get_logs(limit)
    return {"logs": logs}

# --- EVENT & TIMELINE DB METADATA ENDPOINTS ---

PRAGAMENT_API_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json"

ERA_COLORS = {
    "Prehistory": "#8bc34a",
    "Ancient": "#cddc39",
    "Ancient India": "#8bc34a",
    "Global Trade": "#ffeb3b",
    "Medieval India": "#ff9800",
    "Mughal Empire": "#9c27b0",
    "Colonial India": "#2196f3",
    "Social Reform": "#00bcd4",
    "Indian Nationalism": "#e91e63",
    "World History": "#3f51b5"
}

GRADE_COLORS = {
    "Grade 6": "#4caf50",
    "Grade 7": "#ff9800",
    "Grade 8": "#2196f3",
    "Grade 9": "#3f51b5",
    "Grade 10": "#e91e63"
}

@app.get("/api/image-overrides")
async def get_image_overrides():
    """Returns only the AI-generated image paths from local events_data.json.
    The frontend fetches base event data directly from Pragament and merges these overrides."""
    overrides = {}
    if os.path.exists(EVENTS_DATA_FILE):
        try:
            with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
                events = json.load(f)
                for e in events:
                    if e.get("image"):
                        overrides[e["id"]] = {
                            "image": e["image"],
                            "is_ai_image": e.get("is_ai_image", False)
                        }
        except Exception:
            pass
    return overrides

@app.get("/api/events")
async def get_events():
    """Serves the full enriched events data from local events_data.json.
    This is the primary data source for the timeline and detail pages."""
    if not os.path.exists(EVENTS_DATA_FILE):
        raise HTTPException(status_code=404, detail="events_data.json not found")
    try:
        with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
            events = json.load(f)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read events: {e}")


# --- BOARD DATA PROXY ENDPOINTS ---

SECONDARY_BOARDS = {
    "cbse":      "https://staticapis.pragament.com/lms/cbse/topic-timeline.json",
    "telangana": "https://staticapis.pragament.com/lms/scert_telangana/topic-timeline.json",
    "ap":        "https://staticapis.pragament.com/lms/scert_ap/topic-timeline.json",
}

async def _fetch_board_json(url: str):
    """Fetch board JSON from remote Pragament API."""
    if HTTPX_AVAILABLE:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
    else:
        loop = asyncio.get_event_loop()
        def _sync_fetch():
            with urllib.request.urlopen(url, timeout=15) as r:
                return json.loads(r.read().decode())
        return await loop.run_in_executor(None, _sync_fetch)

@app.get("/api/board/{board_key}")
async def get_board_data(board_key: str):
    """Server-side proxy for secondary board data. Avoids browser CORS issues."""
    if board_key not in SECONDARY_BOARDS:
        raise HTTPException(status_code=404, detail=f"Unknown board: {board_key}")
        


    try:
        data = await _fetch_board_json(SECONDARY_BOARDS[board_key])
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch board data: {e}")

@app.post("/api/reset_event")
async def reset_event(req: dict):
    event_id = req.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event ID.")
        
    if not os.path.exists(EVENTS_DATA_FILE):
        raise HTTPException(status_code=404, detail="Database file missing.")
        
    with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
        events = json.load(f)
        
    event = next((e for e in events if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
        
    # Clear image path to empty (resetting to dynamic API state)
    event["image"] = ""
    event["is_ai_image"] = False
        
    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=4, ensure_ascii=False)
        
    log_event("response", {"event_id": event_id, "action": "reset"})
    return {"success": True}

@app.delete("/api/delete_gif")
async def delete_gif(event_id: int):
    if not os.path.exists(EVENTS_DATA_FILE):
        raise HTTPException(status_code=404, detail="Database file missing.")
        
    with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
        events = json.load(f)
        
    event = next((e for e in events if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
        
    current_image = event.get("image", "")
    # Check if it's a generated asset (contained in assets/generated/)
    if "assets/generated/" in current_image:
        if os.path.exists(current_image):
            try:
                os.remove(current_image)
            except Exception as e:
                print(f"Failed to delete file: {e}")
                
        # Also clean up the static raw image if it exists
        raw_image_path = current_image.replace(".gif", ".png").replace("gifs", "images")
        if os.path.exists(raw_image_path):
            try:
                os.remove(raw_image_path)
            except Exception:
                pass

    # Revert image back to default
    curated_defaults = {
        10: "images/discovery_of_fire.gif",
        13: "images/bhimbetka_cave_art.gif",
        14: "images/invention_of_wheel.gif",
        19: "images/great_bath_mohenjodaro.gif",
        55: "images/gutenberg_press.gif"
    }
    
    if event_id in curated_defaults:
        event["image"] = curated_defaults[event_id]
        event["is_ai_image"] = True
    else:
        event["image"] = "images/history_fallback.gif"
        event["is_ai_image"] = False
        
    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=4, ensure_ascii=False)
        
    log_event("response", {"event_id": event_id, "action": "delete"})
    return {"success": True}

# --- SETTINGS ENDPOINTS ---

@app.get("/api/settings")
async def get_settings():
    return load_config()

@app.post("/api/settings")
async def update_settings(req: SettingsUpdateRequest):
    config = AppConfig(
        fooocus_url=req.fooocus_url,
        output_image_dir=req.output_image_dir,
        output_gif_dir=req.output_gif_dir,
        image_size=req.image_size,
        animation_duration=req.animation_duration,
        fps=req.fps,
        gif_quality=req.gif_quality,
        theme=req.theme
    )
    save_config(config)
    log_event("response", {"action": "settings_update", "url": req.fooocus_url})
    return {"success": True}

# --- PROMPT LIBRARY ENDPOINTS ---

@app.get("/api/prompts")
async def get_prompts():
    return load_prompt_library()

@app.post("/api/prompts")
async def edit_prompt(req: PromptUpdateRequest):
    update_prompt_for_event(req.event_id, req.imagePrompt, req.animation)
    log_event("response", {"action": "prompt_update", "event_id": req.event_id})
    return {"success": True}

# --- SERVE FRONTEND STATIC FILES ---

# Mount the static files of the root directory so they are served directly at /
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print("CBSE HISTORY MUSEUM - AI-POWERED LAB SERVER STARTING...")
    print(f"DATA SOURCE: Pragament -> {PRAGAMENT_API_URL}")

    print(f"AI IMAGE OVERRIDES: {EVENTS_DATA_FILE}")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

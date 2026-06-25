import os
import json
import urllib.request
import urllib.parse
import time
import random
import argparse
from PIL import Image

# Constants
EVENTS_DATA_FILE = "events_data.json"
IMAGES_DIR = "images"
CURATED_EVENT_IDS = {10, 13, 14, 19, 55}

def create_motion_gif(image_path, output_gif_path, num_frames=18, duration=90, zoom_factor=0.06, pan_direction="diagonal", target_width=400):
    """
    Converts a static image into a high-quality, lightweight looping GIF.
    """
    try:
        img = Image.open(image_path)
        if img.mode in ("RGBA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
            img = background
            
        width, height = img.size
        scale = target_width / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        width, height = new_width, new_height
        
        frames = []
        for i in range(num_frames):
            t = i / (num_frames - 1)
            ease_t = 3 * t * t - 2 * t * t * t # Smooth ease-in ease-out
            
            current_zoom = 1.0 + (zoom_factor * ease_t)
            crop_w = int(width / current_zoom)
            crop_h = int(height / current_zoom)
            
            if pan_direction == "diagonal":
                dx = int((width - crop_w) * ease_t)
                dy = int((height - crop_h) * ease_t)
            elif pan_direction == "horizontal":
                dx = int((width - crop_w) * ease_t)
                dy = int((height - crop_h) / 2)
            elif pan_direction == "zoom_in":
                dx = int((width - crop_w) / 2)
                dy = int((height - crop_h) / 2)
            else:
                dx = int((width - crop_w) / 2)
                dy = int((height - crop_h) / 2)
                
            crop_box = (dx, dy, dx + crop_w, dy + crop_h)
            cropped_img = img.crop(crop_box)
            resized_img = cropped_img.resize((width, height), Image.Resampling.BILINEAR)
            frames.append(resized_img.convert("P", palette=Image.Palette.ADAPTIVE))
            
        loop_frames = frames + frames[-2:0:-1]
        
        loop_frames[0].save(
            output_gif_path,
            save_all=True,
            append_images=loop_frames[1:],
            duration=duration,
            loop=0,
            optimize=True
        )
        return True
    except Exception as e:
        print(f"Error compiling GIF for {image_path}: {e}")
        return False

def process_event(event, force=False):
    event_id = event["id"]
    title = event["title"]
    cause_effect = event.get("cause_effect", "")
    era = event["era"]
    year = event["year"]
    
    if event_id in CURATED_EVENT_IDS:
        print(f"[{event_id}/187] Skipping curated event ID {event_id} ('{title}').")
        return True

    gif_path = os.path.join(IMAGES_DIR, f"event_{event_id}.gif")
    
    # If the GIF already exists and we are not forcing, skip downloading
    if os.path.exists(gif_path) and not force:
        print(f"[{event_id}/187] Skip: AI GIF already exists for '{title}'.")
        return True

    clean_cause = cause_effect.replace("Cause & effect details not available.", "").strip()
    prompt_desc = f"{title}. {clean_cause[:120]}" if clean_cause else title
    
    prompt = f"A historical illustration of {prompt_desc}. era: {era}, period: {year}. detailed museum exhibit illustration, oil painting style, cinematic lighting, historical accuracy."
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=384&model=flux&seed={event_id}"
    
    raw_path = os.path.join(IMAGES_DIR, f"event_{event_id}_raw.jpg")
    
    success = False
    retries = 3
    backoff = 6.0
    
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            with urllib.request.urlopen(req, timeout=40) as response:
                with open(raw_path, 'wb') as f:
                    f.write(response.read())
            success = True
            break
        except Exception as e:
            if hasattr(e, 'code') and e.code == 429:
                wait_time = backoff + random.uniform(2.0, 5.0)
                print(f"Rate limited (429) for event {event_id}. Waiting {wait_time:.1f}s before retry...")
                time.sleep(wait_time)
                backoff *= 2.0
            else:
                print(f"Error downloading event {event_id}: {e}. Retrying in 3s...")
                time.sleep(3.0)
                
    if not success:
        print(f"ERROR: Failed to download event {event_id}.")
        return False
        
    directions = ["diagonal", "horizontal", "zoom_in"]
    pan = directions[event_id % len(directions)]
    
    animated = create_motion_gif(raw_path, gif_path, pan_direction=pan)
    
    if os.path.exists(raw_path):
        os.remove(raw_path)
        
    if animated:
        print(f"[{event_id}/187] Successfully generated AI motion GIF: '{title}'")
        return True
    else:
        print(f"[{event_id}/187] Failed to compile GIF: '{title}'")
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate AI-generated illustrations for all timeline events sequentially.")
    parser.add_argument("--force", action="store_true", help="Force regenerate all GIFs, overwriting existing ones.")
    args = parser.parse_args()

    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)

    if not os.path.exists(EVENTS_DATA_FILE):
        print(f"Error: {EVENTS_DATA_FILE} not found.")
        return

    with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
        events = json.load(f)

    total_events = len(events)
    print(f"Loaded {total_events} events. Starting sequential AI GIF generation...")
    
    start_time = time.time()
    success_count = 0
    
    for idx, event in enumerate(events):
        event_id = event["id"]
        
        # Process the event
        success = process_event(event, force=args.force)
        if success:
            success_count += 1
            if event_id not in CURATED_EVENT_IDS:
                # Update events_data.json in real time
                event["image"] = f"images/event_{event_id}.gif"
                event["is_ai_image"] = True
                
                with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(events, f, indent=4, ensure_ascii=False)
                    
            # Add a small delay between events to prevent hitting rate limits
            if event_id not in CURATED_EVENT_IDS:
                time.sleep(2.0)
            
    elapsed = time.time() - start_time
    print(f"\nCompleted! Generated {success_count}/{total_events} AI illustrations in {elapsed:.1f} seconds.")

if __name__ == "__main__":
    main()

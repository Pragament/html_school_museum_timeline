import json
import urllib.request
import os
import time

API_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json"
OUTPUT_FILE = "events_data.json"
IMAGES_DIR = "images"

# Era & Grade Color mapping matching CSS/JS styles
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

# The 5 custom AI images generated earlier
CUSTOM_IMAGES = {
    10: ("images/discovery_of_fire.png", True),
    13: ("images/bhimbetka_cave_art.png", True),
    14: ("images/invention_of_wheel.png", True),
    19: ("images/great_bath_mohenjodaro.png", True),
    61: ("images/gutenberg_press.png", True)
}

def download_image(url, filepath):
    """Helper to download a file from a URL to local path"""
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"Failed to download {url} to {filepath}: {e}")
        return False

def main():
    print(f"Fetching timeline data from {API_URL}...")
    try:
        req = urllib.request.Request(
            API_URL, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        subtopics = data.get("timeline", {}).get("subtopics", [])
        if not subtopics:
            print("Error: No subtopics found in the timeline JSON.")
            return

        if not os.path.exists(IMAGES_DIR):
            os.makedirs(IMAGES_DIR)

        processed_events = []
        total_subtopics = len(subtopics)
        print(f"Found {total_subtopics} events. Checking/downloading unique local images...")

        for index, item in enumerate(subtopics):
            event_id = index + 1
            subtopic_name = item.get("subtopic_name") or item.get("topic_name") or "Untitled topic"
            topic_name = item.get("topic_name") or ""
            chapter_name = item.get("chapter_name") or ""
            
            # Format subtitle
            subtitle_parts = [part for part in [topic_name, chapter_name] if part]
            subtitle = " | ".join(subtitle_parts)
            
            # Normalize grade
            grade = str(item.get("grade") or "").strip()
            if grade and not grade.lower().startswith("grade"):
                grade = f"Grade {grade}"
            elif not grade:
                grade = "Grade"
                
            location = item.get("display_location") or item.get("location") or item.get("corridor_classroom_position") or "Location not specified"
            cause_effect = item.get("cause_effect") or "Cause & effect details not available."
            
            # Determine Color
            color = ERA_COLORS.get(chapter_name) or GRADE_COLORS.get(grade) or "#ff9800"

            # Check if this is a custom image event
            if event_id in CUSTOM_IMAGES:
                img_src, is_ai = CUSTOM_IMAGES[event_id]
            else:
                local_filename = f"event_{event_id}.jpg"
                img_src = os.path.join(IMAGES_DIR, local_filename).replace('\\', '/')
                is_ai = False
                
                # Download if not already cached
                if not os.path.exists(img_src):
                    picsum_url = f"https://picsum.photos/600/400?random={event_id}"
                    print(f"[{event_id}/{total_subtopics}] Downloading unique image: {picsum_url} -> {img_src}")
                    success = download_image(picsum_url, img_src)
                    if not success:
                        img_src = "images/history_fallback.png"
                    time.sleep(0.05)
            
            event = {
                "id": event_id,
                "title": subtopic_name,
                "subtitle": subtitle,
                "year": item.get("year_period") or "Period not specified",
                "era": chapter_name or "Timeline",
                "cause_effect": cause_effect,
                "location": location,
                "grade": grade,
                "color": color,
                "image": img_src,
                "is_ai_image": is_ai
            }
            processed_events.append(event)
            
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(processed_events, f, indent=4, ensure_ascii=False)
            
        print(f"Successfully processed {len(processed_events)} events and saved to {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()

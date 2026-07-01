import json
import urllib.request

API_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json"
OUTPUT_FILE = "events_data.json"

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

        processed_events = []
        total_subtopics = len(subtopics)
        print(f"Processing {total_subtopics} events...")

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

            # Image source comes exclusively from the API.
            # Checks these field names in order (whichever the database team adds later).
            # If none exist yet, image will be empty and no image will be shown.
            img_src = (
                item.get("image_url") or
                item.get("image") or
                item.get("gif_url") or
                item.get("thumbnail_url") or
                ""
            )
            is_ai_image = bool(img_src)

            event = {
                "id": event_id,
                "title": subtopic_name,
                "topic_name": topic_name,
                "subtitle": subtitle,
                "year": item.get("year_period") or "Period not specified",
                "era": chapter_name or "Timeline",
                "cause_effect": cause_effect,
                "location": location,
                "geo_location": item.get("location") or "",
                "panel_position": item.get("corridor_classroom_position") or "",
                "grade": grade,
                "color": color,
                "image": img_src,
                "is_ai_image": is_ai_image
            }
            processed_events.append(event)

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(processed_events, f, indent=4, ensure_ascii=False)

        print(f"Successfully processed {len(processed_events)} events and saved to {OUTPUT_FILE}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()

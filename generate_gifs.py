import os
import json
import urllib.request
import argparse
from PIL import Image, ImageDraw, ImageFont

# Constants
EVENTS_DATA_FILE = "events_data.json"
IMAGES_DIR = "images"

def wrap_text(text, font, max_width):
    lines = []
    words = text.split()
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        # Use getlength for modern Pillow versions
        if font.getlength(test_line) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def draw_procedural_card(title, year, era, grade, color_hex, output_path, size=(540, 360)):
    """
    Generates a beautiful, themed museum display card for the event.
    """
    # Parse color
    color_hex = color_hex.lstrip("#")
    r, g, b = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
    
    # Dark gradient background based on theme color
    base_color = (int(r * 0.15), int(g * 0.15), int(b * 0.15))
    end_color = (15, 15, 20)
    
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    
    # Draw vertical gradient
    for y in range(size[1]):
        t = y / (size[1] - 1)
        curr_r = int(base_color[0] * (1 - t) + end_color[0] * t)
        curr_g = int(base_color[1] * (1 - t) + end_color[1] * t)
        curr_b = int(base_color[2] * (1 - t) + end_color[2] * t)
        draw.line([(0, y), (size[0], y)], fill=(curr_r, curr_g, curr_b))
        
    # Draw sleek card borders
    border_color = (int(r * 0.4), int(g * 0.4), int(b * 0.4))
    draw.rectangle([20, 20, size[0] - 21, size[1] - 21], outline=border_color, width=1)
    
    # Draw corner bracket accents
    accent_color = (r, g, b)
    bracket_len = 15
    # Top-Left
    draw.line([(15, 20), (15 + bracket_len, 20)], fill=accent_color, width=2)
    draw.line([(20, 15), (20, 15 + bracket_len)], fill=accent_color, width=2)
    # Top-Right
    draw.line([(size[0] - 20 - bracket_len, 20), (size[0] - 15, 20)], fill=accent_color, width=2)
    draw.line([(size[0] - 20, 15), (size[0] - 20, 15 + bracket_len)], fill=accent_color, width=2)
    # Bottom-Left
    draw.line([(15, size[1] - 20), (15 + bracket_len, size[1] - 20)], fill=accent_color, width=2)
    draw.line([(20, size[1] - 20), (20, size[1] - 20 - bracket_len)], fill=accent_color, width=2)
    # Bottom-Right
    draw.line([(size[0] - 20 - bracket_len, size[1] - 20), (size[0] - 15, size[1] - 20)], fill=accent_color, width=2)
    draw.line([(size[0] - 20, size[1] - 20), (size[0] - 20, size[1] - 20 - bracket_len)], fill=accent_color, width=2)
    
    # Load fonts
    try:
        font_title = ImageFont.truetype("arial.ttf", 20)
        font_year = ImageFont.truetype("arial.ttf", 15)
        font_meta = ImageFont.truetype("arial.ttf", 11)
    except IOError:
        font_title = ImageFont.load_default()
        font_year = ImageFont.load_default()
        font_meta = ImageFont.load_default()
        
    # Draw header metadata
    draw.text((35, 30), era.upper(), fill=(180, 180, 180), font=font_meta)
    draw.text((size[0] - 35 - font_meta.getlength(grade), 30), grade, fill=accent_color, font=font_meta)
    
    # Word wrap title
    max_text_width = size[0] - 90
    lines = wrap_text(title, font_title, max_text_width)
    
    line_height = 26
    total_height = len(lines) * line_height
    y_start = (size[1] - total_height) // 2
    
    for i, line in enumerate(lines):
        line_w = font_title.getlength(line)
        x = (size[0] - line_w) // 2
        y = y_start + i * line_height
        # Text shadow
        draw.text((x + 1, y + 1), line, fill=(0, 0, 0), font=font_title)
        draw.text((x, y), line, fill=(255, 255, 255), font=font_title)
        
    # Draw year at the bottom
    year_str = f"— {year} —"
    year_w = font_year.getlength(year_str)
    x_year = (size[0] - year_w) // 2
    y_year = size[1] - 50
    draw.text((x_year + 1, y_year + 1), year_str, fill=(0, 0, 0), font=font_year)
    draw.text((x_year, y_year), year_str, fill=accent_color, font=font_year)
    
    img.save(output_path)

def generate_fooocus_image(prompt, output_path, host="http://127.0.0.1:7865"):
    """
    Attempts to generate an image using a local Fooocus instance via gradio_client or raw requests.
    """
    print(f"Calling Fooocus API at {host} with prompt: {prompt}...")
    
    # Attempt 1: Gradio client
    try:
        from gradio_client import Client
        client = Client(host, serialize=False)
        # Fooocus standard text-to-image Gradio endpoint signature
        result = client.predict(
            prompt,                     # Prompt
            "",                         # Negative prompt
            "Cinematic",                # Style (Fooocus Cinematic)
            "Speed",                    # Performance (Speed/Quality/Extreme Speed)
            "1024×1024",                # Aspect Ratio
            1,                          # Image Number
            12345,                      # Seed (-1 for random)
            0.5,                        # Image Sharpness
            "None",                     # Guidance scale
            # Add other default parameters if required by specific Fooocus versions
        )
        # Result is typically a list of files or a dictionary containing file paths
        if result and isinstance(result, list) and len(result) > 0:
            temp_path = result[0]
            Image.open(temp_path).save(output_path)
            return True
    except Exception as e:
        print(f"Gradio Client method failed: {e}")
        
    # Attempt 2: REST API (e.g. mrhan1993/Fooocus-API on port 8888 or custom FastAPI wrapper)
    try:
        import requests
        api_url = f"{host.rstrip('/')}/v1/generation/text-to-image"
        payload = {
            "prompt": prompt,
            "negative_prompt": "",
            "style_selections": ["Cinematic"],
            "performance_selection": "Speed",
            "aspect_ratio": "1024*1024",
            "image_number": 1,
            "sharpness": 2.0
        }
        response = requests.post(api_url, json=payload, timeout=60)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0 and "url" in data[0]:
                img_url = data[0]["url"]
                urllib.request.urlretrieve(img_url, output_path)
                return True
            elif isinstance(data, dict) and "images" in data:
                img_url = data["images"][0]["url"]
                urllib.request.urlretrieve(img_url, output_path)
                return True
    except Exception as e:
        print(f"REST API method failed: {e}")
        
    return False

def create_motion_gif(image_path, output_gif_path, num_frames=15, duration=100, zoom_factor=0.06, pan_direction="diagonal", target_width=400):
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
            
        # Scale image to reduce output GIF size
        width, height = img.size
        scale = target_width / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        width, height = new_width, new_height
        
        frames = []
        for i in range(num_frames):
            t = i / (num_frames - 1)
            ease_t = 3 * t * t - 2 * t * t * t # Smooth easing
            
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
            
        # Ping-pong loop
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
        print(f"Failed to compile motion GIF: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate event-specific illustration GIFs for the Timeline.")
    parser.add_argument("--mode", choices=["procedural", "fooocus"], default="procedural", help="Generation mode (procedural cards or Fooocus AI images)")
    parser.add_argument("--host", default="http://127.0.0.1:7865", help="Fooocus server host URL")
    parser.add_argument("--limit", type=int, default=187, help="Limit number of events to process")
    args = parser.parse_args()

    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)

    if not os.path.exists(EVENTS_DATA_FILE):
        print(f"Error: {EVENTS_DATA_FILE} not found. Please run process_timeline.py first to create the base database.")
        return

    with open(EVENTS_DATA_FILE, "r", encoding="utf-8") as f:
        events = json.load(f)

    print(f"Loaded {len(events)} events from database. Starting generation (mode: {args.mode})...")

    updated_count = 0
    for idx, event in enumerate(events):
        if idx >= args.limit:
            break
            
        event_id = event["id"]
        title = event["title"]
        year = event["year"]
        era = event["era"]
        grade = event["grade"]
        color = event["color"]
        
        raw_img_path = os.path.join(IMAGES_DIR, f"event_{event_id}_raw.png")
        gif_img_path = os.path.join(IMAGES_DIR, f"event_{event_id}.gif")
        
        success = False
        if args.mode == "fooocus":
            # Formulate standard historical scene description prompt for Stable Diffusion / Fooocus
            prompt = f"Historical event: {title}. Period: {year}. Era: {era}. Cinematic lighting, highly detailed historical scene, oil painting illustration, masterpiece, 4k."
            success = generate_fooocus_image(prompt, raw_img_path, host=args.host)
            if not success:
                print(f"Fooocus generation failed for event {event_id}. Falling back to procedural layout...")
                draw_procedural_card(title, year, era, grade, color, raw_img_path)
                success = True
        else:
            draw_procedural_card(title, year, era, grade, color, raw_img_path)
            success = True
            
        if success:
            # Alternate panning direction based on event ID for visual variety in the timeline
            directions = ["diagonal", "horizontal", "zoom_in"]
            pan = directions[event_id % len(directions)]
            
            animated = create_motion_gif(raw_img_path, gif_img_path, pan_direction=pan)
            if animated:
                # Clean up the raw temp PNG image to save disk space
                if os.path.exists(raw_img_path):
                    os.remove(raw_img_path)
                
                # Update event image details
                event["image"] = f"images/event_{event_id}.gif"
                event["is_ai_image"] = (args.mode == "fooocus")
                updated_count += 1
                
                if event_id % 10 == 0 or event_id == len(events):
                    print(f"Progress: Generated motion GIFs for {updated_count}/{min(args.limit, len(events))} events.")

    # Save updated database back
    with open(EVENTS_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=4, ensure_ascii=False)
        
    print(f"\nSuccessfully generated {updated_count} event motion GIFs and updated {EVENTS_DATA_FILE}.")

if __name__ == "__main__":
    main()

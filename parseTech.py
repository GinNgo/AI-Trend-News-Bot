import re
import json
from mutagen.mp3 import MP3

def parse_vtt(vtt_path, fps=30, offset_frame=0):
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    blocks = re.findall(r'(\d\d:\d\d:\d\d[,\.]\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d[,\.]\d\d\d)\s*\n([^\n]+)', content)
    subs = []
    
    def to_secs(t_str):
        t_str = t_str.replace(',', '.')
        h, m, s = t_str.split(':')
        return int(h)*3600 + int(m)*60 + float(s)

    for start_str, end_str, text in blocks:
        start_sec = to_secs(start_str)
        end_sec = to_secs(end_str)
        start_f = int(round(start_sec * fps)) + offset_frame
        end_f = int(round(end_sec * fps)) + offset_frame
        subs.append({
            "start": start_f,
            "end": end_f,
            "text": text.strip()
        })
    return subs

fps = 30
global_offset = 0
all_subs = []
padding = 20

scene_frames = []

for i in range(1, 5):
    mp3_file = f"public/tech_{i}.mp3"
    vtt_file = f"public/tech_{i}.vtt"
    
    audio = MP3(mp3_file)
    duration = audio.info.length
    frames = int(round(duration * fps))
    
    print(f"Scene {i}: {duration:.2f}s -> {frames} frames. Starts at global frame {global_offset}")
    
    # Parse subtitles for this scene
    scene_subs = parse_vtt(vtt_file, fps, global_offset)
    all_subs.extend(scene_subs)
    
    scene_frames.append({
        "id": i,
        "audio_frames": frames,
        "global_start": global_offset,
        "padding": padding
    })
    
    # Next scene starts after this scene + padding
    global_offset += frames + padding

with open("public/tech_captions.json", "w", encoding="utf-8") as f:
    json.dump(all_subs, f, ensure_ascii=False, indent=2)

print(f"Total video duration logic: Global offset ended at {global_offset}. We need total frames around {global_offset}")

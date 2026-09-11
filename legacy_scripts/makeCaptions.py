import re
import json

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


subs_1 = parse_vtt("public/traffic_1.vtt", 30, 0)
subs_2 = parse_vtt("public/traffic_2.vtt", 30, 266)
subs_3 = parse_vtt("public/traffic_3.vtt", 30, 528)

all_subs = subs_1 + subs_2 + subs_3
with open("public/captions.json", "w", encoding="utf-8") as f:
    json.dump(all_subs, f, ensure_ascii=False, indent=2)

print("Created public/captions.json!")

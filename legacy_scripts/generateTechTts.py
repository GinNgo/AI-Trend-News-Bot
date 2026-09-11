import asyncio
import edge_tts
from mutagen.mp3 import MP3
import re
import json

scenes_data = [
    {
        "id": "scene-1",
        "voiceover": "Hôm nay, ngày 9 tháng 9 năm 2026, Hội chợ quốc tế Công nghệ cao và Kinh tế số HI-TECH VIETNAM 2026 chính thức khai mạc. Đây là cầu nối chiến lược thúc đẩy hệ sinh thái bán dẫn và trí tuệ nhân tạo vươn tầm khu vực."
    },
    {
        "id": "scene-2",
        "voiceover": "Chiến lược AI mới của Việt Nam xác định bước chuyển mình căn bản: chuyển từ nghiên cứu ứng dụng cục bộ sang chuyển đổi toàn diện quốc gia bằng trí tuệ nhân tạo, đưa AI trở thành động lực cốt lõi phát triển kinh tế số."
    },
    {
        "id": "scene-3",
        "voiceover": "Chiến dịch 100 ngày xử lý các điểm nghẽn chuyển đổi số đang được đẩy mạnh nhằm giải quyết dứt điểm các vướng mắc về tích hợp dữ liệu, giúp người dân và doanh nghiệp thực hiện thủ tục trực tuyến nhanh chóng, an toàn."
    },
    {
        "id": "scene-4",
        "voiceover": "Giải thưởng Sản phẩm công nghệ số Make in Viet Nam 2026 mở rộng trọng tâm cho các sản phẩm AI, khẳng định năng lực tự chủ công nghệ và sáng tạo của các kỹ sư công nghệ trong nước."
    }
]

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

async def main():
    fps = 30
    global_offset = 0
    all_subs = []
    
    for i, scene in enumerate(scenes_data):
        mp3_file = f"public/tech_{i+1}.mp3"
        vtt_file = f"public/tech_{i+1}.vtt"
        
        print(f"Generating {mp3_file}...")
        communicate = edge_tts.Communicate(scene["voiceover"], "vi-VN-HoaiMyNeural", rate="+20%", pitch="+2Hz")
        await communicate.save(mp3_file)
        
        # Save subtitles explicitly by running CLI or parsing if library doesn't expose it easily.
        # Wait, communicate.save doesn't save VTT directly in the python API natively without a custom handler.
        # Let's just use CLI directly via subprocess to get VTT.
        pass

asyncio.run(main())

import subprocess
import json
from mutagen.mp3 import MP3

scripts = [
    {
        "id": 1,
        "text": "Hôm nay, ngày 9 tháng 9 năm 2026, Hội chợ quốc tế Công nghệ cao và Kinh tế số HI-TECH VIETNAM 2026 chính thức khai mạc. Đây là cầu nối chiến lược thúc đẩy hệ sinh thái bán dẫn và trí tuệ nhân tạo vươn tầm khu vực.",
        "file": "public/tech_1.mp3"
    },
    {
        "id": 2,
        "text": "Chiến lược AI mới của Việt Nam xác định bước chuyển mình căn bản: chuyển từ nghiên cứu ứng dụng cục bộ sang chuyển đổi toàn diện quốc gia bằng trí tuệ nhân tạo, đưa AI trở thành động lực cốt lõi phát triển kinh tế số.",
        "file": "public/tech_2.mp3"
    },
    {
        "id": 3,
        "text": "Chiến dịch 100 ngày xử lý các điểm nghẽn chuyển đổi số đang được đẩy mạnh nhằm giải quyết dứt điểm các vướng mắc về tích hợp dữ liệu, giúp người dân và doanh nghiệp thực hiện thủ tục trực tuyến nhanh chóng, an toàn.",
        "file": "public/tech_3.mp3"
    },
    {
        "id": 4,
        "text": "Giải thưởng Sản phẩm công nghệ số Make in Viet Nam 2026 mở rộng trọng tâm cho các sản phẩm AI, khẳng định năng lực tự chủ công nghệ và sáng tạo của các kỹ sư công nghệ trong nước.",
        "file": "public/tech_4.mp3"
    },
    {
        "id": 5,
        "text": "Đó là những thông tin công nghệ nổi bật nhất hôm nay. Hãy nhấn Like và Đăng ký theo dõi kênh để không bỏ lỡ những bước tiến công nghệ mới nhất. Cảm ơn các bạn và hẹn gặp lại!",
        "file": "public/tech_5.mp3"
    }
]

fps = 30
padding = 20 # 20 frames rest before scene change
global_offset = 0
result = []

for item in scripts:
    print(f"Generating TTS for scene {item['id']}...")
    cmd = [
        "edge-tts",
        "--voice", "vi-VN-HoaiMyNeural",
        "--text", item["text"],
        "--write-media", item["file"],
        "--rate=+5%",
        "--pitch=+2Hz"
    ]
    subprocess.run(cmd, check=True)

    audio = MP3(item["file"])
    dur_sec = audio.info.length
    frames = int(round(dur_sec * fps))

    result.append({
        "id": item["id"],
        "duration_sec": round(dur_sec, 2),
        "audio_frames": frames,
        "global_start": global_offset,
        # Sequence duration needed in Remotion TransitionSeries:
        # If there is a next scene, sequence duration = audio_frames + padding + 20 (transition overlap)
        # If it's the last scene, sequence duration = audio_frames + padding
        "seq_duration": frames + padding + (20 if item["id"] < 5 else 0)
    })

    global_offset += frames + padding

total_frames = global_offset
print("Results:")
print(json.dumps(result, indent=2))
print(f"Total video frames: {total_frames}")

with open("public/tech_sync_data.json", "w", encoding="utf-8") as f:
    json.dump({
        "scenes": result,
        "total_frames": total_frames
    }, f, indent=2)

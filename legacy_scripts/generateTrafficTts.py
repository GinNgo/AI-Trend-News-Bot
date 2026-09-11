import asyncio
import edge_tts
from mutagen.mp3 import MP3

texts = [
    ("public/traffic_1.mp3", "Cảnh báo khẩn cấp đầu năm học! Cha mẹ thì chấp hành đầy đủ, nhưng lại để con trần đầu ngồi sau xe máy! Nghịch lý này đang diễn ra ở khắp nơi!"),
    ("public/traffic_2.mp3", "Nhiều phụ huynh bao biện là do muộn giờ, hoặc do con không chịu đội mũ! Nhưng bạn có biết, người lớn không làm gương sẽ làm hỏng ý thức giao thông của con em mình?"),
    ("public/traffic_3.mp3", "Cảnh sát giao thông đã vào cuộc chấn chỉnh, gửi thông báo phạt thẳng về nhà trường! Đội mũ cho con là bảo vệ tính mạng của con, đừng để hối hận không kịp! Bấm theo dõi ngay để cập nhật tin tức nóng hổi!")
]

async def main():
    for file, text in texts:
        print(f"Generating {file}...")
        communicate = edge_tts.Communicate(text, "vi-VN-NamMinhNeural", rate="+25%", pitch="+5Hz")
        await communicate.save(file)
        await asyncio.sleep(1)
        audio = MP3(file)
        duration = audio.info.length
        frames = int(round(duration * 30))
        print(f"{file}: {duration:.2f}s -> {frames} frames")

asyncio.run(main())

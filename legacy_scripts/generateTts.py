import asyncio
import edge_tts
from mutagen.mp3 import MP3

texts = [
    ("public/biz_tiktok_1.mp3", "Cảnh báo cực nóng cho các chủ doanh nghiệp! Bạn nghĩ công ty ngừng hoạt động từ lâu, vứt đó là xong chuyện? Quên đi!"),
    ("public/biz_tiktok_2.mp3", "Cục Thuế vừa chốt hạ: Hơn 95 ngàn doanh nghiệp đang bị rà soát toàn diện. Muốn đóng mã số thuế? Bắt buộc phải thanh toán sòng phẳng mọi khoản nợ cho nhà nước!"),
    ("public/biz_tiktok_3.mp3", "Chiêu trò lập công ty ma để bán hóa đơn sắp hết đất diễn rồi! Đóng đủ tiền, 3 ngày sau hồ sơ tự động giải quyết! Bấm theo dõi ngay để không bao giờ mất tiền oan!")
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

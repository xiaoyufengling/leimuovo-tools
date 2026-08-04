from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public"
DESKTOP = ROOT / "apps" / "receipt-desktop" / "build"


def mark(size: int, maskable: bool = False) -> Image.Image:
    image = Image.new("RGB", (size, size), "#F7F7F8" if maskable else "#111113")
    draw = ImageDraw.Draw(image)
    if maskable:
        pad = round(size * 0.18)
        draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=round(size * 0.17), fill="#111113")
        box_left, box_top, box_right, box_bottom = pad, pad, size - pad, size - pad
    else:
        box_left, box_top, box_right, box_bottom = 0, 0, size, size
    width = box_right - box_left
    stroke = max(2, round(width * 0.1))
    x = box_left + round(width * 0.31)
    y1 = box_top + round(width * 0.26)
    y2 = box_top + round(width * 0.70)
    x2 = box_left + round(width * 0.68)
    draw.line((x, y1, x, y2, x2, y2), fill="#F7F7F8", width=stroke, joint="curve")
    dot = max(2, round(width * 0.075))
    cx = box_left + round(width * 0.70)
    cy = box_top + round(width * 0.30)
    draw.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill="#0A66D6")
    return image


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


WEB.mkdir(parents=True, exist_ok=True)
(WEB / "icons").mkdir(parents=True, exist_ok=True)
DESKTOP.mkdir(parents=True, exist_ok=True)

mark(32).save(WEB / "favicon-32.png")
mark(180).save(WEB / "apple-touch-icon.png")
mark(192).save(WEB / "icons" / "icon-192.png")
mark(512).save(WEB / "icons" / "icon-512.png")
mark(512, maskable=True).save(WEB / "icons" / "icon-maskable-512.png")
mark(256).save(DESKTOP / "app-icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

og = Image.new("RGB", (1200, 630), "#F7F7F8")
draw = ImageDraw.Draw(og)
icon = mark(128)
og.paste(icon, (96, 112))
draw.text((96, 282), "Leimuovo", fill="#111113", font=font(74, bold=True))
draw.text((96, 390), "安静、快速、尊重隐私的个人工具集", fill="#62626B", font=font(34))
draw.ellipse((1030, 96, 1050, 116), fill="#0A66D6")
draw.line((850, 520, 1050, 520), fill="#D6D6D9", width=2)
og.save(WEB / "og-default.png", optimize=True)

print("Generated Leimuovo brand assets")

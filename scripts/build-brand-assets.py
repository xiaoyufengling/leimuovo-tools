from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public"
DESKTOP = ROOT / "apps" / "receipt-desktop" / "build"
BRAND_SOURCE = ROOT / "packages" / "design-system" / "assets" / "brand-avatar.png"
BRAND_BACKGROUND = "#101940"

source = Image.open(BRAND_SOURCE).convert("RGB")

def avatar(size: int) -> Image.Image:
    return ImageOps.fit(
        source,
        (size, size),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def maskable_avatar(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size), BRAND_BACKGROUND)
    inner_size = round(size * 0.8)
    inset = (size - inner_size) // 2
    image.paste(avatar(inner_size), (inset, inset))
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

avatar(256).save(WEB / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
avatar(32).save(WEB / "favicon-32.png", optimize=True)
avatar(64).save(WEB / "icons" / "brand-avatar-64.png", optimize=True)
avatar(180).save(WEB / "apple-touch-icon.png", optimize=True)
avatar(192).save(WEB / "icons" / "icon-192.png", optimize=True)
avatar(512).save(WEB / "icons" / "icon-512.png", optimize=True)
maskable_avatar(512).save(WEB / "icons" / "icon-maskable-512.png", optimize=True)
avatar(256).save(DESKTOP / "app-icon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

og = Image.new("RGB", (1200, 630), "#F7F7F8")
draw = ImageDraw.Draw(og)
icon_size = 144
icon = avatar(icon_size)
icon_mask = Image.new("L", (icon_size, icon_size), 0)
ImageDraw.Draw(icon_mask).ellipse((0, 0, icon_size - 1, icon_size - 1), fill=255)
og.paste(icon, (96, 104), icon_mask)
draw.text((96, 282), "小鱼", fill="#111113", font=font(74, bold=True))
draw.text((96, 390), "安静、快速、尊重隐私的个人工具集", fill="#62626B", font=font(34))
draw.ellipse((1030, 96, 1050, 116), fill="#0A66D6")
draw.line((850, 520, 1050, 520), fill="#D6D6D9", width=2)
og.save(WEB / "og-default.png", optimize=True)

print("Generated 小鱼 brand assets")

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public"
DESKTOP = ROOT / "apps" / "receipt-desktop" / "build"
BRAND_SOURCE = ROOT / "packages" / "design-system" / "assets" / "brand-avatar.png"
BRAND_BACKGROUND = "#101940"

source = Image.open(BRAND_SOURCE).convert("RGBA")

def avatar(size: int) -> Image.Image:
    artwork = ImageOps.contain(source, (round(size * 0.94), round(size * 0.94)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(artwork, ((size - artwork.width) // 2, (size - artwork.height) // 2))
    return canvas


def maskable_avatar(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BRAND_BACKGROUND)
    inner_size = round(size * 0.8)
    inset = (size - inner_size) // 2
    icon = avatar(inner_size)
    image.alpha_composite(icon, (inset, inset))
    return image.convert("RGB")


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

og = Image.new("RGB", (1200, 630), "#0B0B0D")
draw = ImageDraw.Draw(og)
draw.rounded_rectangle((64, 52, 1136, 578), radius=36, outline="#2C2C30", width=2)
icon_size = 112
icon = avatar(icon_size)
og.paste(icon, (96, 88), icon.getchannel("A"))
draw.text((240, 102), "LEIMUOVO.COM", fill="#F5F5F7", font=font(27, bold=True))
draw.text((240, 148), "PERSONAL WEBSITE", fill="#8E8E93", font=font(20))
draw.text((96, 258), "小鱼", fill="#F5F5F7", font=font(76, bold=True))
draw.text((96, 372), "把想法留下，让时间慢慢整理。", fill="#B6B6BC", font=font(39))
draw.line((96, 500, 1104, 500), fill="#2C2C30", width=2)
draw.ellipse((96, 530, 110, 544), fill="#F5F5F7")
draw.text((890, 524), "A PERSONAL SPACE", fill="#8E8E93", font=font(18))
og.save(WEB / "og-default.png", optimize=True)

print("Generated 小鱼 brand assets")

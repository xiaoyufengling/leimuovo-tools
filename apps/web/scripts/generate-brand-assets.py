from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageOps


BRAND_FILES = {
    96: "rem-cat-avatar-96-v4.png",
    180: "rem-cat-avatar-180-v4.png",
    192: "rem-cat-avatar-192-v4.png",
    512: "rem-cat-avatar-512-v4.png",
}


def load_master(path: Path) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if image.width < 512 or image.height < 512:
        raise SystemExit(f"{path} must be at least 512px on both axes")
    return image


def trim_white_border(source: Image.Image) -> Image.Image:
    difference = ImageChops.difference(source, Image.new("RGB", source.size, "white")).convert("L")
    foreground = difference.point(lambda value: 255 if value > 8 else 0)
    bounds = foreground.getbbox()
    if bounds is None:
        raise SystemExit("The approved master image contains no visible artwork")

    padding = round(max(source.size) * 0.018)
    left, top, right, bottom = bounds
    crop = (
        max(0, left - padding),
        max(0, top - padding),
        min(source.width, right + padding),
        min(source.height, bottom + padding),
    )
    return source.crop(crop)


def render_square(
    source: Image.Image,
    size: int,
    *,
    fill_ratio: float = 0.98,
    background: tuple[int, int, int] = (255, 255, 255),
) -> Image.Image:
    max_extent = max(1, round(size * fill_ratio))
    scale = min(max_extent / source.width, max_extent / source.height)
    rendered = source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGB", (size, size), background)
    canvas.paste(rendered, ((size - rendered.width) // 2, (size - rendered.height) // 2))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile every website avatar from one approved master image.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--public", type=Path, required=True)
    parser.add_argument("--design-system-avatar", type=Path, required=True)
    args = parser.parse_args()

    source = load_master(args.source)
    brand_dir = args.public / "brand"
    brand_dir.mkdir(parents=True, exist_ok=True)

    icon_source = trim_white_border(source)
    rendered = {size: render_square(icon_source, size, fill_ratio=0.94) for size in BRAND_FILES}
    for size, filename in BRAND_FILES.items():
        save_png(rendered[size], brand_dir / filename)

    # Maskable icons need a wide safe zone because launchers may crop them into
    # circles, squircles, or rounded squares. Keep the approved white backdrop
    # continuous so the source never appears as a white rectangle on blue.
    maskable = render_square(icon_source, 512, fill_ratio=0.68)
    save_png(maskable, brand_dir / "rem-cat-avatar-maskable-512-v4.png")

    favicon = render_square(icon_source, 256, fill_ratio=0.94)
    save_png(favicon.resize((32, 32), Image.Resampling.LANCZOS), args.public / "favicon-32.png")
    favicon.save(
        args.public / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    for apple_name in ("apple-touch-icon.png", "apple-touch-icon-precomposed.png"):
        save_png(rendered[180], args.public / apple_name)

    save_png(rendered[512], args.design_system_avatar)

    print(f"source={args.source} {source.size} {source.mode}")
    print(f"trimmed_icon_source={icon_source.size}")
    print(f"brand_dir={brand_dir}")
    print(f"design_system_avatar={args.design_system_avatar}")
    print("compiled=master avatar, navigation, favicon, Apple touch, PWA, maskable, control center")


if __name__ == "__main__":
    main()

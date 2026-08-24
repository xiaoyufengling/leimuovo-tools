from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def require_rgba(path: Path) -> Image.Image:
    image = Image.open(path)
    if image.mode != "RGBA" or "A" not in image.getbands():
        raise SystemExit(f"{path} must be a genuine RGBA image")
    if image.getchannel("A").getextrema() != (0, 255):
        raise SystemExit(f"{path} must include both transparent and opaque pixels")
    return image


def premultiplied_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")


def fitted_icon(
    source: Image.Image,
    size: int,
    *,
    fill_ratio: float,
    background: tuple[int, int, int, int] = (0, 0, 0, 0),
    rounded: bool = False,
) -> Image.Image:
    bbox = source.getbbox()
    if bbox is None:
        raise SystemExit("character source is fully transparent")
    cropped = source.crop(bbox)
    max_extent = max(1, round(size * fill_ratio))
    scale = min(max_extent / cropped.width, max_extent / cropped.height)
    rendered = premultiplied_resize(
        cropped,
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
    )

    if rounded:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=round(size * 0.215),
            fill=255,
        )
        backdrop = Image.new("RGBA", (size, size), background)
        canvas.alpha_composite(Image.composite(backdrop, canvas, mask))
    else:
        canvas = Image.new("RGBA", (size, size), background)

    x = (size - rendered.width) // 2
    y = (size - rendered.height) // 2
    canvas.alpha_composite(rendered, (x, y))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", type=Path, required=True)
    parser.add_argument("--public", type=Path, required=True)
    args = parser.parse_args()

    character = require_rgba(args.character)

    images_dir = args.public / "images"
    icons_dir = args.public / "icons"
    images_dir.mkdir(parents=True, exist_ok=True)
    icons_dir.mkdir(parents=True, exist_ok=True)

    character_target = images_dir / "xiaoyugan-rem-face.png"
    if args.character.resolve() != character_target.resolve():
        character.save(character_target, optimize=True)

    favicon = fitted_icon(character, 256, fill_ratio=0.94)
    favicon_32 = premultiplied_resize(favicon, (32, 32))
    safari_favorite = premultiplied_resize(favicon, (180, 180))
    safari_favorite.save(args.public / "safari-favorite-rem-cat-20260823.png", optimize=True)
    favicon_32.save(args.public / "favicon-32.png", optimize=True)
    favicon.save(
        args.public / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    apple = fitted_icon(
        character,
        180,
        fill_ratio=0.88,
        background=(13, 16, 22, 255),
        rounded=True,
    )
    for apple_name in (
        "apple-touch-icon-rem-cat-20260823.png",
        "apple-touch-icon.png",
        "apple-touch-icon-precomposed.png",
    ):
        apple.save(args.public / apple_name, optimize=True)

    fitted_icon(character, 96, fill_ratio=0.94).save(
        icons_dir / "rem-cat-brand-96.png",
        optimize=True,
    )

    fitted_icon(character, 192, fill_ratio=0.92).save(
        icons_dir / "rem-cat-icon-192.png",
        optimize=True,
    )
    fitted_icon(character, 512, fill_ratio=0.92).save(
        icons_dir / "rem-cat-icon-512.png",
        optimize=True,
    )
    fitted_icon(
        character,
        512,
        fill_ratio=0.72,
        background=(13, 16, 22, 255),
    ).save(icons_dir / "rem-cat-icon-maskable-512.png", optimize=True)

    print(f"character={character.mode} {character.size} alpha={character.getchannel('A').getextrema()}")
    print(f"source={args.character}")
    print("wrote=site favicon, Apple touch icon, and PWA icon set")


if __name__ == "__main__":
    main()

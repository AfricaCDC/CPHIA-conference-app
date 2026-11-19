#!/usr/bin/env python3
"""Generate iOS/Android launcher icons from the official PWA icon-512.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "icons" / "icon-512.png"
IOS_ICON = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
BG = (248, 245, 236, 255)  # cream from official icon corners

# Launcher densities (px)
LAUNCHER = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Adaptive foreground densities (px) — full 108dp canvas
FOREGROUND = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def fit_square(src: Image.Image, size: int) -> Image.Image:
    img = src.convert("RGBA")
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img


def adaptive_foreground(src: Image.Image, size: int, content_ratio: float = 0.72) -> Image.Image:
    """Place the icon in the adaptive safe zone on cream."""
    canvas = Image.new("RGBA", (size, size), BG)
    content = max(1, int(size * content_ratio))
    logo = fit_square(src, content)
    offset = (size - content) // 2
    canvas.paste(logo, (offset, offset), logo)
    return canvas


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source icon: {SOURCE}")

    src = Image.open(SOURCE)
    print(f"Source: {SOURCE} ({src.size[0]}x{src.size[1]})")

    ios = fit_square(src, 1024)
    IOS_ICON.parent.mkdir(parents=True, exist_ok=True)
    ios.save(IOS_ICON, format="PNG", optimize=True)
    print(f"Wrote {IOS_ICON.relative_to(ROOT)}")

    for folder, size in LAUNCHER.items():
        out_dir = ANDROID_RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = fit_square(src, size)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            path = out_dir / name
            icon.save(path, format="PNG", optimize=True)
            print(f"Wrote {path.relative_to(ROOT)}")

    for folder, size in FOREGROUND.items():
        out_dir = ANDROID_RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        fg = adaptive_foreground(src, size)
        path = out_dir / "ic_launcher_foreground.png"
        fg.save(path, format="PNG", optimize=True)
        print(f"Wrote {path.relative_to(ROOT)}")

    # Drop vector Capactior foreground so adaptive icons use the PNG mipmaps only.
    for leftover in (
        ANDROID_RES / "drawable-v24" / "ic_launcher_foreground.xml",
        ANDROID_RES / "drawable" / "ic_launcher_foreground.xml",
    ):
        if leftover.is_file():
            leftover.unlink()
            print(f"Removed {leftover.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

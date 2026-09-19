"""Prepare web images from the originals in incoming/.

    python tools/images.py

Each source file listed in content/images.json is resized to 2400, 1200 and 800
pixels wide and saved as both WebP and JPEG in assets/img/. Originals stay in
incoming/ and are never published. Re-run after adding or replacing a source
file; existing outputs are skipped unless the source is newer.
"""
import json
import pathlib
import sys

from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
INCOMING = ROOT / "incoming"
OUT = ROOT / "assets" / "img"
WIDTHS = [2400, 1200, 800]
JPEG_Q = 82
WEBP_Q = 80


def build(slot, spec, force=False):
    src = INCOMING / spec["source"]
    if not src.exists():
        print(f"  ! missing source for {slot}: {spec['source']}")
        return False
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    made = []
    for w in WIDTHS:
        if im.width < w and w != WIDTHS[-1]:
            continue
        h = round(im.height * w / im.width)
        resized = im.resize((min(w, im.width), round(im.height * min(w, im.width) / im.width)), Image.LANCZOS) if im.width > w else im
        for ext, kwargs in (("webp", {"quality": WEBP_Q, "method": 6}), ("jpg", {"quality": JPEG_Q, "progressive": True, "optimize": True})):
            dest = OUT / f"{slot}-{w}.{ext}"
            if dest.exists() and not force and dest.stat().st_mtime > src.stat().st_mtime:
                continue
            resized.save(dest, **kwargs)
            made.append(f"{dest.name} ({dest.stat().st_size // 1024} KB)")
    print(f"  {slot}: {im.width}x{im.height} -> " + (", ".join(made) if made else "up to date"))
    return True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    images = json.loads((ROOT / "content" / "images.json").read_text(encoding="utf-8"))
    force = "--force" in sys.argv
    print(f"Preparing {len(images)} image(s) from incoming/")
    for slot, spec in images.items():
        build(slot, spec, force)


if __name__ == "__main__":
    main()

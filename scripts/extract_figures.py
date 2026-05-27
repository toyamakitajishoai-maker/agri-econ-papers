#!/usr/bin/env python3
"""
PDF から図表画像とキャプションをペアで抽出（PyMuPDF）。
stdout に JSON を出力: {"candidates": [...]}
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"candidates": [], "error": "pymupdf not installed"}))
    sys.exit(0)

CAPTION_RE = re.compile(
    r"(?:Figure|Fig\.?|Table|TABLE)\s*(\d+)[:\.]?\s*([^\n]{0,200})",
    re.IGNORECASE,
)
MIN_IMAGE_BYTES = 8_000
MIN_IMAGE_SIDE = 80
MAX_CANDIDATES = 12


def caption_on_page(text: str) -> list[dict]:
    found = []
    for m in CAPTION_RE.finditer(text):
        label = m.group(0).split("\n")[0].strip()[:120]
        body = (m.group(2) or "").strip()
        caption = f"{label} {body}".strip() if body else label
        found.append({"label": label, "caption": caption[:500]})
    return found


def image_area(doc: fitz.Document, xref: int) -> int:
    try:
        img = doc.extract_image(xref)
        return img.get("width", 0) * img.get("height", 0)
    except Exception:
        return 0


def extract_candidates(pdf_path: str, output_dir: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    candidates: list[dict] = []

    for page_index in range(len(doc)):
        page_num = page_index + 1
        if page_num == 1:
            continue
        page = doc[page_index]
        text = page.get_text("text") or ""
        captions = caption_on_page(text)
        images = page.get_images(full=True)

        if not images:
            continue

        ranked = sorted(
            [(xref, image_area(doc, xref)) for xref, *_ in images],
            key=lambda x: x[1],
            reverse=True,
        )

        for img_idx, (xref, area) in enumerate(ranked[:3]):
            if area < MIN_IMAGE_SIDE * MIN_IMAGE_SIDE:
                continue
            try:
                img = doc.extract_image(xref)
                data = img.get("image")
                if not data or len(data) < MIN_IMAGE_BYTES:
                    continue
                ext = img.get("ext", "png")
                cid = f"p{page_num}_i{img_idx}"
                fname = f"{cid}.{ext}"
                fpath = out / fname
                fpath.write_bytes(data)

                cap = captions[min(img_idx, len(captions) - 1)] if captions else None
                if not cap and captions:
                    cap = captions[0]
                caption = cap["caption"] if cap else f"Page {page_num} の図表"
                label = cap["label"] if cap else f"p.{page_num}"

                candidates.append(
                    {
                        "id": cid,
                        "page": page_num,
                        "caption": caption,
                        "label": label,
                        "imageFile": fname,
                    }
                )
            except Exception:
                continue

        if len(candidates) >= MAX_CANDIDATES:
            break

    doc.close()
    return candidates[:MAX_CANDIDATES]


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"candidates": [], "error": "usage: extract_figures.py <pdf> <out_dir>"}))
        return
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    try:
        candidates = extract_candidates(pdf_path, output_dir)
        print(json.dumps({"candidates": candidates}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"candidates": [], "error": str(e)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

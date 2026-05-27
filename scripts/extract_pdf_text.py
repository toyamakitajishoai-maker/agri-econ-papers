#!/usr/bin/env python3
"""PDF から要約用テキスト抜粋（Introduction / Results / Discussion 等を優先）。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"excerpt": "", "error": "pymupdf not installed"}))
    sys.exit(0)

MAX_CHARS = 14_000
MAX_PAGES = 28

SECTION_RE = re.compile(
    r"^\s*(?:\d+\.?\s*)?"
    r"(abstract|introduction|background|literature|methods?|methodology|materials?\s+and\s+methods?|"
    r"results?|findings|discussion|limitation?s?|study\s+limitation?s?|"
    r"conclusion|conclusions|implications?)\s*"
    r"(?:and\s+\w+)?\s*$",
    re.IGNORECASE | re.MULTILINE,
)

PRIORITY = (
    "introduction",
    "background",
    "methods",
    "methodology",
    "results",
    "findings",
    "discussion",
    "limitations",
    "limitation",
    "conclusion",
    "conclusions",
    "implications",
    "abstract",
)


def normalize(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_sections(full: str) -> dict[str, str]:
    matches = list(SECTION_RE.finditer(full))
    if len(matches) < 2:
        return {"body": full}

    sections: dict[str, str] = {}
    for i, m in enumerate(matches):
        name = m.group(1).lower()
        if name == "method":
            name = "methods"
        if name in ("conclusions", "finding"):
            name = "conclusion" if "conclusion" in name else "results"
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full)
        chunk = normalize(full[start:end])
        if chunk and (name not in sections or len(chunk) > len(sections[name])):
            sections[name] = chunk
    return sections


def build_excerpt(sections: dict[str, str]) -> str:
    parts: list[str] = []
    used = 0
    for key in PRIORITY:
        body = sections.get(key)
        if not body:
            continue
        header = f"## {key.upper()}\n"
        chunk = body[: min(len(body), MAX_CHARS - used - len(header) - 2)]
        if not chunk:
            break
        parts.append(header + chunk)
        used += len(header) + len(chunk)
        if used >= MAX_CHARS - 500:
            break

    if parts:
        return "\n\n".join(parts)[:MAX_CHARS]

    body = sections.get("body", "")
    return body[:MAX_CHARS]


def extract(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    texts: list[str] = []
    for i in range(min(len(doc), MAX_PAGES)):
        texts.append(doc[i].get_text("text"))
    doc.close()
    full = normalize("\n".join(texts))
    if not full:
        return {"excerpt": "", "error": "no text"}
    sections = split_sections(full)
    excerpt = build_excerpt(sections)
    if len(excerpt) < 800 and len(full) > len(excerpt):
        excerpt = full[:MAX_CHARS]
    return {"excerpt": excerpt, "chars": len(excerpt)}


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"excerpt": "", "error": "usage: extract_pdf_text.py <pdf>"}))
        return
    pdf = Path(sys.argv[1])
    if not pdf.is_file():
        print(json.dumps({"excerpt": "", "error": "file not found"}))
        return
    print(json.dumps(extract(str(pdf)), ensure_ascii=False))


if __name__ == "__main__":
    main()

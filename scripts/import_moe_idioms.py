#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile


DOWNLOAD_PAGE_URL = (
    "https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/"
    "dict_idiomsdict_download.html"
)
DOWNLOAD_BASE_URL = (
    "https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/"
)
ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_FILE = ROOT_DIR / "src" / "lib" / "idioms.ts"

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fetch_bytes(url: str) -> bytes:
    try:
        with urllib.request.urlopen(url) as response:
            return response.read()
    except Exception:
        result = subprocess.run(
            ["curl", "-fsSL", url],
            check=True,
            capture_output=True,
        )
        return result.stdout


def find_latest_zip_path(download_page_html: str) -> str:
    matches = re.findall(r'href="(download/(dict_idioms_\d+_\d+\.zip))"', download_page_html)
    if not matches:
        raise RuntimeError("Could not find official idiom download link.")
    # The page is ordered newest-first; keep the first exact match.
    return matches[0][0]


def load_shared_strings(xlsx_bytes: bytes) -> list[str]:
    with ZipFile(BytesIO(xlsx_bytes)) as xlsx_zip:
        root = ET.fromstring(xlsx_zip.read("xl/sharedStrings.xml"))
    return [
        "".join(text.text or "" for text in item.iterfind(".//a:t", NS))
        for item in root.findall("a:si", NS)
    ]


def cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    value = cell.find("a:v", NS)
    if value is None or value.text is None:
        return ""
    if cell.get("t") == "s":
        return shared_strings[int(value.text)]
    return value.text


def normalize_text(text: str) -> str:
    text = text.replace("_x000D_", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_idioms(xlsx_bytes: bytes) -> list[dict[str, str]]:
    with ZipFile(BytesIO(xlsx_bytes)) as xlsx_zip:
        shared_strings = load_shared_strings(xlsx_bytes)
        sheet_root = ET.fromstring(xlsx_zip.read("xl/worksheets/sheet1.xml"))

    rows = sheet_root.find("a:sheetData", NS)
    if rows is None:
        raise RuntimeError("Worksheet is missing sheetData.")

    records: list[dict[str, str]] = []
    seen_words: set[str] = set()

    for index, row in enumerate(rows.findall("a:row", NS)):
        cells = {
            re.sub(r"\d+", "", cell.get("r", "")): normalize_text(cell_text(cell, shared_strings))
            for cell in row.findall("a:c", NS)
        }

        if index == 0:
            continue

        word = cells.get("B", "")
        meaning = cells.get("L", "") or cells.get("E", "")
        entry_type = cells.get("V", "")

        if entry_type != "主條成語":
            continue
        if len(word) != 4:
            continue
        if not meaning:
            continue
        if word in seen_words:
            continue

        seen_words.add(word)
        records.append({"word": word, "definition": meaning})

    return records


def render_typescript(entries: list[dict[str, str]], source_zip_url: str) -> str:
    header = (
        "// Generated from the Ministry of Education official idiom dataset.\n"
        f"// Source page: {DOWNLOAD_PAGE_URL}\n"
        f"// Source zip: {source_zip_url}\n"
        "// Run `npm run import:idioms:moe` to refresh.\n\n"
    )
    interface_block = (
        "export interface Idiom {\n"
        "  word: string;\n"
        "  definition: string;\n"
        "}\n\n"
    )
    entries_json = json.dumps(entries, ensure_ascii=False, indent=2)
    entries_json = re.sub(r'"word":', "word:", entries_json)
    entries_json = re.sub(r'"definition":', "definition:", entries_json)
    return header + interface_block + f"export const IDIOMS: Idiom[] = {entries_json};\n"


def main() -> None:
    html = fetch_bytes(DOWNLOAD_PAGE_URL).decode("utf-8", errors="ignore")
    zip_path = find_latest_zip_path(html)
    zip_url = DOWNLOAD_BASE_URL + zip_path
    zip_bytes = fetch_bytes(zip_url)

    with ZipFile(BytesIO(zip_bytes)) as zip_file:
        xlsx_name = next(
            (name for name in zip_file.namelist() if name.endswith(".xlsx")),
            None,
        )
        if not xlsx_name:
            raise RuntimeError("Could not find xlsx file inside official zip.")
        xlsx_bytes = zip_file.read(xlsx_name)

    idioms = parse_idioms(xlsx_bytes)
    if len(idioms) < 500:
        raise RuntimeError(f"Expected at least 500 idioms, got {len(idioms)}.")

    OUTPUT_FILE.write_text(render_typescript(idioms, zip_url), encoding="utf-8")
    print(f"Wrote {len(idioms)} idioms to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

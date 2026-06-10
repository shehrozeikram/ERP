#!/usr/bin/env python3
"""Generate client/src/data/sgcOrgChartData.js from the official SGC organogram PDF."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Install PyMuPDF: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path.home() / "Downloads" / "43. Organogram_Working File_01 june 2026.pdf"
OUT_JS = ROOT / "client" / "src" / "data" / "sgcOrgChartData.js"

# PDF node boxes are ~72px wide; organogram uses vertical columns with ~72px spacing
COLUMN_STEP = 72
COLUMN_TOLERANCE = 40
ROW_TOLERANCE = 18
MAX_VERTICAL_GAP = 135
MAX_HORIZONTAL_GAP = 220

SECTIONS = [
    ("pmc", 0, 900, "president"),
    ("taj", 900, 2100, "president"),
    ("spb", 2100, 2750, "president"),
    ("boly", 2750, 3100, "president"),
    ("center", 3100, 3600, "president"),
    ("patron_edu", 3600, 4350, "patron"),
    ("cicon", 4350, 4550, "patron"),
    ("solar", 4450, 4600, "president"),
    ("fresh", 4600, 4750, "president"),
    ("royal", 4750, 5000, "president"),
    ("hotel", 5000, 5350, "president"),
    ("side", 5350, 5868, "president"),
]


def section_for_cx(cx: float) -> tuple[str, str]:
    for name, start, end, root in SECTIONS:
        if start <= cx <= end:
            return name, root
    return "misc", "president"


def column_key(node: dict) -> int:
    """Align columns by box left edge (x0) — matches PDF grid better than center x."""
    return round(node["x0"] / COLUMN_STEP) * COLUMN_STEP


def is_department_row_y(y: float) -> bool:
    """Rows where departments sit side-by-side under a GM / director."""
    return (600 <= y <= 645) or (648 <= y <= 685) or (715 <= y <= 755)


def is_spanning_role(title: str) -> bool:
    lower = title.lower()
    return any(
        key in lower
        for key in (
            "gm ", "general manager", "gm admin", "executive director", "ceo", "coo",
            "avp", "director audit", "coordinator", "president steering",
        )
    )


def horizontal_margin(title: str) -> float:
    if is_spanning_role(title):
        return 380
    lower = title.lower()
    if "hod" in lower or "head of" in lower:
        return 100
    if any(key in lower for key in ("director", "manager", "principal")):
        return 140
    return 70


def extract_nodes(page) -> list[dict]:
    seen: set[tuple[int, int, int, int]] = set()
    rects: list[tuple[float, float, float, float]] = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if not rect or rect.width < 28 or rect.height < 12:
            continue
        if rect.width > 95 or rect.height > 50:
            continue
        key = (round(rect.x0), round(rect.y0), round(rect.x1), round(rect.y1))
        if key in seen or rect.y0 > 2190 or rect.y0 < 15:
            continue
        seen.add(key)
        rects.append(key)

    spans = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if not text:
                    continue
                bbox = span["bbox"]
                spans.append(
                    {
                        "text": text,
                        "cx": (bbox[0] + bbox[2]) / 2,
                        "cy": (bbox[1] + bbox[3]) / 2,
                        "y0": bbox[1],
                        "size": span.get("size", 10),
                    }
                )

    def in_rect(span, rect):
        return rect[0] <= span["cx"] <= rect[2] and rect[1] <= span["cy"] <= rect[3]

    def mkid(title: str, index: int) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
        return f"{slug}-{index}"

    nodes: list[dict] = []
    for index, rect in enumerate(rects):
        texts = sorted([s for s in spans if in_rect(s, rect)], key=lambda s: (s["y0"], s["cx"]))
        if not texts or len(texts) > 6:
            continue

        joined = " ".join(item["text"] for item in texts).lower()
        if len(joined) > 120:
            continue
        vacant = any(word in joined for word in ("vacant", "vacnant", "suspended"))

        if len(texts) == 1:
            title, name = texts[0]["text"], ""
        else:
            big = [item["text"] for item in texts if item["size"] >= 10.5]
            small = [item["text"] for item in texts if item["size"] < 10.5]
            if not big:
                big, small = [texts[0]["text"]], [item["text"] for item in texts[1:]]
            title, name = " ".join(big), " ".join(small)

        for word in ("Vacant", "Vacnant", "Suspended"):
            title = title.replace(word, "").strip()
            name = name.replace(word, "").strip()

        if not title:
            continue
        if name and name in title:
            title = title.replace(name, "").strip()
        title = title.replace("President s", "President's").replace("  ", " ").strip()

        node = {
            "id": mkid(title, index),
            "title": title,
            "name": name,
            "x0": rect[0],
            "y0": rect[1],
            "x1": rect[2],
            "y1": rect[3],
            "cx": (rect[0] + rect[2]) / 2,
            "vacant": vacant,
            "parent_id": None,
            "section": section_for_cx((rect[0] + rect[2]) / 2)[0],
            "root_kind": section_for_cx((rect[0] + rect[2]) / 2)[1],
        }
        node["col"] = column_key(node)
        nodes.append(node)

    return nodes


def ensure_root_nodes(nodes: list[dict]) -> tuple[dict, dict | None]:
    president = {
        "id": "president-sardar-tanveer-ilyas",
        "title": "President",
        "name": "Sardar Tanveer Ilyas",
        "x0": 2793,
        "y0": 239,
        "x1": 3147,
        "y1": 327,
        "cx": 2970,
        "vacant": False,
        "parent_id": None,
        "section": "center",
        "root_kind": "president",
    }
    president["col"] = column_key(president)
    patron = {
        "id": "patron-in-chief-education",
        "title": "Patron-in-Chief (Education)",
        "name": "Admiral Abdul Aziz Mirza (Retd)",
        "x0": 3909,
        "y0": 438,
        "x1": 4068,
        "y1": 464,
        "cx": 3989,
        "vacant": False,
        "parent_id": president["id"],
        "section": "patron_edu",
        "root_kind": "patron",
    }
    patron["col"] = column_key(patron)

    if not any(n["id"] == president["id"] for n in nodes):
        nodes.insert(0, president)
    else:
        for n in nodes:
            if n["id"] == president["id"]:
                n.update({k: president[k] for k in president if k != "id"})
                break

    if not any(n["id"] == patron["id"] for n in nodes):
        nodes.append(patron)
    else:
        for n in nodes:
            if n["id"] == patron["id"]:
                n.update({k: patron[k] for k in patron if k != "id"})
                break

    return president, patron


def same_column(a: dict, b: dict) -> bool:
    return abs(a["col"] - b["col"]) <= COLUMN_TOLERANCE


def assign_parents(nodes: list[dict], president: dict, patron: dict | None) -> None:
    skip = {president["id"], patron["id"] if patron else ""}
    by_col: dict[int, list[dict]] = defaultdict(list)
    for node in nodes:
        if node["id"] in skip:
            continue
        by_col[node["col"]].append(node)

    # 1) Vertical chain within each column (department stacks)
    for col_nodes in by_col.values():
        col_nodes.sort(key=lambda n: n["y0"])
        for i in range(1, len(col_nodes)):
            child = col_nodes[i]
            parent = col_nodes[i - 1]
            gap = child["y0"] - parent["y0"]
            if gap <= MAX_VERTICAL_GAP and same_column(child, parent):
                child["parent_id"] = parent["id"]

    # 2) Horizontal parent — department/HOD rows under GM, Director, etc. (not deep stacks)
    for node in nodes:
        if node["id"] in skip or node["parent_id"]:
            continue
        if not is_department_row_y(node["y0"]):
            continue
        best = None
        best_score = float("inf")
        for cand in nodes:
            if cand["id"] in skip or cand["id"] == node["id"]:
                continue
            if cand["section"] != node["section"] and not is_spanning_role(cand["title"]):
                continue
            dy = node["y0"] - cand["y0"]
            if dy < 5 or dy > 120:
                continue
            margin = horizontal_margin(cand["title"])
            if abs(node["cx"] - cand["cx"]) > margin:
                continue
            score = dy + abs(node["cx"] - cand["cx"]) * 0.08
            if score < best_score:
                best_score = score
                best = cand
        if best:
            node["parent_id"] = best["id"]

    # 2b) Education: Executive Director under Patron; HOD row under Executive Director
    if patron:
        for node in nodes:
            if "executive director" in node["title"].lower() and not node["parent_id"]:
                node["parent_id"] = patron["id"]
        ed = next(
            (
                n
                for n in nodes
                if "executive director" in n["title"].lower()
                and n["section"] in ("patron_edu", "cicon")
                and n["y0"] < 650
            ),
            None,
        )
        if ed:
            for node in nodes:
                if node["section"] not in ("patron_edu", "cicon") or node["parent_id"]:
                    continue
                if 598 <= node["y0"] <= 620 and "hod" in node["title"].lower():
                    node["parent_id"] = ed["id"]

    # 3) Section roots -> President or Patron
    for node in nodes:
        if node["id"] in skip or node["parent_id"]:
            continue
        if node["y0"] > 900:
            continue
        if node["root_kind"] == "patron" and patron:
            node["parent_id"] = patron["id"]
        else:
            node["parent_id"] = president["id"]

    # 4) Same-column orphans only (never attach across columns)
    for node in sorted(nodes, key=lambda n: n["y0"]):
        if node["id"] in skip or node["parent_id"]:
            continue
        best = None
        best_score = float("inf")
        for cand in nodes:
            if cand["id"] in skip or cand["id"] == node["id"]:
                continue
            if not same_column(cand, node):
                continue
            dy = node["y0"] - cand["y0"]
            if dy < 15 or dy > MAX_VERTICAL_GAP:
                continue
            if dy < best_score:
                best_score = dy
                best = cand
        if best:
            node["parent_id"] = best["id"]

    # 5) Still orphaned — attach to Patron or President (avoid cross-column guessing)
    for node in nodes:
        if node["id"] in skip or node["parent_id"]:
            continue
        if node["root_kind"] == "patron" and patron:
            node["parent_id"] = patron["id"]
        else:
            node["parent_id"] = president["id"]


def build_tree(nodes: list[dict]) -> dict:
    president, patron = ensure_root_nodes(nodes)
    assign_parents(nodes, president, patron)

    children: dict[str, list[dict]] = defaultdict(list)
    for node in nodes:
        if node["parent_id"]:
            children[node["parent_id"]].append(node)

    def node_type(title: str) -> str:
        lower = title.lower()
        if lower == "president" or ("patron-in-chief" in lower and "education" in lower):
            return "patron"
        if any(
            key in lower
            for key in (
                "business project", "boly.pk", "taj residencia", "sardar prime",
                "project management", "political team", "research cell", "media cell",
                "president secretariat", "ceo secretariat",
            )
        ):
            return "project"
        if any(
            key in lower
            for key in (
                "human resource", "finance", "legal", "security", "administration",
                "information technology", "internal audit", "sales", "land acquisition",
                "procurement", "vigilance", "commcraft", "campus", "accounts",
                "maintenance", "workshop", "store", "horticulture", "customer care",
                "design services", "town planning", "enforcement", "tenacious",
            )
        ):
            return "department"
        if any(
            key in lower
            for key in (
                "director", "manager", "gm ", "general manager", "hod", "avp", "agm",
                "ceo", "coo", "principal", "vice principal", "executive director",
                "deputy manager", "sr.", "senior", "head", "coordinator", "supervisor",
                "technician", "administrator", "engineer", "officer", "executive",
            )
        ):
            return "management"
        return "staff"

    def to_tree(node: dict) -> dict:
        kids = sorted(children.get(node["id"], []), key=lambda item: (item["x0"], item["y0"]))
        return {
            "id": node["id"],
            "title": node["title"],
            "name": node["name"],
            "type": node_type(node["title"]),
            "isVacant": bool(node["vacant"] or (not node["name"] and "vacant" in node["title"].lower())),
            "children": [to_tree(child) for child in kids],
        }

    return to_tree(president)


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    page = fitz.open(pdf_path)[0]
    nodes = extract_nodes(page)
    chart = build_tree(nodes)

    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JS.open("w", encoding="utf-8") as handle:
        handle.write("/**\n")
        handle.write(" * SGC Organogram — auto-generated from official PDF (01 June 2026)\n")
        handle.write(f" * Source: {pdf_path.name}\n")
        handle.write(" * Regenerate: python3 scripts/generate-org-chart-from-pdf.py\n")
        handle.write(" */\n\n")
        handle.write("export const SGC_ORG_CHART = ")
        json.dump(chart, handle, ensure_ascii=False, indent=2)
        handle.write(";\n\nexport default SGC_ORG_CHART;\n")

    def count_nodes(node: dict) -> int:
        return 1 + sum(count_nodes(child) for child in node.get("children", []))

    print(f"Generated {OUT_JS} ({count_nodes(chart)} nodes)")


if __name__ == "__main__":
    main()

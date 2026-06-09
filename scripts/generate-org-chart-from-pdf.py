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


def extract_nodes(page) -> list[dict]:
    seen: set[tuple[int, int, int, int]] = set()
    rects: list[tuple[float, float, float, float]] = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if not rect or rect.width < 28 or rect.height < 12:
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
        if not texts:
            continue

        joined = " ".join(item["text"] for item in texts).lower()
        vacant = any(word in joined for word in ("vacant", "vacnant", "suspended"))

        if len(texts) == 1:
            title, name = texts[0]["text"], ""
        else:
            big = [item["text"] for item in texts if item["size"] >= 11]
            small = [item["text"] for item in texts if item["size"] < 11]
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

        nodes.append(
            {
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
            }
        )

    return nodes


def build_tree(nodes: list[dict]) -> dict:
    branches = [
        ("pmc", 0, 200),
        ("taj", 200, 1250),
        ("spb", 2100, 2750),
        ("boly", 2750, 3100),
        ("center", 3100, 3600),
        ("patron_edu", 3600, 4200),
        ("cicon", 4200, 4400),
        ("solar", 4380, 4550),
        ("fresh", 4520, 4720),
        ("royal", 4680, 4920),
        ("hotel", 4980, 5300),
        ("side", 5300, 5800),
        ("misc", 0, 6000),
    ]

    for node in nodes:
        node["branch"] = next((name for name, start, end in branches if start <= node["cx"] <= end), "misc")

    branch_rows: dict[str, list[list[dict]]] = defaultdict(list)
    for node in sorted(nodes, key=lambda item: (item["y0"], item["x0"])):
        rows = branch_rows[node["branch"]]
        for row in rows:
            if abs(node["y0"] - row[0]["y0"]) <= 22:
                row.append(node)
                break
        else:
            rows.append([node])

    def parent_in_branch(child, rows, child_row_index):
        best = None
        best_score = float("inf")
        for row_index in range(child_row_index - 1, -1, -1):
            for parent in rows[row_index]:
                delta_y = child["y0"] - parent["y0"]
                if delta_y <= 0:
                    continue
                margin = max(35, (parent["x1"] - parent["x0"]) * 0.25)
                if parent["x0"] - margin <= child["cx"] <= parent["x1"] + margin:
                    score = delta_y + abs(child["cx"] - parent["cx"]) * 0.02
                    if score < best_score:
                        best_score = score
                        best = parent
            if best:
                return best
        for row_index in range(child_row_index - 1, -1, -1):
            for parent in rows[row_index]:
                delta_y = child["y0"] - parent["y0"]
                if delta_y <= 0 or delta_y > 250:
                    continue
                score = delta_y + abs(child["cx"] - parent["cx"]) * 0.1
                if score < best_score:
                    best_score = score
                    best = parent
            if best:
                return best
        return None

    for rows in branch_rows.values():
        for row_index in range(1, len(rows)):
            for child in rows[row_index]:
                parent = parent_in_branch(child, rows, row_index)
                if parent:
                    child["parent_id"] = parent["id"]

    president = next(node for node in nodes if "President" in node["title"] and "Sardar" in node["title"] + node["name"])
    patron = next((node for node in nodes if "Patron-in-Chief" in node["title"] and "Admiral" in node["title"] + node["name"]), None)

    president["parent_id"] = None
    president["title"] = "President"
    president["name"] = "Sardar Tanveer Ilyas"

    if patron:
        patron["parent_id"] = president["id"]
        patron["title"] = "Patron-in-Chief (Education)"
        patron["name"] = "Admiral Abdul Aziz Mirza (Retd)"

    for branch, rows in branch_rows.items():
        if not rows:
            continue
        root = min((node for row in rows for node in row), key=lambda item: item["y0"])
        skip_ids = {president["id"], patron["id"] if patron else ""}
        if root["id"] in skip_ids:
            continue
        if branch in ("patron_edu", "cicon") and patron and root["id"] != patron["id"] and root["y0"] < 850 and root["parent_id"] is None:
            root["parent_id"] = patron["id"]
        elif root["y0"] < 850 and root["parent_id"] is None:
            root["parent_id"] = president["id"]

    children: dict[str, list[dict]] = defaultdict(list)
    for node in nodes:
        if node["parent_id"]:
            children[node["parent_id"]].append(node)

    reachable = set()
    stack = [president["id"]]
    while stack:
        current = stack.pop()
        if current in reachable:
            continue
        reachable.add(current)
        stack.extend(child["id"] for child in children.get(current, []))

    for node in sorted((item for item in nodes if item["id"] not in reachable and item["id"] != president["id"]), key=lambda item: item["y0"]):
        candidates = [parent for parent in nodes if parent["branch"] == node["branch"] and parent["y0"] < node["y0"] and parent["id"] in reachable]
        if not candidates:
            candidates = [parent for parent in nodes if parent["y0"] < node["y0"] and parent["id"] in reachable]
        if candidates:
            parent = min(candidates, key=lambda item: (node["y0"] - item["y0"]) + abs(node["cx"] - item["cx"]) * 0.05)
            node["parent_id"] = parent["id"]
            reachable.add(node["id"])

    children = defaultdict(list)
    for node in nodes:
        if node["parent_id"]:
            children[node["parent_id"]].append(node)

    def node_type(title: str) -> str:
        lower = title.lower()
        if lower == "president" or ("patron-in-chief" in lower and "education" in lower):
            return "patron"
        if any(key in lower for key in (
            "business project", "boly.pk", "taj residencia", "sardar prime builders",
            "project management company", "political team", "research cell", "media cell",
            "president secretariat", "ceo secretariat", "president's research", "president's media",
        )):
            return "project"
        if any(key in lower for key in (
            "human resource", "finance", "legal", "security", "administration",
            "information technology", "internal audit", "sales", "land acquisition", "procurement",
            "vigilance", "commcraft", "campus", "support staff", "accounts", "call center",
            "maintenance", "workshop", "store", "horticulture", "customer care", "design services",
            "town planning", "record & transfer", "facility management", " recovery", "land management",
            "master record", "post sales", "enforcement", "tiges", "tenacious", "sas security",
        )):
            return "department"
        if any(key in lower for key in (
            "director", "manager", "gm ", "general manager", "hod", "avp", "agm", "ceo", "coo",
            "principal", "vice principal", "executive director", "deputy manager", "sr.", "senior",
            "head", "coordinator", "supervisor", "incharge", "in charge", "foreman", "chief",
            "lecturer", "engineer", "architect", "inspector", "officer", "technician", "executive",
            "assistant manager",
        )):
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

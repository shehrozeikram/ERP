#!/usr/bin/env python3
"""
Extract khasra parcel polygons from client/public/maps/latha/latha-map.pdf
and write compact JSON for the interactive Latha map overlay.

Usage:
  python3 scripts/extract-latha-map-shapes.py
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / 'client/public/maps/latha/latha-map.pdf'
OUT_DIR = ROOT / 'client/public/maps/latha'
OUT_INDEX = OUT_DIR / 'latha-map-index.json'

PDF_W = 5184.0
PDF_H = 2520.0

MOUZA_COLORS = {
    (1.0, 0.0, 1.0): 'sheikhpur',
    (1.0, 0.498, 0.0): 'lakhu',
    (0.949, 0.404, 0.133): 'lakhu',
    (0.972, 0.6, 0.118): 'lakhu',
    (0.0, 1.0, 0.0): 'kaak',
    (0.749, 0.498, 1.0): 'rupa',
    (0.0, 1.0, 1.0): 'rupa',
    (0.369, 0.404, 0.686): 'chak-rupa',
    (0.867, 0.0, 0.0): 'narhala',
}


def rgb_key(color):
    if not color:
        return None
    return tuple(round(float(x), 3) for x in color[:3])


def drawing_to_points(drawing):
    points = []
    for item in drawing.get('items', []):
        op = item[0]
        if op == 'l' and len(item) >= 3:
            p1, p2 = item[1], item[2]
            if not points:
                points.append((p1.x, p1.y))
            points.append((p2.x, p2.y))
        elif op == 're' and len(item) >= 2:
            rect = item[1]
            points.extend([
                (rect.x0, rect.y0),
                (rect.x1, rect.y0),
                (rect.x1, rect.y1),
                (rect.x0, rect.y1),
            ])
    return points


def bbox_area(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def centroid(points):
    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def point_in_poly(px, py, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def simplify_points(points, max_points=24):
    if len(points) <= max_points:
        return points
    step = max(1, len(points) // max_points)
    simplified = points[::step]
    if simplified[0] != points[0]:
        simplified.insert(0, points[0])
    if simplified[-1] != points[-1]:
        simplified.append(points[-1])
    return simplified


def round_points(points):
    return [[round(x), round(y)] for x, y in points]


def main():
    if not PDF_PATH.exists():
        raise SystemExit(f'PDF not found: {PDF_PATH}')

    doc = fitz.open(str(PDF_PATH))
    page = doc[0]

    boundaries = []
    for drawing in page.get_drawings():
        fill = rgb_key(drawing.get('fill'))
        mouza = MOUZA_COLORS.get(fill)
        if not mouza:
            continue
        points = drawing_to_points(drawing)
        if bbox_area(points) < 50000:
            continue
        boundaries.append({'m': mouza, 'pts': points})

    labels = []
    for block in page.get_text('dict').get('blocks', []):
        if block.get('type') != 0:
            continue
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                text = (span.get('text') or '').strip()
                if not text or not text.replace('.', '').isdigit():
                    continue
                bbox = span.get('bbox')
                labels.append({
                    't': text,
                    'x': (bbox[0] + bbox[2]) / 2,
                    'y': (bbox[1] + bbox[3]) / 2,
                })

    parcels_by_mouza: dict[str, list] = defaultdict(list)
    seen_keys = set()

    for drawing in page.get_drawings():
        fill = rgb_key(drawing.get('fill'))
        points = drawing_to_points(drawing)
        if len(points) < 3:
            continue
        area = bbox_area(points)
        if area < 15 or area > 120000:
            continue

        cx, cy = centroid(points)
        mouza = MOUZA_COLORS.get(fill) if fill else None
        if not mouza:
            for boundary in boundaries:
                if point_in_poly(cx, cy, boundary['pts']):
                    mouza = boundary['m']
                    break

        khasra_no = None
        best_dist = 1e9
        for label in labels:
            dx = label['x'] - cx
            dy = label['y'] - cy
            dist = dx * dx + dy * dy
            if dist < best_dist and dist < 600:
                best_dist = dist
                khasra_no = label['t']

        key = (mouza or 'unknown', khasra_no or f'{round(cx)}:{round(cy)}')
        if key in seen_keys:
            continue
        seen_keys.add(key)

        parcel = {
            'p': round_points(simplify_points(points)),
            'cx': round(cx),
            'cy': round(cy),
        }
        if khasra_no:
            parcel['k'] = khasra_no

        parcels_by_mouza[mouza or 'unknown'].append(parcel)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    mouza_files = {}
    total = 0
    for mouza, parcels in sorted(parcels_by_mouza.items()):
        filename = f'latha-shapes-{mouza}.json'
        path = OUT_DIR / filename
        with path.open('w', encoding='utf-8') as fh:
            json.dump({'mouza': mouza, 'parcels': parcels}, fh, separators=(',', ':'))
        mouza_files[mouza] = filename
        total += len(parcels)
        print(f'  {mouza}: {len(parcels)} parcels -> {filename} ({path.stat().st_size // 1024} KB)')

    index = {
        'viewBox': [PDF_W, PDF_H],
        'pngSize': [6480, 3150],
        'mouzaFiles': mouza_files,
        'totalParcels': total,
        'mouzaLegend': {
            'sheikhpur': '#9C27B0',
            'kaak': '#2E7D32',
            'lakhu': '#EF6C00',
            'rupa': '#0288D1',
            'chak-rupa': '#1565C0',
            'narhala': '#C62828',
            'unknown': '#9E9E9E',
        },
    }
    with OUT_INDEX.open('w', encoding='utf-8') as fh:
        json.dump(index, fh, indent=2)

    print(f'\nWrote index ({total} parcels) -> {OUT_INDEX}')


if __name__ == '__main__':
    main()

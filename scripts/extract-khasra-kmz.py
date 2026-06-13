#!/usr/bin/env python3
"""
Convert docs/Khasra Plan.kmz into compact GeoJSON for the Latha Leaflet map.

Builds filled khasra parcel polygons from survey lines (via shapely polygonize).

Usage:
  python3 scripts/extract-khasra-kmz.py

Requires:
  scripts/.venv with shapely (see scripts/requirements-kmz.txt)
"""
from __future__ import annotations

import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KMZ_PATH = ROOT / 'docs/Khasra Plan.kmz'
OUT_DIR = ROOT / 'client/public/maps/latha'
OUT_INDEX = OUT_DIR / 'khasra-map-index.json'
OUT_POINTS = OUT_DIR / 'khasra-points.json'
OUT_LINES = OUT_DIR / 'khasra-lines.json'
OUT_AREAS = OUT_DIR / 'khasra-areas.json'
OUT_PARCELS = OUT_DIR / 'khasra-parcels.json'
PUBLIC_KMZ = OUT_DIR / 'khasra-plan.kmz'
VENV_PYTHON = ROOT / 'scripts/.venv/bin/python'

MAX_PARCEL_AREA = 5e-6
MIN_PARCEL_AREA = 1e-12
SIMPLIFY_TOLERANCE = 0.000008

NS = {'k': 'http://www.opengis.net/kml/2.2'}


def ensure_shapely():
    try:
        from shapely.geometry import LineString, Point  # noqa: F401
        from shapely.ops import polygonize, unary_union  # noqa: F401
        from shapely import STRtree  # noqa: F401
        return True
    except ImportError:
        if VENV_PYTHON.exists():
            import subprocess
            subprocess.check_call([str(VENV_PYTHON), str(Path(__file__).resolve())])
            raise SystemExit(0)
        raise SystemExit(
            'shapely is required. Run:\n'
            '  python3 -m venv scripts/.venv\n'
            '  scripts/.venv/bin/pip install -r scripts/requirements-kmz.txt\n'
            '  scripts/.venv/bin/python scripts/extract-khasra-kmz.py'
        )


def round_coord(lon: float, lat: float, prec: int = 6) -> list[float]:
    return [round(lon, prec), round(lat, prec)]


def parse_coords(text: str, prec: int = 6) -> list[list[float]]:
    coords = []
    for trip in (text or '').split():
        parts = trip.split(',')
        if len(parts) < 2:
            continue
        try:
            coords.append(round_coord(float(parts[0]), float(parts[1]), prec))
        except ValueError:
            continue
    return coords


def folder_name(folder: ET.Element) -> str:
    el = folder.find('k:name', NS)
    return (el.text or '').strip() if el is not None else ''


def load_kml() -> ET.Element:
    if not KMZ_PATH.exists():
        raise SystemExit(f'KMZ not found: {KMZ_PATH}')

    with zipfile.ZipFile(KMZ_PATH) as zf:
        kml_name = next((n for n in zf.namelist() if n.lower().endswith('.kml')), None)
        if not kml_name:
            raise SystemExit('No KML file inside KMZ')
        kml_bytes = zf.read(kml_name)

    root = ET.fromstring(kml_bytes)
    doc = root.find('k:Document', NS)
    if doc is None:
        raise SystemExit('Invalid KML: missing Document')
    return doc


def bounds_from_coords(all_coords: list[list[float]]) -> dict:
    lons = [c[0] for c in all_coords]
    lats = [c[1] for c in all_coords]
    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)
    return {
        'south': round(south, 6),
        'west': round(west, 6),
        'north': round(north, 6),
        'east': round(east, 6),
        'center': [round((south + north) / 2, 6), round((west + east) / 2, 6)],
    }


def poly_to_geojson(poly, khasra: str) -> dict:
    simplified = poly.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
    if simplified.is_empty:
        simplified = poly
    exterior = [round_coord(x, y) for x, y in simplified.exterior.coords]
    if exterior[0] != exterior[-1]:
        exterior.append(exterior[0])
    centroid = simplified.centroid
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [exterior],
        },
        'properties': {
            'k': khasra,
            'cx': round(centroid.x, 6),
            'cy': round(centroid.y, 6),
        },
    }


def build_khasra_parcels(point_features: list[dict], line_features: list[dict]) -> list[dict]:
    from shapely.geometry import LineString, Point
    from shapely.ops import polygonize, unary_union
    from shapely import STRtree

    lines = []
    for feature in line_features:
        coords = feature['geometry']['coordinates']
        if len(coords) >= 2:
            lines.append(LineString([(c[0], c[1]) for c in coords]))

    if not lines:
        return []

    print('  polygonizing survey lines…')
    polys = [p for p in polygonize(unary_union(lines)) if MIN_PARCEL_AREA < p.area <= MAX_PARCEL_AREA]
    if not polys:
        return []

    spatial_index = STRtree(polys)
    parcel_features = []
    seen_khasra = set()

    for feature in point_features:
        khasra = feature['properties'].get('k')
        if not khasra:
            continue
        lon, lat = feature['geometry']['coordinates']
        point = Point(lon, lat)
        candidates = [polys[i] for i in spatial_index.query(point) if polys[i].contains(point)]
        if not candidates:
            continue
        parcel = min(candidates, key=lambda item: item.area)
        norm_key = khasra.strip()
        if norm_key in seen_khasra:
            continue
        seen_khasra.add(norm_key)
        parcel_features.append(poly_to_geojson(parcel, khasra))

    return parcel_features


def main() -> None:
    ensure_shapely()

    doc = load_kml()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    point_features = []
    line_features = []
    area_features = []
    all_coords: list[list[float]] = []

    for folder in doc.findall('k:Folder', NS):
        fname = folder_name(folder)
        for placemark in folder.findall('k:Placemark', NS):
            name_el = placemark.find('k:name', NS)
            khasra = (name_el.text or '').strip() if name_el is not None else ''

            point = placemark.find('k:Point', NS)
            if point is not None and fname == 'Point Features':
                coord_el = point.find('k:coordinates', NS)
                coords = parse_coords(coord_el.text if coord_el is not None else '')
                if not coords or not khasra:
                    continue
                lon, lat = coords[0]
                all_coords.append([lon, lat])
                point_features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                    'properties': {'k': khasra},
                })
                continue

            line = placemark.find('k:LineString', NS)
            if line is not None and fname == 'Line Features':
                coord_el = line.find('k:coordinates', NS)
                coords = parse_coords(coord_el.text if coord_el is not None else '')
                if len(coords) < 2:
                    continue
                all_coords.extend(coords)
                line_features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'LineString', 'coordinates': coords},
                    'properties': {},
                })
                continue

            polygon = placemark.find('k:Polygon', NS)
            if polygon is not None and fname == 'Area Features':
                coord_el = polygon.find('.//k:coordinates', NS)
                coords = parse_coords(coord_el.text if coord_el is not None else '')
                if len(coords) < 3:
                    continue
                all_coords.extend(coords)
                ring = coords if coords[0] == coords[-1] else coords + [coords[0]]
                area_features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Polygon', 'coordinates': [ring]},
                    'properties': {'k': khasra} if khasra else {},
                })

    if not all_coords:
        raise SystemExit('No coordinates found in KMZ')

    parcel_features = build_khasra_parcels(point_features, line_features)

    index = {
        'source': 'docs/Khasra Plan.kmz',
        'bounds': bounds_from_coords(all_coords),
        'counts': {
            'points': len(point_features),
            'lines': len(line_features),
            'areas': len(area_features),
            'parcels': len(parcel_features),
            'uniqueKhasraLabels': len({f['properties']['k'] for f in point_features}),
        },
        'files': {
            'points': OUT_POINTS.name,
            'lines': OUT_LINES.name,
            'areas': OUT_AREAS.name,
            'parcels': OUT_PARCELS.name,
            'kmz': PUBLIC_KMZ.name,
        },
    }

    for path, features in (
        (OUT_POINTS, point_features),
        (OUT_LINES, line_features),
        (OUT_AREAS, area_features),
        (OUT_PARCELS, parcel_features),
    ):
        with path.open('w', encoding='utf-8') as fh:
            json.dump({'type': 'FeatureCollection', 'features': features}, fh, separators=(',', ':'))

    with OUT_INDEX.open('w', encoding='utf-8') as fh:
        json.dump(index, fh, indent=2)

    PUBLIC_KMZ.write_bytes(KMZ_PATH.read_bytes())

    print(f'  points:  {len(point_features)} -> {OUT_POINTS.name}')
    print(f'  lines:   {len(line_features)} -> {OUT_LINES.name}')
    print(f'  areas:   {len(area_features)} -> {OUT_AREAS.name}')
    print(f'  parcels: {len(parcel_features)} -> {OUT_PARCELS.name}')
    print(f'  kmz copy -> {PUBLIC_KMZ.name}')
    print(f'  index -> {OUT_INDEX}')


if __name__ == '__main__':
    main()

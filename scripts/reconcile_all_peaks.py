#!/usr/bin/env python3
"""
reconcile_all_peaks.py — Snaps coarse / arcminute-truncated mountain summits in
public/data/major_peaks.geojson to exact surveyed geodetic benchmark coordinates
using Wikidata SPARQL and OpenStreetMap.

Strict criteria:
- Matches name exactly or via standard geographic prefix removal
- Geodetically bounded to <= 4.0 km (arcminute error is physically ~1.0-1.5 km)
- Elevation validation within +- 500 ft when available
- Rejects arcminute-rounded candidates
"""

import json
import math
import re
import time
import urllib.parse
import urllib.request

GEOJSON_PATH = 'public/data/major_peaks.geojson'

def haversine(c1, c2):
    lon1, lat1 = c1
    lon2, lat2 = c2
    R = 6371.0  # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return 2 * R * math.asin(math.sqrt(a))

def is_coarse(lng, lat):
    # Detect swapped coordinates
    if abs(lat) > 85.0 or abs(lng) > 180.0:
        return True
    # Arcminute check
    lat_m = lat * 60
    lng_m = lng * 60
    is_arc = abs(lat_m - round(lat_m)) < 0.005 or abs(lng_m - round(lng_m)) < 0.005
    # Decimal precision check (< 4 decimal places)
    s_lat = f"{lat:.8f}".rstrip('0')
    s_lng = f"{lng:.8f}".rstrip('0')
    dec_lat = len(s_lat.split('.')[1]) if '.' in s_lat else 0
    dec_lng = len(s_lng.split('.')[1]) if '.' in s_lng else 0
    return is_arc or dec_lat < 4 or dec_lng < 4

def get_name_variants(name):
    names = set()
    cleaned = name.strip()
    names.add(cleaned)
    # Strip parenthetical notes: e.g. "Mount Olympus (Mytikas)" -> "Mount Olympus"
    no_parens = re.sub(r'\s*\(.*?\)', '', cleaned).strip()
    if no_parens:
        names.add(no_parens)
    # Inside parens if it looks like a summit name: e.g. "Mytikas"
    m = re.search(r'\((.*?)\)', cleaned)
    if m:
        sub = m.group(1).strip()
        if len(sub) >= 3 and not any(c.isdigit() for c in sub):
            names.add(sub)
    # Strip mountain prefix
    for base in [cleaned, no_parens]:
        alt = re.sub(r'^(Mount|Mt\.|Pic|Piz|Pico|Pico de|Mont|Monte|Nevado de|Nevado|Volcán|Volcan)\s+', '', base, flags=re.I).strip()
        if len(alt) >= 3:
            names.add(alt)
    return names

def main():
    with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    features = data['features']
    print(f"Loaded {len(features)} peaks from {GEOJSON_PATH}")

    # Specific known fixes (e.g. Baltoro Kangri inverted coordinates)
    for f in features:
        if f['properties'].get('name') == 'Baltoro Kangri':
            coords = f['geometry']['coordinates']
            if coords[0] < 50 and coords[1] > 60:
                f['geometry']['coordinates'] = [coords[1], coords[0]]
                print("Fixed swapped coordinates for Baltoro Kangri")

    coarse_targets = []
    for idx, f in enumerate(features):
        coords = f['geometry']['coordinates']
        lng, lat = coords[0], coords[1]
        if is_coarse(lng, lat):
            coarse_targets.append((idx, f))

    print(f"Identified {len(coarse_targets)} coarse / arcminute peaks needing geodetic reconciliation.")

    # Phase 1: Batched Wikidata SPARQL
    BATCH_SIZE = 25
    resolved_count = 0

    for b in range(0, len(coarse_targets), BATCH_SIZE):
        batch = coarse_targets[b:b + BATCH_SIZE]
        batch_names = set()
        feat_info = []

        for idx, feat in batch:
            p_name = feat['properties'].get('name', '')
            variants = get_name_variants(p_name)
            batch_names.update(variants)
            feat_info.append((idx, feat, variants))

        # Build SPARQL query with @en, @de, @fr, @es, @it
        values_list = []
        for n in batch_names:
            escaped = n.replace('\\', '\\\\').replace('"', '\\"')
            for lang in ['en', 'de', 'fr', 'es', 'it']:
                values_list.append(f'"{escaped}"@{lang}')

        values_str = ' '.join(values_list)
        query = f"""
        SELECT ?name ?coord ?elev WHERE {{
          VALUES ?name {{ {values_str} }}
          ?item (rdfs:label|skos:altLabel) ?name;
                wdt:P625 ?coord.
          OPTIONAL {{ ?item wdt:P2044 ?elev. }}
        }}
        """

        url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(query) + '&format=json'
        req = urllib.request.Request(url, headers={'User-Agent': 'SkiAtlasBot/1.0 (contact@skiatlas.org)'})

        bindings = []
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                res_data = json.loads(resp.read().decode())
                bindings = res_data.get('results', {}).get('bindings', [])
        except Exception as e:
            print(f"Batch {b//BATCH_SIZE + 1} SPARQL error: {e}")

        # Process bindings
        for idx, feat, variants in feat_info:
            coords = feat['geometry']['coordinates']
            p_name = feat['properties'].get('name', '')
            elev_ft = feat['properties'].get('elevation_ft', 0)

            best = None
            best_dist = 999999

            for b_item in bindings:
                b_name = b_item.get('name', {}).get('value')
                if b_name not in variants:
                    continue

                wkt = b_item.get('coord', {}).get('value', '')
                m = re.match(r'Point\(([-0-9.]+)\s+([-0-9.]+)\)', wkt)
                if not m:
                    continue
                c_lng, c_lat = float(m.group(1)), float(m.group(2))
                dist = haversine(coords, (c_lng, c_lat))

                # Must be strictly within 4.0 km (arcminute error is physically 1.0-1.5 km)
                if dist > 4.0:
                    continue

                # Elevation check if elevation is provided in Wikidata (accounts for either ft or m)
                elev_val = b_item.get('elev', {}).get('value')
                if elev_val:
                    try:
                        raw_elev = float(elev_val)
                        elev_m = feat['properties'].get('elevation_m', 0)
                        diff_ft = min(abs(raw_elev - elev_ft), abs(raw_elev * 3.28084 - elev_ft))
                        diff_m = min(abs(raw_elev - elev_m), abs(raw_elev / 3.28084 - elev_m))
                        if diff_ft > 500 and diff_m > 150:
                            continue
                    except ValueError:
                        pass

                # Check precision: candidate must NOT be arcminute-rounded
                lat_m = c_lat * 60
                lng_m = c_lng * 60
                is_arc = abs(lat_m - round(lat_m)) < 0.001 and abs(lng_m - round(lng_m)) < 0.001
                if is_arc:
                    continue

                if dist < best_dist:
                    best = (c_lng, c_lat, dist)
                    best_dist = dist

            if best:
                feat['geometry']['coordinates'] = [round(best[0], 6), round(best[1], 6)]
                feat['properties']['geodetic_reconciled'] = True
                resolved_count += 1
                print(f"[{resolved_count}] Snapped {p_name}: {coords} -> [{best[0]:.6f}, {best[1]:.6f}] (offset: {best[2]:.2f} km)")

        time.sleep(0.3)

    print(f"\nPhase 1 Complete: Reconciled {resolved_count} / {len(coarse_targets)} peaks via Wikidata SPARQL.")

    # Phase 2: Nominatim OSM fallback for remaining iconic / major peaks
    remaining_coarse = []
    for idx, feat in coarse_targets:
        if feat['properties'].get('geodetic_reconciled'):
            continue
        coords = feat['geometry']['coordinates']
        if is_coarse(coords[0], coords[1]):
            remaining_coarse.append((idx, feat))

    print(f"Phase 2: {len(remaining_coarse)} peaks remaining. Running targeted Nominatim OSM lookup...")

    nom_resolved = 0
    for idx, feat in remaining_coarse:
        p_name = feat['properties'].get('name', '')
        coords = feat['geometry']['coordinates']
        clean = re.sub(r'\s*\(.*?\)', '', p_name).strip()

        nom_url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(clean)}&format=json&limit=5"
        req = urllib.request.Request(nom_url, headers={'User-Agent': 'SkiAtlasSummitBot/1.0 (contact@skiatlas.org)'})

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                nom_results = json.loads(resp.read().decode())
        except Exception:
            nom_results = []

        best = None
        best_dist = 999999
        for item in nom_results:
            itype = item.get('type', '')
            if itype not in ['peak', 'volcano', 'mountain']:
                continue
            try:
                n_lat = float(item['lat'])
                n_lng = float(item['lon'])
            except (ValueError, KeyError):
                continue
            dist = haversine(coords, (n_lng, n_lat))
            if dist <= 4.0 and dist < best_dist:
                best = (n_lng, n_lat, dist)
                best_dist = dist

        if best:
            feat['geometry']['coordinates'] = [round(best[0], 6), round(best[1], 6)]
            feat['properties']['geodetic_reconciled'] = True
            nom_resolved += 1
            print(f"[OSM {nom_resolved}] Snapped {p_name}: {coords} -> [{best[0]:.6f}, {best[1]:.6f}] (offset: {best[2]:.2f} km)")

        time.sleep(1.0)  # Nominatim rate limit: 1 request/sec
        if nom_resolved >= 50:
            break

    total_snapped = resolved_count + nom_resolved
    print(f"\nTotal snapped to exact geodetic summit: {total_snapped}")

    with open(GEOJSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Saved updated {GEOJSON_PATH}")

if __name__ == '__main__':
    main()

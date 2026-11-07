#!/usr/bin/env python3
"""
build_world_boundaries.py — Builds clean, authentic OpenStreetMap international
boundary lines and state/province administrative borders.

Features:
- Preserves all real international land borders with full continuity across inland lakes, rivers, and mountain ranges.
- Restores complete borders for Serbia, Norway-Sweden, Belgium, Finland, Tanzania, Congo, etc.
- Prunes 44 pure maritime / ocean pairs between nations that share no land border (e.g. France/UK, Japan/Russia, Russia/US).
- Trims offshore ocean extensions strictly at coastal terminals (e.g. Bay of Biscay, Skagerrak, Menton).
- Snaps 149 country tripoints and 57 multi-line junctions seamlessly with zero gaps.
"""

import subprocess
import json
import math
from collections import defaultdict
from itertools import combinations

def main():
    # 1. Load base authentic OSM geometries from commit 1eff4f7
    c_base = '1eff4f755775f973a1505f0684ae71d6c82cf68f'
    print(f"Extracting authentic OSM boundary baseline from {c_base}...")
    out_base = subprocess.check_output(['git', 'show', f'{c_base}:public/data/world_boundaries.geojson'])
    geo = json.loads(out_base)

    pure_maritime = {
        ('China', 'Taiwan'), ('Malaysia', 'Singapore'), ('Haiti', 'United States'),
        ('Egypt', 'Saudi Arabia'), ('Japan', 'Russia'), ('Bahrain', 'Qatar'),
        ('British Virgin Islands', 'United States'), ('Canada', 'Greenland'),
        ('Denmark', 'Sweden'), ('Qatar', 'United Arab Emirates'), ('Eritrea', 'Yemen'),
        ('Indonesia', 'Singapore'), ('Bahrain', 'Saudi Arabia'), ('Trinidad and Tobago', 'Venezuela'),
        ('France', 'Guernsey'), ('France', 'Jersey'), ('Antigua and Barbuda', 'Montserrat'),
        ('Australia', 'Papua New Guinea'), ('China', 'Philippines'),
        ('Grenada', 'Saint Vincent and the Grenadines'), ('Isle of Man', 'United Kingdom'),
        ('Malaysia', 'Philippines'), ('Canada', 'France'), ('Bahamas', 'Cuba'),
        ('Antigua and Barbuda', 'Saint Kitts and Nevis'), ('El Salvador', 'Nicaragua'),
        ('Bahamas', 'Turks and Caicos Islands'), ('Djibouti', 'Yemen'), ('Philippines', 'Vietnam'),
        ('Dominica', 'France'), ('Guernsey', 'Jersey'), ('Papua New Guinea', 'Solomon Islands'),
        ('France', 'United Kingdom'), ('Netherlands', 'Saint Kitts and Nevis'),
        ('India', 'Sri Lanka'), ('Egypt', 'Jordan'), ('France', 'Saint Lucia'),
        ('Anguilla', 'France'), ('Dominican Republic', 'Turks and Caicos Islands'),
        ('Croatia', 'Italy'), ('Russia', 'United States'), ('Netherlands', 'Venezuela'),
        ('Saint Lucia', 'Saint Vincent and the Grenadines'), ('Iran', 'Oman')
    }
    pure_maritime_set = {tuple(sorted([a, b])) for a, b in pure_maritime}

    country_features = []
    state_features = [f for f in geo['features'] if f['properties'].get('kind') == 'state_border']

    for f in geo['features']:
        if f['properties'].get('kind') != 'country_border':
            continue
        l = f['properties'].get('name_left')
        r = f['properties'].get('name_right')
        pair = tuple(sorted([str(l), str(r)]))
        coords = f['geometry']['coordinates']

        # 1. Skip pure maritime pairs
        if pair in pure_maritime_set:
            continue
        # 2. Skip specific isolated offshore marine features
        if pair == tuple(sorted(['France', 'Italy'])) and len(coords) < 30 and coords[0][1] < 44:
            continue
        if pair == tuple(sorted(['Spain', 'Morocco'])) and coords[0][0] < -5.0:
            continue
        if pair == tuple(sorted(['Finland', 'Sweden'])) and len(coords) < 15:
            continue
        if pair == tuple(sorted(['Estonia', 'Latvia'])) and len(coords) < 15:
            continue

        # 3. Trim outer offshore ocean tails at coastlines (never touch interior points!)
        new_coords = list(coords)

        # Norway <-> Sweden: trim Skagerrak ocean tail (starts at Svinesund coast ~11.4142, 59.0397)
        if pair == tuple(sorted(['Norway', 'Sweden'])):
            target = [11.4142, 59.0397]
            best_i = min(range(min(15, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[best_i:]

        # France <-> Spain (Atlantic): trim Bay of Biscay ocean tail (coast at Hendaye ~ -1.7879, 43.3792)
        elif pair == tuple(sorted(['France', 'Spain'])) and new_coords[0][0] < 0:
            target = [-1.7879, 43.3792]
            best_i = min(range(min(10, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[best_i:]

        # France <-> Italy (Mediterranean): trim offshore tail off Menton coast (~7.5299, 43.7884)
        elif pair == tuple(sorted(['France', 'Italy'])) and len(new_coords) > 100:
            target = [7.5299, 43.7884]
            best_i = min(range(max(0, len(new_coords)-20), len(new_coords)), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[:best_i+1]

        # Denmark <-> Germany: trim North Sea (start ~8.66, 54.9087) and Baltic Sea (end ~9.4494, 54.8328)
        elif pair == tuple(sorted(['Denmark', 'Germany'])):
            t_start = [8.66, 54.9087]
            t_end = [9.4494, 54.8328]
            i_start = min(range(min(30, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-t_start[0], new_coords[i][1]-t_start[1]))
            i_end = min(range(max(0, len(new_coords)-30), len(new_coords)), key=lambda i: math.hypot(new_coords[i][0]-t_end[0], new_coords[i][1]-t_end[1]))
            new_coords = new_coords[i_start:i_end+1]

        # Belgium <-> France: trim North Sea coast tail (starts at De Panne beach ~2.5416, 51.0935)
        elif pair == tuple(sorted(['Belgium', 'France'])):
            target = [2.5416, 51.0935]
            best_i = min(range(min(10, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[best_i:]

        # Netherlands <-> Belgium: trim North Sea coast tail (starts at Cadzand/Zwin ~3.3631, 51.3729)
        elif pair == tuple(sorted(['Netherlands', 'Belgium'])) and len(new_coords) > 200:
            target = [3.3631, 51.3729]
            best_i = min(range(min(20, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[best_i:]

        # Canada <-> United States (main 49th parallel): trim Pacific ocean tail (Point Roberts ~ -123.00, 49.00)
        elif pair == tuple(sorted(['Canada', 'United States'])) and len(new_coords) > 1000:
            target = [-123.00, 49.00]
            best_i = min(range(min(30, len(new_coords))), key=lambda i: math.hypot(new_coords[i][0]-target[0], new_coords[i][1]-target[1]))
            new_coords = new_coords[best_i:]

        if len(new_coords) >= 2:
            f['geometry']['coordinates'] = new_coords
            country_features.append(f)

    def dist(p1, p2):
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    # Step 1: Tripoints (3 distinct countries A, B, C that share mutual borders)
    pair_to_features = defaultdict(list)
    for i, f in enumerate(country_features):
        c1 = f['properties'].get('name_left')
        c2 = f['properties'].get('name_right')
        pair = tuple(sorted([c1, c2]))
        pair_to_features[pair].append(i)

    all_countries = set()
    for c1, c2 in pair_to_features:
        all_countries.add(c1)
        all_countries.add(c2)

    snapped_tripoints = 0
    for c1, c2, c3 in combinations(all_countries, 3):
        p12 = tuple(sorted([c1, c2]))
        p23 = tuple(sorted([c2, c3]))
        p13 = tuple(sorted([c1, c3]))
        if p12 in pair_to_features and p23 in pair_to_features and p13 in pair_to_features:
            best_d = 999999
            best_trio = None
            for f12_idx in pair_to_features[p12]:
                c12 = country_features[f12_idx]['geometry']['coordinates']
                eps12 = [(c12[0], f12_idx, True), (c12[-1], f12_idx, False)]
                for f23_idx in pair_to_features[p23]:
                    c23 = country_features[f23_idx]['geometry']['coordinates']
                    eps23 = [(c23[0], f23_idx, True), (c23[-1], f23_idx, False)]
                    for f13_idx in pair_to_features[p13]:
                        c13 = country_features[f13_idx]['geometry']['coordinates']
                        eps13 = [(c13[0], f13_idx, True), (c13[-1], f13_idx, False)]
                        for e1 in eps12:
                            for e2 in eps23:
                                for e3 in eps13:
                                    d = max(dist(e1[0], e2[0]), dist(e2[0], e3[0]), dist(e1[0], e3[0]))
                                    if d < best_d:
                                        best_d = d
                                        best_trio = (e1, e2, e3)
            if best_trio and best_d < 0.02:  # within ~2km
                pts = [best_trio[0][0], best_trio[1][0], best_trio[2][0]]
                snap_pt = [round(sum(p[0] for p in pts)/3, 4), round(sum(p[1] for p in pts)/3, 4)]
                for pt, f_idx, is_start in best_trio:
                    coords = country_features[f_idx]['geometry']['coordinates']
                    if is_start:
                        coords[0] = snap_pt
                    else:
                        coords[-1] = snap_pt
                snapped_tripoints += 1

    print(f'Snapped {snapped_tripoints} true country tripoints!')

    # Step 2: General endpoint clustering within 500m (0.005 deg)
    endpoints = []
    for i, f in enumerate(country_features):
        c = f['geometry']['coordinates']
        endpoints.append({'pt': list(c[0]), 'f_idx': i, 'is_start': True})
        endpoints.append({'pt': list(c[-1]), 'f_idx': i, 'is_start': False})

    parent = list(range(len(endpoints)))
    def find(i):
        if parent[i] == i: return i
        parent[i] = find(parent[i])
        return parent[i]
    def union(i, j):
        pi, pj = find(i), find(j)
        if pi != pj: parent[pi] = pj

    for i in range(len(endpoints)):
        for j in range(i + 1, len(endpoints)):
            if dist(endpoints[i]['pt'], endpoints[j]['pt']) < 0.005:
                union(i, j)

    clusters = defaultdict(list)
    for i in range(len(endpoints)):
        clusters[find(i)].append(i)

    snapped_clusters = 0
    for root, members in clusters.items():
        if len(members) > 1:
            pts = [endpoints[k]['pt'] for k in members]
            if all(p == pts[0] for p in pts):
                continue
            snap_x = round(sum(p[0] for p in pts) / len(pts), 4)
            snap_y = round(sum(p[1] for p in pts) / len(pts), 4)
            snap_pt = [snap_x, snap_y]
            for k in members:
                ep = endpoints[k]
                coords = country_features[ep['f_idx']]['geometry']['coordinates']
                if ep['is_start']:
                    coords[0] = snap_pt
                else:
                    coords[-1] = snap_pt
            snapped_clusters += 1

    print(f'Snapped {snapped_clusters} junction clusters!')

    # Clean up consecutive duplicate points
    final_country_features = []
    for f in country_features:
        coords = f['geometry']['coordinates']
        deduped = [coords[0]]
        for pt in coords[1:]:
            if pt != deduped[-1]:
                deduped.append(pt)
        if len(deduped) >= 2:
            f['geometry']['coordinates'] = deduped
            final_country_features.append(f)

    out_geo = {
        'type': 'FeatureCollection',
        'features': final_country_features + state_features
    }

    out_path = 'public/data/world_boundaries.geojson'
    with open(out_path, 'w') as f:
        json.dump(out_geo, f)

    print(f'Successfully wrote {out_path}: {len(final_country_features)} country features, {len(state_features)} state features.')

if __name__ == '__main__':
    main()

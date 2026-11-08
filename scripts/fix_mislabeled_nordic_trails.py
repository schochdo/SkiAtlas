import json
import os

def clean_trails():
    with open('public/data/global_ski_areas.json') as f:
        areas = json.load(f)['features']

    nordic_ids = set(a['properties']['id'] for a in areas if a['properties'].get('category') == 'nordic')

    trail_dir = 'public/data/trails'
    files = sorted(os.listdir(trail_dir))

    total_hike_fixed = 0
    total_nordic_center_fixed = 0
    files_modified = 0

    for fname in files:
        if not fname.endswith('.json'):
            continue
        path = os.path.join(trail_dir, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                d = json.load(f)
        except Exception as e:
            continue

        rid = fname.replace('.json', '')
        is_nordic_center = rid in nordic_ids
        file_modified = False

        for feat in d.get('features', []):
            p = feat.get('properties', {})
            uses = p.get('uses') or []
            ptype = p.get('piste:type')

            # 1. Trail has uses including hike/nordic without downhill, but ptype was downhill
            if ptype == 'downhill' and (('hike' in uses and 'downhill' not in uses) or ('nordic' in uses and 'downhill' not in uses)):
                p['piste:type'] = 'nordic'
                total_hike_fixed += 1
                file_modified = True

            # 2. Entire file belongs to a dedicated Nordic center, so any downhill piste inside it is actually nordic
            elif is_nordic_center and ptype == 'downhill':
                p['piste:type'] = 'nordic'
                total_nordic_center_fixed += 1
                file_modified = True

        if file_modified:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(d, f, separators=(',', ':'), ensure_ascii=False)
            files_modified += 1

    print(f'Hike/nordic trails mislabeled as downhill fixed: {total_hike_fixed}')
    print(f'Nordic center downhill mislabeled trails fixed: {total_nordic_center_fixed}')
    print(f'Total affected files saved: {files_modified}')

if __name__ == '__main__':
    clean_trails()

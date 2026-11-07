#!/usr/bin/env python3
"""
classify_major_peaks.py — Assigns 3-tier cartographic hierarchy to public/data/major_peaks.geojson

Tiers:
- Tier 1 (Ultra & Iconic Continental Apex Summits): minzoom 6.0
  Famous world massifs, state/regional apex summits, volcanic giants (Wrangell, Blackburn, Sanford,
  Denali, Rainier, Whitney, Elbert, Mont Blanc, Matterhorn, Everest, Fuji, Kilimanjaro, etc.)
- Tier 2 (Major Regional Summits & High Range Crests): minzoom 8.0
  Prominent regional crests and high-elevation alpine peaks (12,000'+ in Rockies, 10,000'+ in Alps)
- Tier 3 (Local Alpine Summits & Ski Valley Horizon Peaks): minzoom 10.0
  All remaining surveyed local mountain peaks.
"""

import json

ICONIC_NAMES = {
    # Alaska & Yukon
    'Denali', 'Mount Logan', 'Mount Saint Elias', 'Mount Foraker', 'Mount Blackburn',
    'Mount Sanford', 'Mount Wrangell', 'Mount Fairweather', 'Mount Hunter', 'Mount Bona',
    'Mount Lucania', 'Mount Steele', 'Mount Hayes', 'Mount Redoubt', 'Mount Spurr',
    'Mount Iliamna', 'Augustine Volcano', 'Mount Shishaldin',

    # Pacific Northwest & California
    'Mount Rainier', 'Mount Shasta', 'Mount Whitney', 'Mount Williamson', 'North Palisade',
    'Mount Adams', 'Mount Hood', 'Mount Baker', 'Glacier Peak', 'Mount Saint Helens',
    'Mount Olympus', 'Mount Ritter',

    # Rockies & Interior West
    'Mount Elbert', 'Mount Massive', 'Mount Harvard', 'Longs Peak', 'Pikes Peak',
    'Mount Sneffels', 'Uncompahgre Peak', 'Blanca Peak', 'Crestone Peak', 'Grand Teton',
    'Gannett Peak', 'Granite Peak', 'Kings Peak', 'Borah Peak', 'Humphreys Peak',
    'Wheeler Peak',

    # Canadian Rockies & Coast Mountains
    'Mount Robson', 'Mount Columbia', 'Mount Assiniboine', 'Mount Temple', 'Mount Sir Wilfrid Laurier',
    'Mount Waddington',

    # Eastern North America
    'Mount Washington', 'Mount Mitchell',

    # Mexico & Central America
    'Pico de Orizaba', 'Popocatepetl', 'Iztaccihuatl', 'Volcan Tajumulco',

    # Alps & Europe
    'Mont Blanc', 'Matterhorn', 'Monte Rosa', 'Dufourspitze', 'Dom', 'Weisshorn',
    'Gran Paradiso', 'Jungfrau', 'Eiger', 'Mönch', 'Finsteraarhorn', 'Piz Bernina',
    'Ortler', 'Grossglockner', 'Grossvenediger', 'Wildspitze', 'Zugspitze', 'Marmolada',
    'Tre Cime', 'Cima Grande', 'Barre des Écrins', 'Mount Elbrus', 'Kazbek',
    'Mulhacén', 'Pico de Teide', 'Mount Etna', 'Galdhøpiggen', 'Olympus', 'Mount Olympus',

    # Asia & Himalayas
    'Mount Everest', 'K2', 'Kangchenjunga', 'Lhotse', 'Makalu', 'Cho Oyu',
    'Dhaulagiri', 'Manaslu', 'Nanga Parbat', 'Annapurna', 'Nanda Devi', 'Mount Fuji',
    'Fuji', 'Mount Kinabalu', 'Mount Rinjani', 'Mount Kerinci', 'Pik Kommunizma',

    # South America & Andes
    'Aconcagua', 'Ojos del Salado', 'Huascaran', 'Chimborazo', 'Cotopaxi', 'Illimani',
    'Fitz Roy', 'Cerro Torre', 'Sajama', 'Coropuna', 'Ausangate',

    # Africa
    'Mount Kilimanjaro', 'Kilimanjaro', 'Mount Kenya', 'Margherita', 'Table Mountain',

    # Oceania & Antarctica
    'Aoraki/Mount Cook', 'Mount Cook', 'Mount Kosciuszko', 'Puncak Jaya', 'Mount Taranaki',
    'Mount Vinson', 'Vinson Massif'
}

def main():
    path = 'public/data/major_peaks.geojson'
    with open(path) as f:
        data = json.load(f)

    peaks = data['features']
    print(f"Loaded {len(peaks)} peaks from {path}")

    t1_count = 0
    t2_count = 0
    t3_count = 0

    for f in peaks:
        p = f['properties']
        name = p.get('name', '').strip()
        elev = p.get('elevation_ft', 0)
        cont = p.get('continent', '')

        is_t1 = False
        for icon in ICONIC_NAMES:
            if icon.lower() == name.lower() or name.lower().startswith(icon.lower() + ' '):
                is_t1 = True
                break

        if not is_t1:
            if cont == 'North America' and elev >= 14400:
                is_t1 = True
            elif cont == 'Europe' and elev >= 13200:
                is_t1 = True
            elif cont == 'Asia' and elev >= 24000:
                is_t1 = True
            elif cont == 'South America' and elev >= 20000:
                is_t1 = True
            elif cont in ['Africa', 'Australia/Oceania', 'Antarctica'] and elev >= 12000:
                is_t1 = True

        if is_t1:
            p['tier'] = 1
            p['sort_key'] = 1000 + max(0, 40000 - elev)
            t1_count += 1
        else:
            is_t2 = False
            if cont == 'North America' and elev >= 12000:
                is_t2 = True
            elif cont == 'Europe' and elev >= 10000:
                is_t2 = True
            elif cont == 'Asia' and elev >= 18000:
                is_t2 = True
            elif cont == 'South America' and elev >= 16000:
                is_t2 = True
            elif cont in ['Africa', 'Australia/Oceania', 'Antarctica'] and elev >= 6000:
                is_t2 = True

            if is_t2:
                p['tier'] = 2
                p['sort_key'] = 10000 + max(0, 40000 - elev)
                t2_count += 1
            else:
                p['tier'] = 3
                p['sort_key'] = 20000 + max(0, 40000 - elev)
                t3_count += 1

    print(f"Classification complete:")
    print(f"  Tier 1 (minzoom 6.0): {t1_count} peaks")
    print(f"  Tier 2 (minzoom 8.0): {t2_count} peaks")
    print(f"  Tier 3 (minzoom 10.0): {t3_count} peaks")

    with open(path, 'w') as f:
        json.dump(data, f)
    print(f"Wrote updated {path}")

if __name__ == '__main__':
    main()

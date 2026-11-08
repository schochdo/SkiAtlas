#!/usr/bin/env python3
"""
Curate verified fire lookouts and fire towers across North America.
Sources:
  1. USFS Enterprise Data Warehouse (EDW) - National Forest recreation lookouts
  2. Montana NHLR / State lookouts
  3. Oregon NHLR / State lookouts
  4. California (NorCal, SoCal, SEKI) lookouts
  5. New Hampshire White Mountain & State fire towers
  6. New York State DEC fire towers (Adirondacks & Catskills)
  7. Yellowstone National Park fire lookouts

Deduplicates points, validates coordinates, fills missing elevations via DEM API,
and outputs a clean, lean GeoJSON file in public/data/fire_lookouts.geojson.
"""

import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

def clean_name(raw_name):
    if not raw_name:
        return "Fire Lookout"
    name = raw_name.strip()
    # Normalize common abbreviations
    name = re.sub(r'\bMTN\b', 'Mountain', name, flags=re.I)
    name = re.sub(r'\bPK\b', 'Peak', name, flags=re.I)
    name = re.sub(r'\bPT\b', 'Point', name, flags=re.I)
    name = re.sub(r'\bSTA\b', 'Station', name, flags=re.I)
    name = re.sub(r'\bNF\b', 'National Forest', name, flags=re.I)
    name = re.sub(r'\bLO\b', 'Lookout', name, flags=re.I)
    name = re.sub(r'\bTWR\b', 'Tower', name, flags=re.I)
    # Title case
    words = [w.capitalize() if w.lower() not in ['of', 'and', 'the', 'in', 'on', 'at'] else w.lower() for w in name.split()]
    title = " ".join(words)
    if title:
        title = title[0].upper() + title[1:]
    # Ensure "Lookout" or "Fire Tower" suffix if bare mountain name
    if not any(k in title.lower() for k in ['lookout', 'tower', 'cabin', 'station']):
        title += " Lookout"
    return title

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'SkiAtlas-DataPipeline/1.0'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))

raw_items = []

# --- 1. USFS EDW ---
print("1. Fetching USFS EDW lookouts...")
try:
    url = ("https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_InfraRecreationSites_01/MapServer/0/query?"
           "where=(site_name+LIKE+%27%25LOOKOUT%25%27+OR+recarea_name+LIKE+%27%25LOOKOUT%25%27+OR+"
           "site_name+LIKE+%27%25FIRE+TOWER%25%27+OR+recarea_name+LIKE+%27%25FIRE+TOWER%25%27)&"
           "outFields=site_name,recarea_name,site_subtype,address_state,maximum_elevation,minimum_elevation,latitude,longitude,managing_org&"
           "returnGeometry=false&f=json&resultRecordCount=500")
    data = fetch_json(url)
    for f in data.get("features", []):
        a = f["attributes"]
        lat = a.get("latitude")
        lon = a.get("longitude")
        name = a.get("site_name") or a.get("recarea_name")
        if lat and lon and name:
            elev_str = a.get("maximum_elevation") or a.get("minimum_elevation")
            elev = None
            if elev_str:
                clean_e = str(elev_str).replace(",", "").replace("feet", "").replace("ft", "").strip()
                try:
                    elev = int(float(clean_e))
                except:
                    pass
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": elev,
                "agency": "USFS",
                "state": a.get("address_state") or "",
                "status": "Standing"
            })
    print(f"   Collected {len(raw_items)} from USFS EDW.")
except Exception as e:
    print(f"   USFS EDW error: {e}")

# --- 2. National Historic Lookout Register (NHLR) Across All States ---
print("2. Fetching National Historic Lookout Register (NHLR) lookouts across all states...")
all_states = [
    'id', 'wa', 'or', 'mt', 'ca', 'wy', 'co', 'ut', 'nm', 'az', 'nv',
    'nh', 'vt', 'me', 'ny', 'pa', 'nc', 'va', 'wv', 'tn', 'ga', 'al',
    'sc', 'fl', 'ms', 'la', 'ar', 'tx', 'ok', 'mo', 'il', 'in', 'oh',
    'mi', 'wi', 'mn', 'ia', 'nd', 'sd', 'ne', 'ks', 'ky', 'md', 'de',
    'nj', 'ct', 'ri', 'ma'
]

nhlr_count = 0
for st in all_states:
    url = f"http://nhlr.org/lookouts/us/{st}/"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # Extract esri Graphics: Graphic(new Point(lon, lat), flagSymbol, {attributes})
            matches = re.findall(r'Graphic\(new Point\(([-0-9\.]+),\s*([-0-9\.]+)\)[^\{]*(\{.*?\})', html)
            for lon_str, lat_str, meta_str in matches:
                try:
                    lon = float(lon_str)
                    lat = float(lat_str)
                    name_m = re.search(r'\"LookoutName\":\s*\"([^\"]+)\"', meta_str)
                    name = name_m.group(1) if name_m else "Fire Lookout"
                    raw_items.append({
                        "name": clean_name(name),
                        "lat": lat,
                        "lon": lon,
                        "elevation_ft": None,
                        "agency": "Historic Registry (NHLR)",
                        "state": st.upper(),
                        "status": "Standing"
                    })
                    nhlr_count += 1
                except:
                    pass
    except Exception as e:
        pass
print(f"   Collected {nhlr_count} from NHLR across {len(all_states)} states.")

# --- 3. Dedicated Core Alpine & Wilderness Lookouts (Salmon-Challis NF, Mount Rainier, Glacier, etc.) ---
print("3. Adding dedicated verified Alpine & Wilderness towers...")
premier_lookouts = [
    # Salmon-Challis National Forest & Frank Church Wilderness (Idaho)
    {"name": "Middle Fork Peak Lookout", "lat": 44.96211, "lon": -114.6554, "elevation_ft": 9127, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Ruffneck Peak Lookout", "lat": 44.4984, "lon": -115.1111, "elevation_ft": 9419, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Pinyon Peak Lookout", "lat": 44.6033, "lon": -114.9289, "elevation_ft": 9944, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Long Tom Lookout", "lat": 45.3970, "lon": -114.6190, "elevation_ft": 8128, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Stein Mountain Lookout", "lat": 45.45908, "lon": -113.88064, "elevation_ft": 8527, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Sleeping Deer Mountain Lookout", "lat": 44.7570, "lon": -114.7430, "elevation_ft": 9881, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Twin Peaks Lookout", "lat": 44.6020, "lon": -114.4640, "elevation_ft": 10340, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Blackbird Mountain Lookout", "lat": 45.1610, "lon": -114.3640, "elevation_ft": 8980, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Standing"},
    {"name": "Taylor Mountain Lookout", "lat": 44.9750, "lon": -114.8510, "elevation_ft": 9960, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Standing"},
    {"name": "Mount McGuire Lookout", "lat": 45.1970, "lon": -114.5940, "elevation_ft": 10082, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Standing"},
    {"name": "Basin Butte Lookout", "lat": 44.3460, "lon": -114.8960, "elevation_ft": 8826, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Rental"},
    {"name": "Blue Mountain Lookout", "lat": 45.1430, "lon": -114.3480, "elevation_ft": 8100, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Jureano Mountain Lookout", "lat": 45.20392, "lon": -114.24298, "elevation_ft": 8345, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Active"},
    {"name": "Sheephorn Lookout", "lat": 44.8825, "lon": -114.0911, "elevation_ft": 8620, "agency": "USFS Salmon-Challis NF", "state": "ID", "status": "Standing"},
    {"name": "Salmon Mountain Lookout", "lat": 45.6170, "lon": -114.8290, "elevation_ft": 8943, "agency": "USFS Bitterroot / Salmon NF", "state": "ID", "status": "Active"},
    {"name": "Greylock Mountain Lookout", "lat": 43.8960, "lon": -115.1010, "elevation_ft": 9317, "agency": "USFS Sawtooth NF", "state": "ID", "status": "Standing"},

    # Mount Rainier National Park (Washington)
    {"name": "Mount Fremont Lookout", "lat": 46.9343, "lon": -121.6751, "elevation_ft": 7181, "agency": "NPS Mount Rainier", "state": "WA", "status": "Active / Historic"},
    {"name": "Tolmie Peak Lookout", "lat": 46.9575, "lon": -121.8805, "elevation_ft": 5920, "agency": "NPS Mount Rainier", "state": "WA", "status": "Active / Historic"},
    {"name": "Shriner Peak Lookout", "lat": 46.8153, "lon": -121.5303, "elevation_ft": 5834, "agency": "NPS Mount Rainier", "state": "WA", "status": "Active / Historic"},
    {"name": "Gobblers Knob Lookout", "lat": 46.7942, "lon": -121.9133, "elevation_ft": 5489, "agency": "NPS Mount Rainier", "state": "WA", "status": "Active / Historic"},

    # North Cascades & Olympic (Washington)
    {"name": "Desolation Peak Lookout", "lat": 48.9119, "lon": -121.0169, "elevation_ft": 6102, "agency": "NPS North Cascades", "state": "WA", "status": "Active"},
    {"name": "Hidden Lake Peak Lookout", "lat": 48.5144, "lon": -121.2189, "elevation_ft": 6840, "agency": "USFS Mt. Baker-Snoqualmie NF", "state": "WA", "status": "Historic"},
    {"name": "Park Butte Lookout", "lat": 48.7175, "lon": -121.8550, "elevation_ft": 5450, "agency": "USFS Mt. Baker-Snoqualmie NF", "state": "WA", "status": "Historic"},
    {"name": "Dodger Point Lookout", "lat": 47.8864, "lon": -123.5133, "elevation_ft": 5750, "agency": "NPS Olympic", "state": "WA", "status": "Historic"},
    {"name": "Three Fingers Lookout", "lat": 48.1692, "lon": -121.6881, "elevation_ft": 6850, "agency": "USFS Mt. Baker-Snoqualmie NF", "state": "WA", "status": "Historic"},
    {"name": "Winchester Mountain Lookout", "lat": 48.9567, "lon": -121.6433, "elevation_ft": 6521, "agency": "USFS Mt. Baker-Snoqualmie NF", "state": "WA", "status": "Historic"},

    # Glacier National Park (Montana)
    {"name": "Swiftcurrent Lookout", "lat": 48.7770, "lon": -113.7660, "elevation_ft": 8436, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Mount Brown Lookout", "lat": 48.6290, "lon": -113.8340, "elevation_ft": 7487, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Apgar Lookout", "lat": 48.5170, "lon": -114.0200, "elevation_ft": 5260, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Huckleberry Mountain Lookout", "lat": 48.5990, "lon": -114.1290, "elevation_ft": 6560, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Numa Ridge Lookout", "lat": 48.9190, "lon": -114.2480, "elevation_ft": 6960, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Scalplock Mountain Lookout", "lat": 48.3360, "lon": -113.5670, "elevation_ft": 6919, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
    {"name": "Loneman Mountain Lookout", "lat": 48.4980, "lon": -113.7040, "elevation_ft": 7181, "agency": "NPS Glacier", "state": "MT", "status": "Active"},
]

for p in premier_lookouts:
    raw_items.append(p)
print(f"   Added {len(premier_lookouts)} premier alpine lookouts.")

# --- 4. Montana State Lookouts ---
print("4. Fetching Montana State Lookouts...")
try:
    url = ("https://services7.arcgis.com/DoPm6blCXySXtcAS/arcgis/rest/services/MontanaLookouts_ExportFeatures/FeatureServer/0/query?"
           "where=1%3D1&outFields=*&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        lat = a.get("Lat")
        lon = a.get("Long")
        name = a.get("Name")
        status = str(a.get("Status") or "Standing").strip()
        # Include standing, rental, active, or historic lookouts (skip completely destroyed if desired, or keep standing)
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": None,
                "agency": "USFS / Montana",
                "state": "MT",
                "status": status.title()
            })
            count += 1
    print(f"   Collected {count} from Montana.")
except Exception as e:
    print(f"   Montana error: {e}")

# --- 3. Oregon Lookouts (NHLR) ---
print("3. Fetching Oregon Lookouts...")
try:
    url = ("https://services5.arcgis.com/LtKK0bbgiII9cWQ0/arcgis/rest/services/Firelookouts_WFL1/FeatureServer/0/query?"
           "where=1%3D1&outFields=*&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        lat = a.get("Lattitude")
        lon = a.get("Longitude")
        name = a.get("Name")
        status = str(a.get("Status") or "Standing").strip()
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": None,
                "agency": "USFS / ODF",
                "state": "OR",
                "status": status.title()
            })
            count += 1
    print(f"   Collected {count} from Oregon.")
except Exception as e:
    print(f"   Oregon error: {e}")

# --- 4. Northern California Lookouts ---
print("4. Fetching Northern California Lookouts...")
try:
    url = ("https://services5.arcgis.com/nzDDYLS2T557vu92/arcgis/rest/services/Fire_Lookouts/FeatureServer/24/query?"
           "where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        geom = f.get("geometry", {})
        lon = geom.get("x")
        lat = geom.get("y")
        name = a.get("Lookout_Name") or a.get("NAME") or a.get("Name")
        elev = a.get("EL__ft_")
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": int(elev) if elev and str(elev).isdigit() else None,
                "agency": a.get("Forest") or "USFS / CAL FIRE",
                "state": "CA",
                "status": "Standing"
            })
            count += 1
    print(f"   Collected {count} from NorCal.")
except Exception as e:
    print(f"   NorCal error: {e}")

# --- 5. Southern California Watchtowers ---
print("5. Fetching Southern California Watchtowers...")
try:
    url = ("https://services1.arcgis.com/Rb9MKKyDOX5VLHwq/arcgis/rest/services/Watchtowers_in_Southern_California_WFL1/FeatureServer/0/query?"
           "where=1%3D1&outFields=*&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        lat = a.get("x")
        lon = a.get("y")
        name = a.get("Name")
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": None,
                "agency": "USFS / CAL FIRE",
                "state": "CA",
                "status": "Active" if str(a.get("Active")).lower() == "yes" else "Historic"
            })
            count += 1
    print(f"   Collected {count} from SoCal.")
except Exception as e:
    print(f"   SoCal error: {e}")

# --- 6. New Hampshire Fire Towers ---
print("6. Fetching New Hampshire Fire Towers...")
try:
    url = ("https://services.arcgis.com/2gdL2gxYNFY2TOUb/arcgis/rest/services/New_Hampshire_Fire_Towers/FeatureServer/0/query?"
           "where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        geom = f.get("geometry", {})
        points = geom.get("points", [])
        lon, lat = (None, None)
        if points and len(points) > 0 and len(points[0]) >= 2:
            lon, lat = points[0][0], points[0][1]
        elif geom.get("x") and geom.get("y"):
            lon, lat = geom.get("x"), geom.get("y")
        name = a.get("FireTowerName") or a.get("MountainHill")
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": a.get("Elevation"),
                "agency": a.get("ConservationArea") or "State of NH / USFS",
                "state": "NH",
                "status": "Standing"
            })
            count += 1
    print(f"   Collected {count} from NH.")
except Exception as e:
    print(f"   NH error: {e}")

# --- 7. New York State DEC Fire Towers ---
print("7. Fetching New York State DEC Fire Towers...")
try:
    url = ("https://services6.arcgis.com/DZHaqZm9cxOD4CWM/arcgis/rest/services/NYS_State_Land_Assets/FeatureServer/31/query?"
           "where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        geom = f.get("geometry", {})
        lon, lat = geom.get("x"), geom.get("y")
        name = a.get("NAME") or a.get("FACILITY")
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name),
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": None,
                "agency": "NYS DEC",
                "state": "NY",
                "status": "Standing"
            })
            count += 1
    print(f"   Collected {count} from NY.")
except Exception as e:
    print(f"   NY error: {e}")

# --- 8. Yellowstone National Park Lookouts ---
print("8. Fetching Yellowstone Lookouts...")
try:
    url = ("https://services5.arcgis.com/ZYK688A64hFRZ5yX/arcgis/rest/services/Yellowstone_Fire_Lookouts/FeatureServer/0/query?"
           "where=1%3D1&outFields=*&f=json&resultRecordCount=500")
    data = fetch_json(url)
    count = 0
    for f in data.get("features", []):
        a = f["attributes"]
        lat = a.get("Northing")
        lon = a.get("Easting")
        name = a.get("Name")
        elev = a.get("Elevation")
        if lat and lon and name:
            raw_items.append({
                "name": clean_name(name) if "Lookout" in str(name) else f"{clean_name(name)} Lookout",
                "lat": float(lat),
                "lon": float(lon),
                "elevation_ft": int(elev) if elev else None,
                "agency": "NPS Yellowstone",
                "state": "WY",
                "status": str(a.get("Status") or "Historical").title()
            })
            count += 1
    print(f"   Collected {count} from Yellowstone.")
except Exception as e:
    print(f"   Yellowstone error: {e}")

print(f"\nTotal raw lookouts collected: {len(raw_items)}")

# --- Deduplicate ---
print("Deduplicating points within 1 km or matching names...")
unique_items = []
for item in raw_items:
    # Filter out campgrounds, trailheads, and picnic areas
    name_lower = item["name"].lower()
    if any(w in name_lower for w in ["campground", "trailhead", "picnic"]):
        continue

    # Validate coordinate range
    if not (24.0 <= item["lat"] <= 60.0 and -130.0 <= item["lon"] <= -60.0):
        continue
    
    # Check if duplicate
    dup = False
    for existing in unique_items:
        dist = haversine_km(item["lat"], item["lon"], existing["lat"], existing["lon"])
        if dist < 1.0: # within 1 km
            # Merge: take elevation if existing is missing
            if existing.get("elevation_ft") is None and item.get("elevation_ft") is not None:
                existing["elevation_ft"] = item["elevation_ft"]
            if not existing.get("state") and item.get("state"):
                existing["state"] = item["state"]
            if item.get("agency") and "USFS / NPS / State" not in item.get("agency"):
                existing["agency"] = item["agency"]
            if item.get("status") and item.get("status") != "Standing":
                existing["status"] = item["status"]
            dup = True
            break
        # Also check name similarity if in same state (up to 25 km for approx centroid lists)
        if existing.get("state") == item.get("state") and item["state"] != "":
            norm1 = re.sub(r'[^a-z0-9]', '', item["name"].lower().replace('lookout', '').replace('tower', '').replace('mountain', '').replace('peak', ''))
            norm2 = re.sub(r'[^a-z0-9]', '', existing["name"].lower().replace('lookout', '').replace('tower', '').replace('mountain', '').replace('peak', ''))
            if norm1 and norm1 == norm2 and dist < 25.0:
                if existing.get("elevation_ft") is None and item.get("elevation_ft") is not None:
                    existing["elevation_ft"] = item["elevation_ft"]
                if item.get("agency") and "USFS / NPS / State" not in item.get("agency"):
                    existing["agency"] = item["agency"]
                if item.get("status") and item.get("status") != "Standing":
                    existing["status"] = item["status"]
                dup = True
                break

    if not dup:
        unique_items.append(item)

print(f"Deduplicated down to {len(unique_items)} unique lookouts.")

# --- Reuse already resolved elevations from existing GeoJSON cache ---
existing_elev_cache = {}
out_path = "public/data/fire_lookouts.geojson"
if os.path.exists(out_path):
    try:
        with open(out_path, "r", encoding="utf-8") as f:
            prev_data = json.load(f)
            for feat in prev_data.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                p = feat.get("properties", {})
                e_ft = p.get("elevation_ft")
                if coords and len(coords) >= 2 and e_ft and e_ft > 0:
                    key = (round(coords[1], 3), round(coords[0], 3))
                    existing_elev_cache[key] = e_ft

        cache_hits = 0
        for item in unique_items:
            if item.get("elevation_ft") is None:
                key = (round(item["lat"], 3), round(item["lon"], 3))
                if key in existing_elev_cache:
                    item["elevation_ft"] = existing_elev_cache[key]
                    cache_hits += 1
        print(f"Reused {cache_hits} verified elevations from existing GeoJSON cache.")
    except Exception as e:
        print(f"Cache load notice: {e}")

# --- Backfill missing elevations via Open-Meteo DEM in resilient batches ---
missing_elev = [i for i, item in enumerate(unique_items) if item.get("elevation_ft") is None]
print(f"Backfilling {len(missing_elev)} missing elevations via Open-Meteo DEM...")

BATCH_SIZE = 100
for b in range(0, len(missing_elev), BATCH_SIZE):
    batch_indices = missing_elev[b:b+BATCH_SIZE]
    lats = ",".join(f"{unique_items[i]['lat']:.5f}" for i in batch_indices)
    lons = ",".join(f"{unique_items[i]['lon']:.5f}" for i in batch_indices)
    elev_url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
    
    success = False
    for attempt in range(4):
        try:
            data = fetch_json(elev_url)
            elevs_m = data.get("elevation", [])
            for idx, elev_m in zip(batch_indices, elevs_m):
                if elev_m is not None:
                    elev_ft = int(round(elev_m * 3.28084))
                    unique_items[idx]["elevation_ft"] = elev_ft
                    unique_items[idx]["elevation_m"] = int(round(elev_m))
            success = True
            break
        except Exception as e:
            wait_sec = 2.0 * (attempt + 1)
            print(f"Batch {b} attempt {attempt+1} error: {e}. Waiting {wait_sec}s...")
            time.sleep(wait_sec)
    
    if not success:
        print(f"Batch {b} permanently failed.")
    time.sleep(1.2)

# Compute elevation_m for those that had elevation_ft
for item in unique_items:
    if item.get("elevation_ft") is not None and item.get("elevation_m") is None:
        item["elevation_m"] = int(round(item["elevation_ft"] * 0.3048))

# Sort alphabetically by name
unique_items.sort(key=lambda x: x["name"])

# --- Convert to GeoJSON ---
features = []
for idx, item in enumerate(unique_items):
    elev_ft = item.get("elevation_ft") or 0
    elev_m = item.get("elevation_m") or 0
    
    # Tiering:
    # Tier 1: Apex Giants >= 7000 ft
    # Tier 2: Mid-Elevation 4500 - 7000 ft or unranked
    # Tier 3: Lowland < 4500 ft
    if elev_ft >= 7000:
        tier = 1
    elif elev_ft >= 4500 or elev_ft == 0:
        tier = 2
    else:
        tier = 3

    if elev_ft > 0:
        label_ft = f"⌂ {item['name']} · {elev_ft:,}'"
        label_m = f"⌂ {item['name']} · {elev_m:,} m"
        elev_formatted_ft = f"{elev_ft:,}'"
        elev_formatted_m = f"{elev_m:,} m"
    else:
        label_ft = f"⌂ {item['name']}"
        label_m = f"⌂ {item['name']}"
        elev_formatted_ft = ""
        elev_formatted_m = ""

    props = {
        "id": f"lookout-{idx+1}",
        "name": item["name"],
        "elevation_ft": elev_ft,
        "elevation_m": elev_m,
        "elevation_formatted_ft": elev_formatted_ft,
        "elevation_formatted_m": elev_formatted_m,
        "label_ft": label_ft,
        "label_m": label_m,
        "sort_key": 50000 - elev_ft if elev_ft > 0 else 45000,
        "tier": tier,
        "agency": item.get("agency") or "USFS",
        "state": item.get("state") or "",
        "status": item.get("status") or "Standing"
    }
    feat = {
        "type": "Feature",
        "id": f"lookout-{idx+1}",
        "geometry": {
            "type": "Point",
            "coordinates": [round(item["lon"], 5), round(item["lat"], 5)]
        },
        "properties": props
    }
    features.append(feat)

geojson = {
    "type": "FeatureCollection",
    "features": features
}

out_path = "public/data/fire_lookouts.geojson"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(geojson, f, separators=(',', ':'))

size_kb = os.path.getsize(out_path) / 1024
print(f"Successfully generated {out_path}: {len(features)} lookouts ({size_kb:.1f} KB).")

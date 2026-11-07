import urllib.request
import json
import math
import os

print("Fetching Natural Earth 10m populated places...")
url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=30) as resp:
    ne_data = json.loads(resp.read().decode("utf-8"))

print(f"Downloaded {len(ne_data['features'])} features from Natural Earth.")

# Curated Alpine Hubs & Ski Towns
ALPINE_HUBS = [
    {"name": "Chamonix", "country": "France", "coords": [6.8694, 45.9237]},
    {"name": "Courchevel", "country": "France", "coords": [6.6348, 45.4150]},
    {"name": "Val d'Isère", "country": "France", "coords": [6.9803, 45.4480]},
    {"name": "Morzine", "country": "France", "coords": [6.7089, 46.1792]},
    {"name": "Megève", "country": "France", "coords": [6.6177, 45.8569]},
    {"name": "Les Deux Alpes", "country": "France", "coords": [6.1228, 45.0089]},
    {"name": "Alpe d'Huez", "country": "France", "coords": [6.0694, 45.0924]},
    {"name": "Zermatt", "country": "Switzerland", "coords": [7.7491, 45.9763]},
    {"name": "St. Moritz", "country": "Switzerland", "coords": [9.8355, 46.4908]},
    {"name": "Davos", "country": "Switzerland", "coords": [9.8372, 46.8027]},
    {"name": "Verbier", "country": "Switzerland", "coords": [7.2286, 46.0968]},
    {"name": "Interlaken", "country": "Switzerland", "coords": [7.8632, 46.6863]},
    {"name": "Grindelwald", "country": "Switzerland", "coords": [8.0336, 46.6242]},
    {"name": "Gstaad", "country": "Switzerland", "coords": [7.2868, 46.4746]},
    {"name": "Engelberg", "country": "Switzerland", "coords": [8.4069, 46.8200]},
    {"name": "Andermatt", "country": "Switzerland", "coords": [8.5947, 46.6339]},
    {"name": "Kitzbühel", "country": "Austria", "coords": [12.3917, 47.4464]},
    {"name": "St. Anton am Arlberg", "country": "Austria", "coords": [10.2682, 47.1300]},
    {"name": "Lech", "country": "Austria", "coords": [10.1417, 47.2105]},
    {"name": "Sölden", "country": "Austria", "coords": [11.0076, 46.9655]},
    {"name": "Mayrhofen", "country": "Austria", "coords": [11.8637, 47.1683]},
    {"name": "Ischgl", "country": "Austria", "coords": [10.2917, 47.0125]},
    {"name": "Zell am See", "country": "Austria", "coords": [12.7968, 47.3235]},
    {"name": "Cortina d'Ampezzo", "country": "Italy", "coords": [12.1357, 46.5405]},
    {"name": "Madonna di Campiglio", "country": "Italy", "coords": [10.8267, 46.2294]},
    {"name": "Livigno", "country": "Italy", "coords": [10.1357, 46.5386]},
    {"name": "Canazei", "country": "Italy", "coords": [11.7708, 46.4764]},
    {"name": "Bormio", "country": "Italy", "coords": [10.3742, 46.4686]},
    {"name": "Courmayeur", "country": "Italy", "coords": [6.9723, 45.7969]},
    {"name": "Breuil-Cervinia", "country": "Italy", "coords": [7.6312, 45.9347]},
    {"name": "Aosta", "country": "Italy", "coords": [7.3197, 45.7373]},
    {"name": "Chambéry", "country": "France", "coords": [5.9178, 45.5646]},
    {"name": "Lucerne", "country": "Switzerland", "coords": [8.3093, 47.0502]},
    {"name": "Aspen", "country": "USA", "coords": [-106.8175, 39.1911]},
    {"name": "Vail", "country": "USA", "coords": [-106.3742, 39.6403]},
    {"name": "Breckenridge", "country": "USA", "coords": [-106.0384, 39.4817]},
    {"name": "Steamboat Springs", "country": "USA", "coords": [-106.8317, 40.4850]},
    {"name": "Telluride", "country": "USA", "coords": [-107.8123, 37.9375]},
    {"name": "Crested Butte", "country": "USA", "coords": [-106.9878, 38.8697]},
    {"name": "Jackson", "country": "USA", "coords": [-110.7624, 43.4799]},
    {"name": "Sun Valley", "country": "USA", "coords": [-114.3637, 43.6977]},
    {"name": "Park City", "country": "USA", "coords": [-111.4980, 40.6461]},
    {"name": "Truckee", "country": "USA", "coords": [-120.1833, 39.3280]},
    {"name": "South Lake Tahoe", "country": "USA", "coords": [-119.9772, 38.9399]},
    {"name": "Mammoth Lakes", "country": "USA", "coords": [-118.9721, 37.6485]},
    {"name": "Taos", "country": "USA", "coords": [-105.5734, 36.4072]},
    {"name": "Big Sky", "country": "USA", "coords": [-111.3008, 45.2618]},
    {"name": "Whitefish", "country": "USA", "coords": [-114.3353, 48.4111]},
    {"name": "Whistler", "country": "Canada", "coords": [-122.9574, 50.1163]},
    {"name": "Banff", "country": "Canada", "coords": [-115.5708, 51.1784]},
    {"name": "Canmore", "country": "Canada", "coords": [-115.3637, 51.0890]},
    {"name": "Revelstoke", "country": "Canada", "coords": [-118.1957, 50.9981]},
    {"name": "Golden", "country": "Canada", "coords": [-116.9644, 51.2980]},
    {"name": "Fernie", "country": "Canada", "coords": [-115.0631, 49.5042]},
    {"name": "Rossland", "country": "Canada", "coords": [-117.7986, 49.0783]},
    {"name": "Nelson", "country": "Canada", "coords": [-117.2948, 49.4928]},
    {"name": "Niseko", "country": "Japan", "coords": [140.6974, 42.8617]},
    {"name": "Hakuba", "country": "Japan", "coords": [137.8633, 36.7022]},
    {"name": "Nozawa Onsen", "country": "Japan", "coords": [138.4414, 36.9208]},
    {"name": "Myoko", "country": "Japan", "coords": [138.2514, 36.9122]},
    {"name": "Furano", "country": "Japan", "coords": [142.3833, 43.3419]},
    {"name": "Queenstown", "country": "New Zealand", "coords": [168.6626, -45.0312]},
    {"name": "Wanaka", "country": "New Zealand", "coords": [169.1321, -44.7032]},
    {"name": "Bariloche", "country": "Argentina", "coords": [-71.3082, -41.1335]},
    {"name": "San Martín de los Andes", "country": "Argentina", "coords": [-71.3533, -40.1580]},
    {"name": "Ushuaia", "country": "Argentina", "coords": [-68.3030, -54.8019]},
    {"name": "Jindabyne", "country": "Australia", "coords": [148.6219, -36.4253]},
]

features = []

def haversine(c1, c2):
    lon1, lat1 = c1
    lon2, lat2 = c2
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

# 1. First add Tier 4 Alpine Hubs
for hub in ALPINE_HUBS:
    coords = [round(hub["coords"][0], 4), round(hub["coords"][1], 4)]
    features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": coords},
        "properties": {
            "name": hub["name"],
            "country": hub.get("country", ""),
            "pop": 10000,
            "tier": 4,
            "kind": "alpine_hub",
            "importance": 4,
        }
    })

# 2. Process Natural Earth Populated Places
tier_counts = {1: 0, 2: 0, 3: 0, 4: len(features)}

for f in ne_data["features"]:
    props = f["properties"]
    pop = props.get("pop_max") or props.get("pop_min") or 0
    is_cap = props.get("adm0cap") == 1
    is_admin1_cap = (props.get("featurecla") or "").lower() == "admin-1 capital"
    is_worldcity = props.get("worldcity") == 1 or props.get("megacity") == 1
    scalerank = props.get("scalerank") or 10

    # Cutoff: pop >= 45,000 OR national/admin1 capital OR scalerank <= 6
    if pop < 40000 and not is_cap and not is_admin1_cap and scalerank > 7:
        continue

    coords = [round(f["geometry"]["coordinates"][0], 4), round(f["geometry"]["coordinates"][1], 4)]
    name = props.get("nameascii") or props.get("name")
    if not name:
        continue

    # Prevent duplicates with alpine hubs within 15 km
    is_dup = False
    for h in ALPINE_HUBS:
        if haversine(coords, h["coords"]) < 15:
            is_dup = True
            break
    if is_dup:
        continue

    # Tier 1: Megacity & World Metros (>= 1,000,000 or national capital >= 500k)
    if pop >= 1000000 or (is_cap and pop >= 500000):
        tier = 1
        kind = "megacity"
        importance = 1
    # Tier 2: Major Cities & Regional Capitals (>= 250,000, or admin-1 capital >= 100k, or any national capital)
    elif pop >= 250000 or is_cap or (is_admin1_cap and pop >= 100000) or (is_worldcity and pop >= 150000):
        tier = 2
        kind = "major_city"
        importance = 2
    # Tier 3: Regional Cities & Gateways (>= 45,000 or notable regional center)
    else:
        tier = 3
        kind = "city"
        importance = 3

    tier_counts[tier] += 1
    features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": coords},
        "properties": {
            "name": name,
            "country": props.get("adm0name", ""),
            "state": props.get("adm1name", ""),
            "pop": pop,
            "tier": tier,
            "kind": kind,
            "importance": importance,
        }
    })

print(f"Generated features by tier:")
print(f"  Tier 1 (Megacities 1M+): {tier_counts[1]}")
print(f"  Tier 2 (Major Cities 250k - 1M): {tier_counts[2]}")
print(f"  Tier 3 (Regional Cities 50k - 250k): {tier_counts[3]}")
print(f"  Tier 4 (Alpine Valley Hubs): {tier_counts[4]}")
print(f"Total features: {len(features)}")

fc = {"type": "FeatureCollection", "features": features}
out_path = "public/data/geo_reference.geojson"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(fc, f, separators=(",", ":"))

print(f"Saved to {out_path} ({round(os.path.getsize(out_path)/1024, 1)} KB).")


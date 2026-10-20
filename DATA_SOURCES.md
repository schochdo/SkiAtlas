# SkiAtlas — Data Sources

## 1. Resort Data (Static, Bundled)

**Location:** `src/App.tsx` → `GLOBAL_SKI_ATLAS` array

**~91 curated downhill resorts** hand-authored with verified data:

| Field | Source |
|---|---|
| `lat`, `lng` | Manually verified resort coordinates |
| `base_elev_ft`, `summit_elev_ft` | Resort published data |
| `vertical_drop_ft` | Computed: summit − base |
| `skiable_acres` | Resort published data |
| `pass_networks` | Ikon/Epic/Indy/Mountain Collective official lists |
| `lift_count`, `run_count` | Resort published data |
| `summary` | Editorial description |

**Also in `src/App.tsx`:** `HELI_CAT_OPERATIONS` — separate array of heli-ski and cat-ski operators, distinct from lift-served resorts.

**Global points (6,592 ski areas):** Loaded from OpenSkiMap / OSM data as a GeoJSON layer for the map clusters. These are NOT in `GLOBAL_SKI_ATLAS` — they appear as map dots only (no dossier data).

---

## 2. Weather (Live, Client-Side)

**Provider:** [Open-Meteo](https://open-meteo.com/)
- Free, no API key
- Elevation-aware (we pass summit elevation in meters)
- 6s fetch timeout per resort

**Fetched fields:**
```
hourly: snowfall, freezing_level_height, wind_gusts_10m, temperature_2m
daily:  snowfall_sum, temperature_2m_max, temperature_2m_min
```

**Prefetch:** All resorts fetched in batches of 5 on app startup. Individual resort re-fetches on selection.

---

## 3. Terrain (Live Tiles)

**Provider:** Mapterhorn / AWS Elevation Tiles
- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Encoding: `terrarium` (RGB-encoded elevation)
- Replaces old AWS Terrarium source which had spike artifacts at certain zoom levels

---

## 4. Piste & Lift Trails (Hybrid: Local DB + Live Overpass)

**Local SQLite DB:** `data_pipeline/trails.db`
- Pre-built from OpenStreetMap Overpass API
- Contains piste and lift geometries for known resorts
- Served via Vite plugin (`src/server/trailsPlugin.ts`) in dev mode
- Exported as static GeoJSON in `src/data/curatedTrails.ts` for production

**Live Overpass fallback:** When a resort is selected, `fetchOverpassBbox()` queries live OSM data for a ~0.4° × 0.5° bounding box around the resort. This supplements the local DB for newer or less-covered areas.

**Rebuild scripts:**
```bash
node data_pipeline/build_trails_db.cjs      # Rebuild trails.db from Overpass
node data_pipeline/export_resort_trails.cjs # Export per-resort GeoJSON
```

---

## 5. Basemap Tiles (Live Tiles)

| Mode | Source |
|---|---|
| `satellite` | ESRI World Imagery / Mapbox Satellite |
| `osm` | OpenStreetMap standard tiles |
| `topo` | USGS / OpenTopoMap |

All accessed as XYZ raster tile URLs — no API key required for OSM/topo.

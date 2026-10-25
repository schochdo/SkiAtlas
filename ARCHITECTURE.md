# SkiAtlas — Architecture & Design Reference

> This document is the authoritative reference for AI agents and developers working on this codebase. Read this before making any changes.

---

## 1. What This Is

**SkiAtlas** is a cartographic editorial application for exploring ski areas worldwide. It is a **single-page React app** with a MapLibre GL JS map at its core. There is no backend — all data is either bundled at build time or fetched client-side from public APIs.

**Stack:** React 18 · TypeScript · MapLibre GL JS · Tailwind CSS · Vite

---

## 2. Design Principles (Non-Negotiable)

These are permanent constraints. Do not violate them.

1. **No vanity UI** — no version badges, no pulsing status dots, no "System Optimal" indicators, no SaaS chrome.
2. **Editorial cartographic aesthetic** — layout follows the domain (full-bleed map, left dock directory, mountain profile view). Not a dashboard grid.
3. **Strict unit hygiene** — snowfall is always in `in` (imperial) or `cm` (metric). Vertical is `ft` or `m`. Acreage is `ac` or `ha`. Never mix or display without units.
4. **No temperature on resort cards** — snow quantity only on the list. Temperature belongs in the detail mountain profile only.
5. **Metric/imperial toggle** — global `unitsMetric: boolean` state. Always use `formatSnow()`, `formatVert()`, `formatAcres()` helpers — never raw numbers.

---

## 3. File Structure

```
SkiAtlas/
├── src/
│   ├── App.tsx              ← ENTIRE app: types, data, map, UI (monolithic by design)
│   ├── main.tsx             ← React root mount
│   ├── index.css            ← Tailwind base + MapLibre overrides
│   ├── data/
│   │   └── curatedTrails.ts ← Pre-exported OSM piste/lift GeoJSON (loaded on resort select)
│   └── server/
│       └── trailsPlugin.ts  ← Vite dev plugin: serves local SQLite trails DB via HTTP
├── data_pipeline/
│   ├── trails.db            ← SQLite: OSM piste + lift geometries keyed by resort bbox
│   ├── build_trails_db.cjs  ← Script: build trails.db from Overpass API
│   └── export_resort_trails.cjs ← Script: export per-resort GeoJSON from DB
├── public/                  ← Static assets served as-is
├── index.html
├── vite.config.ts
└── CHANGELOG.md             ← Every feature/fix logged here
```

---

## 4. App.tsx Internal Structure (in order)

`App.tsx` is a single large file (~4600+ lines). Sections are delimited by `/* === ... === */` banners.

| Section | Lines (approx) | Purpose |
|---|---|---|
| **TYPES** | 35–115 | `SkiResort`, `ResortWeatherData`, `DailyForecast`, `PisteFeature`, etc. |
| **GEOMETRY HELPERS** | 116–156 | `extractPointCoordinates()` — safe centroid from Point/Polygon geom |
| **SAFE CAMERA** | 158–210 | `safeFlyTo()` — validates coords before any `map.flyTo()` call |
| **DATA: GLOBAL_SKI_ATLAS** | 306–~1630 | Static array of ~91 curated `SkiResort` objects |
| **DATA: HELI_CAT_OPERATIONS** | ~1630–1640 | Heli/cat ski operators (separate from downhill resorts) |
| **getNeutralWeather()** | ~1639 | Returns zeroed `ResortWeatherData` as placeholder before live fetch |
| **fetchLiveWeather()** | 1658–1721 | Async: calls Open-Meteo API, returns `ResortWeatherData` |
| **APP COMPONENT** | 1727+ | Main `export default function App()` |
| ↳ State declarations | 1727–1810 | All `useState` / `useRef` hooks |
| ↳ **Weather prefetch** | ~1967 | `useEffect` — on mount, batch-fetches weather for ALL resorts (5 concurrent) |
| ↳ Map initialization | ~2008 | MapLibre GL map setup, globe/mercator, terrain, sources, layers |
| ↳ Layer effects | ~2619+ | `useEffect` hooks for basemap changes, 3D terrain, cluster updates, etc. |
| ↳ `handleSelectResort` | ~3520 | Click handler: flies to resort, fetches fresh weather, loads trails |
| ↳ `displayedResorts` memo | ~1905 | Combines `filteredResorts` (sorted) with `directoryScope` (in_frame vs all) |
| ↳ Render: Left dock | ~3620 | Directory tray with resort cards |
| ↳ Render: Unified dock | ~4100 | Directory list or Mountain Profile with weather, stats table, forecast bars |
| ↳ Render: Map controls | ~3960 | North arrow, zoom +/-, basemap picker, compass gyro |

---

## 5. Data Flow

```
GLOBAL_SKI_ATLAS (static)
    │
    ├─→ resorts[] state (initialized with getNeutralWeather placeholders)
    │       │
    │       ├─→ [on mount] prefetch useEffect → fetchLiveWeather() × all resorts
    │       │       └─→ setResorts() patches weather onto each resort as it resolves
    │       │
    │       └─→ [on resort click] handleSelectResort → fetchLiveWeather() (refresh)
    │               └─→ setResorts() patches single resort weather
    │
    ├─→ filteredResorts (memo) — applies pass/vert/acres/category/search filters + sort
    │
    ├─→ inViewResorts (memo) — filteredResorts clipped to map viewport bounds
    │
    └─→ displayedResorts (memo) — either inViewResorts or filteredResorts per directoryScope
            └─→ Resort cards in left dock (sorted by sortBy state)
```

---

## 6. Weather Data

**Source:** [Open-Meteo](https://open-meteo.com/) — free, no API key required.

**Endpoint:** `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&elevation=...&hourly=snowfall,freezing_level_height,wind_gusts_10m,temperature_2m&daily=snowfall_sum,temperature_2m_max,temperature_2m_min&timezone=auto`

**What we compute:**
| Field | How |
|---|---|
| `snowfall_72h_in/cm` | Sum of first 72 hourly `snowfall` values |
| `snowfall_7d_in/cm` | Sum of all `daily.snowfall_sum` values (7 days) |
| `daily_forecast[]` | One entry per forecast day with snow + temp |
| `current_temp_f/c` | `hourly.temperature_2m[0]` |
| `summit_wind_gust_mph` | `hourly.wind_gusts_10m[0]` converted from km/h |
| `freezing_level_ft` | `hourly.freezing_level_height[0]` converted from m |
| `is_live` | Always `true` when fetch succeeds |

**Prefetch strategy:** On app mount, all ~91 resorts are fetched in batches of 5 concurrent requests with 200ms between batches. This ensures cards are sorted by real 7-day snow data within ~5-10 seconds.

---

## 7. Map Configuration

**Library:** MapLibre GL JS (open-source fork of Mapbox GL JS)

**Projection modes:**
- `globe` — 3D spherical globe (default on startup, centered on North America)
- `mercator` — flat 2D map

**Terrain:** Mapterhorn global DEM (void-free, replaces AWS Terrarium which caused geometry spikes)
- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Encoding: `terrarium`

**Basemap modes:** `satellite` | `osm` | `topo`

**Key layers (in order):**
1. Terrain (DEM source)
2. Hillshade
3. Basemap raster tiles
4. Resort clusters (GeoJSON source: `resorts-source`)
5. Piste/lift lines (GeoJSON source: `trails-source`) — loaded per resort on click
6. Labels (hidden until zoom ≥ 10)

**Globe startup behavior:**
- Initial padding applied **synchronously** before map construction to prevent globe drift
- North-up (`bearing: 0`) by default
- Centered on North America: `[-100, 47]` zoom 3.2

---

## 8. Resort Cards (Left Dock)

Each card shows:
- Resort name (serif, bold)
- Category badge (downhill/nordic/heli-cat)
- Region, Country · Vertical · Acreage (in selected units)
- **7-day snow chip** (blue, snowflake icon) — shows `snowfall_7d_in` or `snowfall_7d_cm`

**Default sort:** 7-day snow forecast (`sortBy = 'snow'`), descending.

**Sort options:** 7-Day Snow | Vertical | Acreage | Name

**Directory scope tabs:** IN FRAME (viewport-clipped) | ALL MATCHING (full filter results)

---

## 9. Sorting Logic

Located in `filteredResorts` useMemo (not `displayedResorts`).

```ts
if (sortBy === 'snow') {
  // Uses snowfall_7d_in — NOT snowfall_72h_in
  const diff = (a.weather?.snowfall_7d_in ?? 0) - (b.weather?.snowfall_7d_in ?? 0);
  return diff * multiplier;
}
```

> **Important:** The sort key is `snowfall_7d_in`. Do not revert this to `snowfall_72h_in`.

---

## 10. Known Constraints & Gotchas

- **Monolithic App.tsx** — intentional. Do not split into components without explicit user direction. The file is large but all logic is in one place, which makes it easier to reason about state flow.
- **No backend** — all data is client-side. Do not add a server dependency.
- **Open-Meteo rate limits** — the API is free but has limits. Batch size of 5 with 200ms delay is conservative. Do not increase batch size beyond 10.
- **Globe centering** — `setPadding` must be called synchronously before map construction, not in a `useEffect`. This was a hard-won fix; do not change the initialization order.
- **Terrain on globe** — terrain source must be re-added when switching from mercator back to globe. The `useEffect` watching `earthProjection` handles this.
- **`safeFlyTo()`** — always use this instead of `map.flyTo()` directly. It validates coordinates and prevents crashes from NaN/Infinity values.
- **Cluster counts** — updated dynamically when filters change via a `useEffect` that re-generates GeoJSON source data. Do not bypass this.

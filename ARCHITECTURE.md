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
│   ├── App.tsx                    ← Core orchestrator & map viewport (~2,800 lines)
│   ├── main.tsx                   ← React root mount
│   ├── index.css                  ← Tailwind base + MapLibre overrides
│   ├── types/
│   │   └── index.ts               ← SkiResort, PassNetwork, BasemapMode, SortBy, etc.
│   ├── utils/
│   │   ├── formatters.ts          ← Unit hygiene helpers: formatSnow, formatVert, formatAcres, formatDistance
│   │   ├── camera.ts              ← safeFlyTo, safeEaseTo, programmatic flight coordination
│   │   ├── geometry.ts            ← extractPointCoordinates, haversineDistanceKm
│   │   ├── classification.ts      ← PASS_COLORS, PASS_DISPLAY_NAMES, getResortStats, getCategoryBadge
│   │   ├── mapStyles.ts           ← MapLibre style JSON factory (satellite, osm, topo, Mapterhorn DEM, slope, aspect)
│   │   └── terrainAnalysis.ts     ← Client-side 3x3 Sobel/Horn DEM convolution protocols (slope://, aspect://)
│   ├── data/
│   │   ├── resorts.ts             ← Curated flagship ski atlas (GLOBAL_SKI_ATLAS)
│   │   ├── heliCat.ts             ← Curated heli/cat operators (HELI_CAT_OPERATIONS)
│   │   └── curatedTrails.ts       ← Pre-exported OSM piste/lift GeoJSON
│   ├── services/
│   │   └── weather.ts             ← Open-Meteo live meteorology service & neutral forecast builder
│   ├── components/
│   │   ├── header/
│   │   │   ├── TopNavBar.tsx      ← Editorial brand wordmark, extent reset, fullscreen, popover triggers
│   │   │   └── FilterModal.tsx    ← Sliders, unit toggles, pass network filters, projection selector
│   │   ├── sidebar/
│   │   │   ├── LeftDock.tsx       ← Collapsible desktop drawer container with pull tab
│   │   │   ├── DirectoryList.tsx  ← Search input, sort bar, scope tabs, active selection banner, resort list
│   │   │   ├── ResortCard.tsx     ← 3-row editorial resort card with pass chips and 7-day snow chip
│   │   │   ├── ActiveSelectionBanner.tsx ← Sticky selection & quick deselect banner
│   │   │   └── MobileSheet.tsx    ← Mobile bottom drawer (peek, half, full states)
│   │   ├── profile/
│   │   │   └── MountainProfile.tsx← Mountain profile view: lifts/pistes/acres, vertical/summit/base, 7-day meteorology bars
│   │   └── map/
│   │       ├── NavigationControls.tsx ← Vertical [ + ] [ − ] [ ▲ ] zoom and true north snap
│   │       ├── RegionalLocator.tsx    ← Collapsible 2D MapLibre overview inset (Esri Light Gray Canvas)
│   │       ├── BasemapMenu.tsx        ← Basemap selector & 3D terrain exaggeration slider
│   │       ├── CartographicLegend.tsx ← Map key popover & alternating scale bar
│   │       ├── CompassGimbal.tsx      ← Concentric rotary compass heading & 3D tilt horizon gimbal
│   │       └── AttributionBadge.tsx   ← Collapsible map attribution pill
│   └── server/
│       └── trailsPlugin.ts        ← Vite dev plugin: serves local SQLite trails DB via HTTP
├── data_pipeline/
│   ├── trails.db                  ← SQLite: OSM piste + lift geometries keyed by resort bbox
│   ├── build_trails_db.cjs        ← Script: build trails.db from Overpass API
│   └── export_resort_trails.cjs   ← Script: export per-resort GeoJSON from DB
├── public/                        ← Static assets served as-is
├── index.html
├── vite.config.ts
└── CHANGELOG.md                   ← Every feature/fix logged here
```

---

## 4. Architectural Organization & Responsibilities

The codebase follows clean separation of concerns, isolating heavy data sets, domain formatters, network calls, and UI components from the main MapLibre viewport orchestrator.

| Layer / Directory | Primary Files | Responsibilities |
|---|---|---|
| **Types** | `src/types/index.ts` | Complete TypeScript domain interfaces (`SkiResort`, `PassNetwork`, `DailyForecast`, `ResortWeatherData`, etc.) |
| **Data Modules** | `src/data/resorts.ts`, `src/data/heliCat.ts` | Static curated flagship resorts (~91 global ski areas) and heli/cat operators. Separated from component closures to prevent HMR recompilation slowdowns. |
| **Utilities** | `src/utils/` | Formatters (unit hygiene), camera bounds validation (`safeFlyTo`), geometry math (`haversineDistanceKm`), pass & badge classifications (`classifySkiFeature`), and MapLibre style factories. |
| **Services** | `src/services/weather.ts` | Asynchronous Open-Meteo live weather queries, temperature/snowfall caching, and batch prefetch orchestration. |
| **Header Components** | `src/components/header/` | `TopNavBar` (brand crest, global extent reset, display popover triggers) and `FilterModal` (pass toggles, sliders, unit selectors). |
| **Sidebar Components** | `src/components/sidebar/` | `LeftDock`, `DirectoryList`, `ResortCard`, `ActiveSelectionBanner`, and `MobileSheet`. Manages directory search, sorting, and responsive drawer transitions. |
| **Profile Components** | `src/components/profile/` | `MountainProfile` provides deep editorial inspection of selected mountains (elevation profiles, lifts/pistes stats, official website links, and 7-day meteorology bars). |
| **Map Instruments** | `src/components/map/` | `NavigationControls`, `RegionalLocator`, `BasemapMenu`, `CartographicLegend`, `CompassGimbal`, and `AttributionBadge`. Self-contained cartographic instruments with click-outside handlers and independent 2D MapLibre instances. |
| **Core Orchestrator** | `src/App.tsx` | Main application coordinating the primary 3D MapLibre GL map canvas, real-time Overpass SQLite trail streaming, camera gestures, and shared selection state. |

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
4. Terrain Analysis Overlays (`overlay-slope`, `overlay-aspect`) — client-side DEM-derived raster tiles
5. Resort clusters (GeoJSON source: `resorts-source`)
6. Piste/lift lines (GeoJSON source: `trails-source`) — streamed per resort on zoom/click
7. Labels (hidden until zoom ≥ 10)

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

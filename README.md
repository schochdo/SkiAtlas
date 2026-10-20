# SkiAtlas

Global interactive ski atlas with live weather, trail cartography, and resort discovery.

## Quick Start

```bash
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to dist/
```

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | **Read first.** Full system design, file structure, data flow, and gotchas |
| [CHANGELOG.md](./CHANGELOG.md) | Every feature and fix, with git commit references |
| [DATA_SOURCES.md](./DATA_SOURCES.md) | Where all data comes from (weather, terrain, trails, basemaps) |

## Key Facts for AI Agents

- **All app logic is in `src/App.tsx`** — one file, ~4600+ lines, intentionally monolithic
- **No backend** — client-side only, public APIs only
- **Default sort:** 7-day snow forecast (descending)
- **Default view:** Globe, North America, north-up
- **Weather:** Open-Meteo API, prefetched for all resorts on startup in batches of 5
- **Terrain:** Mapterhorn DEM (NOT AWS Terrarium — that caused geometry spikes)
- **Design:** Editorial cartographic, no SaaS chrome, no vanity UI. See ARCHITECTURE.md §2.
- **Units:** Always use `formatSnow()` / `formatVert()` / `formatAcres()` helpers, never raw numbers
- **Before making changes:** Read ARCHITECTURE.md and CHANGELOG.md to understand what was already done and why

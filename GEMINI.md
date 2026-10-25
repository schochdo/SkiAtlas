# SkiAtlas — Agent Rules

These rules apply to every AI agent working in this repository, regardless of model or session.

## 1. Read the docs before writing any code

Before making any change, read these files:
- `ARCHITECTURE.md` — system design, data flow, gotchas, and non-negotiable constraints
- `CHANGELOG.md` — what has already been built and why certain decisions were made

Skipping this step leads to undoing previous work.

## 2. Commit after every change

After every discrete fix or feature:
```bash
git add -A
git commit -m "<type>: <description>"
```

Types: `feat` | `fix` | `refactor` | `docs` | `chore`

Never leave changes uncommitted at the end of a session.

## 3. Update CHANGELOG.md with every commit

Add an entry to `CHANGELOG.md` describing:
- What changed
- What was wrong before (for fixes)
- Why this specific approach was chosen (if non-obvious)

This is the primary mechanism for preserving context across sessions and model switches.

## 4. Design constraints (never violate these)

- **No vanity UI** — no version badges, status pills, pulsing dots, or SaaS chrome
- **Editorial cartographic layout** — not a dashboard grid
- **Unit hygiene** — always use `formatSnow()`, `formatVert()`, `formatAcres()` helpers; never raw numbers
- **No temperature on resort cards** — snow quantity only; temperature belongs in the detail mountain profile
- **Monolithic `src/App.tsx`** — do not split into components without explicit instruction
- **No backend** — client-side only; no server dependencies
- **Always use `safeFlyTo()`** — never call `map.flyTo()` directly

## 5. Key non-obvious decisions (do not revert)

- **Sort key is `snowfall_7d_in`**, not `snowfall_72h_in`
- **Terrain source is Mapterhorn DEM** — AWS Terrarium causes geometry spikes at certain zooms; do not switch back
- **Globe initial padding must be set synchronously** before map construction — not in a useEffect
- **Default sort is `'snow'` (7-day), not `'vert'`**
- **Default projection is `'mercator'` (flat map)** at global scope `[12, 28]` z=1.8, with OpenStreetMap (OSM) basemap by default
- **Default directory scope is `'all'` (All Matching)**, with `[ ALL MATCHING ]` positioned before `[ IN FRAME ]`
- **Sort bar lists `'A-Z'` first**: `[ A-Z ] [ Vert ] [ Acres ] [ 7-Day ❄ ]`, while keeping `'snow'` as the default active sort
- **Selected resort card outline**: Whole box is outlined with a prominent 2px border and shadow
- **Weather prefetch fires on mount** (batches of 5, 200ms apart) — do not remove this

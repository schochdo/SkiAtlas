# SkiAtlas — Changelog

All notable changes in reverse chronological order. Format: `[date] type: description`.

---

## 2026-10-23

### `9cb62a5` fix: persist bottom padding in viewport effect and apply bearing-aligned valley offset so mountains center vertically
- **Padding Overwrite Fix**: Fixed a bug where the reactive `useEffect` monitoring `[selectedResortId]` was immediately executing `map.easeTo({ padding: { top: 52, bottom: 0 } })` the moment a card was clicked, instantly stripping the `bottom: 220` padding set by `safeFlyTo`. Updated the `useEffect` to retain `bottom: 220` whenever `selectedResortId` is active.
- **Bearing-Aligned Valley Ground Anchor**: In addition to padding, offset the camera focal coordinate by ~1.35 km down the valley along the inverse of `default_bearing`. At 42° pitch, this pulls the physical mountain down into the central optical zone of the screen instead of letting the summit crowd the top bar.

### `245899b` fix: increase bottom framing padding to 220px, soften pitch to 42deg, and factor acreage into zoom
- **Mountain Position Framing**: Increased camera viewport `bottom` padding from `140px` to `220px` (with `top: 30px`) and softened pitch from `45°` to `42°`. This prevents mountains (like Jackson Hole, Alta, Snowbird) from riding up against the top edge or disappearing into the upper horizon, seating the base village and runs comfortably in the lower-middle field of view.
- **Acreage Sprawl Zoom Damping**: Added an acreage factor (`Math.log2(acres / 500) * 0.15`) into the zoom calculation alongside vertical drop. Vast expanses like Vail (5,317 acres) and Zermatt (8,800 acres) no longer over-zoom into a single localized cluster of trails, pulling back to ~`11.97` (Vail) and ~`11.54` (Zermatt) while keeping standard alpine peaks crisp around `12.0 – 12.3`.

### `7457771` feat: add bottom viewport padding to camera fly-to so 3D mountains frame prominently in center
- Added `bottom: 140` padding to `safeFlyTo` camera flight options for both curated resort selection and global ski area selection.
- In 3D perspective mode (45° pitch), focusing strictly on `[lng, lat]` without bottom padding pushed the mountain far into the upper horizon of the screen. Bottom padding pulls the focal mountain forward into the lower and middle thirds of the viewport, matching traditional ski trail map perspectives.

### `a744de7` fix: cap maxZoom to 16.5 and refine piste line widths at high zoom
- **Subterranean Zoom Prevention**: Added `maxZoom: 16.5` to the MapLibre map initialization. Previously, without a maximum zoom limit, scroll-wheel zooming could drive the camera beyond the DEM tile resolution and clip beneath the mountain surface mesh. Added pitch clamping to 65° if zoom exceeds 16.0 to prevent steep oblique camera angles from colliding into terrain.
- **Piste Line Width Taming**: Reduced the high-zoom line width interpolation stops for `live-pistes-lines` (from 5px down to 3.0px at zoom 17) and `live-pistes-casing` (from 7px down to 4.6px at zoom 17). Eliminates the ribbon-like ballooning of trail lines when zoomed in close on mountain faces.

## 2026-10-19

### `e535e72` style: position north arrow below +/- buttons with minimal cartographic needle matching zoom control aesthetic
- Moved the North Arrow button below the `+` and `-` zoom controls.
- Replaced the previous decorative needle and floating serif "N" with a clean, minimal cartographic directional needle matching the stroke and color palette (`#1C1B18` ink and neutral stone tones) of the zoom controls.

### `94cd046` fix: smooth European cross-globe flights and calibrate zoom closer for crisp trail viewing
- **European Flight Hang Fix**: When flying from North America to European resorts (>100° longitude span), the globe zoom-out listener (`curPitch > maxAllowedPitch`) was conflicting mid-flight with the programmatic camera animation, causing it to freeze/stall. Added a guard check (`if (isProgrammaticFlightActive) return;`) so transcontinental flights execute cleanly.
- **Dynamic Flight Duration**: Jumps across >40° distance scale to 2800ms so MapLibre can arc across the globe smoothly without snapping or aborting.
- **Closer Zoom Calibration**: US resorts now land closer (Jackson Hole ~12.8, Vail/Snowbird ~13.0, small resorts ~14.0, European domains ~12.4–12.6) so piste runs and trail details are immediately legible upon selection.

### `2e9f470` fix: right-click orbit reverts to stable center-locked approach with 0.35deg/px sensitivity
- Reverted the unproject-based mouse-pivot math which became unstable at oblique pitches near the horizon, causing sudden camera fling.
- Preserved center-locked rotation with responsive 0.35°/pixel bearing sensitivity and 0.25°/pixel pitch sensitivity.

### `bfd6f2f` fix: zoom on card click scales from vertical drop with 45° pitch
- Switched zoom calculation to vertical drop height instead of acreage.
- Set oblique pitch to 45° for full base-to-summit mountain framing.

### `067f535` feat: split trail overlay into separate Alpine and Nordic/XC toggles; alpine on by default, nordic off
- Replaced single `showTrails` boolean with two independent booleans: `showAlpineTrails` (default `true`) and `showNordicTrails` (default `false`)
- Map visibility `useEffect` now builds a `piste:type` filter expression so each toggle only shows its respective trail type
- UI basemap panel now has two separate toggle rows: "Alpine Ski Trails" and "Nordic / XC Trails"
- Filter logic: alpine = all pistes where `piste:type !== 'nordic'`; nordic = pistes where `piste:type === 'nordic'`; both = all pistes; neither = nothing

### `c701649` feat: sort cards by 7-day snow forecast by default and prefetch weather for all resorts on load
- Default `sortBy` state changed from `'vert'` to `'snow'`
- Sort comparator for `'snow'` now uses `snowfall_7d_in` (was incorrectly using `snowfall_72h_in`)
- Resort card snowfall chip now shows **7-day total** (not 72h) with updated tooltip
- Sort button label changed from "Snow" → "7-Day ❄"
- Added `useEffect` on mount that batch-fetches weather for all ~91 resorts (5 concurrent, 200ms between batches) so cards sort by real data immediately on load without requiring a click

### `16a69db` fix: prevent globe from sliding over on start by applying initial padding synchronously
- `setPadding()` called synchronously before map construction (not in useEffect)
- `easeTo` centering call guarded to prevent race condition on initial render

### `c7056f8` fix: replace spike-prone AWS Terrarium DEM with void-free Mapterhorn global DEM
- Switched terrain tile source to Mapterhorn; eliminates geometry spike artifacts

### `e301abc` fix: use standard demotiles font stack for cluster counts
- Cluster count labels now use correct font stack

### `58ba46d` fix: restore multi-tiered color coding for ski area clusters and hide labels until zoomed in
- Cluster colors restored to green/amber/red tiers by count
- Resort name labels hidden until zoom ≥ 10

### `4e85c90` feat: default north-up orientation and add top-left cartographic north arrow and zoom buttons
- Map initializes with `bearing: 0` (north up)
- Top-left controls: north arrow (click to snap north), zoom + / zoom -

### `6e3124b` feat: default to globe viewing North America on start, and dynamically update map cluster counts and category tallies on filter
- Globe (`earthProjection: 'globe'`) is the default on startup
- Centered on North America `[-100, 47]` at zoom 3.2
- Filter changes now dynamically re-render cluster counts and category tallies

### `d123ac9` feat: add directory scope category toggle between IN FRAME and ALL MATCHING filters
- Left dock now has two tabs: **IN FRAME** (viewport-clipped) and **ALL MATCHING** (full filter results)
- Both tabs respect all active filters

### `ea5bdff` feat: remove redundant globe button from map, enable terrain on globe, rename alpine layer without Berann, and ensure centered globe
- Globe/2D toggle removed from basemap panel (projection is now a map control only)
- Terrain enabled in globe mode
- Alpine layer renamed (removed "Berann" branding — it is an inspiration, not a copy)
- Globe centering improved

### `c170f99` feat: move resort overview summary to top of dossier and remove redundant infrastructure line
- Resort summary paragraph moved above stats table
- Redundant "infrastructure" row removed from dossier table (lifts/pistes already in table)

### `be5f466` fix: drop mountain vector from gyroscope, center viewing angle readout, and enable left/right heading drag
- Compass/gyro HUD: mountain icon removed from center
- Viewing angle (pitch) displayed in center, stays centered
- Heading ring draggable left/right (bearing control)

### `ea7e31d` fix: restore smooth center-locked right-click orbit controller with calibrated sensitivity

### `3c46fd8` fix: strictly eliminate repeating earths across 2D/3D modes
- `renderWorldCopies: false`, `minZoom: 1.2`
- Clean globe/mercator terrain decoupling

### `b7f47c6` fix: remove slope trails from filters, restore area points, prevent basemap toggle from hiding under right panel, and restore 3D globe mode

### `7c173ad` fix: dismiss basemap panel on outside click, restore high-contrast editorial styling without blackouts, and add map overlay toggles

### `5aabd88` feat: expand to all 6,592 worldwide ski areas with real-time in-frame count
- Default filters: downhill only, ≥500ft vert, ≥100ac
- Lifts-only default (trails toggle available)
- In-frame count displayed live

### Earlier commits
- `0e959a7` fix: restore smooth zoom on selection, concentric navigation gimbal, matching attribution, separated weather chips
- `df8e1f2` feat: make directory pull-tab rail full height along tray seam
- `be88a39` feat: complete editorial cartography overhaul with SQLite vector trails, 60fps flight, smart deduplication
- `a2731fc` feat: initialize global 3D ski atlas project

---

## Format Reference
- `feat:` — new capability added
- `fix:` — bug corrected; note what was wrong and what the correct behavior is
- `refactor:` — internal change, no behavioral change
- `chore:` — tooling, deps, config

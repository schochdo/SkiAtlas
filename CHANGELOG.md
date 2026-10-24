# SkiAtlas — Changelog

All notable changes in reverse chronological order. Format: `[date] type: description`.

---

## 2026-10-23

### `feat: unify category buttons to toggle all associated points, trails, and infrastructure; remove redundant map overlays menu`
- **Unified Category-Level Toggle Authority**:
  - `⛷️ Downhill`: Directly toggles all downhill curated resorts, global points, clusters, alpine pistes (green, blue, black, double-black runs), trail labels, and aerialway ski lifts.
  - `🎿 Nordic`: Directly toggles all Nordic cross-country centers, global Nordic points, clusters, and groomed cross-country tracks (`piste:type == 'nordic'`).
  - `🚁 Heli/Cat`: Directly toggles all guided heli-ski and snowcat operations, global backcountry areas, skin tracks, and freeride routes (`grooming == 'backcountry'` / `difficulty == 'freeride'`).
- **Eliminated Redundant "Map Overlays" Popover Section**:
  - Removed the redundant 7-toggle "Map Overlays" checkbox section from the top-right Cartographic Controls panel.
  - Previously, trail and lift layers required secondary checkboxes in a separate menu, disconnecting them from the primary category filters in the left directory.
  - Streamlined the top-right control into a clean **Basemap** popover dedicated exclusively to Earth Projection (3D Globe vs Flat Mercator) and Cartographic Base (Satellite 3D, OpenStreetMap, Alpine Topo).
- **Clean Architecture & State Hygiene**:
  - Removed deprecated separate states (`showAlpineTrails`, `showNordicTrails`, `showTouringTrails`, `showLifts`, `showResortMarkers`) and their redundant listeners, consolidating layer filters into a single reactive pipeline.

### `fix: increase default resort selection zoom by one full click and unify north arrow color with +/- controls`
- **One Full Click Closer on Resort Selection**:
  - Increased the base zoom constant from `12.6` to `13.6` in `handleSelectResort()` (e.g. Alta: ~11.5 → ~12.5, Snowbird: ~11.4 → ~12.4, Jackson: ~11.2 → ~12.2, Vail: ~10.9 → ~12.0, Zermatt: ~10.2 → ~11.2, regional hills: ~13.3 → ~14.3).
  - Replaced the hardcoded `zoom: 12.0` in `handleSelectGlobalResort()` with the same dynamic acreage- and vertical-scaled `gZoom` formula (base `13.6`), ensuring all global ski areas frame tightly on selection rather than floating far out in orbit.
  - Aligns with user request for one full `+` click closer zoom, providing an intimate, readable framing of the piste network and base area upon fly-in.
- **Unified North Arrow Ink Palette**:
  - Matched the North arrow chevron color to the exact uniform charcoal ink (`#1C1B18` via `fill="currentColor"`) used by the adjacent `+` (`Plus`) and `−` (`Minus`) zoom buttons.
  - Eliminated dual-tone facet shading to ensure clean graphic consistency with the monochrome linework of the viewport control stack.
  - Centered a high-contrast `#FAF8F3` bold knockout `N` glyph in the chevron belly for immediate True North orientation.
  - Scaled SVG icon footprint to `w-4 h-4` to match the exact visual weight and balance of the `w-3.5 h-3.5` zoom icons.

### `style: convert top-left north arrow to completely grayscale cartographic palette`
- **Monochrome Cartographic Palette**: Converted the top-left True North arrow from chromatic vermilion red to a pure grayscale palette.
- **Deep Charcoal & Slate Faceting**: Rendered the upward-pointing chevron with deep ink charcoal (`#1C1B18`) on the left facet and rich graphite gray (`#5A554E`) on the shaded facet, bounded by a `#1C1B18` stroke and center spine.
- **High-Contrast White 'N'**: Retained the crisp, prominent off-white (`#FAF8F3`) bold `N` glyph inside the chevron, achieving high legibility and quiet Swiss editorial restraint.

### `fix: redesign north arrow to true upward-pointing cartographic chevron with bold N glyph`
- **Eliminated Inverted Visual Cue**: Previously, trying to fit both a North cap, center pivot, South needle, and external letter resulted in the South pointer being almost twice as long as the North pointer with a heavy black outline. Visually, the bulk of the arrow pointed South with a miniscule 4px N.
- **True North Orientation**: Replaced the ambiguous two-pointed compass needle with a full-height, dual-faceted **North Arrow** pointing directly UP to North (`y=20` to `y=2`), matching modern cartographic and GIS conventions.
- **Embedded Bold 'N'**: Stamped a prominent, crystal-clear white **`N`** (6.5px font-size, bold weight 900) directly into the heart of the Alpine Vermilion chevron.
- **High Visibility**: Dual-faceted in Alpine Vermilion (`#E04836` lit facet / `#B84A39` shaded facet) with a crisp `#1C1B18` charcoal stroke. 100% of the graphic unambiguously indicates True North.

### `fix: restore WASD direct camera rotation and tilt without requiring shift key modifier`
- **Eliminated Shift-Key Confusion**: Requiring `Shift + Arrows` to rotate and tilt the 3D camera caused friction and confusion. Restored `W`, `A`, `S`, `D` as direct, single-finger camera orientation controls requiring no modifier keys.
- **Direct 3D Camera Controls (WASD)**:
  - `A` / `D`: Directly rotates camera azimuth / heading (spins yaw left and right around focal center).
  - `W` / `S`: Directly tilts camera pitch (tilts up towards 3D oblique horizon / tilts down towards 2D nadir).
- **Direct Terrain Panning (Arrow Keys)**:
  - `Arrow Keys` (`↑`, `↓`, `←`, `→`): Directly pan directional ground navigation across mountain terrain with elevation lock.
- **Direct Zoom (+ / − and Z / X)**:
  - `+` / `−` and `Z` / `X`: Directly zoom in and out.
- **Optional Speed Multiplier**: Holding `Shift` now serves exclusively as an optional turbo speed multiplier rather than a prerequisite modifier.
- **Updated Cartographic Key**: Updated the on-screen Keyboard Guide inside the Cartographic Key modal to display `W / S: Tilt camera pitch`, `A / D: Rotate camera heading`, `Arrows: Pan across mountain`, `+ / −: Zoom In / Out`.

### `fix: restore authoritative nordic classification and eliminate phantom cross-country skiable acreage`
- **Root Cause of Nordic Miscategorization**: In `public/data/global_ski_areas.json`, 889 cross-country areas (including Larch Hills, McCulloch, Methow, Katahdin) were already correctly flagged as `category: "nordic"`. However, during runtime ingestion in `src/App.tsx`, `classifySkiFeature()` ignored the existing `p.category` and inspected `p.statistics.runs.byActivity.nordic`. Because `p.statistics` is not included in the pre-built JSON, the function defaulted to `category: 'downhill'`, overwriting all 890+ Nordic centers as Downhill and stamping them with `⛷ Downhill` badges.
- **Top Acreage Clogging Fixed**: When OpenSkiData calculates polygon area for Nordic trail networks, it calculates the geographic area of the entire surrounding park or forest reserve (e.g. 11,134 ac for Larch Hills, 7,825 ac for McCulloch, 19,072 ac for Katahdin). Because they were misclassified as Downhill, they falsely outranked mega alpine resorts like Whistler, Vail, and Big Sky when sorted by Acreage.
- **Classification Engine Hardening**:
  - `classifySkiFeature()` now strictly respects existing authoritative categories (`p.category === 'nordic'` or `p.archetype === 'Cross-Country Ski Center'`).
  - Added robust name keyword pattern matching for Nordic centers (`nordic`, `cross-country`, `cross country`, `ski de fond`, `sci di fondo`, `langlauf`, `biathlon`, `outdoor center`) while exempting true alpine downhill resorts (e.g. Nordic Valley, Nordic Mountain, Sugarloaf Mountain).
  - Explicitly zeroed out `skiable_acres` for all Nordic cross-country trail networks in both the ingestion engine and `global_ski_areas.json`. Nordic centers now report true trail counts (e.g. `70 trails`, `50 trails`) rather than misleading alpine skiable acreage.
  - Corrected miscategorized Nordic centers in `global_ski_areas.json` (Ski Callaghan, China Ridge Trails, Palouse Divide, Ski de fond Mont-Tremblant, Sugarloaf Outdoor Center, National Biathlon Centre, Summit Ranger District, Quarry Road Trails).
- **Directory and Dossier UI Cleanliness**:
  - Downhill directory (`showDownhill: true`, `showNordic: false`) now strictly displays genuine alpine downhill ski resorts.
  - Nordic centers only appear when the user toggles the **Nordic** category filter, displaying `🎿 Nordic XC` badges and trail counts.

### `fix: redesign top-left north arrow with high-contrast alpine vermilion needle and bold N glyph`
- **Visibility Enhancement**: Previously, the True North reorientation arrow inside the top-left zoom stack was rendered as a tiny 16px (`w-4 h-4`) black/gray diamond without color or cardinal lettering. The South tip was beige on cream paper, rendering half the needle practically invisible against the button background.
- **Substantial Sizing**: Increased the icon footprint to 22×22px (`w-5.5 h-5.5`), comfortably filling the 32×32px button while maintaining balanced cartographic margins.
- **Alpine Vermilion Faceting**: Styled the North pointer in vivid Alpine Vermilion (`#E04836` lit facet / `#B84A39` shaded facet), harmonizing with the vermilion palette used across SkiAtlas and in the bottom navigation dial.
- **High-Contrast South Needle & Pivot**: Outlined the South needle with a sharp `#1C1B18` stroke and `#D6D0C2` / `#FAF8F3` fill, anchored by an ink-black pivot ring with an inner brass dot.
- **Prominent 'N' Cardinal Stamp**: Added a bold serif `N` letter in `#B84A39` atop the North pointer tip, creating an unmistakable, immediate visual anchor for True North heading.

### `feat: adopt standard WASD + arrow navigation and replace Q/E with +/- and Z/X for zoom`
- **Replaced Awkward Q/E Zoom Controls**: Eliminated `Q` and `E` for zoom, aligning keyboard navigation with standard 3D cartographic and gaming mental models (Option 2).
- **WASD + Arrow Key Terrain Panning**:
  - `W / A / S / D` and `Arrow Keys`: Pan directional ground navigation across the mountain along the current camera bearing.
  - Holding `Shift` with `WASD` or directional arrows applies a 2.5× sprint speed boost for rapid mountain exploration.
- **Intuitive Zoom Controls**:
  - `+` / `=` (`Equal`, `NumpadAdd`): Zoom In.
  - `−` / `_` (`Minus`, `NumpadSubtract`): Zoom Out.
  - `Z` / `X`: Single-hand left keyboard zoom keys directly adjacent to `WASD`.
- **Shift + Arrow 3D Orbiting**:
  - `Shift + ArrowLeft` / `Shift + ArrowRight`: Rotates camera heading (yaw) around the focal mountain center.
  - `Shift + ArrowUp` / `Shift + ArrowDown`: Tilts pitch between top-down 2D and 3D oblique horizon view.
- **Updated Cartographic Key**: Updated the on-screen Keyboard Guide in the Cartographic Key modal to reflect the new WASD, `+ / −`, and `Shift + Arrows` controls.

### `feat: move map attribution to bottom right with collapsible expansion button to eliminate overlap with scale bar`
- **Eliminated Scale Bar Overlap**: Previously, attribution was centered at `bottom-1.5 left-1/2 -translate-x-1/2`. When the left directory dock was open, the cartographic scale bar shifted right to `left-88 md:left-106`, causing the scale bar to sit directly on top of the attribution text.
- **Relocated to Bottom Right with Collapsible "i"**: Replaced the static center pill with a collapsible bottom-right attribution widget styled in the Swiss/Tufte archival cotton rag paper aesthetic (`#FAF8F3`, border `#D6D0C2`, text `#8A847C`, `rounded-[2px]`).
- **Conflict-Free Positioning**:
  - When collapsed: Renders as a discrete 20×20px button with a classic serif italic `i` aligned with the right edge below the compass navigation dial (`bottom-2 right-6`).
  - When expanded: Slides open horizontally to the left, cleanly tucked 6px beneath the compass dial and well clear of the bottom-left scale bar.
  - Reactive to Right Dossier: When a resort is selected, both the compass and the attribution widget slide smoothly to `right-92 md:right-104` with `transition-all duration-300`, preventing any obstruction by the resort dossier.
  - Dismissal: Automatically collapses when clicking the `i` or close button, clicking outside on the map, or pressing `Escape`.

### `fix: filter trail line layers to LineString geometries to eliminate duplicate polygon boundary strokes`
- **Eliminated 3-Parallel-Line Artifacts**: Resolved an issue where ski runs (such as those at Blue Knob, PA) rendered as three parallel lines with crossbar caps down a single trail clearing.
- **Root Cause**: OpenStreetMap and OpenSkiData contain two geometry types for ski runs: (1) centerline paths (`LineString`) and (2) clearing area footprints (`Polygon`). When a `Polygon` is fed to a MapLibre `type: 'line'` layer without geometry filtering, MapLibre strokes the polygon's perimeter boundary (left and right tree lines plus top/bottom end-caps). When combined with the centerline `LineString`, this stroked both flanks and the middle of the trail simultaneously.
- **Geometry-Type Filtering**: Updated `live-pistes-casing`, `live-pistes-lines`, and `live-pistes-labels` with `['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]` both on layer initialization and inside dynamic layer visibility/difficulty filters. All trail outlines now render as single, clean, canonical centerlines matching editorial cartographic standards.

### `fix: populate direct official websites for curated resorts and eliminate generic google search fallbacks`
- **Curated Resort Official Websites**: Added direct, verified official website URLs for all 49 flagship curated resorts (e.g. Jackson Hole, Alta, Snowbird, Vail, Aspen Snowmass, Zermatt, Chamonix, Whistler) and 14 heli/cat operations in `GLOBAL_SKI_ATLAS` and `HELI_CAT_OPERATIONS`.
- **Eliminated Generic Google Search Fallback**: Removed the fallback that redirected users to `google.com/search?q=...` when no website was present. If a ski area has no official website known, the website link is omitted entirely rather than displaying a generic search page.
- **URL Sanitization & Validation**: Enhanced `getResortWebsite()` to sanitize common syntax typos (e.g. leading duplicate protocols like `hhttps://`), trim whitespace, and validate hostname structure before rendering. Non-URL strings in global ski data are safely filtered out.

### `feat: add backcountry touring toggle and suppress unnamed/unknown trail labels`
- **Unnamed / Unknown Label Suppression**: Suppressed text labels for trails named "Unnamed Trail", "Unnamed", "Unknown", or blank/null strings using MapLibre expressions and label filtering. The physical trail line geometries remain rendered on the mountain, but map label clutter from placeholder names is eliminated.
- **Dedicated Touring / Backcountry Toggle**: Split trails into three independent overlays: Alpine Downhill (default ON), Touring / Backcountry (default OFF), and Nordic / XC (default OFF).
- **Touring Identification**: Classified trails with `grooming === 'backcountry'` or `difficulty === 'freeride'` (24,636 trails globally, such as Cody Bowl and Rock Springs at Jackson Hole) into the Touring category, and rendered them with an ochre (`#C25916`) freeride color palette.

### `feat: add minimal full-screen toggle button next to unit selector in header`
- Added an icon-only full-screen button (`Maximize` / `Minimize` from `lucide-react`) directly next to the Imperial / Metric selector in the top bar.
- Styled in the warm cotton rag aesthetic (`#FAF8F3`, border `#D6D0C2`, `rounded-[2px]`, 26px height matching the unit selector).
- Listens to native `fullscreenchange` events to update its icon state seamlessly whether toggled via the button or browser shortcuts (e.g. `Esc`).

### `fix: enable native linear drag-to-rotate with ground clamping, and calibrate zoom and framing padding`
- **Root Cause of Rotation Panning/Flinging**: Disabling `setCenterClampedToGround` on map init forced MapLibre to calculate camera positioning relative to sea level (elevation 0) rather than the mountain terrain surface. In alpine resorts (2,500m–3,500m elevation), this placed the rotation pivot 2.5–3.5 km underground. Rotating around an underground pivot caused the mountain to swing hundreds of pixels in a circle on every slight mouse drag. Replaced the custom mouse listener with MapLibre's native `dragRotate.enable({ around: 'center', movement: 'linear' })` and ensured `setCenterClampedToGround(true)`, so right-click drag orbits cleanly around the true 3D mountain surface in place without swinging.
- **Mountain Centering & Top-Clip Elimination**: Set pitch to 38° to compress vertical perspective foreshortening. Set `bottom: 140px` framing padding (with `top: 60px`) in both `safeFlyTo` and the responsive padding hook, pulling mountain summits down from the top bar into the upper third while keeping the base village in the lower third.
- **Universal Calibrated Zoom Formula**: Updated zoom calculation to `12.6 - log2(vert/1000)*0.45 - log2(acres/1000)*0.35`. Mega-domains (Zermatt ~`10.2`, Vail ~`10.9`) pull back to show their sprawling trail networks, alpine peaks (Jackson Hole ~`11.2`, Snowbird ~`11.4`, Alta ~`11.5`) frame comfortably, and smaller hills remain crisp around ~`13.3`.

### `598adb1` fix: invert direction vector and remove bottom padding to center mountain between base and summit
- **Direction Vector Inversion**: The previous offset math subtracted a vector along `default_bearing`, which moved the target away from the mountain into the valley flatlands. Because the camera faces towards the mountain (along `default_bearing`), moving the target backwards pushed the mountain further into the distance towards the top horizon. Corrected the vector to advance *forward* along `default_bearing` from the base lodge into the mid-mountain (`midpointKm = 0.5 - 2.2 km`), placing the middle of the ski area directly at the screen center.
- **Removed Artificial Bottom Padding**: In MapLibre, `padding.bottom` tells the map engine that the bottom of the screen is covered by UI, which shifts the focal point *upwards* towards the top of the monitor. Removed the artificial 260px bottom padding and restored natural viewport padding (`top: 60, bottom: 20`) so the vertical center of the map corresponds to the unobstructed middle of the screen.
- **Refined Zoom Calibration**: Tuned zoom scaling (`13.3 - log2(vert/500)*0.35 - log2(acres/500)*0.20`) to pull back slightly further for large-acreage mountains: Alta ~`12.00`, Snowbird ~`11.89`, Vail ~`11.64`, Jackson Hole ~`11.77`, Zermatt ~`11.22`.

### `bae25d1` fix: increase down-valley target offset to 3.8km, lower pitch to 38deg, and set bottom padding to 260px
- **Vertical Centering Geometry**: At zoom ~12 with 3,000+ ft vertical relief, a 1.3km offset was too subtle to overcome the high perspective displacement of mountain summits. Increased the down-valley focal offset to `3.8 km` along the inverse of `default_bearing`.
- **Pitch Softening**: Lowered pitch from `42°` to `38°`. A shallower pitch substantially compresses the vertical horizon stretch, preventing peaks from reaching the top navigation elements and placing the trail network squarely in the center of the viewport.
- **Padding Update**: Elevated bottom viewport padding to `260px` in both the flight parameters and the responsive viewport padding hook.

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

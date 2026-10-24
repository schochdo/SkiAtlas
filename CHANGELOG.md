# SkiAtlas — Changelog

All notable changes in reverse chronological order. Format: `[date] type: description`.

---

## 2026-10-23

### `fix: comprehensive dataset quality sweep, exclude defunct ski areas, and repair websites`
- **Exclusion of Defunct / Closed Ski Areas**:
  - **What was wrong**: 1,049 permanently closed, defunct, or abandoned ski areas (e.g., `Snow Forest`, `Plumas Eureka Ski Bowl`, `Wolverton Ski Bowl`, `Kratka Ridge`, `Echo Summit`, `Berthoud Pass`, `Pikes Peak`, `Marble Mountain NY`) were being ingested from `global_ski_areas.json` without any closure checks, cluttering map clusters and the directory tray. Additionally, 23 historic lost ski areas (e.g. `Cortina Valley`, `Raton Ski Basin (Closed)`, `Osceola Tow`, `Pine Ridge`) were erroneously marked `status: 'operating'` with placeholder or misleading links.
  - **Fix**: Implemented strict multi-tier exclusion in `fetchGlobal` in [`src/App.tsx`](file:///Users/macstudio/Documents/Antigravity/SkiAtlas/src/App.tsx) and updated dataset tags in `public/data/global_ski_areas.json`:
    - Filtered `status === 'abandoned' | 'closed' | 'disused' | 'defunct'` or `is_closed === true`.
    - Filtered archetypes or infrastructure marked `Defunct` / `Lost Ski Area` or names containing `(Closed)`, `(abandoned)`, or `(defunct)`.
    - Added defense-in-depth closure guards in `filteredResorts` and `matchingCategoryCounts`.
- **Purge of Downhill Phantom & Sledding Hill Ghost Entries**:
  - Filtered out zero-infrastructure ghost entries where `category === 'downhill'`, lifts = 0, runs = 0, vertical $\le 50\text{ ft}$, acreage $\le 5\text{ ac}$, and no official website exists (e.g., municipal sledding hills, lake overlooks, summer hiking paths mapped as winter sports polygons).
- **Official Website Protocol & URL Quality Repairs**:
  - Repaired malformed, non-protocol, and typo URLs in `public/data/global_ski_areas.json`:
    - `Malá Úpa`: `skimu.cz` $\to$ `https://www.skimu.cz`
    - `Shirakaba 2 in 1` (Japan): `2in1.jp` $\to$ `https://www.2in1.jp/`
    - `Park sportu Hrubá Voda`: `hrubavoda.cz` $\to$ `https://www.hrubavoda.cz/`
    - `Hochfelln` (Germany): fixed double protocol `hhttps://` $\to$ `https://www.hochfellnseilbahn.de/`
    - `Gudauri` (Georgia): `mta.ski` $\to$ `https://mta.ski/`
    - `Roundtop Mountain Resort`: fixed dead domain to official `https://www.skiroundtop.com/`
    - `Montage Mountain Ski Area`: fixed raw resort string to official `https://www.montagemountain.com/`
    - `Sunrise Park Resort`: fixed dead domain to official `https://www.sunrise.ski/`
    - `Boreal Mountain Resort`: updated 404 URL to `https://www.rideboreal.com/`
    - `Mt Seymour`: updated domain to official `https://mtseymour.ca/`
    - `Catamount Mountain Resort`: updated to `https://catamountski.com/`
    - `Meadowlark Ski Area`: updated to `https://meadowlarkskilodge.com/`
    - `Victor Constant Ski Area`: updated West Point MWR URL
    - `Hickory Ski Center`: updated to `https://hickoryskicenter.com/`
    - Ingest pipeline now automatically strips protocol typos and ensures strict `https://` formatting.
- **Entity Name & Wikidata Normalization**:
  - Repaired **Searchmont Resort** in Ontario (`id: 'acf98e56a3ab6ac1fdc702835ad737ae68622058'`), which was mistakenly titled `"Terrain Park"` in OSM despite having 5 lifts, 20 pistes, and official website.
  - Cleaned Wikidata Q-ID suffix from `Ski Santa Fe, Santa Fe, Q38555` $\to$ `Ski Santa Fe`.
  - Purged phantom `"Terrain Park"` polygon in Santa Fe.

---

### `fix: clarify Big Bear Mountain Resort structure and resolve California ski area websites`
- **Domain Clarification for Big Bear Mountain Resort**:
  - In Southern California's San Bernardino Mountains, **Big Bear Mountain Resort** is a single unified Alterra / Ikon Pass resort brand consisting of two distinct ski mountains 2 miles apart: **Snow Summit** (cruisers, family skiing, 15 lifts, 240 ac) and **Bear Mountain** (all-mountain freestyle terrain parks, 12 lifts, 198 ac), plus nearby **Snow Valley Mountain Resort** (acquired in 2023).
  - Previously, `Bear Mountain` was missing from `global_ski_areas.json`, and `Snow Summit` had no mention of Big Bear in its title, creating confusion over whether Big Bear existed or whether Snow Summit was an independent area.
- **Added Big Bear Mountain Resort to Curated Seed Atlas**:
  - Added `Big Bear Mountain Resort` to `GLOBAL_SKI_ATLAS` in [`src/App.tsx#L757-L777`](file:///Users/macstudio/Documents/Antigravity/SkiAtlas/src/App.tsx#L757-L777) (27 lifts, 63 runs, 1,844' vert, 438 ac, Ikon pass, 195° fall-line bearing).
- **Added Bear Mountain to Global Database & Updated Mountain Names**:
  - Added `Bear Mountain (Big Bear)` feature (`id: '78bac1237b378a398d712ba2cc962ddf9d1c6479'`) to `public/data/global_ski_areas.json` with 12 lifts, 27 pistes, and 1,665' vertical, immediately linking with its 39 vector pistes in `trails.db`.
  - Renamed `Snow Summit` to `Snow Summit (Big Bear)` and `Snow Valley` to `Snow Valley (Big Bear)` with `Ikon` pass affiliations and unified `https://www.bigbearmountainresort.com` official websites.
- **Quality Checked California Ski Area Websites**:
  - Updated Badger Pass Ski Area in Yosemite to official modern NPS site `https://www.travelyosemite.com/winter/badger-pass-ski-area/`.
  - Populated Alta Sierra Ski Resort (`https://www.altasierra.com/`).
  - Added summary keyword matching to the search filter so queries for "Big Bear" match all related peaks.

### `fix: support mac trackpad pinch-zoom and rotation in Brave and Chromium browsers`
- **Root Cause in Chromium / Brave**:
  - WebKit's `gesturestart` and `gesturechange` APIs are exclusive to Safari and are not implemented by Chromium (Brave / Chrome on macOS).
  - On Mac trackpads, Chromium translates pinches to `wheel` events with `e.ctrlKey = true`, which defaults to browser-level tab zooming unless intercepted with `e.preventDefault()`.
  - Chromium completely lacks an OS-level trackpad two-finger twist recognizer (`NSRotationGestureRecognizer`).
- **Smooth Trackpad Pinch-to-Zoom**:
  - Intercepted `wheel` events with `e.ctrlKey = true` directly on capture, calling `preventDefault()` to block Chromium browser tab zoom and smoothly adjusting `map.setZoom()` with dynamic delta scaling.
- **Trackpad Rotation via Option (⌥) + Scroll & Right-Click Drag**:
  - Added `Option (⌥) + two-finger scroll` to rotate camera heading effortlessly in Brave and Chrome without requiring click-down.
  - Two-finger click-and-drag (right-click drag) and `A` / `D` keys remain fully active as native rotation options.

### `style: remove truncated count numbers from category filter buttons`
- **Eliminated Button Text Truncation**:
  - Removed parenthesized resort counts `(1,732)` from the 3 category filter buttons (`⛷️ Downhill`, `🎿 Nordic`, `🚁 Heli/Cat`).
  - In the 3-column drawer grid, the long labels caused text to truncate with an ellipsis (`Downhill (1,7...`).
  - Total matching resort counts are already prominently displayed in the filter card header `(1,732)` and directory scope tabs; counts remain available via hover tooltips on each button.

### `feat: add native trackpad twist-to-rotate, shift-scroll tilt, and tablet gesture controls`
- **Mac Trackpad Twist to Rotate & Pinch Zoom**:
  - Attached WebKit `gesturestart`, `gesturechange`, and `gestureend` listeners to the map container with `{ passive: false }`.
  - Calling `e.preventDefault()` prevents Safari from zooming or rotating the HTML page, routing two-finger trackpad twists directly into `map.setBearing(startBearing + e.rotation)`.
  - Simultaneously supports continuous trackpad pinch-to-zoom via `Math.log2(e.scale)`.
- **Shift + Two-Finger Scroll 3D Tilt**:
  - Intercepts `wheel` events when `e.shiftKey` is held, smoothly tilting the 3D camera pitch (`setPitch`) without zooming.
- **Tablet & Touchscreen Gestures**:
  - Enabled native two-finger rotation (`map.touchZoomRotate.enableRotation()`), center-locked pinch zoom, and two-finger vertical drag tilt (`map.touchPitch.enable()`).
- **Updated Cartographic Key Guide**:
  - Updated the modal guide to display concise instructions for Trackpad, Tablet, and Keyboard navigation.

### `feat: add cable-aligned ski lift labels with editorial vermilion styling`
- **Cable-Aligned Aerialway Labels**:
  - Added dedicated vector symbol layer `live-pistes-lifts-labels` in [`src/App.tsx#L2529-L2571`](file:///Users/macstudio/Documents/Antigravity/SkiAtlas/src/App.tsx#L2529-L2571) displaying official lift names (*"Aerial Tram"*, *"Sublette Quad Chair"*, etc.) centered directly along the aerialway cable lines (`symbol-placement: 'line-center'`).
  - Aligns with the cable line rotation angle while keeping text strictly upright (`text-keep-upright: true`) and offset slightly perpendicular to the cable (`text-offset: [0, -0.75]`), ensuring the dashed terracotta line remains visible.
- **Editorial Mountain Styling**:
  - Styled in deep alpine vermilion (`#8F3628`) with an off-white cotton-rag halo (`#FAF8F3`, width 2.5), establishing instant visual hierarchy against dark charcoal trail names.
  - Dynamically scales font size from 9.5px at zoom 12.5 up to 12.5px at zoom 16.
  - Tied to the `⛷️ Downhill` category master toggle alongside `live-pistes-lifts`.
  - Suppresses placeholder and unnamed labels (`Unnamed`, `Unknown`).

### `refactor: remove redundant selected resort name from top navigation bar`
- **Eliminated Header Redundancy**:
  - Removed `{selectedResort.name} ({region}, {country})` breadcrumb from the top navigation bar.
  - The resort name and location are already prominently featured in the sliding detail dossier panel upon selection; displaying it in the masthead created visual clutter and competed with the `SNOW · GLOBE` wordmark.
  - Keeps the top masthead clean and balanced across all viewports.

### `feat: add 3D terrain elevation relief multiplier slider to cartographic controls menu`
- **Dynamic DEM Vertical Relief Exaggeration**:
  - Added an interactive **Terrain Relief Multiplier** slider to the top-right **Cartographic Controls** popover (`Basemap` / layers button).
  - Allows adjusting the MapLibre 3D DEM mesh vertical exaggeration continuously from `0.00×` (completely planar flat) to `2.50×` (dramatic alpine relief) in `0.05×` increments.
  - Formatted using the Edward Tufte engraved scale range slider (`.tufte-slider`) on warm paper tones with a live tabular multiplier readout (e.g. `0.70×`).
- **One-Click Cartographic Presets**:
  - Provided 4 quick-select chips: **Flat (0×)**, **Calibrated (0.7×)**, **1:1 Scale (1.0×)**, and **Alpine (2.0×)** for instant terrain profile switching.
- **60fps Real-Time Updates**:
  - Wired direct synchronous dispatch to `map.setTerrain({ source: 'terrain-dem', exaggeration: val })` on slider scrub, updating the shader's `u_terrain_exaggeration` uniform immediately without reloading DEM tiles.
  - Retains user-selected multiplier across projection toggles (3D Globe vs Planar Mercator).

### `style: replace Christmas-tree contour icon with Alpine Snow Globe crest`
- **Replaced Confusing Contour Mark**:
  - The previous 3-tiered elevation contour curves crowned by a red triangular monument resembled a decorated Christmas tree at small navbar sizes (26px).
  - Replaced it with an authentic **Alpine Snow Globe** crest: a circular glass dome on a flared architectural pedestal, framing a dual-peak alpine ridge silhouette, vermilion summit flag, and drifting snow crystals.
  - Aligns cleanly with the rebranded **`SNOW · GLOBE`** identity.

### `feat: rebrand application title and masthead wordmark to Snow Globe`
- **Updated Page & Masthead Title**:
  - Changed `<title>` and OpenGraph title in `index.html` from `SkiAtlas` to `Snow Globe`.
  - Updated the top masthead wordmark in `src/App.tsx` from `SKI · ATLAS` to `SNOW · GLOBE` in tracked small-caps with the hypsometric summit contour crest and alpine vermilion interpunct.

### `style: conduct page-wide sweep to eliminate heavy black outlines and soften UI chrome`
- **Root Cause of Heavy Outlines**:
  - Elements such as the map scale pill, key toggle, zoom navigation controls, popovers, active buttons, and slider tracks retained harsh black `#2C2A27` borders and dark ink segments that felt jarring against the warm cotton rag paper palette.
- **Swept and Softened All Borders**:
  - **Map Scale Bar & Key**: Replaced `#2C2A27` border with soft `#D6D0C2` paper border; softened scale bar container to `#BDB7A9`; replaced stark black scale segments with warm `#5C5852` charcoal; removed forced underline and green icon on Key button.
  - **Map Viewport Controls (+ / −)**: Replaced heavy black border with `#D6D0C2`.
  - **Popovers (Basemap & Key)**: Replaced `#2C2A27` border with `#D6D0C2` paper rules.
  - **Active State Buttons**: Softened active borders on unit switch (`ft` / `m`), sort pills (`Vert`, `Acres`, `A-Z`, `7-Day ❄`), and scope tabs (`IN FRAME` / `ALL MATCHING`) to `#A8A299` over `#EAE5D9`.
  - **Sliders**: Replaced dark `#2C2A27` slider tracks with `#A8A299` and thumbs with `#5C5852`.

### `style: redesign navigation compass gimbal with minimal Mountain Editorial styling`
- **Eliminated Cluttered Divisions & Harsh Black Ink**:
  - The previous compass gimbal had heavy black borders (`#2C2A27`), 5 concentric rings, 12 degree tick marks, 8 faceted starburst polygons, and harsh black `2D` typography that clashed with the warm editorial palette.
- **Applied Clean, Minimalist Cartographic Dial**:
  - Replaced the harsh black border with subtle `#D6D0C2` warm paper border and `#EAE5D9` calibration circle.
  - Eliminated the 8 faceted starburst polygons, dashed lines, and 30-degree subdivisions.
  - Reduced to 4 clean cardinal divisions: a crisp Alpine Vermilion (`#B84A39`) pointer and `N` at the top, with quiet muted ticks at East, South, and West.
  - Styled the inner gimbal with `#D6D0C2` borders, a subtle vermilion pitch arc, and clean `11px font-bold text-[#1C1B18]` viewing angle typography.

### `refactor: replace verbose unit toggle button with compact segmented ft / m control`
- **Eliminated Clunky Text Padding**:
  - Replaced the wordy single button `Imperial (°F, ft)` / `Metric (°C, m)` with a crisp, segmented `[ ft | m ]` switch.
- **Improved Usability & Editorial Clarity**:
  - Both units are now immediately visible at a glance, with the active unit clearly highlighted using standard `rounded-md` active button styling (`bg-[#F7F4ED] text-[#1C1B18] border-[#2C2A27]`).
  - Follows standard cartographic convention seen in Swiss Topo, FATMAP, and Gaia GPS.

### `style: eliminate arbitrary green color styling from slider metrics and UI controls`
- **Removed Discordant Green Highlights**:
  - The `Min Skiable Acres` and `Min Trail Network` slider metrics previously rendered values (e.g. `100 ac`) in pine green (`#2E5A44`), conflicting with the neutral charcoal palette of `Min Vertical Drop` (`500'`).
  - Active `acres` sort button, active filters badge, scope tab focus ring, and card selection border also used inconsistent green styling.
- **Unified on Natural Editorial Charcoal**:
  - Converted slider values (`100 ac`, `km`) to `#1C1B18` charcoal, matching `Min Vertical Drop`.
  - Replaced green text on active `Acres` sort button with `#1C1B18`.
  - Standardized active filters pill to `#1C1B18` with cream text (`#FAF8F3`).
  - Standardized scope tabs and card active selection borders to `#1C1B18` / `#2C2A27`.

### `style: standardize on refined rounded-md (6px) corners across panel and controls`
- **Replaced Full Stadium Pills with Tailored 6px Rounded Corners**:
  - Overly round stadium capsules (`rounded-full`) felt too circular and bubbly.
  - Standardized on the user's preferred corner geometry: `rounded-md` (`border-radius: 6px` / `0.375rem`), as featured on the Basemap cartographic controls button.
- **Applied Consistent `rounded-md` Across Elements**:
  - **Search Input**: Updated from `rounded-full` to `rounded-md`.
  - **Terrain Filters Container**: Standardized to `rounded-md`.
  - **Category Filter Buttons**: Converted Downhill, Nordic, and Heli/Cat toggle buttons to `rounded-md`.
  - **Sort Bar**: Container and buttons standardized to `rounded-md`.
  - **Scope Tabs**: `IN FRAME` and `ALL MATCHING` tabs set to `rounded-md`.
  - **Card Badges & Snow Chips**: Category tags and snowfall chips standardized to `rounded-md`.
  - **Header & Tool Toggles**: Units toggle, fullscreen button, tray pull tab, and attribution controls set to `rounded-md`.

### `style: soften panel elements with fully rounded pills and smooth curved containers`
- **Eliminated Discordant Hard Edges Inside Directory Panel**:
  - Previously, category badges (`rounded-full`) were soft enamel pills, while adjacent panel controls (search input, terrain filter box, sort buttons, scope tabs, and pull tabs) retained sharp `rounded-[2px]`, `rounded-[3px]`, and `rounded` corners, creating visual friction.
- **Unified Soft Editorial Language**:
  - **Search Input**: Converted to `rounded-full` capsule input.
  - **Terrain Filters Container**: Softened from `rounded-[3px]` to `rounded-2xl` for a gentle, inset card container.
  - **Category Filter Buttons**: Converted Downhill, Nordic, and Heli/Cat toggle buttons to `rounded-full` pills matching the card badges.
  - **Sort Segmented Control**: Transformed both the pill track container and individual sort buttons (`Vert`, `Acres`, `A-Z`, `7-Day ❄`) to `rounded-full`.
  - **Scope Tabs**: Converted `IN FRAME` and `ALL MATCHING` buttons from sharp `rounded-[3px]` to soft `rounded-full` pills.
  - **Card Snow Chip**: Softened forecast snowfall chip from `rounded-md` to `rounded-full px-2.5 py-1`, harmonizing with the category badges.
  - **Tray Seam Pull Tab & Navigation Controls**: Converted drawer pull grip to `rounded-full` and map viewport controls to `rounded-lg`.

### `style: scale up header, search, filter labels, and sort controls to balance with directory cards`
- **Root Cause of Visual Hierarchy Mismatch**:
  - While directory cards were scaled up to warm, confident typography (14px bold titles, readable badges, proportional stats), the header, search input, filter section, and sort controls retained ultra-dense micro-typography (`text-[9px]`, `text-[10px]`, `text-[11px]`, and `h-5` icons).
  - This caused the top controls to feel spindly, cramped, and diminutive compared to the cards below.
- **Proportional Scaling & Balanced Editorial Hierarchy**:
  - **Masthead Wordmark & Crest**: Enlarged the topographic contour crest (`w-6.5 h-6.5`) and scaled `SKI · ATLAS` wordmark to `text-[15.5px]` with wide tracking (`tracking-[0.18em]`) and a bold vermilion interpunct, giving the top header clear authority over card content.
  - **Search Input**: Scaled input text to `text-sm` (14px), increased padding (`py-2 pl-9.5`), and enlarged the search icon to `w-4 h-4` for natural typing and readability.
  - **Terrain Filters Header & Badges**: Upgraded section label to `text-[11px] font-extrabold uppercase`, active count badge to `text-[10px]`, and reset link to `text-xs font-bold`.
  - **Category Filter Buttons**: Scaled to `text-xs font-bold py-2` with increased padding and clear emoji labels, matching the card badge visual weight.
  - **Sliders**: Increased metric labels to `text-[12.5px] font-semibold` and values (`500'`, `100 ac`, `10 km`) to `text-[13.5px] font-extrabold tabular-nums` to match card stat weights.
  - **Sort & Scope Tabs**: Upgraded sort buttons to `text-xs font-bold px-2.5 py-1` and scope tabs (`IN FRAME` / `ALL MATCHING`) to `text-xs py-1.5` with proportional tabular-num counters.

### `style: implement Mountain Editorial typography across application, eliminating typewriter monospace and heavy newspaper serif`
- **Root Cause of Contrived / Stiff Aesthetic & Eye Fatigue**:
  - The UI previously relied heavily on `JetBrains Mono` (`font-mono`) for numerical values, statistics, and badges, and `Newsreader` (`font-serif`) for headers and subheaders.
  - Monospace forced fixed-character widths on numbers and stats, creating an artificial typewriter/academic zine feel that made reading numbers and data dense and fatiguing.
  - Newsreader serif gave the interface an overly academic "New York Times / Edward Tufte" stiffness that felt out of place for modern mountain and topographic exploration.
- **Implemented Mountain Editorial Typography**:
  - Standardized on **Plus Jakarta Sans** (`font-sans`) across the entire application with intentional weights (`font-semibold`, `font-bold`, `font-extrabold`) and proportional numerical spacing (`tabular-nums` where vertical alignment is needed).
  - Replaced harsh boxy monospace tags with soft, rounded enamel badges (`rounded-full`, refined typography).
  - Preserved editorial hierarchy: crisp uppercase metadata tracking (`tracking-wider`, `text-[10px]`), clean human-scale typography for mountain titles, and warm, legible typography for snow depths, lifts, and vertical drops.
  - Eliminated all occurrences of `font-mono` and `font-serif` from the header, left filter drawer, resort cards, right mountain dossier, basemap selector, scale bar, and attribution controls.

### `revert: remove synthetic multi-line callout layer and restore clean cartographic map labels`
- **Root Cause of Glitched Callout and Broken Emoji**:
  - The experimental `selected-resort-callout` layer attempted to render multi-line text with an emoji prefix (`⛷️ Monarch \n 1,162' vert`) and a heavy 3.5px white halo. Because MapLibre GL glyph PBFs cannot render color emojis, it displayed a harsh black-and-white pixelated icon in an opaque white box. The 3.5px halo formed solid white blocks around letters, and printed the resort name twice (above and below the pin marker).
- **Restored Clean, Single Map Labels**:
  - Completely removed `selected-resort-source`, `selected-resort-halo`, `selected-resort-pin`, and `selected-resort-callout`.
  - Removed emoji prefixes from map symbol text fields.
  - Restored clean, subtle 1.5px halo and single name label below each resort marker.

### `style: redesign header with tracked editorial small-caps wordmark and geodetic contour crest`
- **Replaced Generic Header Icon with Cartographic Contour Crest**:
  - Replaced the stock Lucide `Mountain` icon with an authentic SVG hypsometric contour crest: three nested elevation contour lines (slate, charcoal) crowned by an Alpine Vermilion (`#B84A39`) triangulation benchmark monument and inner geodetic point.
- **Tracked Editorial Small-Caps Wordmark**:
  - Replaced generic bold serif `SkiAtlas` with wide-tracked editorial small-caps: `S K I · A T L A S` (`tracking-[0.22em]`, bold serif), separated by an alpine vermilion interpunct dot (`·`).
  - Aligns with Swiss National Topographic Survey / Edward Tufte publication standards, eliminating generic SaaS branding feel.
- **Integrated Location Breadcrumb Divider**:
  - Restyled the active mountain breadcrumb with a crisp vertical dividing rule and muted monospace metadata.

### `refactor: eliminate redundant 'Ski Directory' sub-header and consolidate active filter counter`
- **Eliminated Redundant Sub-Header**:
  - Removed the duplicate `Ski Directory` header row and redundant mountain icon from the top of the sliding architectural tray.
  - Previously, opening the tray stacked an identical icon and label right under the main header bar, adding visual clutter and consuming vertical screen real estate without providing new domain information.
- **Consolidated Filter Hierarchy**:
  - Moved the active filter badge (`{activeFiltersCount} active`) directly into the `Terrain Filters` header, keeping the tray header completely streamlined and letting the search bar sit immediately below the top bar.

### `fix: restore visible map points, persistent area nameplates, and centered framing for nordic ski areas`
- **Root Cause of Missing Nordic Points & Anonymous Terrain**:
  - `global-unclustered-label` had `text-optional: true`. As soon as the camera zoomed into a Nordic area and `/api/trails` loaded 20–50 cross-country trail LineStrings, MapLibre GL collision avoidance prioritized trail lines and dropped the ski area's name label completely, leaving the user with anonymous trails.
  - Nordic points were rendered as generic 4.5px blue dots with no outer ring or category badge, making them virtually invisible against satellite terrain.
  - In `handleSelectResort()`, an alpine fall-line midpoint offset (`midpointKm`) designed for vertical peaks shifted the camera ~0.6 km south away from the Nordic touring center coordinates, pushing the center point out of the framed viewport.
- **Dedicated Concentric Ring Points for Nordic & Global Areas**:
  - Added `global-unclustered-outer-ring` (`minzoom: 8.5`, radius 7–14px) and updated `global-unclustered-point`, dynamically styled in Pine Forest Green (`#2E5A44`) for Nordic, Heli Ochre (`#C25916`), and Alpine Slate Blue (`#3B627E`).
- **Indestructible Area Name Labels**:
  - Changed `text-optional` to `false` and set `symbol-sort-key: 1` on area labels so MapLibre GL never drops the ski area name in favor of individual trails.
  - Prefixed Nordic centers with `🎿 ` and rendered in high-contrast bold typography with 2.5px crisp white halo.
- **Active Area Callout Pin & Top Editorial Breadcrumb**:
  - Added `selected-resort-source` with a high-contrast radiant ring, central pin, and multi-line callout badge (`text-allow-overlap: true`, `text-ignore-placement: true`) floating directly above the selected area's coordinates.
  - Added a quiet editorial breadcrumb in the top header (`SkiAtlas / [Area Name] ([Region], [Country])`) so the active area is always immediately identifiable at a glance.
- **Accurate Framing for Nordic Cross-Country Networks**:
  - Centered directly on `[resort.lng, resort.lat]` without alpine midpoint offset, set True North bearing (`bearing: 0`), and applied adaptive zoom scaling based on total trail network length (`trail_km`) with low-oblique $28^\circ$ pitch.

### `fix: derive gyroscope 3D perspective state from camera pitch angle to eliminate stuck 2D indicator`
- **Root Cause of Stuck '2D' Gyroscope**:
  - `is3D` was previously managed as an independent `useState(false)`. When zooming into a resort via `safeFlyTo` (which tilts the camera to `pitch: 38`), `map.on('pitch')` updated `mapPitch`, but `setIs3D` was never called during programmatic camera flight.
  - The gyroscope HUD evaluated `{is3D ? `${mapPitch}°` : '2D'}`, displaying `2D` and dimming the pitch arc meter despite the camera already resting in 38° oblique 3D terrain perspective.
- **Derived Reactive Perspective State**:
  - Replaced the disconnected boolean with pure derived state (`const is3D = mapPitch > 3;`), ensuring the gyroscope is mathematically guaranteed to reflect the camera's actual tilt angle in real time.
  - Removed all error-prone `setIs3D` call sites across the application.
- **Synchronous Orientation on Flight & MoveEnd**:
  - Updated `handleSelectResort()` and `handleSelectGlobalResort()` to synchronously dispatch `setMapPitch(pitch)` and `setMapBearing(bearing)` at flight initiation.
  - Added pitch and bearing synchronization to `handleMapMoveEnd()`.

### `fix: adapt filters for nordic cross-country centers using trail network length (km) and eliminate false acreage exclusions`
- **Root Cause of Nordic Exclusion**:
  - The default alpine filters (`minAcreage = 100` ac, `minVertical = 500` ft) were applied uniformly to all categories. Because Nordic cross-country trail networks correctly have 0 downhill skiable acres (and mostly rolling elevation below 500 ft), 100% of the 897 worldwide Nordic centers were falsely eliminated on load.
- **Enriched Nordic Trail Network Distance (`trail_km` & `trail_mi`)**:
  - Computed exact geometric trail network length across all 710 Nordic centers using OpenStreetMap LineStrings from `trails.db`.
  - Added `trail_km` and `trail_mi` properties to `public/data/global_ski_areas.json` and `SkiResort` model (ranging up to 209 km at Les Gollières, 170 km at Larch Hills, 120 km at Methow Valley).
- **Category-Adaptive Filter Sliders**:
  - Alpine Downhill sliders (`Min Vertical Drop` and `Min Skiable Acres`) now strictly constrain Downhill ski areas.
  - Added a dedicated `Min Trail Network` slider (`minNordicKm`: 0 to 100 km, formatted via `formatDistance()`) that activates when Nordic is selected.
  - When sorting by size (`sortBy === 'acres'`), Nordic areas sort by total trail network distance (`trail_km`) rather than 0 acres.
- **Card and Dossier Display**:
  - Directory cards for Nordic areas display real trail distance and trail count (e.g. `13.1 km (15 trails)` / `8.2 mi (15 trails)`).
  - Dossier metric bar for Nordic areas swaps `Lifts` and `Acres` for `Trails` (count), `Network` (total distance in km / mi), and `Type` (`Nordic XC`).

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

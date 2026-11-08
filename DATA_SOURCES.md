# SkiAtlas — Data Sources & Cartographic Provenance

This document provides a comprehensive accounting of the datasets, authorities, coordinate reference systems, and verification standards powering SkiAtlas.

SkiAtlas is built on an anti-SaaS, domain-integrity standard: every label, elevation, vector, and snow metric displayed on screen reflects authentic, physically verified real-world provenance.

---

## 1. 3D Terrain & Hypsometry

| Attribute | Specification |
| :--- | :--- |
| **Primary Source** | **Mapterhorn DEM** (AWS Open Data / Tilezen Joerd Project) |
| **Tile Format** | Terrarium-encoded RGB PNG tiles: `elevation = (R * 256 + G + B / 256) - 32768` |
| **Tile Endpoint** | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` |
| **Global Resolution** | 30-meter ground sample distance worldwide |
| **Vertical Calibration** | Calibrated to **0.70× vertical exaggeration** (retains true alpine slopes without vertical distortion) |
| **Licensing** | Open Data / ODbL |
| **Architectural Decision** | Mapterhorn DEM was adopted over standard Mapzen/AWS Terrarium due to geometry stability at steep mountain zooms, avoiding vertex spikes in vertical canyons. |

---

## 2. Satellite Orthoimagery & Base Cartography

| Attribute | Specification |
| :--- | :--- |
| **Global Satellite** | **Esri World Imagery** (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`) |
| **Satellite Imagery Sources** | Maxar, Earthstar Geographics, USDA Farm Service Agency, USGS, Aerogrid, IGN, IGP |
| **Summer Cloudless Satellite** | **EOX Sentinel-2 Cloudless** (European Space Agency / EOX IT Services GmbH) |
| **Alpine Topo Basemap** | **OpenStreetMap Standard Carto** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) |
| **No-Labels Topo** | **CARTO Voyager (No Labels)** (`https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png`) |
| **Licensing** | Esri Terms of Use / © EOX Sentinel-2 / © OpenStreetMap contributors / CARTO |

---

## 3. Ski Areas, Lifts & Trail Geometry

| Attribute | Specification |
| :--- | :--- |
| **Primary Sources** | **OpenSkiData** (`https://openskidata.org`) & **OpenStreetMap** (`piste:type`, `aerialway` relations) |
| **Curated Ingestion** | Curated registry of **1,611 worldwide ski areas** (North America, Alps, Scandinavia, Andes, Japan, Oceania) |
| **Infrastructure Coverage** | 23,000+ aerial lifts (gondolas, trams, high-speed detachables, chairlifts, surface tows) and downhill/nordic trail networks |
| **Snowfall Aggregation** | 72-hour and 7-day cumulative snowfall tracking per resort summit |
| **Pass Network Classification** | Multi-pass partner networks independently categorized: **Epic**, **Ikon**, **Indy**, **Mountain Collective**, and **Unaffiliated** |
| **Licensing** | Open Database License (ODbL) / Open Data Commons |

---

## 4. Fire Lookouts & Historic Watchtowers

| Attribute | Specification |
| :--- | :--- |
| **Primary Registry** | **National Historic Lookout Register (NHLR)** (`https://nhlr.org`) |
| **Secondary Authority** | **Forest Fire Lookout Association (FFLA)** (`https://ffla.org`) |
| **Inventory Size** | **1,843 fire lookouts** across the United States and Canada |
| **Surveyed Benchmark Elevations** | Authentically reconciled against USGS topographic benchmarks (e.g. Leon Peak benchmark at 11,236' / 3,425 m) |
| **Administering Agencies** | Extracted authentic managing agencies: `USFS (by National Forest)`, `NPS (by National Park)`, `CAL FIRE`, `WA DNR`, `ODF`, `State Forestry Agencies` |
| **Operational Status Taxonomy** | Categorized into 5 distinct operational realities: <br>• **Active Watchtower** (staffed wildfire detection)<br>• **Cabin Rental** (USFS / Recreation.gov overnight rentals)<br>• **Historic Site** (restored interpretive towers)<br>• **Abandoned Tower** (decommissioned standing structures)<br>• **Historic Ruins** (stone bases, log foundation remnants) |
| **Licensing** | Public Domain / US Government Works |

---

## 5. Major Mountain Summits & Alpine Peaks

| Attribute | Specification |
| :--- | :--- |
| **Primary Source** | **USGS Geographic Names Information System (GNIS)** |
| **Global Summits** | **Natural Earth Alpine Hypsometry** (1:10m physical summits) & **OpenStreetMap** (`natural=peak`) |
| **Inventory Size** | **1,093 prominent peaks** worldwide with surveyed summit benchmark elevations |
| **Hypsometric Filtering** | Filtered by topographic prominence ($\ge 1,000\text{ ft}$ / $300\text{ m}$) and alpine significance |
| **Coordinate System** | WGS 84 (`EPSG:4326`) |
| **Licensing** | Public Domain |

---

## 6. International & Administrative Boundaries

| Attribute | Specification |
| :--- | :--- |
| **Primary Source** | **Natural Earth 10m Land Boundaries** (North American Cartographic Information Society, NACIS) |
| **Topological Mesh** | Sourced directly from **Natural Earth 10m TopoJSON** (`world-atlas/countries-10m.json`) |
| **Terrestrial Continuity** | 383 continuous international land borders with **100% tripoint connectivity** across all 175 global border junctions |
| **Maritime Water Purge** | Strict exclusion of territorial water indicators, EEZ arcs, and open-ocean lines; all borders terminate strictly at physical coastlines |
| **Sovereign Side Normalization** | Ray-casting point-in-polygon verification ensures left/right border typography aligns strictly with sovereign territory |
| **State / Province Lines** | Natural Earth 50m administrative boundaries for US states, Canadian provinces, Australian states, Brazilian states, and Russian federal subjects |
| **Licensing** | Public Domain |

---

## 7. Alpine Snowfall & Weather Forecasts

| Attribute | Specification |
| :--- | :--- |
| **Primary Provider** | **Open-Meteo Alpine Forecast Model** (`https://open-meteo.com`) |
| **Underlying Models** | High-resolution ensemble combining **ECMWF** (European Centre for Medium-Range Weather Forecasts), **NOAA HRRR** (High-Resolution Rapid Refresh), and **GFS** |
| **Summit Elevation Correction** | Every query passes the resort's actual surveyed summit benchmark elevation in meters (`elevation={summitElevM}`), preventing valley-floor temperature distortion |
| **Daily Metrics** | 7-day cumulative snowfall (inches/cm), 72-hour recent snowfall, base/summit freezing level height, wind gusts, and base rain risk |
| **Local Timezone Alignment** | Resolved via `timezone=auto` against physical resort coordinates, ensuring a single unified "Today" calendar alignment |
| **Licensing** | Attribution Required (CC-BY 4.0) |

---

## Verification & Integrity Principles

1. **Dimensional Rigor**: Rates ($Q$) and cumulative volumes ($V$) are never conflated without a mathematical bridge. Snowfall is tracked as cumulative snowfall water equivalent over standard temporal horizons (72h, 7-day).
2. **Zero Placeholder Data**: Missing coordinates or benchmarks are omitted or flagged rather than extrapolated with synthetic numbers.
3. **No Decorative Jargon**: Labels, status badges, and elevation benchmarks reflect verified administrative facts (e.g. USFS National Forest districts, NHLR register numbers, surveyed benchmark heights).

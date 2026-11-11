import type { StyleSpecification } from 'maplibre-gl';
import type { EarthProjectionMode, BasemapMode, TerrainOverlayMode } from '../types';

export const createMapStyle = (
  earthProjection: EarthProjectionMode,
  basemapMode: BasemapMode,
  terrainOverlay: TerrainOverlayMode = 'none',
  terrainOverlayOpacity: number = 0.65,
  showCountryOutlines: boolean = false,
  showHillshade: boolean = true
): StyleSpecification => {
  const cartoApiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CARTO_API_KEY) || 'cb1_27pq_1_05391dca080d5ca53cb5c122';

  return {
    version: 8,
    projection: { type: earthProjection },
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      // 1. Esri World Imagery (Standard) — Seamless global orthoimagery with continuous color balancing and edge blending
      'satellite-tiles': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri Satellite',
      },
      // 1b. EOX Sentinel-2 Cloudless — Seamless global summer satellite mosaic (zero patchwork seams)
      'cloudless-tiles': {
        type: 'raster',
        tiles: [
          'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
        ],
        tileSize: 256,
        maxzoom: 14,
        attribution: '© EOX Sentinel-2 Cloudless',
      },
      // 2. OpenStreetMap Standard (Raster PNG)
      'osm-tiles': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'OpenStreetMap',
      },
      // 2b. CARTO Voyager No-Labels (Pristine alpine landcover with zero upside-down text)
      'carto-tiles': {
        type: 'raster',
        tiles: cartoApiKey
          ? [
              `https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${cartoApiKey}`,
              `https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${cartoApiKey}`,
              `https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${cartoApiKey}`,
            ]
          : [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
            ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© CARTO © OpenStreetMap',
      },
      // 3. Esri World Topo Map (Clean contours, summits, elevations & passes from z=0 to z=19)
      'topo-tiles': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri Topo',
      },
      // 4. Mapterhorn Global DEM (Copernicus GLO-30 + JAXA void-free 3D elevation mesh)
      // Unified source for both 3D terrain extrusion and 2D hillshade relief shading
      'terrain-dem': {
        type: 'raster-dem',
        tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        encoding: 'terrarium',
        tileSize: 512,
        maxzoom: 15,
        attribution: '© Mapterhorn',
      },
      // 5. Dynamic Client-Side Slope Angle Overlay (CalTopo Avalanche Grade 0° - 90°)
      'slope-tiles': {
        type: 'raster',
        tiles: ['slope://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        tileSize: 512,
        maxzoom: 15,
        attribution: '© SkiAtlas Terrain Analysis',
      },
      // 8. Dynamic Client-Side Aspect Compass Solar Exposure Overlay (N, E, S, W)
      'aspect-tiles': {
        type: 'raster',
        tiles: ['aspect://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        tileSize: 512,
        maxzoom: 15,
        attribution: '© SkiAtlas Terrain Analysis',
      },
    },
    layers: [
      // Base 1: Satellite 3D (Standard Esri) — Berann-tuned: lift shadows, mute forest noise, cap snowfield blow-out
      {
        id: 'basemap-satellite',
        type: 'raster',
        source: 'satellite-tiles',
        layout: { visibility: basemapMode === 'satellite' ? 'visible' : 'none' },
        paint: {
          // Mute flatland color noise at continental zoom; desaturate dark conifer canopy at resort zoom so ski runs pop
          'raster-saturation': [
            'interpolate', ['linear'], ['zoom'],
            5, -0.20,
            8, -0.25,
            13, -0.38,
          ],
          // Boost macro ridge contrast from space; soften speckle close-up
          'raster-contrast': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.15,
            10, 0.06,
            13, -0.10,
          ],
          // Lift black floor so north-face shadows become soft charcoal-slate, not dead blotches
          'raster-brightness-min': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.05,
            13, 0.10,
          ],
          // Cap snowfield brightness so white labels stay legible
          'raster-brightness-max': 0.92,
          'raster-fade-duration': 0,
        },
      },
      // Base 1b: Satellite Cloudless (Seamless EOX Sentinel-2) — same Berann palette
      {
        id: 'basemap-cloudless',
        type: 'raster',
        source: 'cloudless-tiles',
        layout: { visibility: basemapMode === 'cloudless' ? 'visible' : 'none' },
        paint: {
          'raster-saturation': [
            'interpolate', ['linear'], ['zoom'],
            5, -0.18,
            8, -0.22,
            13, -0.35,
          ],
          'raster-contrast': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.12,
            10, 0.05,
            13, -0.08,
          ],
          'raster-brightness-min': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.04,
            13, 0.09,
          ],
          'raster-brightness-max': 0.93,
          'raster-fade-duration': 0,
        },
      },
      // Base 2: OpenStreetMap Standard
      {
        id: 'basemap-osm',
        type: 'raster',
        source: 'osm-tiles',
        layout: { visibility: basemapMode === 'osm' ? 'visible' : 'none' },
        paint: {
          'raster-contrast': 0.06,
          'raster-saturation': 0.05,
          'raster-brightness-min': 0.02,
          'raster-fade-duration': 0,
        },
      },
      // Base 2b: Clean OSM (CARTO Voyager No-Labels)
      {
        id: 'basemap-carto',
        type: 'raster',
        source: 'carto-tiles',
        layout: { visibility: basemapMode === 'carto' ? 'visible' : 'none' },
        paint: {
          'raster-contrast': 0.04,
          'raster-saturation': 0.05,
          'raster-fade-duration': 0,
        },
      },
      // Base 3: Alpine Topo Map (Clean contours, summits, elevations & passes from z=0 to z=19)
      {
        id: 'basemap-topo',
        type: 'raster',
        source: 'topo-tiles',
        layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
        paint: {
          'raster-contrast': 0.1,
          'raster-saturation': 0.12,
          'raster-brightness-min': 0.05,
          'raster-opacity': 1.0,
          'raster-fade-duration': 0,
        },
      },
      // Berann Alpine Tint Wash — deep slate-sage unifies noisy flatlands at continental zoom; fades to 0 at resort level
      // Non-interactive fill layer, sits above satellite/cloudless and below hillshade
      {
        id: 'berann-tint-wash',
        type: 'background',
        layout: { visibility: (basemapMode === 'satellite' || basemapMode === 'cloudless') ? 'visible' : 'none' },
        paint: {
          'background-color': '#1c2a24',
          'background-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.10,
            8, 0.08,
            11, 0.04,
            13, 0.0,
          ],
        },
      },
      // Alpine Berann-Glazed Hillshade — warm sunlit ridges, Prussian-blue shadows, oblique upper-left light
      {
        id: 'alpine-painted-hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
        paint: {
          // Zoom-scaled exaggeration: macro ranges look sculpted; close-up resort views stay clean
          'hillshade-exaggeration': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.45,
            12, 0.35,
            15, 0.20,
          ],
          // Viewport-anchored: light always rakes from upper-left regardless of camera bearing
          'hillshade-illumination-anchor': 'viewport',
          'hillshade-illumination-direction': 325,
          // Prussian blue shadows (Berann signature)
          'hillshade-shadow-color': '#0b1d30',
          // Warm golden-cream alpenglow on lit ridges
          'hillshade-highlight-color': '#fff3d1',
          // Subtle steep-rock/gully accent in dark alpine green
          'hillshade-accent-color': '#1a302b',
        },
      },
      // Berann Glaze for OSM & Voyager modes
      {
        id: 'hillshade-relief',
        type: 'hillshade',
        source: 'terrain-dem',
        layout: { visibility: (basemapMode === 'osm' || basemapMode === 'carto') && showHillshade ? 'visible' : 'none' },
        paint: {
          'hillshade-exaggeration': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.40,
            12, 0.30,
            15, 0.18,
          ],
          'hillshade-illumination-anchor': 'viewport',
          'hillshade-illumination-direction': 325,
          'hillshade-shadow-color': '#0b1d30',
          'hillshade-highlight-color': '#fff3d1',
          'hillshade-accent-color': '#1a302b',
        },
      },
    // Overlay 1: Dynamic Slope Angle Layer
    {
      id: 'overlay-slope',
      type: 'raster',
      source: 'slope-tiles',
      layout: { visibility: terrainOverlay === 'slope' ? 'visible' : 'none' },
      paint: {
        'raster-opacity': terrainOverlayOpacity,
        'raster-fade-duration': 150,
      },
    },
    // Overlay 2: Dynamic Aspect Compass Exposure Layer
    {
      id: 'overlay-aspect',
      type: 'raster',
      source: 'aspect-tiles',
      layout: { visibility: terrainOverlay === 'aspect' ? 'visible' : 'none' },
      paint: {
        'raster-opacity': terrainOverlayOpacity,
        'raster-fade-duration': 150,
      },
    },
  ],
  };
};

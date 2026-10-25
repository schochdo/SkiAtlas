import type { StyleSpecification } from 'maplibre-gl';
import type { EarthProjectionMode, BasemapMode, TerrainOverlayMode } from '../types';

export const createMapStyle = (
  earthProjection: EarthProjectionMode,
  basemapMode: BasemapMode,
  terrainOverlay: TerrainOverlayMode = 'none',
  terrainOverlayOpacity: number = 0.65
): StyleSpecification => ({
  version: 8,
  projection: { type: earthProjection },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    // 1. Esri World Imagery Satellite (Crisp 3D photo terrain)
    'satellite-tiles': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Esri Satellite',
    },
    // 2. OpenStreetMap (Clean vector roads, towns & trails)
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
    // 3. Esri World Physical Map (Painted relief up to zoom 8)
    'physical-tiles': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 8,
      attribution: 'Esri Physical',
    },
    // 4. Esri World Topo Map (Clean contours, summits, elevations & passes)
    'topo-tiles': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri Topo',
    },
    // 5. Mapterhorn Global DEM (Copernicus GLO-30 + JAXA void-free 3D elevation mesh)
    'terrain-dem': {
      type: 'raster-dem',
      tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 15,
      attribution: '© Mapterhorn',
    },
    // 6. Dedicated DEM source for painted hillshade relief
    'hillshade-dem': {
      type: 'raster-dem',
      tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 15,
    },
    // 7. Dynamic Client-Side Slope Angle Overlay (CalTopo Avalanche Grade 0° - 90°)
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
    // Base 1: Satellite 3D
    {
      id: 'basemap-satellite',
      type: 'raster',
      source: 'satellite-tiles',
      layout: { visibility: basemapMode === 'satellite' ? 'visible' : 'none' },
      paint: { 'raster-contrast': 0.1 },
    },
    // Base 2: OpenStreetMap
    {
      id: 'basemap-osm',
      type: 'raster',
      source: 'osm-tiles',
      layout: { visibility: basemapMode === 'osm' ? 'visible' : 'none' },
      paint: { 'raster-contrast': 0.06, 'raster-saturation': 0.05, 'raster-brightness-min': 0.02 },
    },
    // Base 3A: Alpine Physical Landcover (Visible at globe & regional zooms)
    {
      id: 'basemap-physical',
      type: 'raster',
      source: 'physical-tiles',
      layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
      paint: {
        'raster-contrast': 0.08,
        'raster-saturation': -0.15,
        'raster-brightness-min': 0.08,
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 8, 1.0, 9.5, 0.0] as any,
      },
    },
    // Base 3B: Topo Map Contours (Cross-fades in as you zoom in)
    {
      id: 'basemap-topo',
      type: 'raster',
      source: 'topo-tiles',
      layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
      paint: {
        'raster-contrast': 0.1,
        'raster-saturation': 0.12,
        'raster-brightness-min': 0.05,
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.0, 8, 0.5, 9.5, 1.0] as any,
      },
    },
    // Alpine Multi-Color Painted Hillshade
    {
      id: 'alpine-painted-hillshade',
      type: 'hillshade',
      source: 'hillshade-dem',
      layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
      paint: {
        'hillshade-exaggeration': 0.45,
        'hillshade-illumination-direction': 315,
        'hillshade-illumination-anchor': 'map',
        'hillshade-shadow-color': 'rgba(44, 62, 80, 0.42)',
        'hillshade-highlight-color': 'rgba(255, 255, 255, 0.75)',
        'hillshade-accent-color': 'rgba(74, 107, 83, 0.22)',
      },
    },
    // Subtle hillshade for OSM mode
    {
      id: 'hillshade-relief',
      type: 'hillshade',
      source: 'hillshade-dem',
      layout: { visibility: basemapMode === 'osm' ? 'visible' : 'none' },
      paint: {
        'hillshade-exaggeration': 0.35,
        'hillshade-shadow-color': 'rgba(51, 65, 85, 0.40)',
        'hillshade-highlight-color': 'rgba(255, 255, 255, 0.90)',
        'hillshade-accent-color': 'rgba(148, 163, 184, 0.30)',
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
});

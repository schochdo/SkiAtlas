import type { Map as MapLibreMap } from 'maplibre-gl';
import type { BasemapMode } from '../types';
import { SOURCE_IDS, LAYER_IDS } from './types';
import { getStaticDataUrl } from '../utils/url';

/**
 * Registers country boundaries, state borders, and hierarchical place reference labels
 */
export function registerBoundaryLayers(
  map: MapLibreMap,
  showCountryOutlines: boolean,
  basemapMode: BasemapMode
): void {
  const isDark = basemapMode === 'satellite' || basemapMode === 'cloudless';
  const visibility = showCountryOutlines ? 'visible' : 'none';

  // World Country & Administrative Boundary Lines
  map.addSource(SOURCE_IDS.WORLD_BOUNDARIES, {
    type: 'geojson',
    data: getStaticDataUrl('data/world_boundaries.geojson?v=20261108_ne10m_land_mesh'),
  });

  // Country International Borders
  map.addLayer({
    id: LAYER_IDS.WORLD_COUNTRY_BORDERS,
    type: 'line',
    source: SOURCE_IDS.WORLD_BOUNDARIES,
    filter: ['==', ['get', 'kind'], 'country_border'],
    layout: {
      visibility,
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': isDark ? '#FAF8F3' : '#334155',
      'line-opacity': [
        'interpolate', ['linear'], ['zoom'],
        1, 0.40,
        6, 0.65,
        10, 0.85,
      ],
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        1, 1.2,
        5, 1.8,
        8, 2.4,
        12, 3.0,
      ],
    },
  });

  // State / Province Administrative Borders
  map.addLayer({
    id: LAYER_IDS.WORLD_STATE_BORDERS,
    type: 'line',
    source: SOURCE_IDS.WORLD_BOUNDARIES,
    filter: ['==', ['get', 'kind'], 'state_border'],
    minzoom: 3.5,
    layout: {
      visibility,
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': isDark ? '#FAF8F3' : '#475569',
      'line-opacity': 0.35,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        3.5, 0.8,
        7, 1.2,
        11, 1.5,
      ],
      'line-dasharray': [2, 2],
    },
  });

  // Consolidated Matched-Pair Country Border Labels (Clean non-colliding, non-orphaned)
  map.addLayer({
    id: LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.WORLD_BOUNDARIES,
    filter: [
      'all',
      ['==', ['get', 'kind'], 'country_border'],
      ['any', ['has', 'name_left'], ['has', 'adm0_left']],
      ['any', ['has', 'name_right'], ['has', 'adm0_right']],
    ],
    minzoom: 9,
    maxzoom: 14.5,
    layout: {
      visibility,
      'symbol-placement': 'line',
      'symbol-spacing': [
        'interpolate', ['linear'], ['zoom'],
        8, 450,
        11, 800,
        14, 1300,
      ],
      'symbol-sort-key': 0.5,
      'symbol-avoid-edges': false,
      'text-field': [
        'format',
        ['upcase', ['coalesce', ['get', 'name_left'], ['get', 'adm0_left'], '']],
        {},
        '\n',
        {},
        ['upcase', ['coalesce', ['get', 'name_right'], ['get', 'adm0_right'], '']],
        {},
      ],
      'text-font': ['Open Sans Bold'],
      'text-size': 10,
      'text-letter-spacing': 0.25,
      'text-line-height': 1.65,
      'text-offset': [0, 0],
      'text-max-angle': 20,
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'map',
      'text-keep-upright': true,
      'text-padding': 4,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#FAF8F3',
      'text-halo-color': 'rgba(28, 27, 24, 0.78)',
      'text-halo-width': 1.25,
      'text-halo-blur': 0.5,
      'text-opacity': [
        'interpolate', ['linear'], ['zoom'],
        9.0, 0.85,
        10.0, 0.95,
        14.0, 0.95,
        14.5, 0.70,
      ],
    },
  });

  // Geographic Reference Places: 4-Tier Population & Alpine Horizon Hierarchy
  map.addSource(SOURCE_IDS.GEO_REFERENCE, {
    type: 'geojson',
    data: getStaticDataUrl('data/geo_reference.geojson?v=20261106_hierarchy'),
  });

  // Tier 4: Alpine Valley Hubs & Mountain Towns
  map.addLayer({
    id: LAYER_IDS.GEO_REFERENCE_ALPINE_HUBS,
    type: 'symbol',
    source: SOURCE_IDS.GEO_REFERENCE,
    filter: ['==', ['get', 'tier'], 4],
    minzoom: 6.8,
    maxzoom: 13.5,
    layout: {
      visibility,
      'symbol-sort-key': ['-', 20000000, ['coalesce', ['get', 'pop'], 0]],
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        6.8, 9.5,
        9.5, 11.0,
        13.0, 13.0,
      ],
      'text-offset': [0, 0.3],
      'text-anchor': 'top',
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-color': isDark ? '#F5F5F4' : '#292524',
      'text-halo-color': isDark ? '#1C1917' : '#FAF8F3',
      'text-halo-width': 2.6,
      'text-halo-blur': 0.5,
    },
  });

  // Tier 3: Regional Cities & Gateways
  map.addLayer({
    id: LAYER_IDS.GEO_REFERENCE_REGIONAL_CITIES,
    type: 'symbol',
    source: SOURCE_IDS.GEO_REFERENCE,
    filter: ['==', ['get', 'tier'], 3],
    minzoom: 7.0,
    maxzoom: 13.5,
    layout: {
      visibility,
      'symbol-sort-key': ['-', 20000000, ['coalesce', ['get', 'pop'], 0]],
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        7.0, 8.5,
        9.5, 10.0,
        12.0, 11.5,
      ],
      'text-letter-spacing': 0.01,
      'text-offset': [0, 0.3],
      'text-anchor': 'top',
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-color': isDark ? '#CBD5E1' : '#64748B',
      'text-halo-color': isDark ? '#1C1B18' : '#FAF8F3',
      'text-halo-width': 2.0,
      'text-halo-blur': 0.5,
    },
  });

  // Tier 2: Major Cities & Regional Capitals
  map.addLayer({
    id: LAYER_IDS.GEO_REFERENCE_MAJOR_CITIES,
    type: 'symbol',
    source: SOURCE_IDS.GEO_REFERENCE,
    filter: ['==', ['get', 'tier'], 2],
    minzoom: 5.0,
    maxzoom: 13.5,
    layout: {
      visibility,
      'symbol-sort-key': ['-', 20000000, ['coalesce', ['get', 'pop'], 0]],
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5.0, 9.0,
        7.5, 10.5,
        10.0, 12.0,
        13.0, 13.5,
      ],
      'text-letter-spacing': 0.03,
      'text-offset': [0, 0.3],
      'text-anchor': 'top',
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-color': isDark ? '#E2E8F0' : '#475569',
      'text-halo-color': isDark ? '#1C1B18' : '#FAF8F3',
      'text-halo-width': 2.2,
      'text-halo-blur': 0.5,
    },
  });

  // Tier 1: Megacities & World Metros
  map.addLayer({
    id: LAYER_IDS.GEO_REFERENCE_MEGACITIES,
    type: 'symbol',
    source: SOURCE_IDS.GEO_REFERENCE,
    filter: ['==', ['get', 'tier'], 1],
    minzoom: 3.0,
    maxzoom: 13.5,
    layout: {
      visibility,
      'symbol-sort-key': ['-', 20000000, ['coalesce', ['get', 'pop'], 0]],
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Semibold'],
      'text-transform': 'uppercase',
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        3.0, 9.0,
        6.0, 11.0,
        9.0, 13.0,
        12.0, 15.0,
      ],
      'text-letter-spacing': 0.12,
      'text-offset': [0, 0.3],
      'text-anchor': 'top',
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-color': isDark ? '#F8FAFC' : '#334155',
      'text-halo-color': isDark ? '#0F172A' : '#FAF8F3',
      'text-halo-width': 2.4,
      'text-halo-blur': 0.5,
    },
  });
}

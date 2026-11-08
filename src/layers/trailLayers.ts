import type { Map as MapLibreMap } from 'maplibre-gl';
import { SOURCE_IDS, LAYER_IDS } from './types';

/**
 * Registers local vector ski trails, aerial lifts, and selected trail highlight layers
 */
export function registerTrailLayers(map: MapLibreMap, showDownhill: boolean): void {
  // 1. Vector Ski Trails Source
  map.addSource(SOURCE_IDS.LIVE_PISTES, {
    type: 'geojson',
    promoteId: 'id',
    data: { type: 'FeatureCollection', features: [] },
    maxzoom: 22,
    buffer: 128,
    tolerance: 0.375,
  });

  // Translucent difficulty fill for freeride bowls, glades, and alpine areas
  map.addLayer({
    id: LAYER_IDS.PISTES_POLYGONS_FILL,
    type: 'fill',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'match',
        ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
        'novice', '#2E7D32',       // Alpine Green
        'easy', '#2E7D32',         // Alpine Green
        'intermediate', '#1565C0', // Cobalt Blue
        'advanced', '#1C1B18',     // Black Diamond
        'expert', '#B84A39',       // Double Black Vermilion
        'extreme', '#B84A39',      // Double Black Vermilion
        'freeride', '#B84A39',     // Double Black / Freeride Vermilion
        '#8A847C',
      ],
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        11, 0.12,
        13, 0.10,
        15, 0.08,
        17, 0.06,
      ],
    },
  });

  // Subtle dashed boundary outline for glades, bowls, and freeride terrain
  map.addLayer({
    id: LAYER_IDS.PISTES_POLYGONS_OUTLINE,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    layout: { visibility: 'none' },
    paint: {
      'line-color': [
        'match',
        ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
        'novice', '#2E7D32',
        'easy', '#2E7D32',
        'intermediate', '#1565C0',
        'advanced', '#1C1B18',
        'expert', '#B84A39',
        'extreme', '#B84A39',
        'freeride', '#B84A39',
        '#8A847C',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.4, 17, 2.0],
      'line-dasharray': [2, 2],
      'line-opacity': 0.75,
    },
  });

  // Outer Casing line
  map.addLayer({
    id: LAYER_IDS.PISTES_CASING,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#FAF8F3',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        10, 2.4,
        12, 3.8,
        14, 5.8,
        16, 8.0,
        18, 10.5,
      ],
      'line-opacity': 0.95,
    },
  });

  // Color lines
  map.addLayer({
    id: LAYER_IDS.PISTES_LINES,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': [
        'match',
        ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
        'novice', '#2E7D32',       // Alpine Green
        'easy', '#2E7D32',         // Alpine Green
        'intermediate', '#1565C0', // Cobalt Blue
        'advanced', '#1C1B18',     // Black Diamond
        'expert', '#B84A39',       // Double Black Vermilion
        'extreme', '#B84A39',      // Double Black Vermilion
        'freeride', '#B84A39',     // Double Black / Freeride Vermilion
        '#8A847C',
      ],
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        10, 1.4,
        12, 2.2,
        14, 3.6,
        16, 5.0,
        18, 6.8,
      ],
      'line-opacity': 1.0,
    },
  });

  // Calibrated invisible hit-target layer for piste lines
  map.addLayer({
    id: LAYER_IDS.PISTES_HIT_TARGET,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    layout: { visibility: 'none', 'line-cap': 'round' },
    paint: {
      'line-color': 'transparent',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        10, 14,
        12, 18,
        14, 24,
        16, 30,
        18, 38,
      ],
      'line-opacity': 0,
    },
  });

  // Aerialways / Lifts (Terracotta dashed line)
  map.addLayer({
    id: LAYER_IDS.PISTES_LIFTS,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: [
      'all',
      ['==', ['get', 'kind'], 'lift'],
      ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
      ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#B84A39',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        10, 1.8,
        12, 2.6,
        14, 3.8,
        16, 5.0,
        18, 6.2,
      ],
      'line-dasharray': [3, 2],
      'line-opacity': 1.0,
    },
  });

  // Calibrated invisible hit-target layer for lifts / aerialways
  map.addLayer({
    id: LAYER_IDS.PISTES_LIFTS_HIT_TARGET,
    type: 'line',
    source: SOURCE_IDS.LIVE_PISTES,
    filter: [
      'all',
      ['==', ['get', 'kind'], 'lift'],
      ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
      ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ],
    layout: { visibility: 'none', 'line-cap': 'round' },
    paint: {
      'line-color': 'transparent',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        10, 14,
        12, 18,
        14, 24,
        16, 30,
        18, 38,
      ],
      'line-opacity': 0,
    },
  });

  // Centroid Labels for Glades, Bowls, and Freeride Areas
  map.addLayer({
    id: LAYER_IDS.PISTES_POLYGONS_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.LIVE_PISTES,
    minzoom: 12.0,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    layout: {
      'visibility': 'none',
      'symbol-placement': 'point',
      'text-padding': 12,
      'text-field': [
        'case',
        [
          'any',
          ['!', ['has', 'name']],
          ['==', ['coalesce', ['get', 'name'], ''], ''],
          ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]],
        ],
        '',
        ['get', 'name'],
      ],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        12.0, 11,
        14.0, 13,
        16.0, 15,
        18.0, 17,
      ],
      'text-font': ['Open Sans Semibold'],
      'text-letter-spacing': 0.04,
      'text-keep-upright': true,
      'text-pitch-alignment': 'viewport',
      'text-rotation-alignment': 'viewport',
      'text-optional': true,
    },
    paint: {
      'text-color': '#1C1B18',
      'text-halo-color': '#FAF8F3',
      'text-halo-width': 2.6,
      'text-halo-blur': 0.5,
    },
  });

  // Upright 3D Trail & Lift Names
  map.addLayer({
    id: LAYER_IDS.PISTES_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.LIVE_PISTES,
    minzoom: 12.5,
    filter: [
      'all',
      ['!=', ['get', 'kind'], 'lift'],
      ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    ],
    layout: {
      'visibility': 'none',
      'symbol-placement': 'line',
      'symbol-spacing': 500,
      'text-padding': 10,
      'text-field': [
        'case',
        [
          'any',
          ['!', ['has', 'name']],
          ['==', ['coalesce', ['get', 'name'], ''], ''],
          ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]],
        ],
        '',
        ['get', 'name'],
      ],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        12.5, 11.5,
        14.0, 13.0,
        16.0, 15.0,
        18.0, 17.0,
      ],
      'text-font': ['Open Sans Bold'],
      'text-keep-upright': true,
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'viewport',
      'text-max-angle': 45,
    },
    paint: {
      'text-color': '#1C1B18',
      'text-halo-color': '#FAF8F3',
      'text-halo-width': 2.8,
      'text-halo-blur': 0.5,
    },
  });

  // Dedicated Aerialway / Lift Cable-Aligned Labels
  map.addLayer({
    id: LAYER_IDS.PISTES_LIFTS_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.LIVE_PISTES,
    minzoom: 12.5,
    filter: [
      'all',
      ['==', ['get', 'kind'], 'lift'],
      ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
      ['has', 'name'],
      ['!=', ['coalesce', ['get', 'name'], ''], ''],
      ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ],
    layout: {
      'visibility': showDownhill ? 'visible' : 'none',
      'symbol-placement': 'line',
      'symbol-spacing': 600,
      'text-padding': 12,
      'text-field': [
        'case',
        [
          'any',
          ['!', ['has', 'name']],
          ['==', ['coalesce', ['get', 'name'], ''], ''],
          ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]],
          ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]],
        ],
        '',
        ['get', 'name'],
      ],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        12.5, 11.0,
        14.0, 12.5,
        16.0, 14.2,
        18.0, 16.0,
      ],
      'text-font': ['Open Sans Bold'],
      'text-letter-spacing': 0.03,
      'text-keep-upright': true,
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'viewport',
      'text-max-angle': 45,
    },
    paint: {
      'text-color': '#7F1D1D',
      'text-halo-color': '#FAF8F3',
      'text-halo-width': 2.8,
      'text-halo-blur': 0.5,
    },
  });

  // 2. Clicked Trail / Slope Selected Highlight Source & Layers
  map.addSource(SOURCE_IDS.SELECTED_TRAIL, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_TRAIL_CASING,
    type: 'line',
    source: SOURCE_IDS.SELECTED_TRAIL,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#FAF8F3',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.0, 12, 5.5, 14, 8.0, 16, 11.0, 18, 14.0],
      'line-opacity': 1.0,
    },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_TRAIL_LINE,
    type: 'line',
    source: SOURCE_IDS.SELECTED_TRAIL,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#D97706',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 12, 3.4, 14, 5.0, 16, 7.5, 18, 10.0],
      'line-opacity': 1.0,
    },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_TRAIL_POLYGON_FILL,
    type: 'fill',
    source: SOURCE_IDS.SELECTED_TRAIL,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    paint: {
      'fill-color': '#D97706',
      'fill-opacity': 0.35,
    },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_TRAIL_POLYGON_OUTLINE,
    type: 'line',
    source: SOURCE_IDS.SELECTED_TRAIL,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    paint: {
      'line-color': '#D97706',
      'line-width': 2.8,
      'line-dasharray': [2, 1.5],
    },
  });
}

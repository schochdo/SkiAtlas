import type { Map as MapLibreMap } from 'maplibre-gl';
import type { BasemapMode } from '../types';
import { SOURCE_IDS, LAYER_IDS } from './types';

/**
 * Registers curated flagship resorts, selected resort pin, and global OpenSkiData clustered markers
 */
export function registerResortLayers(
  map: MapLibreMap,
  curatedFeatures: any[],
  globalFeatures: any[],
  basemapMode: BasemapMode
): void {
  const isDark = basemapMode === 'satellite' || basemapMode === 'cloudless';

  // 1. Curated Seed Resorts Source
  map.addSource(SOURCE_IDS.RESORTS, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: curatedFeatures as any },
  });

  // Curated Outer Ring
  map.addLayer({
    id: LAYER_IDS.RESORTS_OUTER_RING,
    type: 'circle',
    source: SOURCE_IDS.RESORTS,
    maxzoom: 12,
    filter: ['!=', ['get', 'category'], 'heli_cat'],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        2, 6,
        6, 8,
        10, 11,
      ],
      'circle-color': ['get', 'pass_color'],
      'circle-opacity': 0.25,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': ['get', 'pass_color'],
    },
  });

  // Curated Inner Ring
  map.addLayer({
    id: LAYER_IDS.RESORTS_INNER_DOT,
    type: 'circle',
    source: SOURCE_IDS.RESORTS,
    maxzoom: 12,
    filter: ['!=', ['get', 'category'], 'heli_cat'],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        2, 3,
        6, 4,
        10, 5,
      ],
      'circle-color': ['get', 'pass_color'],
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  // Curated Single Label
  map.addLayer({
    id: LAYER_IDS.RESORTS_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.RESORTS,
    minzoom: 5.5,
    maxzoom: 12,
    filter: ['!=', ['get', 'category'], 'heli_cat'],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        6, 12,
        9, 13.5,
        12, 15,
        15, 17,
      ],
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-letter-spacing': 0.02,
      'text-max-width': 18,
      'symbol-sort-key': 1,
      'text-padding': 8,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-optional': true,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': isDark ? '#FFFFFF' : '#0F172A',
      'text-halo-color': isDark ? '#0F172A' : '#FAF8F3',
      'text-halo-width': 2.8,
      'text-halo-blur': 0.5,
    },
  });

  // Heli & Cat Ski Outer Ring
  map.addLayer({
    id: LAYER_IDS.RESORTS_HELI_CAT_RING,
    type: 'circle',
    source: SOURCE_IDS.RESORTS,
    filter: ['==', ['get', 'category'], 'heli_cat'],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        2, 6,
        6, 8,
        10, 11,
        14, 15,
        18, 20,
      ],
      'circle-color': '#C85A32',
      'circle-opacity': 0.25,
      'circle-stroke-width': 1.6,
      'circle-stroke-color': '#C85A32',
    },
  });

  // Heli & Cat Ski Inner Dot
  map.addLayer({
    id: LAYER_IDS.RESORTS_HELI_CAT_DOT,
    type: 'circle',
    source: SOURCE_IDS.RESORTS,
    filter: ['==', ['get', 'category'], 'heli_cat'],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        2, 3,
        6, 4,
        10, 6,
        14, 7,
        18, 9,
      ],
      'circle-color': '#C85A32',
      'circle-stroke-width': 1.4,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  // Heli & Cat Ski Name Label
  map.addLayer({
    id: LAYER_IDS.RESORTS_HELI_CAT_LABELS,
    type: 'symbol',
    source: SOURCE_IDS.RESORTS,
    minzoom: 5.0,
    filter: ['==', ['get', 'category'], 'heli_cat'],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, 11.5,
        9, 13.5,
        13, 15,
        16, 17,
      ],
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-max-width': 14,
      'symbol-sort-key': 1,
      'text-padding': 8,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-optional': true,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': isDark ? '#FFFFFF' : '#0F172A',
      'text-halo-color': isDark ? '#0F172A' : '#FAF8F3',
      'text-halo-width': 2.8,
      'text-halo-blur': 0.5,
    },
  });

  // 2. Dedicated Selected Active Resort Pin & Target Ring
  map.addSource(SOURCE_IDS.SELECTED_RESORT, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_RESORT_PULSE,
    type: 'circle',
    source: SOURCE_IDS.SELECTED_RESORT,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        4, 14,
        8, 18,
        12, 24,
        16, 30,
      ],
      'circle-color': ['coalesce', ['get', 'pass_color'], '#C85A32'],
      'circle-opacity': 0.2,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': ['coalesce', ['get', 'pass_color'], '#C85A32'],
      'circle-stroke-opacity': 0.9,
    },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_RESORT_DOT,
    type: 'circle',
    source: SOURCE_IDS.SELECTED_RESORT,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        4, 5,
        8, 6.5,
        12, 8,
        16, 10,
      ],
      'circle-color': ['coalesce', ['get', 'pass_color'], '#C85A32'],
      'circle-stroke-width': 2.2,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.SELECTED_RESORT_LABEL,
    type: 'symbol',
    source: SOURCE_IDS.SELECTED_RESORT,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        4, 12,
        8, 13.5,
        12, 15,
        16, 17,
      ],
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'symbol-sort-key': 0,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-allow-overlap': true,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': isDark ? '#FFFFFF' : '#0F172A',
      'text-halo-color': isDark ? '#0F172A' : '#FAF8F3',
      'text-halo-width': 2.8,
      'text-halo-blur': 0.5,
    },
  });

  // 3. Global OpenSkiData Points Source & Clusters
  map.addSource(SOURCE_IDS.GLOBAL_SKI_AREAS, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: globalFeatures },
    cluster: true,
    clusterMaxZoom: 10,
    clusterRadius: 40,
  });

  // Color-coded cluster badges
  map.addLayer({
    id: LAYER_IDS.GLOBAL_CLUSTERS,
    type: 'circle',
    source: SOURCE_IDS.GLOBAL_SKI_AREAS,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#0284C7', // Sky Blue (< 15 resorts)
        15,
        '#D97706', // Warm Ochre (15 - 49 resorts)
        50,
        '#E05216', // Terracotta Vermilion (50 - 99 resorts)
        100,
        '#B91C1C', // Crimson Carmine (100+ resorts)
      ],
      'circle-opacity': 0.88,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        14,
        15,
        18,
        50,
        22,
        100,
        26,
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.GLOBAL_CLUSTER_COUNT,
    type: 'symbol',
    source: SOURCE_IDS.GLOBAL_SKI_AREAS,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#1C1B18',
      'text-halo-width': 0.8,
    },
  });

  // Global Ski Areas Outer Concentric Ring
  map.addLayer({
    id: LAYER_IDS.GLOBAL_UNCLUSTERED_OUTER_RING,
    type: 'circle',
    source: SOURCE_IDS.GLOBAL_SKI_AREAS,
    filter: ['!', ['has', 'point_count']],
    minzoom: 6.0,
    maxzoom: 12,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 7,
        10, 10,
        15, 14,
      ],
      'circle-color': [
        'match',
        ['get', 'category'],
        'nordic', '#2E5A44',
        'heli_cat', '#C25916',
        ['coalesce', ['get', 'pass_color'], '#3B627E'],
      ],
      'circle-opacity': 0.22,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': [
        'match',
        ['get', 'category'],
        'nordic', '#2E5A44',
        'heli_cat', '#C25916',
        ['coalesce', ['get', 'pass_color'], '#3B627E'],
      ],
    },
  });

  // Global Ski Areas Core Point
  map.addLayer({
    id: LAYER_IDS.GLOBAL_UNCLUSTERED_POINT,
    type: 'circle',
    source: SOURCE_IDS.GLOBAL_SKI_AREAS,
    filter: ['!', ['has', 'point_count']],
    maxzoom: 12,
    paint: {
      'circle-color': [
        'match',
        ['get', 'category'],
        'nordic', '#2E5A44',
        'heli_cat', '#C25916',
        ['coalesce', ['get', 'pass_color'], '#3B627E'],
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        2, 3,
        6, 4,
        10, 5,
        15, 6.5,
      ],
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  // Global Ski Areas Name Label
  map.addLayer({
    id: LAYER_IDS.GLOBAL_UNCLUSTERED_LABEL,
    type: 'symbol',
    source: SOURCE_IDS.GLOBAL_SKI_AREAS,
    filter: ['!', ['has', 'point_count']],
    minzoom: 6.5,
    maxzoom: 12,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        6.5, 11,
        9, 12.5,
        12, 14,
        15, 15.5,
      ],
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'symbol-sort-key': 2,
      'text-max-width': 16,
      'text-padding': 8,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-keep-upright': true,
      'text-optional': true,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': isDark ? '#FFFFFF' : '#0F172A',
      'text-halo-color': isDark ? '#0F172A' : '#FAF8F3',
      'text-halo-width': 2.6,
      'text-halo-blur': 0.5,
    },
  });
}

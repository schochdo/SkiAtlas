import type { BasemapMode } from '../types';

/* =========================================================================
   VECTOR LAYER SYSTEM TYPES & IDENTIFIERS
   ========================================================================= */

export const SOURCE_IDS = {
  LIVE_PISTES: 'live-pistes-vector',
  SELECTED_TRAIL: 'selected-trail-source',
  WORLD_BOUNDARIES: 'world-boundaries-source',
  GEO_REFERENCE: 'geo-reference-source',
  RESORTS: 'resorts-source',
  SELECTED_RESORT: 'selected-resort-source',
  GLOBAL_SKI_AREAS: 'global-ski-areas-source',
  MAJOR_PEAKS: 'major-peaks-source',
  FIRE_LOOKOUTS: 'fire-lookouts-source',
} as const;

export const LAYER_IDS = {
  // Pistes & Trails
  PISTES_POLYGONS_FILL: 'live-pistes-polygons-fill',
  PISTES_POLYGONS_OUTLINE: 'live-pistes-polygons-outline',
  PISTES_CASING: 'live-pistes-casing',
  PISTES_LINES: 'live-pistes-lines',
  PISTES_HIT_TARGET: 'live-pistes-hit-target',
  PISTES_LIFTS: 'live-pistes-lifts',
  PISTES_LIFTS_HIT_TARGET: 'live-pistes-lifts-hit-target',
  PISTES_POLYGONS_LABELS: 'live-pistes-polygons-labels',
  PISTES_LABELS: 'live-pistes-labels',
  PISTES_LIFTS_LABELS: 'live-pistes-lifts-labels',

  // Selected Trail Highlight
  SELECTED_TRAIL_CASING: 'selected-trail-casing',
  SELECTED_TRAIL_LINE: 'selected-trail-line',
  SELECTED_TRAIL_POLYGON_FILL: 'selected-trail-polygon-fill',
  SELECTED_TRAIL_POLYGON_OUTLINE: 'selected-trail-polygon-outline',

  // Boundaries & Reference
  WORLD_COUNTRY_BORDERS: 'world-country-borders',
  WORLD_STATE_BORDERS: 'world-state-borders',
  WORLD_COUNTRY_BORDER_LABELS: 'world-country-border-labels',
  WORLD_COUNTRY_BORDER_LABELS_LEFT: 'world-country-border-labels-left',
  WORLD_COUNTRY_BORDER_LABELS_RIGHT: 'world-country-border-labels-right',
  GEO_REFERENCE_MEGACITIES: 'geo-reference-megacities',
  GEO_REFERENCE_MAJOR_CITIES: 'geo-reference-major-cities',
  GEO_REFERENCE_REGIONAL_CITIES: 'geo-reference-regional-cities',
  GEO_REFERENCE_ALPINE_HUBS: 'geo-reference-alpine-hubs',

  // Curated Flagship Resorts
  RESORTS_OUTER_RING: 'resorts-outer-ring',
  RESORTS_INNER_DOT: 'resorts-inner-dot',
  RESORTS_LABELS: 'resorts-labels',
  RESORTS_HELI_CAT_RING: 'resorts-heli-cat-ring',
  RESORTS_HELI_CAT_DOT: 'resorts-heli-cat-dot',
  RESORTS_HELI_CAT_LABELS: 'resorts-heli-cat-labels',

  // Selected Resort Marker
  SELECTED_RESORT_PULSE: 'selected-resort-pulse',
  SELECTED_RESORT_DOT: 'selected-resort-dot',
  SELECTED_RESORT_LABEL: 'selected-resort-label',

  // Global OpenSkiData Clusters & Points
  GLOBAL_CLUSTERS: 'global-clusters',
  GLOBAL_CLUSTER_COUNT: 'global-cluster-count',
  GLOBAL_UNCLUSTERED_OUTER_RING: 'global-unclustered-outer-ring',
  GLOBAL_UNCLUSTERED_POINT: 'global-unclustered-point',
  GLOBAL_UNCLUSTERED_LABEL: 'global-unclustered-label',

  // Major Summits
  MAJOR_PEAKS_TIER3: 'major-peaks-marker-tier3',
  MAJOR_PEAKS_TIER2: 'major-peaks-marker-tier2',
  MAJOR_PEAKS_TIER1: 'major-peaks-marker-tier1',
  MAJOR_PEAKS_LABEL: 'major-peaks-label',

  // Fire Lookouts
  FIRE_LOOKOUTS_TIER3: 'fire-lookouts-marker-tier3',
  FIRE_LOOKOUTS_TIER2: 'fire-lookouts-marker-tier2',
  FIRE_LOOKOUTS_TIER1: 'fire-lookouts-marker-tier1',
  FIRE_LOOKOUTS_LABEL: 'fire-lookouts-label',
} as const;

export interface VectorLayerRegistrationOptions {
  showDownhill: boolean;
  showTouring?: boolean;
  showCountryOutlines: boolean;
  showPeaks: boolean;
  showLookouts: boolean;
  unitsMetric: boolean;
  basemapMode: BasemapMode;
  curatedFeatures: any[];
  globalFeatures: any[];
}

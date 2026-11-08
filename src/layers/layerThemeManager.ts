import type { Map as MapLibreMap } from 'maplibre-gl';
import type { BasemapMode, SkiResort } from '../types';
import { LAYER_IDS } from './types';

export interface ResortFilterSyncOptions {
  showDownhill: boolean;
  showNordic: boolean;
  showHeliCat: boolean;
  effectiveMinVerticalFt: number;
  effectiveMinAcreage: number;
  effectiveMinNordicKm: number;
  selectedResort: SkiResort | null;
}

/**
 * Synchronizes borders, places, and labels with basemap light/dark palette and toggle
 */
export function syncGeoReferenceTheme(
  map: MapLibreMap,
  showCountryOutlines: boolean,
  basemapMode: BasemapMode
): void {
  const isDark = basemapMode === 'satellite' || basemapMode === 'cloudless';
  const refVisibility = showCountryOutlines ? 'visible' : 'none';

  if (map.getLayer(LAYER_IDS.WORLD_COUNTRY_BORDERS)) {
    map.setLayoutProperty(LAYER_IDS.WORLD_COUNTRY_BORDERS, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDERS, 'line-color', isDark ? '#FAF8F3' : '#334155');
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDERS, 'line-opacity', isDark ? 0.65 : 0.45);
  }
  if (map.getLayer(LAYER_IDS.WORLD_STATE_BORDERS)) {
    map.setLayoutProperty(LAYER_IDS.WORLD_STATE_BORDERS, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.WORLD_STATE_BORDERS, 'line-color', isDark ? '#FAF8F3' : '#475569');
    map.setPaintProperty(LAYER_IDS.WORLD_STATE_BORDERS, 'line-opacity', isDark ? 0.35 : 0.25);
  }
  if (map.getLayer(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_LEFT)) {
    map.setLayoutProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_LEFT, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_LEFT, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_LEFT, 'text-halo-color', isDark ? '#0F0E0D' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_RIGHT)) {
    map.setLayoutProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_RIGHT, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_RIGHT, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.WORLD_COUNTRY_BORDER_LABELS_RIGHT, 'text-halo-color', isDark ? '#0F0E0D' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.GEO_REFERENCE_MEGACITIES)) {
    map.setLayoutProperty(LAYER_IDS.GEO_REFERENCE_MEGACITIES, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_MEGACITIES, 'text-color', isDark ? '#F8FAFC' : '#334155');
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_MEGACITIES, 'text-halo-color', isDark ? '#0F172A' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.GEO_REFERENCE_MAJOR_CITIES)) {
    map.setLayoutProperty(LAYER_IDS.GEO_REFERENCE_MAJOR_CITIES, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_MAJOR_CITIES, 'text-color', isDark ? '#E2E8F0' : '#475569');
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_MAJOR_CITIES, 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.GEO_REFERENCE_REGIONAL_CITIES)) {
    map.setLayoutProperty(LAYER_IDS.GEO_REFERENCE_REGIONAL_CITIES, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_REGIONAL_CITIES, 'text-color', isDark ? '#CBD5E1' : '#64748B');
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_REGIONAL_CITIES, 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.GEO_REFERENCE_ALPINE_HUBS)) {
    map.setLayoutProperty(LAYER_IDS.GEO_REFERENCE_ALPINE_HUBS, 'visibility', refVisibility);
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_ALPINE_HUBS, 'text-color', isDark ? '#F5F5F4' : '#292524');
    map.setPaintProperty(LAYER_IDS.GEO_REFERENCE_ALPINE_HUBS, 'text-halo-color', isDark ? '#1C1917' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.RESORTS_LABELS)) {
    map.setPaintProperty(LAYER_IDS.RESORTS_LABELS, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.RESORTS_LABELS, 'text-halo-color', isDark ? '#0F172A' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.RESORTS_HELI_CAT_LABELS)) {
    map.setPaintProperty(LAYER_IDS.RESORTS_HELI_CAT_LABELS, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.RESORTS_HELI_CAT_LABELS, 'text-halo-color', isDark ? '#0F172A' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.GLOBAL_UNCLUSTERED_LABEL)) {
    map.setPaintProperty(LAYER_IDS.GLOBAL_UNCLUSTERED_LABEL, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.GLOBAL_UNCLUSTERED_LABEL, 'text-halo-color', isDark ? '#0F172A' : '#FAF8F3');
  }
  if (map.getLayer(LAYER_IDS.SELECTED_RESORT_LABEL)) {
    map.setPaintProperty(LAYER_IDS.SELECTED_RESORT_LABEL, 'text-color', isDark ? '#FFFFFF' : '#0F172A');
    map.setPaintProperty(LAYER_IDS.SELECTED_RESORT_LABEL, 'text-halo-color', isDark ? '#0F172A' : '#FAF8F3');
  }
  ['major-peaks-label', 'major-peaks-label-tier1', 'major-peaks-label-tier2', 'major-peaks-label-tier3'].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'text-color', isDark ? '#FDE68A' : '#852E1C');
      map.setPaintProperty(layerId, 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
    }
  });
  if (map.getLayer(LAYER_IDS.FIRE_LOOKOUTS_LABEL)) {
    map.setPaintProperty(LAYER_IDS.FIRE_LOOKOUTS_LABEL, 'text-color', isDark ? '#FDBA74' : '#9A3412');
    map.setPaintProperty(LAYER_IDS.FIRE_LOOKOUTS_LABEL, 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
  }
}

/**
 * Synchronizes major mountain summit layers with visibility toggle and unit system
 */
export function syncPeakLayers(
  map: MapLibreMap,
  showPeaks: boolean,
  unitsMetric: boolean
): void {
  const visibility = showPeaks ? 'visible' : 'none';
  const peakLayers = [
    'major-peaks-marker-tier1', 'major-peaks-marker-tier2', 'major-peaks-marker-tier3', 'major-peaks-marker',
    'major-peaks-label-tier1', 'major-peaks-label-tier2', 'major-peaks-label-tier3', 'major-peaks-label'
  ];

  peakLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
      if (layerId === 'major-peaks-label') {
        map.setLayoutProperty(layerId, 'text-field', [
          'step', ['zoom'],
          ['case', ['==', ['coalesce', ['get', 'tier'], 3], 1], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
          8.0,
          ['case', ['<=', ['coalesce', ['get', 'tier'], 3], 2], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
          10.0,
          ['get', unitsMetric ? 'label_m' : 'label_ft'],
        ]);
      } else if (layerId.includes('label')) {
        map.setLayoutProperty(layerId, 'text-field', ['get', unitsMetric ? 'label_m' : 'label_ft']);
      }
    }
  });
}

/**
 * Synchronizes fire lookout layers with visibility toggle and unit system
 */
export function syncLookoutLayers(
  map: MapLibreMap,
  showLookouts: boolean,
  unitsMetric: boolean,
  lookoutPopupRef?: { current: any }
): void {
  if (!showLookouts && lookoutPopupRef?.current) {
    lookoutPopupRef.current.remove();
    lookoutPopupRef.current = null;
  }

  const visibility = showLookouts ? 'visible' : 'none';
  const lookoutLayers = [
    'fire-lookouts-marker-tier1', 'fire-lookouts-marker-tier2', 'fire-lookouts-marker-tier3',
    'fire-lookouts-label'
  ];

  lookoutLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
      if (layerId === 'fire-lookouts-label') {
        map.setLayoutProperty(layerId, 'text-field', [
          'step', ['zoom'],
          ['case', ['==', ['coalesce', ['get', 'tier'], 3], 1], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
          7.8,
          ['case', ['<=', ['coalesce', ['get', 'tier'], 3], 2], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
          9.5,
          ['get', unitsMetric ? 'label_m' : 'label_ft'],
        ]);
      }
    }
  });
}

/**
 * Synchronizes ski trails and lifts with active discipline filters (Downhill / Nordic / HeliCat)
 */
export function syncTrailFilterAndVisibility(
  map: MapLibreMap,
  showDownhill: boolean,
  showNordic: boolean,
  showHeliCat: boolean
): void {
  const anyTrails = showDownhill || showNordic || showHeliCat;
  const allowedConditions: any[] = [];

  const heliCatExclusion: any = showHeliCat
    ? null
    : ['!=', ['coalesce', ['get', 'is_heli_cat'], false], true];

  if (showDownhill) {
    const dlCond: any[] = [
      'all',
      ['!=', ['get', 'piste:type'], 'nordic'],
      ['!=', ['coalesce', ['get', 'resort_category'], ''], 'nordic'],
      [
        'any',
        ['==', ['get', 'piste:type'], 'downhill'],
        ['==', ['get', 'piste:type'], 'connection'],
      ],
    ];
    if (heliCatExclusion) {
      allowedConditions.push(['all', dlCond, heliCatExclusion]);
    } else {
      allowedConditions.push(dlCond);
    }
  }

  if (showNordic) {
    allowedConditions.push([
      'any',
      ['==', ['get', 'piste:type'], 'nordic'],
      ['==', ['get', 'resort_category'], 'nordic'],
    ]);
  }

  if (showHeliCat && !showDownhill) {
    allowedConditions.push([
      'any',
      ['==', ['get', 'piste:type'], 'downhill'],
      ['==', ['get', 'piste:type'], 'connection'],
    ]);
  }

  const nonSkiExclusion = [
    '!',
    [
      'in',
      ['coalesce', ['get', 'piste:type'], ''],
      ['literal', ['fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other', 'skitour', 'backcountry']],
    ],
  ];

  const isLineGeom = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']];
  const isPolyGeom = ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']];

  let pisteFilter: any;
  if (allowedConditions.length === 0) {
    pisteFilter = ['==', '1', '0'];
  } else if (allowedConditions.length === 1) {
    pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, nonSkiExclusion, allowedConditions[0]];
  } else {
    pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, nonSkiExclusion, ['any', ...allowedConditions]];
  }

  let polyPisteFilter: any;
  if (allowedConditions.length === 0) {
    polyPisteFilter = ['==', '1', '0'];
  } else if (allowedConditions.length === 1) {
    polyPisteFilter = ['all', isPolyGeom, nonSkiExclusion, allowedConditions[0]];
  } else {
    polyPisteFilter = ['all', isPolyGeom, nonSkiExclusion, ['any', ...allowedConditions]];
  }

  const labelFilter: any = [
    'all',
    pisteFilter,
    ['has', 'name'],
    ['!=', ['coalesce', ['get', 'name'], ''], ''],
    ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]]],
  ];

  const polyLabelFilter: any = [
    'all',
    polyPisteFilter,
    ['has', 'name'],
    ['!=', ['coalesce', ['get', 'name'], ''], ''],
    ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]]],
  ];

  ['live-pistes-casing', 'live-pistes-lines', 'live-pistes-hit-target'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
      if (anyTrails) map.setFilter(id, pisteFilter);
    }
  });

  ['live-pistes-polygons-fill', 'live-pistes-polygons-outline'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
      if (anyTrails) map.setFilter(id, polyPisteFilter);
    }
  });

  if (map.getLayer('live-pistes-labels')) {
    map.setLayoutProperty('live-pistes-labels', 'visibility', anyTrails ? 'visible' : 'none');
    if (anyTrails) map.setFilter('live-pistes-labels', labelFilter);
  }

  if (map.getLayer('live-pistes-polygons-labels')) {
    map.setLayoutProperty('live-pistes-polygons-labels', 'visibility', anyTrails ? 'visible' : 'none');
    if (anyTrails) map.setFilter('live-pistes-polygons-labels', polyLabelFilter);
  }

  const liftVisible = showDownhill || showHeliCat;
  const baseLiftConditions: any[] = [
    ['==', ['get', 'kind'], 'lift'],
    ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
  ];
  if (heliCatExclusion) {
    baseLiftConditions.push(heliCatExclusion);
  }
  const liftFilter: any = ['all', ...baseLiftConditions];

  const liftLabelFilter: any = [
    'all',
    ...baseLiftConditions,
    ['has', 'name'],
    ['!=', ['coalesce', ['get', 'name'], ''], ''],
    ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'untitled', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
  ];

  ['live-pistes-lifts', 'live-pistes-lifts-hit-target'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', liftVisible ? 'visible' : 'none');
      if (liftVisible) map.setFilter(id, liftFilter);
    }
  });
  if (map.getLayer('live-pistes-lifts-labels')) {
    map.setLayoutProperty('live-pistes-lifts-labels', 'visibility', liftVisible ? 'visible' : 'none');
    if (liftVisible) map.setFilter('live-pistes-lifts-labels', liftLabelFilter);
  }
}

/**
 * Synchronizes GPU map points with category and slider thresholds
 */
export function syncResortPointFilters(
  map: MapLibreMap,
  options: ResortFilterSyncOptions
): void {
  const {
    showDownhill,
    showNordic,
    showHeliCat,
    effectiveMinVerticalFt,
    effectiveMinAcreage,
    effectiveMinNordicKm,
    selectedResort,
  } = options;

  const allowedCats: string[] = [];
  if (showDownhill) allowedCats.push('downhill');
  if (showNordic) allowedCats.push('nordic');
  if (showHeliCat) allowedCats.push('heli_cat');

  const downhillConditions: any[] = ['all'];
  if (effectiveMinVerticalFt > 0) {
    downhillConditions.push(['>=', ['coalesce', ['get', 'vertical_ft'], ['get', 'vertical_drop_ft'], 0], effectiveMinVerticalFt]);
  }
  if (effectiveMinAcreage > 0) {
    downhillConditions.push(['>=', ['coalesce', ['get', 'skiable_acres'], 0], effectiveMinAcreage]);
  }

  const nordicConditions: any[] = ['all'];
  if (effectiveMinNordicKm > 0) {
    nordicConditions.push(['>=', ['coalesce', ['get', 'trail_km'], 0], effectiveMinNordicKm]);
  }

  const filterExpr: any[] = [
    'all',
    ['in', ['get', 'category'], ['literal', allowedCats]],
    [
      'case',
      ['==', ['get', 'category'], 'downhill'],
      downhillConditions,
      ['==', ['get', 'category'], 'nordic'],
      nordicConditions,
      true,
    ],
  ];

  const notSelected: any = selectedResort?.id
    ? ['!=', ['coalesce', ['get', 'id'], ''], selectedResort.id]
    : true;

  ['resorts-outer-ring', 'resorts-inner-dot'].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setFilter(layerId, ['all', ['!=', ['get', 'category'], 'heli_cat'], filterExpr] as any);
    }
  });
  if (map.getLayer('resorts-labels')) {
    map.setFilter('resorts-labels', ['all', ['!=', ['get', 'category'], 'heli_cat'], notSelected, filterExpr] as any);
  }

  ['resorts-heli-cat-ring', 'resorts-heli-cat-dot'].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', showHeliCat ? 'visible' : 'none');
      map.setFilter(layerId, ['all', ['==', ['get', 'category'], 'heli_cat'], filterExpr] as any);
    }
  });
  if (map.getLayer('resorts-heli-cat-labels')) {
    map.setLayoutProperty('resorts-heli-cat-labels', 'visibility', showHeliCat ? 'visible' : 'none');
    map.setFilter('resorts-heli-cat-labels', ['all', ['==', ['get', 'category'], 'heli_cat'], notSelected, filterExpr] as any);
  }

  const unclusteredFilter: any = ['all', ['!', ['has', 'point_count']], filterExpr];
  if (map.getLayer('global-unclustered-outer-ring')) {
    map.setFilter('global-unclustered-outer-ring', unclusteredFilter);
  }
  if (map.getLayer('global-unclustered-point')) {
    map.setFilter('global-unclustered-point', unclusteredFilter);
  }
  if (map.getLayer('global-unclustered-label')) {
    map.setFilter('global-unclustered-label', ['all', unclusteredFilter, notSelected] as any);
  }
}

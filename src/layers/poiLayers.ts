import type { Map as MapLibreMap } from 'maplibre-gl';
import type { BasemapMode } from '../types';
import { SOURCE_IDS, LAYER_IDS } from './types';
import { getStaticDataUrl } from '../utils/url';

/**
 * Registers mountain summits (major peaks) and historic fire lookouts
 */
export function registerPoiLayers(
  map: MapLibreMap,
  showPeaks: boolean,
  showLookouts: boolean,
  unitsMetric: boolean,
  basemapMode: BasemapMode
): void {
  const isDark = basemapMode === 'satellite' || basemapMode === 'cloudless';
  const peakVisibility = showPeaks ? 'visible' : 'none';
  const lookoutVisibility = showLookouts ? 'visible' : 'none';

  // 1. Major Mountain Summits Source
  map.addSource(SOURCE_IDS.MAJOR_PEAKS, {
    type: 'geojson',
    promoteId: 'id',
    data: getStaticDataUrl('data/major_peaks.geojson?v=20261106_dem_clean_summits'),
  });

  // Markers: Tier 3 -> Tier 2 -> Tier 1
  map.addLayer({
    id: LAYER_IDS.MAJOR_PEAKS_TIER3,
    type: 'circle',
    source: SOURCE_IDS.MAJOR_PEAKS,
    minzoom: 10.0,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 3],
    layout: {
      visibility: peakVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10.0, 2.0,
        12.0, 3.0,
        14.0, 4.0,
      ],
      'circle-color': '#B84A39',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.MAJOR_PEAKS_TIER2,
    type: 'circle',
    source: SOURCE_IDS.MAJOR_PEAKS,
    minzoom: 8.0,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 2],
    layout: {
      visibility: peakVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8.0, 2.0,
        11.0, 2.8,
        14.0, 4.0,
      ],
      'circle-color': '#B84A39',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.MAJOR_PEAKS_TIER1,
    type: 'circle',
    source: SOURCE_IDS.MAJOR_PEAKS,
    minzoom: 6.0,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 1],
    layout: {
      visibility: peakVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6.0, 2.0,
        9.0, 3.0,
        14.0, 4.2,
      ],
      'circle-color': '#B84A39',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  // Unified Mountain Peak Labels
  map.addLayer({
    id: LAYER_IDS.MAJOR_PEAKS_LABEL,
    type: 'symbol',
    source: SOURCE_IDS.MAJOR_PEAKS,
    minzoom: 6.0,
    layout: {
      'visibility': peakVisibility,
      'symbol-sort-key': ['-', 50000, ['coalesce', ['get', 'elevation_ft'], 0]],
      'text-field': [
        'step', ['zoom'],
        ['case', ['==', ['coalesce', ['get', 'tier'], 3], 1], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
        8.0,
        ['case', ['<=', ['coalesce', ['get', 'tier'], 3], 2], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
        10.0,
        ['get', unitsMetric ? 'label_m' : 'label_ft'],
      ],
      'text-font': ['Open Sans Bold Italic'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        6.0, 9.0,
        9.0, 10.5,
        12.0, 12.0,
        15.0, 14.0,
      ],
      'text-max-width': 26,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
      'text-letter-spacing': 0.04,
      'text-keep-upright': true,
      'text-pitch-alignment': 'viewport',
      'text-rotation-alignment': 'viewport',
      'text-padding': 4,
      'text-optional': true,
    },
    paint: {
      'text-color': isDark ? '#FDE68A' : '#852E1C',
      'text-halo-color': isDark ? '#1C1B18' : '#FAF8F3',
      'text-halo-width': 2.4,
      'text-halo-blur': 0.5,
    },
  });

  // 2. Fire Lookouts & Watchtowers Source
  map.addSource(SOURCE_IDS.FIRE_LOOKOUTS, {
    type: 'geojson',
    promoteId: 'id',
    data: getStaticDataUrl('data/fire_lookouts.geojson?v=20261108_v4'),
  });

  // Markers: Tier 3 -> Tier 2 -> Tier 1
  map.addLayer({
    id: LAYER_IDS.FIRE_LOOKOUTS_TIER3,
    type: 'circle',
    source: SOURCE_IDS.FIRE_LOOKOUTS,
    minzoom: 8.0,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 3],
    layout: {
      visibility: lookoutVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8.0, 1.8,
        11.0, 2.8,
        14.0, 4.0,
      ],
      'circle-color': '#D96B27',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.FIRE_LOOKOUTS_TIER2,
    type: 'circle',
    source: SOURCE_IDS.FIRE_LOOKOUTS,
    minzoom: 6.5,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 2],
    layout: {
      visibility: lookoutVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6.5, 1.8,
        9.0, 2.6,
        14.0, 4.0,
      ],
      'circle-color': '#D96B27',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  map.addLayer({
    id: LAYER_IDS.FIRE_LOOKOUTS_TIER1,
    type: 'circle',
    source: SOURCE_IDS.FIRE_LOOKOUTS,
    minzoom: 4.8,
    filter: ['==', ['coalesce', ['get', 'tier'], 3], 1],
    layout: {
      visibility: lookoutVisibility,
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        4.8, 1.8,
        7.0, 2.4,
        10.0, 3.2,
        14.0, 4.2,
      ],
      'circle-color': '#D96B27',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FAF8F3',
    },
  });

  // Fire Lookout Labels
  map.addLayer({
    id: LAYER_IDS.FIRE_LOOKOUTS_LABEL,
    type: 'symbol',
    source: SOURCE_IDS.FIRE_LOOKOUTS,
    minzoom: 5.8,
    layout: {
      'visibility': lookoutVisibility,
      'symbol-sort-key': ['coalesce', ['get', 'sort_key'], 0],
      'text-field': [
        'step', ['zoom'],
        ['case', ['==', ['coalesce', ['get', 'tier'], 3], 1], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
        7.8,
        ['case', ['<=', ['coalesce', ['get', 'tier'], 3], 2], ['get', unitsMetric ? 'label_m' : 'label_ft'], ''],
        9.5,
        ['get', unitsMetric ? 'label_m' : 'label_ft'],
      ],
      'text-font': ['Open Sans Bold Italic'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5.8, 8.5,
        8.0, 10.0,
        11.0, 11.5,
        14.0, 13.5,
      ],
      'text-max-width': 26,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
      'text-letter-spacing': 0.04,
      'text-keep-upright': true,
      'text-pitch-alignment': 'viewport',
      'text-rotation-alignment': 'viewport',
      'text-padding': 4,
      'text-optional': true,
    },
    paint: {
      'text-color': isDark ? '#FDBA74' : '#9A3412',
      'text-halo-color': isDark ? '#1C1B18' : '#FAF8F3',
      'text-halo-width': 2.4,
      'text-halo-blur': 0.5,
    },
  });
}

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { VectorLayerRegistrationOptions } from './types';
import { registerTrailLayers } from './trailLayers';
import { registerBoundaryLayers } from './boundaryLayers';
import { registerResortLayers } from './resortLayers';
import { registerPoiLayers } from './poiLayers';

export * from './types';
export * from './trailLayers';
export * from './boundaryLayers';
export * from './resortLayers';
export * from './poiLayers';
export * from './layerThemeManager';

/**
 * Registers all vector sources and layers onto the MapLibre map in strict draw order:
 * 1. Trails & Aerialways (live-pistes-vector, selected-trail-source)
 * 2. Country & State Boundaries (world-boundaries-source)
 * 3. Geographic Reference Places (geo-reference-source)
 * 4. Curated Resorts & Clusters (resorts-source, selected-resort-source, global-ski-areas-source)
 * 5. Mountain Summits & Fire Lookouts (major-peaks-source, fire-lookouts-source)
 */
export function registerAllVectorLayers(
  map: MapLibreMap,
  options: VectorLayerRegistrationOptions
): void {
  // 1. Trails & Aerialway Infrastructure
  registerTrailLayers(map, options.showDownhill);

  // 2. World Boundaries & Geographic Reference Places
  registerBoundaryLayers(map, options.showCountryOutlines, options.basemapMode);

  // 3. Curated Flagship Resorts & Clustered Global Points
  registerResortLayers(map, options.curatedFeatures, options.globalFeatures, options.basemapMode);

  // 4. Mountain Summits & Historic Fire Lookouts
  registerPoiLayers(
    map,
    options.showPeaks,
    options.showLookouts,
    options.unitsMetric,
    options.basemapMode
  );
}

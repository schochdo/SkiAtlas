import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { SkiResort, PassNetwork } from '../../types';
import type { ResortFilterCriteria, ResortCatalogSortOptions } from './types';
import { GLOBAL_SKI_ATLAS } from '../../data/resorts';
import { HELI_CAT_OPERATIONS } from '../../data/heliCat';
import { PASS_COLORS } from '../../utils/classification';
import { SOURCE_IDS } from '../../layers/types';

/**
 * Filters and sorts the master resort list based on user selections and search criteria
 */
export function filterResortCatalog(
  resorts: SkiResort[],
  criteria: ResortFilterCriteria,
  sortOptions: ResortCatalogSortOptions
): SkiResort[] {
  const {
    showDownhill,
    showNordic,
    showHeliCat,
    selectedPasses,
    effectiveMinVerticalFt,
    effectiveMinAcreage,
    effectiveMinNordicKm,
    searchQuery,
  } = criteria;

  const { sortBy, sortOrder } = sortOptions;

  const list = resorts.filter((r) => {
    if (r.is_closed) return false;
    const cat = r.category || 'downhill';
    if (cat === 'downhill' && !showDownhill) return false;
    if (cat === 'nordic' && !showNordic) return false;
    if (cat === 'heli_cat' && !showHeliCat) return false;

    const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
    if (!passMatch) return false;

    // Downhill alpine resorts filtered by vertical drop and skiable acreage
    if (cat === 'downhill') {
      if (effectiveMinVerticalFt > 0 && (r.vertical_drop_ft === null || r.vertical_drop_ft === undefined || r.vertical_drop_ft < effectiveMinVerticalFt)) return false;
      if (effectiveMinAcreage > 0 && (r.skiable_acres === null || r.skiable_acres === undefined || r.skiable_acres < effectiveMinAcreage)) return false;
    } else if (cat === 'nordic') {
      // Nordic cross-country networks filtered by trail network length (km)
      if (effectiveMinNordicKm > 0 && ((r.trail_km || 0) < effectiveMinNordicKm)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = r.name.toLowerCase().includes(q);
      const matchesRegion = (r.region || '').toLowerCase().includes(q);
      const matchesCountry = (r.country || '').toLowerCase().includes(q);
      const matchesSummary = (r.summary || '').toLowerCase().includes(q);
      if (!matchesName && !matchesRegion && !matchesCountry && !matchesSummary) return false;
    }

    return true;
  });

  const multiplier = sortOrder === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (sortBy === 'snow') {
      const diff = (a.weather?.snowfall_7d_in ?? 0) - (b.weather?.snowfall_7d_in ?? 0);
      return diff * multiplier;
    } else if (sortBy === 'vert') {
      const diff = (a.vertical_drop_ft || 0) - (b.vertical_drop_ft || 0);
      return diff * multiplier;
    } else if (sortBy === 'acres') {
      const valA = a.category === 'nordic' ? (a.trail_km || a.run_count || 0) : (a.skiable_acres || 0);
      const valB = b.category === 'nordic' ? (b.trail_km || b.run_count || 0) : (b.skiable_acres || 0);
      const diff = valA - valB;
      return diff * multiplier;
    } else {
      return a.name.localeCompare(b.name) * multiplier;
    }
  });

  return list;
}

/**
 * Filters resorts within visible map viewport bounding box (handles antimeridian wrapping)
 */
export function filterResortsInBounds(
  resorts: SkiResort[],
  viewportBounds: [number, number, number, number] | null
): SkiResort[] {
  if (!viewportBounds) return resorts;
  const [west, south, east, north] = viewportBounds;

  return resorts.filter((r) => {
    const inLng = west <= east ? r.lng >= west && r.lng <= east : r.lng >= west || r.lng <= east;
    const inLat = r.lat >= south && r.lat <= north;
    return inLng && inLat;
  });
}

/**
 * Synchronizes dynamic GeoJSON data sources for global clusters and curated seed resorts
 */
export function syncDynamicMapSources(
  map: MapLibreMap,
  options: {
    allGlobalFeatures: any[];
    showDownhill: boolean;
    showNordic: boolean;
    showHeliCat: boolean;
    effectiveMinVerticalFt: number;
    effectiveMinAcreage: number;
    effectiveMinNordicKm: number;
    selectedPasses: PassNetwork[];
    searchQuery: string;
  }
): void {
  const {
    allGlobalFeatures,
    showDownhill,
    showNordic,
    showHeliCat,
    effectiveMinVerticalFt,
    effectiveMinAcreage,
    effectiveMinNordicKm,
    selectedPasses,
    searchQuery,
  } = options;

  const allowedCats = new Set<string>();
  if (showDownhill) allowedCats.add('downhill');
  if (showNordic) allowedCats.add('nordic');
  if (showHeliCat) allowedCats.add('heli_cat');

  // 1. Sync global clustered ski areas source
  const globalSrc = map.getSource(SOURCE_IDS.GLOBAL_SKI_AREAS) as GeoJSONSource;
  if (globalSrc && allGlobalFeatures.length > 0) {
    const filteredFeatures = allGlobalFeatures.filter((f) => {
      const p = f.properties;
      const cat = p.category || 'downhill';
      if (!allowedCats.has(cat)) return false;

      const passes: PassNetwork[] = p.pass_networks && p.pass_networks.length > 0 ? p.pass_networks : ['Independent'];
      const passMatch = passes.some((pn) => selectedPasses.includes(pn));
      if (!passMatch) return false;

      if (cat === 'downhill') {
        const vert = p.vertical_ft || p.vertical_drop_ft || 0;
        if (effectiveMinVerticalFt > 0 && vert < effectiveMinVerticalFt) return false;
        const acres = p.skiable_acres || 0;
        if (effectiveMinAcreage > 0 && acres < effectiveMinAcreage) return false;
      } else if (cat === 'nordic') {
        if (effectiveMinNordicKm > 0 && ((p.trail_km || 0) < effectiveMinNordicKm)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchReg = (p.region || '').toLowerCase().includes(q);
        const matchCountry = (p.country || '').toLowerCase().includes(q);
        if (!matchName && !matchReg && !matchCountry) return false;
      }
      return true;
    });

    globalSrc.setData({ type: 'FeatureCollection', features: filteredFeatures });
  }

  // 2. Sync curated seed resorts source
  const curatedSrc = map.getSource(SOURCE_IDS.RESORTS) as GeoJSONSource;
  if (curatedSrc) {
    const allCurated = [...GLOBAL_SKI_ATLAS, ...HELI_CAT_OPERATIONS];
    const filteredCurated = allCurated.filter((r) => {
      const cat = r.category || 'downhill';
      if (!allowedCats.has(cat)) return false;
      const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
      if (!passMatch) return false;

      if (cat === 'downhill') {
        const vert = r.vertical_drop_ft || 0;
        if (effectiveMinVerticalFt > 0 && vert < effectiveMinVerticalFt) return false;
        const acres = r.skiable_acres || 0;
        if (effectiveMinAcreage > 0 && acres < effectiveMinAcreage) return false;
      } else if (cat === 'nordic') {
        if (effectiveMinNordicKm > 0 && ((r.trail_km || 0) < effectiveMinNordicKm)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchReg = (r.region || '').toLowerCase().includes(q);
        const matchCountry = (r.country || '').toLowerCase().includes(q);
        if (!matchName && !matchReg && !matchCountry) return false;
      }
      return true;
    }).map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        name: r.name,
        category: r.category || 'downhill',
        primary_pass: r.pass_networks?.[0] || 'Independent',
        pass_color: r.category === 'heli_cat' ? '#C85A32' : (PASS_COLORS[r.pass_networks?.[0] || 'Independent'] || '#8A847C'),
        vertical_ft: r.vertical_drop_ft || 0,
        vertical_drop_ft: r.vertical_drop_ft || 0,
        skiable_acres: r.skiable_acres || 0,
        trail_km: r.trail_km || null,
        trail_mi: r.trail_mi || null,
      },
    }));

    curatedSrc.setData({ type: 'FeatureCollection', features: filteredCurated as any });
  }
}

/**
 * Updates the active selected resort pin and target pulse layer
 */
export function updateSelectedResortPin(
  map: MapLibreMap,
  selectedResort: SkiResort | null
): void {
  const src = map.getSource(SOURCE_IDS.SELECTED_RESORT) as GeoJSONSource;
  if (!src) return;

  if (selectedResort && selectedResort.lng != null && selectedResort.lat != null) {
    const pass = selectedResort.pass_networks?.[0] || 'Independent';
    const passColor = selectedResort.category === 'heli_cat' ? '#C85A32' : (PASS_COLORS[pass] || '#8A847C');
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [selectedResort.lng, selectedResort.lat],
          },
          properties: {
            id: selectedResort.id,
            name: selectedResort.name,
            category: selectedResort.category,
            primary_pass: pass,
            pass_color: passColor,
          },
        },
      ],
    });
  } else {
    src.setData({ type: 'FeatureCollection', features: [] });
  }
}

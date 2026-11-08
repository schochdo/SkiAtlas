import type { SkiResort, PassNetwork, ResortWeatherData } from '../../types';
import type { GlobalSkiAreasResult } from './types';
import { GLOBAL_SKI_ATLAS } from '../../data/resorts';
import { HELI_CAT_OPERATIONS } from '../../data/heliCat';
import { extractPointCoordinates } from '../../utils/geometry';
import {
  cleanResortName,
  cleanNameForMatching,
  getSignificantTokens,
  classifySkiFeature,
  PASS_COLORS,
} from '../../utils/classification';
import { getStaticDataUrl } from '../../utils/url';
import { getInitialWeather, getNeutralWeather } from '../weather';
import {
  buildCuratedSeedIndex,
  isDuplicateAgainstCurated,
  isDefunctOrClosed,
  isGhostOrZeroInfra,
  sanitizeWebsiteUrl,
} from './deduplication';

/**
 * Builds the initial baseline catalog from curated flagship and heli/cat entries
 */
export function buildInitialResorts(): SkiResort[] {
  return [
    ...GLOBAL_SKI_ATLAS.map((r) => ({
      ...r,
      weather: getInitialWeather(r),
    })),
    ...HELI_CAT_OPERATIONS.map((r) => ({
      ...r,
      weather: getInitialWeather(r),
    })),
  ];
}

/**
 * Ingests OpenSkiData GeoJSON, runs quality hygiene and deduplication against curated seed resorts,
 * and compiles GeoJSON features and typed SkiResort items.
 */
export async function fetchGlobalSkiAreas(): Promise<GlobalSkiAreasResult> {
  // Load local curated JSON first, fallback to CDN
  let data: any = null;
  try {
    const localRes = await fetch(getStaticDataUrl('data/global_ski_areas.json'));
    if (localRes.ok) data = await localRes.json();
  } catch (_) {}

  if (!data) {
    const remoteRes = await fetch('https://tiles.openskimap.org/geojson/ski_areas.geojson');
    if (remoteRes.ok) data = await remoteRes.json();
  }

  if (!data || !data.features) {
    return {
      features: [],
      resorts: [],
      counts: { downhill: 0, nordic: 0, heli_cat: HELI_CAT_OPERATIONS.length, touring: 1 },
    };
  }

  // Build curated index for fast spatial deduplication
  const curatedIndex = buildCuratedSeedIndex([...GLOBAL_SKI_ATLAS, ...HELI_CAT_OPERATIONS]);

  const features: any[] = [];
  let dhTotal = 0;
  let nordTotal = 0;

  for (const f of data.features) {
    const pt = extractPointCoordinates(f.geometry);
    if (!pt) continue;
    const p = f.properties;
    if (!p || !p.name) continue;

    const rawName = p.name ? String(p.name).trim() : '';
    const pName = cleanResortName(rawName);
    const pNameLower = pName.toLowerCase();

    // 1. Exclude closed, defunct, or historic areas
    if (isDefunctOrClosed(p, pNameLower)) {
      continue;
    }

    // 2. Exclude zero-infrastructure ghost entries
    const hasSite = !!p.website && typeof p.website === 'string' && p.website.trim().length > 0;
    if (isGhostOrZeroInfra(p, hasSite)) {
      continue;
    }

    // 3. Deduplicate against curated flagship seed list
    const pLng = pt[0];
    const pLat = pt[1];
    const gClean = cleanNameForMatching(pName);
    const gTokens = getSignificantTokens(pName);

    if (isDuplicateAgainstCurated({ cleanName: gClean, tokens: gTokens, lat: pLat, lng: pLng }, curatedIndex)) {
      continue;
    }

    // 4. URL and property classification
    const cleanSite = sanitizeWebsiteUrl(p.website);
    const place = p.places?.[0]?.localized?.en;
    const country = place?.country || p.country || '';
    const region = place?.region || p.region || '';
    const classified = classifySkiFeature(p, pt);

    const rVert = p.vertical_ft || classified.cleanedVertFt || 0;
    const rAcres = classified.category === 'nordic' ? 0 : (p.skiable_acres || 0);

    if (classified.category === 'downhill') dhTotal++;
    else if (classified.category === 'nordic') nordTotal++;

    const rawPassNets = (p.pass_networks && p.pass_networks.length > 0 ? p.pass_networks : ['Independent']) as PassNetwork[];
    const passNets = rawPassNets.length > 1 && rawPassNets.includes('Independent')
      ? rawPassNets.filter((net) => net !== 'Independent')
      : rawPassNets;
    const primaryPass = passNets[0] || 'Independent';
    const passColor = PASS_COLORS[primaryPass] || '#8A847C';

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pt },
      properties: {
        ...p,
        id: p.id,
        name: pName,
        country,
        region,
        lng: pt[0],
        lat: pt[1],
        category: classified.category,
        archetype: classified.archetype,
        infrastructure: p.infrastructure || classified.infrastructure || 'Ski area',
        vertical_drop_ft: rVert,
        vertical_ft: rVert,
        summit_elev_ft: p.summit_elev_ft || classified.cleanedSummitFt || 0,
        base_elev_ft: p.base_elev_ft || classified.cleanedBaseFt || 0,
        skiable_acres: rAcres,
        website: cleanSite,
        trail_km: p.trail_km || null,
        trail_mi: p.trail_mi || null,
        pass_networks: passNets,
        primary_pass: primaryPass,
        pass_color: passColor,
        avg_snowfall_in: p.avg_snowfall_in || null,
      },
    });
  }

  // Compile typed SkiResort items
  const resorts: SkiResort[] = features.map((f) => {
    const props = f.properties;
    return {
      id: props.id,
      name: props.name,
      country: props.country,
      region: props.region,
      lng: props.lng,
      lat: props.lat,
      default_bearing: props.default_bearing || (props.lat < 0 ? 0 : 180),
      category: props.category,
      archetype: props.archetype,
      infrastructure: props.infrastructure,
      vertical_drop_ft: props.vertical_ft || 0,
      summit_elev_ft: props.summit_elev_ft || 0,
      base_elev_ft: props.base_elev_ft || 0,
      skiable_acres: props.category === 'nordic' ? 0 : (props.skiable_acres || 0),
      pass_networks: (props.pass_networks && props.pass_networks.length > 0 ? props.pass_networks : ['Independent']) as PassNetwork[],
      summary: props.summary || '',
      website: props.website || '',
      lift_count: props.lift_count || null,
      run_count: props.run_count || null,
      trail_km: props.trail_km || null,
      trail_mi: props.trail_mi || null,
      avg_snowfall_in: props.avg_snowfall_in || null,
    };
  });

  return {
    features,
    resorts,
    counts: {
      downhill: dhTotal,
      nordic: nordTotal,
      heli_cat: HELI_CAT_OPERATIONS.length,
      touring: 1,
    },
  };
}

/**
 * Merges freshly ingested global resorts with existing resorts, preserving cached weather states
 */
export function mergeResortsWithWeather(
  prevResorts: SkiResort[],
  globalResortItems: SkiResort[]
): SkiResort[] {
  const weatherMap = new Map<string, ResortWeatherData>();
  prevResorts.forEach((r) => {
    if (r.weather) weatherMap.set(r.id, r.weather);
  });

  return [
    ...GLOBAL_SKI_ATLAS.map((r) => ({
      ...r,
      weather: weatherMap.get(r.id) || getInitialWeather(r),
    })),
    ...HELI_CAT_OPERATIONS.map((r) => ({
      ...r,
      weather: weatherMap.get(r.id) || getInitialWeather(r),
    })),
    ...globalResortItems.map((r) => ({
      ...r,
      weather: weatherMap.get(r.id) || getNeutralWeather(r),
    })),
  ];
}

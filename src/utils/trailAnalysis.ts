import * as maplibregl from 'maplibre-gl';
import { TrailInspectionData } from '../types';

function haversineMeters(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1[1] * Math.PI) / 180) *
      Math.cos((p2[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAspectCardinal(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'North';
  if (normalized >= 22.5 && normalized < 67.5) return 'Northeast';
  if (normalized >= 67.5 && normalized < 112.5) return 'East';
  if (normalized >= 112.5 && normalized < 157.5) return 'Southeast';
  if (normalized >= 157.5 && normalized < 202.5) return 'South';
  if (normalized >= 202.5 && normalized < 247.5) return 'Southwest';
  if (normalized >= 247.5 && normalized < 292.5) return 'West';
  return 'Northwest';
}

function sampleElevation(
  map: maplibregl.Map,
  coord: [number, number, number?],
  exaggeration: number = 0.7
): number {
  // If GeoJSON already has 3D coordinate (Z in meters), use it as primary truth
  if (coord.length >= 3 && typeof coord[2] === 'number' && isFinite(coord[2]) && coord[2] > 0) {
    return coord[2];
  }
  // Otherwise sample live DEM mesh
  const dem = map.queryTerrainElevation?.([coord[0], coord[1]]);
  if (dem !== null && dem !== undefined && isFinite(dem)) {
    return dem / (exaggeration || 1.0);
  }
  return 0;
}

/**
 * Normalizes a trail or lift name for robust grouping across OSM formatting discrepancies
 * (e.g., en-dash vs hyphen, diacritics / accents, whitespace).
 */
export function normalizeTrailName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics (é -> e, è -> e)
    .replace(/[\u2010-\u2015\u2212]/g, '-') // normalize hyphens, en-dashes, em-dashes
    .replace(/\s+/g, ' ')
    .trim();
}

function getLineCoordinates(feat: any): [number, number, number?][][] {
  const geom = feat?.geometry;
  if (!geom) return [];
  if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
    return [geom.coordinates];
  }
  if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
    return geom.coordinates;
  }
  return [];
}

function getFeatureEndpoints(lines: [number, number, number?][][]): [number, number][] {
  const pts: [number, number][] = [];
  for (const line of lines) {
    if (line && line.length > 0) {
      pts.push([line[0][0], line[0][1]]);
      pts.push([line[line.length - 1][0], line[line.length - 1][1]]);
    }
  }
  return pts;
}

function minDistanceBetweenEndpoints(ptsA: [number, number][], ptsB: [number, number][]): number {
  let minD = Infinity;
  for (const a of ptsA) {
    for (const b of ptsB) {
      const dLat = (b[1] - a[1]) * 111320;
      const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
      const dLng = (b[0] - a[0]) * 111320 * cosLat;
      const d = Math.hypot(dLat, dLng);
      if (d < minD) minD = d;
    }
  }
  return minD;
}

/**
 * Groups and stitches physically connected OSM way segments that belong to the same
 * continuous ski lift (aerialway) or named trail run into a single composite GeoJSON feature.
 *
 * OSM mappers frequently split continuous lifts and pistes at intermediate stations,
 * passing loops, road crossings, or bridges. This function performs a graph connectivity
 * traversal starting from the clicked feature, discovering all adjoining segments that share
 * the same normalized name and facility kind (lift vs piste).
 */
export function aggregateConnectedTrailFeatures(
  selectedFeat: any,
  allFeatures: Iterable<any>
): any {
  if (!selectedFeat || !selectedFeat.geometry) return selectedFeat;

  const geomType = selectedFeat.geometry.type;
  if (geomType !== 'LineString' && geomType !== 'MultiLineString') {
    return selectedFeat;
  }

  const selectedLines = getLineCoordinates(selectedFeat);
  if (!selectedLines.length) return selectedFeat;

  const selectedProps = selectedFeat.properties || {};
  const isLift = selectedProps.kind === 'lift' || !!selectedProps.aerialway;
  const rawName = selectedProps.name || selectedProps['piste:name'] || selectedProps['name:en'] || '';
  const normName = normalizeTrailName(rawName);

  const isGeneric =
    !normName ||
    /^(untitled|unnamed|unknown|ski trail|mountain aerialway|lift)$/i.test(normName);

  // If generic, only merge strictly touching segments (<= 15m)
  // If named, allow up to 150m to bridge intermediate stations and road crossings
  const maxGapMeters = isGeneric ? 15 : 150;

  const startId = String(selectedFeat.id || selectedProps.id || '');
  const visitedIds = new Set<string>();
  if (startId) visitedIds.add(startId);

  // Filter relevant candidates
  interface Candidate {
    feat: any;
    id: string;
    lines: [number, number, number?][][];
    endpoints: [number, number][];
  }

  const candidates: Candidate[] = [];
  for (const f of allFeatures) {
    if (!f || f === selectedFeat) continue;
    const fid = String(f.id || f.properties?.id || '');
    if (startId && fid === startId) continue;

    const fp = f.properties || {};
    const fIsLift = fp.kind === 'lift' || !!fp.aerialway;
    if (fIsLift !== isLift) continue;

    const fRawName = fp.name || fp['piste:name'] || fp['name:en'] || '';
    const fNormName = normalizeTrailName(fRawName);

    let isMatch = false;
    if (isGeneric) {
      isMatch = !fNormName || /^(untitled|unnamed|unknown|ski trail|mountain aerialway|lift)$/i.test(fNormName);
      if (isMatch && !isLift) {
        // For unnamed pistes, difficulty must also match
        const diffA = selectedProps.difficulty || selectedProps['piste:difficulty'] || '';
        const diffB = fp.difficulty || fp['piste:difficulty'] || '';
        if (diffA !== diffB) isMatch = false;
      }
    } else {
      isMatch = fNormName === normName;
    }

    if (isMatch) {
      const lines = getLineCoordinates(f);
      if (lines.length) {
        candidates.push({
          feat: f,
          id: fid,
          lines,
          endpoints: getFeatureEndpoints(lines),
        });
      }
    }
  }

  if (candidates.length === 0) {
    return selectedFeat;
  }

  // BFS connectivity traversal from clicked feature
  const connectedFeatures: any[] = [selectedFeat];
  const queue: Candidate[] = [
    {
      feat: selectedFeat,
      id: startId,
      lines: selectedLines,
      endpoints: getFeatureEndpoints(selectedLines),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (let i = candidates.length - 1; i >= 0; i--) {
      const cand = candidates[i];
      if (cand.id && visitedIds.has(cand.id)) {
        candidates.splice(i, 1);
        continue;
      }

      const d = minDistanceBetweenEndpoints(current.endpoints, cand.endpoints);
      if (d <= maxGapMeters) {
        if (cand.id) visitedIds.add(cand.id);
        connectedFeatures.push(cand.feat);
        queue.push(cand);
        candidates.splice(i, 1);
      }
    }
  }

  if (connectedFeatures.length <= 1) {
    return selectedFeat;
  }

  // Combine line geometries into a MultiLineString
  const combinedLines: [number, number, number?][][] = [];
  for (const f of connectedFeatures) {
    const lines = getLineCoordinates(f);
    for (const l of lines) {
      if (l && l.length >= 2) {
        combinedLines.push(l);
      }
    }
  }

  // Merge metadata properties, preserving selected feature's primary identity
  const mergedProps: Record<string, any> = { ...selectedProps };
  for (const f of connectedFeatures) {
    const fp = f.properties || {};
    for (const k of Object.keys(fp)) {
      if (mergedProps[k] === undefined || mergedProps[k] === '') {
        mergedProps[k] = fp[k];
      }
    }
  }

  mergedProps.is_aggregated = true;
  mergedProps.segment_count = connectedFeatures.length;

  return {
    type: 'Feature',
    id: selectedFeat.id || selectedProps.id,
    geometry: {
      type: 'MultiLineString',
      coordinates: combinedLines,
    },
    properties: mergedProps,
  };
}

export function analyzeTrailFeature(
  feature: any,
  map: maplibregl.Map,
  clickedLngLat: [number, number]
): TrailInspectionData {
  const p = feature.properties || {};
  const geom = feature.geometry || {};
  const exaggeration = (map as any).getTerrain?.()?.exaggeration || 0.7;

  const rawName = p.name || p['piste:name'] || '';
  const isLift = p.kind === 'lift' || !!p.aerialway;
  const defaultName = isLift ? 'Mountain Aerialway' : 'Ski Trail';
  const isGeneric = !rawName.trim() || /^(untitled|unnamed|unknown)/i.test(rawName.trim());
  const name = isGeneric ? defaultName : rawName.trim();

  // Extract all constituent coordinate lines for LineString, MultiLineString, and polygons
  const lines: [number, number, number?][][] =
    geom.type === 'LineString'
      ? [geom.coordinates || []]
      : geom.type === 'MultiLineString'
      ? geom.coordinates || []
      : geom.type === 'Polygon'
      ? [geom.coordinates?.[0] || []]
      : geom.type === 'MultiPolygon'
      ? [geom.coordinates?.[0]?.[0] || []]
      : [];

  let minElev = Infinity;
  let maxElev = -Infinity;
  let topCoord: [number, number] = clickedLngLat;
  let baseCoord: [number, number] = clickedLngLat;

  let totalDist2D = 0;
  let totalDist3D = 0;
  let maxSlopeDeg = 0;

  for (const line of lines) {
    if (!line || line.length === 0) continue;
    let prevC: [number, number, number?] | null = null;
    let prevZ = 0;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const z = sampleElevation(map, c, exaggeration);

      if (z > maxElev) {
        maxElev = z;
        topCoord = [c[0], c[1]];
      }
      if (z < minElev && z > 0) {
        minElev = z;
        baseCoord = [c[0], c[1]];
      }

      if (prevC) {
        const d2 = haversineMeters([prevC[0], prevC[1]], [c[0], c[1]]);
        const dz = Math.abs(z - prevZ);
        const d3 = Math.hypot(d2, dz);

        totalDist2D += d2;
        totalDist3D += d3;

        if (d2 > 5 && isFinite(dz)) {
          const segDeg = (Math.atan2(dz, d2) * 180) / Math.PI;
          if (segDeg > maxSlopeDeg && segDeg < 75) {
            maxSlopeDeg = segDeg;
          }
        }
      }
      prevC = c;
      prevZ = z;
    }
  }

  // Handle flat or single-point geometries
  if (!isFinite(minElev)) minElev = 0;
  if (!isFinite(maxElev) || maxElev <= 0) maxElev = minElev;

  const vertDropM = Math.max(0, maxElev - minElev);
  const verticalDropFt = Math.round(vertDropM * 3.28084);
  const topElevationFt = Math.round(maxElev * 3.28084);
  const baseElevationFt = Math.round(minElev * 3.28084);

  const lengthKm = totalDist3D > 0 ? Math.round((totalDist3D / 1000) * 10) / 10 : undefined;

  let avgSlopeDeg: number | undefined;
  let avgSlopeGrade: number | undefined;

  if (totalDist2D > 10 && vertDropM > 0) {
    avgSlopeDeg = Math.round((Math.atan2(vertDropM, totalDist2D) * 180) / Math.PI);
    avgSlopeGrade = Math.round((vertDropM / totalDist2D) * 100);
  }

  // Calculate fall-line aspect (from top to base)
  let aspect: string | undefined;
  const dLat = baseCoord[1] - topCoord[1];
  const midLat = ((baseCoord[1] + topCoord[1]) / 2) * (Math.PI / 180);
  const dLng = (baseCoord[0] - topCoord[0]) * Math.cos(midLat);
  const descentBearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;

  if (haversineMeters(topCoord, baseCoord) > 20) {
    aspect = getAspectCardinal(descentBearing);
  }

  return {
    id: String(feature.id || p.id || Math.random()),
    name,
    kind: isLift ? 'lift' : 'piste',
    difficulty: p.difficulty || p['piste:difficulty'],
    aerialway: p.aerialway || p.lift_type,
    capacity: p.capacity,
    duration: p.duration,
    occupancy: p.occupancy,
    lit: p.lit === true || p.lit === 'yes',
    gladed: p.gladed === true || p.gladed === 'yes',
    oneway: p.oneway === true || p.oneway === 'yes',
    topElevationFt,
    baseElevationFt,
    verticalDropFt,
    lengthKm,
    avgSlopeDeg,
    avgSlopeGrade,
    maxSlopeDeg: maxSlopeDeg > 0 ? Math.round(maxSlopeDeg) : undefined,
    aspect,
    anchorLngLat: clickedLngLat,
    feature,
    segmentCount: p.segment_count || (lines.length > 1 ? lines.length : undefined),
  };
}

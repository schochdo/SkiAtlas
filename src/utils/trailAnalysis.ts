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
  const name = rawName.trim() || defaultName;

  let coords: [number, number, number?][] = [];

  if (geom.type === 'LineString') {
    coords = geom.coordinates || [];
  } else if (geom.type === 'MultiLineString') {
    // Find closest line string to clicked point
    const lines: [number, number, number?][][] = geom.coordinates || [];
    let bestDist = Infinity;
    for (const line of lines) {
      if (!line || !line.length) continue;
      for (const pt of line) {
        const d = haversineMeters([pt[0], pt[1]], clickedLngLat);
        if (d < bestDist) {
          bestDist = d;
          coords = line;
        }
      }
    }
    if (!coords.length && lines.length) coords = lines[0];
  } else if (geom.type === 'Polygon') {
    coords = geom.coordinates?.[0] || [];
  } else if (geom.type === 'MultiPolygon') {
    coords = geom.coordinates?.[0]?.[0] || [];
  }

  let minElev = Infinity;
  let maxElev = -Infinity;
  let topCoord: [number, number] = clickedLngLat;
  let baseCoord: [number, number] = clickedLngLat;

  let totalDist2D = 0;
  let totalDist3D = 0;
  let maxSlopeDeg = 0;

  const sampledPoints: { pt: [number, number]; z: number }[] = [];

  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    const z = sampleElevation(map, c, exaggeration);
    sampledPoints.push({ pt: [c[0], c[1]], z });

    if (z > maxElev) {
      maxElev = z;
      topCoord = [c[0], c[1]];
    }
    if (z < minElev && z > 0) {
      minElev = z;
      baseCoord = [c[0], c[1]];
    }

    if (i > 0) {
      const prev = coords[i - 1];
      const d2 = haversineMeters([prev[0], prev[1]], [c[0], c[1]]);
      const prevZ = sampledPoints[i - 1].z;
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
  }

  // Handle flat or single-point geometries
  if (!isFinite(minElev)) minElev = 0;
  if (!isFinite(maxElev) || maxElev <= 0) maxElev = minElev;

  const vertDropM = Math.max(0, maxElev - minElev);
  const verticalDropFt = Math.round(vertDropM * 3.28084);
  const topElevationFt = Math.round(maxElev * 3.28084);
  const baseElevationFt = Math.round(minElev * 3.28084);

  const lengthKm = totalDist3D > 0 ? totalDist3D / 1000 : undefined;

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
  };
}

import type { Map as MapLibreMap } from 'maplibre-gl';
import { CAMERA_CONSTANTS } from './types';

export const DEFAULT_NORTH_AMERICA_CENTER: [number, number] = [-98, 40];

/**
 * Normalizes bearing in degrees to [0, 360)
 */
export function normalizeBearing(bearing: number): number {
  const mod = bearing % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Clamps pitch angle between 0 and dynamic max degrees based on current zoom level
 */
export function clampPitch(pitch: number, zoom?: number): number {
  const maxPitch = zoom !== undefined
    ? Math.max(0, Math.min(82, (zoom - 3.5) * 18))
    : CAMERA_CONSTANTS.MAX_PITCH_DEG;
  return Math.max(CAMERA_CONSTANTS.MIN_PITCH_DEG, Math.min(maxPitch, pitch));
}

/**
 * Checks if the currently focused DOM element is an editable form field
 */
export function isInputElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/**
 * Calculates geographic lat/lng displacement given bearing, forward/strafe inputs, speed, and dt
 */
export function computeGeographicDisplacement(
  center: { lng: number; lat: number },
  bearingDeg: number,
  moveForward: number,
  moveStrafe: number,
  speedMps: number,
  dt: number
): { deltaLat: number; deltaLng: number; nextLat: number; nextLng: number } {
  const len = Math.hypot(moveForward, moveStrafe);
  if (len === 0) {
    return { deltaLat: 0, deltaLng: 0, nextLat: center.lat, nextLng: center.lng };
  }

  const normForward = moveForward / len;
  const normStrafe = moveStrafe / len;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const distMeters = speedMps * dt;

  const sinB = Math.sin(bearingRad);
  const cosB = Math.cos(bearingRad);
  const deltaEastMeters = (sinB * normForward + cosB * normStrafe) * distMeters;
  const deltaNorthMeters = (cosB * normForward - sinB * normStrafe) * distMeters;

  const latRad = (center.lat * Math.PI) / 180;
  const metersPerDegLat = CAMERA_CONSTANTS.METERS_PER_DEG_LAT;
  const metersPerDegLng = metersPerDegLat * Math.max(0.1, Math.cos(latRad));

  const deltaLat = deltaNorthMeters / metersPerDegLat;
  const deltaLng = deltaEastMeters / metersPerDegLng;

  const nextLat = Math.max(-85, Math.min(85, center.lat + deltaLat));
  const nextLng = center.lng + deltaLng;

  return { deltaLat, deltaLng, nextLat, nextLng };
}

/**
 * Samples terrain elevation under camera and ahead along trajectory to detect terrain collisions
 */
export function sampleTerrainObstacle(
  map: MapLibreMap,
  camLng: number,
  camLat: number,
  lookaheadLng: number,
  lookaheadLat: number
): number {
  const groundCam = map.queryTerrainElevation([camLng, camLat]);
  const groundAheadCam = map.queryTerrainElevation([lookaheadLng, lookaheadLat]);

  let maxGround = -Infinity;
  if (groundCam !== null && groundCam !== undefined && isFinite(groundCam)) {
    maxGround = Math.max(maxGround, groundCam);
  }
  if (groundAheadCam !== null && groundAheadCam !== undefined && isFinite(groundAheadCam)) {
    maxGround = Math.max(maxGround, groundAheadCam);
  }
  return maxGround;
}

/**
 * Calculates the exact MapLibre zoom level required for the 3D globe sphere to fill
 * a given target percentage (default ~84%) of the visible unpadded viewport area without
 * touching or overlapping UI chrome (left directory dock, top navbar, control buttons).
 *
 * @param windowWidth - Window inner width in CSS pixels
 * @param windowHeight - Window inner height in CSS pixels
 * @param isMobile - Whether running on a mobile viewport (<768px)
 * @param dockOpen - Whether the desktop left dock is open (404px width)
 * @param centerLat - Center latitude in degrees (defaults to 40 for North America focus)
 * @param targetRatio - Target ratio of the constraining viewport dimension (defaults to 0.84)
 */
export function computeGlobeFitZoom(
  windowWidth: number,
  windowHeight: number,
  isMobile: boolean,
  dockOpen: boolean,
  centerLat: number = 40,
  targetRatio: number = 0.84
): number {
  const leftPad = isMobile ? 0 : (dockOpen ? 404 : 20);
  const rightPad = 0;
  const topPad = isMobile ? 0 : 44;
  const bottomPad = 0;

  const availW = Math.max(300, windowWidth - leftPad - rightPad);
  const availH = Math.max(300, windowHeight - topPad - bottomPad);
  const availDim = Math.min(availW, availH);

  // MapLibre vertical perspective globe geometry:
  // fov is 36.87 degrees (0.643501 rad)
  // cameraToCenterDistance = 0.5 / tan(fov / 2) * availDim
  const fov = 36.87 * (Math.PI / 180);
  const c2c = (0.5 / Math.tan(fov / 2)) * availDim;

  const targetDiameter = availDim * targetRatio;
  const targetScreenRadius = targetDiameter / 2;

  // Screen projection: tan(theta) = targetScreenRadius / c2c
  const tanTheta = targetScreenRadius / c2c;
  const sinTheta = Math.sin(Math.atan(tanTheta));

  // Sphere geometry: sin(theta) = R / (c2c + R) => R = (c2c * sinTheta) / (1 - sinTheta)
  const R = (c2c * sinTheta) / Math.max(0.001, 1 - sinTheta);

  // MapLibre globe radius formula: R = worldSize / (2 * PI) / cos(centerLat)
  // worldSize = 512 * 2^zoom => zoom = log2(worldSize / 512)
  const clampedLat = Math.min(Math.abs(centerLat), 85);
  const cosLat = Math.cos(clampedLat * (Math.PI / 180));
  const worldSize = R * 2 * Math.PI * cosLat;
  const calculatedZoom = Math.log2(worldSize / 512);

  return Math.max(1.0, Math.min(3.0, Math.round(calculatedZoom * 100) / 100));
}

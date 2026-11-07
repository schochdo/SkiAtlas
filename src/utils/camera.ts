import type { Map as MapLibreMap } from 'maplibre-gl';

/* =========================================================================
   SAFE MAP CAMERA CONTROLS
   Validates coordinates to prevent crashes from NaN/Infinity values.
   ========================================================================= */

export let isProgrammaticFlightActive = false;
let flightId = 0;

export function setIsProgrammaticFlightActive(v: boolean) {
  isProgrammaticFlightActive = v;
}

export function getIsProgrammaticFlightActive(): boolean {
  return isProgrammaticFlightActive;
}

export function safeFlyTo(map: MapLibreMap | null, options: any) {
  if (!map || !options) return;
  if (options.center) {
    const c = options.center;
    let lng: number | undefined;
    let lat: number | undefined;
    if (Array.isArray(c)) {
      lng = Number(c[0]);
      lat = Number(c[1]);
    } else if (c && typeof c === 'object') {
      lng = Number(c.lng ?? c.lon);
      lat = Number(c.lat);
    }
    if (
      lng === undefined ||
      lat === undefined ||
      !isFinite(lng) ||
      !isFinite(lat) ||
      isNaN(lng) ||
      isNaN(lat)
    ) {
      console.warn('safeFlyTo rejected invalid coordinates:', c);
      return;
    }
    options.center = [lng, lat];
  }
  try {
    const currentFlightId = ++flightId;
    isProgrammaticFlightActive = true;
    // Enable center ground clamping during programmatic flight so MapLibre eases smoothly onto the target terrain
    try {
      (map as any).setCenterClampedToGround?.(true);
    } catch (_) {}
    map.flyTo(options);
    const onEnd = () => {
      if (flightId === currentFlightId) {
        isProgrammaticFlightActive = false;
        // Re-disable center ground clamping once landed so panning and cruising never bounce
        try {
          (map as any).setCenterClampedToGround?.(false);
        } catch (_) {}
      }
      map.off('moveend', onEnd);
    };
    map.once('moveend', onEnd);
  } catch (err) {
    console.warn('safeFlyTo caught exception:', err);
    isProgrammaticFlightActive = false;
    try {
      (map as any).setCenterClampedToGround?.(false);
    } catch (_) {}
  }
}

export function safeEaseTo(map: MapLibreMap | null, options: any) {
  if (!map || !options) return;
  try {
    map.easeTo(options);
  } catch (err) {
    console.warn('safeEaseTo caught exception:', err);
  }
}

export const DEFAULT_NORTH_AMERICA_CENTER: [number, number] = [-98, 40];

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
  const topPad = 44;
  const bottomPad = isMobile ? 80 : 0;

  const availW = Math.max(300, windowWidth - leftPad - rightPad);
  const availH = Math.max(300, windowHeight - topPad - bottomPad);
  const availDim = Math.min(availW, availH);

  // MapLibre vertical perspective globe geometry:
  // fov is 36.87 degrees (0.643501 rad)
  // cameraToCenterDistance = 0.5 / tan(fov / 2) * availDim
  const fov = 36.87 * (Math.PI / 180);
  const c2c = 0.5 / Math.tan(fov / 2) * availDim;

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

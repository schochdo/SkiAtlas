import type { Map as MapLibreMap } from 'maplibre-gl';

/* =========================================================================
   SAFE MAP CAMERA CONTROLS
   Validates coordinates to prevent crashes from NaN/Infinity values.
   ========================================================================= */

export let isProgrammaticFlightActive = false;

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
    isProgrammaticFlightActive = true;
    map.flyTo(options);
    const onEnd = () => {
      isProgrammaticFlightActive = false;
      map.off('moveend', onEnd);
    };
    map.once('moveend', onEnd);
  } catch (err) {
    console.warn('safeFlyTo caught exception:', err);
    isProgrammaticFlightActive = false;
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

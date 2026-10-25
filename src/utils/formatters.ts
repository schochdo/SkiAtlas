/* =========================================================================
   CARTOGRAPHIC UNIT HYGIENE & FORMATTING HELPERS
   Always use these helpers instead of raw strings or numbers.
   ========================================================================= */

export function formatSnow(inches: number, unitsMetric: boolean = false): string {
  if (unitsMetric) return `${Math.round(inches * 2.54)} cm`;
  return `${inches}"`;
}

export function formatVert(ft: number | null | undefined, unitsMetric: boolean = false): string {
  if (!ft || ft <= 0) return '—';
  if (unitsMetric) return `${Math.round(ft * 0.3048).toLocaleString()} m`;
  return `${ft.toLocaleString()}'`;
}

export function formatAcres(acres: number | null | undefined, unitsMetric: boolean = false): string {
  if (!acres || acres <= 0) return '—';
  if (unitsMetric) return `${Math.round(acres * 0.404686).toLocaleString()} ha`;
  return `${acres.toLocaleString()} ac`;
}

export function formatDistance(km: number | null | undefined, unitsMetric: boolean = false): string {
  if (!km || km <= 0) return '—';
  if (unitsMetric) return `${km} km`;
  const mi = Math.round(km * 0.621371 * 10) / 10;
  return `${mi} mi`;
}

export function formatCoords(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

/* =========================================================================
   CARTOGRAPHIC UNIT HYGIENE & FORMATTING HELPERS
   Always use these helpers instead of raw strings or numbers.
   ========================================================================= */

export function formatSnow(inches: number, unitsMetric: boolean = false): string {
  if (unitsMetric) {
    const cm = Math.round(inches * 2.54 * 10) / 10;
    return `${cm} cm`;
  }
  const roundedIn = Math.round(inches * 10) / 10;
  return `${roundedIn}"`;
}

export function formatVert(ft: number | null | undefined, unitsMetric: boolean = false): string {
  if (!ft || ft <= 0) return '—';
  if (unitsMetric) return `${Math.round(ft * 0.3048).toLocaleString()} m`;
  return `${Math.round(ft).toLocaleString()}'`;
}

export function formatAcres(acres: number | null | undefined, unitsMetric: boolean = false): string {
  if (!acres || acres <= 0) return '—';
  if (unitsMetric) {
    const ha = acres * 0.404686;
    if (ha < 10) {
      return `${(Math.round(ha * 10) / 10).toLocaleString()} ha`;
    }
    return `${Math.round(ha).toLocaleString()} ha`;
  }
  return `${Math.round(acres).toLocaleString()} ac`;
}

export function formatDistance(km: number | null | undefined, unitsMetric: boolean = false): string {
  if (km === null || km === undefined || !isFinite(km) || km <= 0) return '—';
  if (unitsMetric) {
    const val = Math.max(0.1, Math.round(km * 10) / 10);
    return `${val} km`;
  }
  const mi = Math.max(0.1, Math.round(km * 0.621371 * 10) / 10);
  return `${mi} mi`;
}

export function formatCoords(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

export function formatCameraAltitude(altitudeMeters: number | null | undefined, unitsMetric: boolean = false): string {
  if (altitudeMeters === null || altitudeMeters === undefined || !isFinite(altitudeMeters)) return '—';
  const altFt = altitudeMeters * 3.28084;
  if (unitsMetric) {
    if (altitudeMeters >= 50000) {
      const km = Math.round(altitudeMeters / 1000);
      return `${km.toLocaleString()} km`;
    }
    return `${Math.round(altitudeMeters).toLocaleString()} m`;
  } else {
    if (altFt >= 100000) {
      const mi = Math.round(altFt / 5280);
      return `${mi.toLocaleString()} mi`;
    }
    return `${Math.round(altFt).toLocaleString()}'`;
  }
}

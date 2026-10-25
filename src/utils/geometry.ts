/* =========================================================================
   GEOMETRY & SPATIAL HELPERS
   ========================================================================= */

export function extractPointCoordinates(geom: any): [number, number] | null {
  if (!geom || !geom.coordinates) return null;
  const { type, coordinates } = geom;
  if (type === 'Point') {
    if (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number' &&
      !isNaN(coordinates[0]) &&
      !isNaN(coordinates[1])
    ) {
      return [coordinates[0], coordinates[1]];
    }
    return null;
  }
  if (type === 'Polygon' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    const ring = coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const pt of ring) {
      if (
        Array.isArray(pt) &&
        typeof pt[0] === 'number' &&
        typeof pt[1] === 'number' &&
        !isNaN(pt[0]) &&
        !isNaN(pt[1])
      ) {
        sumLng += pt[0];
        sumLat += pt[1];
        count++;
      }
    }
    if (count > 0) return [sumLng / count, sumLat / count];
  }
  return null;
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

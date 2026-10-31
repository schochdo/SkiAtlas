const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-50m.json');

const cleanNames = {
  "United States of America": "United States",
  "Dem. Rep. Congo": "DR Congo",
  "Central African Rep.": "Central African Rep.",
  "Dominican Rep.": "Dominican Republic",
  "Bosnia and Herz.": "Bosnia & Herzegovina",
  "Eq. Guinea": "Equatorial Guinea",
  "W. Sahara": "Western Sahara",
  "S. Sudan": "South Sudan"
};

function getCleanName(n) {
  return cleanNames[n] || n;
}

function roundCoords(coords) {
  if (typeof coords[0] === 'number') {
    return [Math.round(coords[0] * 1000) / 1000, Math.round(coords[1] * 1000) / 1000];
  }
  return coords.map(roundCoords);
}

// 1. Boundary lines mesh (smooth 1:50m curves for all national borders and coastlines)
const boundaryMesh = topojson.mesh(world, world.objects.countries);
const roundedBoundaryCoords = roundCoords(boundaryMesh.coordinates);

const boundaryFeature = {
  type: "Feature",
  geometry: {
    type: "MultiLineString",
    coordinates: roundedBoundaryCoords
  },
  properties: {
    type: "country-boundary"
  }
};

// 2. Single macro country points (one visual center per nation)
function polygonArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += (ring[i][0] * ring[i+1][1]) - (ring[i+1][0] * ring[i][1]);
  }
  return Math.abs(area) / 2;
}

function ringCentroid(ring) {
  let cx = 0, cy = 0, signedArea = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0], y0 = ring[i][1];
    const x1 = ring[i+1][0], y1 = ring[i+1][1];
    const a = (x0 * y1) - (x1 * y0);
    signedArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of ring) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  cx /= (6 * signedArea);
  cy /= (6 * signedArea);
  return [Number(cx.toFixed(3)), Number(cy.toFixed(3))];
}

const countriesCollection = topojson.feature(world, world.objects.countries);
const macroPoints = [];

for (const f of countriesCollection.features) {
  const rawName = f.properties.name;
  if (!rawName) continue;
  const name = getCleanName(rawName);
  let maxArea = -1;
  let bestRing = null;

  if (f.geometry.type === "Polygon") {
    bestRing = f.geometry.coordinates[0];
  } else if (f.geometry.type === "MultiPolygon") {
    for (const poly of f.geometry.coordinates) {
      const outer = poly[0];
      const area = polygonArea(outer);
      if (area > maxArea) {
        maxArea = area;
        bestRing = outer;
      }
    }
  }

  if (bestRing && bestRing.length >= 3) {
    const center = ringCentroid(bestRing);
    macroPoints.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: center
      },
      properties: {
        name,
        type: "macro-country"
      }
    });
  }
}

// 3. Shared frontier border labels
// Map each arc to the countries that touch it
const arcToCountries = new Map();
for (const geom of world.objects.countries.geometries) {
  const country = geom.properties.name;
  if (!country) continue;
  const recordArcs = (arcs) => {
    for (const a of arcs) {
      if (Array.isArray(a)) recordArcs(a);
      else {
        const idx = a < 0 ? ~a : a;
        if (!arcToCountries.has(idx)) arcToCountries.set(idx, { countries: new Set(), orientations: new Map() });
        const entry = arcToCountries.get(idx);
        entry.countries.add(country);
        // positive arc = forward traversal, negative arc = reverse traversal
        entry.orientations.set(country, a >= 0 ? 1 : -1);
      }
    }
  };
  recordArcs(geom.arcs);
}

function decodeArc(topology, arcIndex) {
  const arc = topology.arcs[arcIndex];
  const scale = topology.transform.scale;
  const translate = topology.transform.translate;
  let x = 0, y = 0;
  const coords = [];
  for (let i = 0; i < arc.length; i++) {
    x += arc[i][0];
    y += arc[i][1];
    coords.push([
      Number((x * scale[0] + translate[0]).toFixed(3)),
      Number((y * scale[1] + translate[1]).toFixed(3))
    ]);
  }
  return coords;
}

function lineLengthKm(line) {
  let len = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const dx = (line[i+1][0] - line[i][0]) * Math.cos((line[i][1] + line[i+1][1]) * Math.PI / 360) * 111.32;
    const dy = (line[i+1][1] - line[i][1]) * 110.57;
    len += Math.sqrt(dx*dx + dy*dy);
  }
  return len;
}

function offsetLine(line, dist) {
  const out = [];
  const n = line.length;
  for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0;
    if (i === 0) {
      dx = line[1][0] - line[0][0];
      dy = line[1][1] - line[0][1];
    } else if (i === n - 1) {
      dx = line[n - 1][0] - line[n - 2][0];
      dy = line[n - 1][1] - line[n - 2][1];
    } else {
      dx = line[i + 1][0] - line[i - 1][0];
      dy = line[i + 1][1] - line[i - 1][1];
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) {
      out.push(line[i]);
    } else {
      const nx = (dy / len) * dist;
      const ny = (-dx / len) * dist;
      out.push([
        Number((line[i][0] + nx).toFixed(3)),
        Number((line[i][1] + ny).toFixed(3))
      ]);
    }
  }
  return out;
}

const borderLineFeatures = [];
for (const [arcIdx, entry] of arcToCountries.entries()) {
  if (entry.countries.size === 2) {
    const countries = Array.from(entry.countries);
    const c1 = countries[0];
    const c2 = countries[1];
    const c1Dir = entry.orientations.get(c1);

    const arcCoords = decodeArc(world, arcIdx);
    const len = lineLengthKm(arcCoords);

    // Only label border arcs with sufficient length (>= 30 km) to comfortably display the text
    if (len >= 30) {
      // In clockwise winding, interior is to the right of forward traversal.
      // If c1 traversed the arc in forward direction (c1Dir === 1), normal to the right points into c1.
      // If c1 traversed in reverse direction (c1Dir === -1), normal to the left points into c1.
      const shiftC1 = c1Dir === 1 ? 0.035 : -0.035;
      const lineC1 = offsetLine(arcCoords, shiftC1);
      borderLineFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: lineC1
        },
        properties: {
          name: getCleanName(c1),
          neighbor: getCleanName(c2),
          type: "border-label"
        }
      });

      const shiftC2 = -shiftC1;
      const lineC2 = offsetLine(arcCoords, shiftC2);
      borderLineFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: lineC2
        },
        properties: {
          name: getCleanName(c2),
          neighbor: getCleanName(c1),
          type: "border-label"
        }
      });
    }
  }
}

const finalGeoJson = {
  type: "FeatureCollection",
  features: [
    boundaryFeature,
    ...macroPoints,
    ...borderLineFeatures
  ]
};

const tsFilePath = path.join(__dirname, '..', 'src', 'data', 'countryBoundaries.ts');
const outputTs = `export const COUNTRY_BOUNDARIES_GEOJSON = ${JSON.stringify(finalGeoJson)} as const;\n`;
fs.writeFileSync(tsFilePath, outputTs, 'utf8');

console.log(`Successfully generated high-resolution 50m boundaries at ${tsFilePath}`);
console.log(`- Boundary mesh lines: ${roundedBoundaryCoords.length}`);
console.log(`- Macro country points: ${macroPoints.length}`);
console.log(`- Frontier border lines: ${borderLineFeatures.length}`);
console.log(`- File size: ${(outputTs.length / (1024*1024)).toFixed(2)} MB`);

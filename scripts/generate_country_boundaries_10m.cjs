const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-10m.json');

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

function roundCoord(pt) {
  return [Math.round(pt[0] * 10000) / 10000, Math.round(pt[1] * 10000) / 10000];
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

// 1. Extract shared international land boundaries (a !== b)
const countriesWithLandBorder = new Set();
const landMesh = topojson.mesh(world, world.objects.countries, (a, b) => {
  if (a !== b) {
    if (a && a.properties && a.properties.name) countriesWithLandBorder.add(a.properties.name);
    if (b && b.properties && b.properties.name) countriesWithLandBorder.add(b.properties.name);
    return true;
  }
  return false;
});

// 2. Extract perimeters for island nations that have NO shared land borders (e.g. Japan, Australia, New Zealand, Iceland)
const islandGeometries = world.objects.countries.geometries.filter(g => 
  g.properties && !countriesWithLandBorder.has(g.properties.name)
);
const islandMesh = topojson.mesh(world, { type: 'GeometryCollection', geometries: islandGeometries });
const filteredIslandCoords = islandMesh.coordinates.filter(line => lineLengthKm(line) >= 15);

// Combine land borders + major island outlines
const allBoundaryLines = [
  ...landMesh.coordinates,
  ...filteredIslandCoords
].map(line => line.map(roundCoord));

console.log(`Generated ${allBoundaryLines.length} boundary lines with ${allBoundaryLines.reduce((acc, l) => acc + l.length, 0)} vertices.`);

const boundaryFeature = {
  type: "Feature",
  geometry: {
    type: "MultiLineString",
    coordinates: allBoundaryLines
  },
  properties: {
    type: "country-boundary"
  }
};

// 3. Single visual centroid per nation (macro-country)
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
  if (signedArea === 0) return [ring[0][0], ring[0][1]];
  signedArea *= 0.5;
  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);
  return [Math.round(cx * 10000) / 10000, Math.round(cy * 10000) / 10000];
}

const macroPoints = [];
const countriesGeo = topojson.feature(world, world.objects.countries);

for (const f of countriesGeo.features) {
  const rawName = f.properties.name;
  if (!rawName) continue;
  const name = getCleanName(rawName);

  let bestRing = null;
  let maxArea = -1;

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

// 4. Parallel frontier border labels along shared land borders
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
      Math.round((x * scale[0] + translate[0]) * 10000) / 10000,
      Math.round((y * scale[1] + translate[1]) * 10000) / 10000
    ]);
  }
  return coords;
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
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      out.push(line[i]);
      continue;
    }
    const nx = -dy / len;
    const ny = dx / len;
    out.push([
      Math.round((line[i][0] + nx * dist) * 10000) / 10000,
      Math.round((line[i][1] + ny * dist) * 10000) / 10000
    ]);
  }
  return out;
}

const borderLabelFeatures = [];
const seenPairs = new Set();

for (const [arcIdx, info] of arcToCountries.entries()) {
  if (info.countries.size === 2) {
    const countries = Array.from(info.countries);
    const c1 = countries[0];
    const c2 = countries[1];
    const pairKey = [c1, c2].sort().join('::') + `::${arcIdx}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const arcCoords = decodeArc(world, arcIdx);
    const len = lineLengthKm(arcCoords);

    if (len >= 35 && arcCoords.length >= 4) {
      const o1 = info.orientations.get(c1);
      const coords1 = o1 === 1 ? arcCoords : [...arcCoords].reverse();
      const offsetCoords1 = offsetLine(coords1, 0.035);

      borderLabelFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: offsetCoords1
        },
        properties: {
          name: getCleanName(c1),
          type: "border-label"
        }
      });

      const o2 = info.orientations.get(c2);
      const coords2 = o2 === 1 ? arcCoords : [...arcCoords].reverse();
      const offsetCoords2 = offsetLine(coords2, 0.035);

      borderLabelFeatures.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: offsetCoords2
        },
        properties: {
          name: getCleanName(c2),
          type: "border-label"
        }
      });
    }
  }
}

console.log(`Generated ${borderLabelFeatures.length} frontier border labels.`);
console.log(`Generated ${macroPoints.length} macro country points.`);

const finalFeatureCollection = {
  type: "FeatureCollection",
  features: [
    boundaryFeature,
    ...macroPoints,
    ...borderLabelFeatures
  ]
};

// Write GeoJSON to public/data/country_boundaries.geojson for asynchronous streaming
const publicPath = path.join(__dirname, '../public/data/country_boundaries.geojson');
fs.writeFileSync(publicPath, JSON.stringify(finalFeatureCollection), 'utf8');
const stats = fs.statSync(publicPath);
console.log(`Wrote ${publicPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

// Clean stub for src/data/countryBoundaries.ts
const tsPath = path.join(__dirname, '../src/data/countryBoundaries.ts');
fs.writeFileSync(tsPath, `// Static reference to public/data/country_boundaries.geojson
export const COUNTRY_BOUNDARIES_URL = 'data/country_boundaries.geojson';
`, 'utf8');

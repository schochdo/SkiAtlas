const fs = require('fs');
const path = require('path');

const tsFilePath = path.join(__dirname, '..', 'src', 'data', 'countryBoundaries.ts');
const rawTs = fs.readFileSync(tsFilePath, 'utf8').trim();
const prefix = "export const COUNTRY_BOUNDARIES_GEOJSON = ";
const jsonStr = rawTs.slice(prefix.length).replace(/\s*as const;?$/, "");
const baseGeoJson = JSON.parse(jsonStr);

function ptKey(pt) {
  return `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
}

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

// 1. Single macro country points (one visual center per country)
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

const macroPoints = [];
for (const f of baseGeoJson.features) {
  // Only process original country polygons
  if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
  if (f.properties.type && f.properties.type !== "country-boundary") continue;

  const rawName = f.properties.name;
  const name = getCleanName(rawName);
  const iso = f.properties.iso;
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

  const center = ringCentroid(bestRing);
  macroPoints.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: center
    },
    properties: {
      name,
      iso,
      type: "macro-country"
    }
  });
}

// 2. Shared borders
const segmentMap = new Map();
const originalCountryFeatures = baseGeoJson.features.filter(f => 
  (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") &&
  (!f.properties.type || f.properties.type === "country-boundary")
);

for (const f of originalCountryFeatures) {
  const name = f.properties.name;
  const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat(1);
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      const k1 = `${ptKey(p1)}|${ptKey(p2)}`;
      const k2 = `${ptKey(p2)}|${ptKey(p1)}`;
      if (segmentMap.has(k2)) {
        const other = segmentMap.get(k2);
        other.country_right = name;
      } else {
        segmentMap.set(k1, { p1, p2, country_left: name, country_right: null });
      }
    }
  }
}

const sharedSegments = Array.from(segmentMap.values()).filter(s => s.country_right !== null);

function stitchLines(segs) {
  const remaining = [...segs];
  const lines = [];
  while (remaining.length > 0) {
    const first = remaining.shift();
    const line = [first.p1, first.p2];
    let extended = true;
    while (extended) {
      extended = false;
      const lastPt = line[line.length - 1];
      const lastKey = ptKey(lastPt);
      const nextIdx = remaining.findIndex(s => ptKey(s.p1) === lastKey);
      if (nextIdx !== -1) {
        line.push(remaining.splice(nextIdx, 1)[0].p2);
        extended = true;
        continue;
      }
      const firstPt = line[0];
      const firstKey = ptKey(firstPt);
      const prevIdx = remaining.findIndex(s => ptKey(s.p2) === firstKey);
      if (prevIdx !== -1) {
        line.unshift(remaining.splice(prevIdx, 1)[0].p1);
        extended = true;
      }
    }
    lines.push(line);
  }
  return lines;
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
        Number((line[i][0] + nx).toFixed(4)),
        Number((line[i][1] + ny).toFixed(4))
      ]);
    }
  }
  return out;
}

const pairMap = new Map();
for (const s of sharedSegments) {
  const pairKey = [s.country_left, s.country_right].sort().join("::");
  if (!pairMap.has(pairKey)) pairMap.set(pairKey, []);
  pairMap.get(pairKey).push(s);
}

const borderLineFeatures = [];
for (const [pairKey, segs] of pairMap.entries()) {
  const [c1, c2] = pairKey.split("::");
  const oriented = segs.map(s => {
    if (s.country_left === c1) return s;
    return { p1: s.p2, p2: s.p1, country_left: c1, country_right: c2 };
  });
  const lines = stitchLines(oriented);
  for (const line of lines) {
    const len = lineLengthKm(line);
    if (len >= 35) { // Only lines long enough to display a label
      // Shift into c1 (positive normal since c1 was traversed clockwise with interior to right)
      const lineC1 = offsetLine(line, 0.04);
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
      // Shift into c2 (negative normal)
      const lineC2 = offsetLine(line, -0.04);
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

// Preserve all original polygon features, tagging them as type "country-boundary"
const polygonFeatures = originalCountryFeatures.map(f => ({
  ...f,
  properties: {
    ...f.properties,
    type: "country-boundary"
  }
}));

const combinedFeatures = [
  ...polygonFeatures,
  ...macroPoints,
  ...borderLineFeatures
];

const finalGeoJson = {
  type: "FeatureCollection",
  features: combinedFeatures
};

const outputTs = `export const COUNTRY_BOUNDARIES_GEOJSON = ${JSON.stringify(finalGeoJson)} as const;\n`;
fs.writeFileSync(tsFilePath, outputTs, 'utf8');

console.log(`Successfully generated ${tsFilePath}`);
console.log(`- Polygons: ${polygonFeatures.length}`);
console.log(`- Macro points: ${macroPoints.length}`);
console.log(`- Border lines: ${borderLineFeatures.length}`);
console.log(`- Total features: ${combinedFeatures.length}`);

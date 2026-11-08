const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-10m.json');

const cleanNames = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'DR Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Rep.',
  'Bosnia and Herz.': 'Bosnia & Herzegovina',
  'Eq. Guinea': 'Equatorial Guinea',
  'W. Sahara': 'Western Sahara',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'Marshall Is.': 'Marshall Islands',
  'Russian Federation': 'Russia'
};
const getCleanName = n => cleanNames[n] || n;

function pointInRing(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeo(pt, geojsonGeom) {
  if (!geojsonGeom) return false;
  if (geojsonGeom.type === 'Polygon') {
    if (!pointInRing(pt, geojsonGeom.coordinates[0])) return false;
    for (let i = 1; i < geojsonGeom.coordinates.length; i++) {
      if (pointInRing(pt, geojsonGeom.coordinates[i])) return false;
    }
    return true;
  } else if (geojsonGeom.type === 'MultiPolygon') {
    for (const poly of geojsonGeom.coordinates) {
      if (pointInRing(pt, poly[0])) {
        let inHole = false;
        for (let i = 1; i < poly.length; i++) {
          if (pointInRing(pt, poly[i])) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }
  return false;
}

function build() {
  console.log('Building authoritative Natural Earth 10m land boundaries...');
  const countries = world.objects.countries.geometries;
  const polyCache = new Map();
  countries.forEach(c => {
    polyCache.set(c.properties.name, topojson.feature(world, c).geometry);
  });

  const countryFeatures = [];

  for (let i = 0; i < countries.length; i++) {
    for (let j = i + 1; j < countries.length; j++) {
      const c1 = countries[i], c2 = countries[j];
      const n1 = c1.properties.name, n2 = c2.properties.name;
      const mesh = topojson.mesh(world, { type: 'GeometryCollection', geometries: [c1, c2] }, (a, b) => a && b && a !== b);
      if (mesh.coordinates && mesh.coordinates.length > 0) {
        const g1 = polyCache.get(n1);
        const g2 = polyCache.get(n2);

        mesh.coordinates.forEach(line => {
          if (line.length < 2) return;

          let name_left = getCleanName(n1);
          let name_right = getCleanName(n2);

          // Test normal along 5 points to determine sovereign side with precision
          let determined = false;
          for (let s = 1; s <= 4; s++) {
            const midIdx = Math.floor((line.length * s) / 5);
            const mid = line[midIdx];
            const next = line[midIdx + 1] || line[midIdx - 1];
            const dx = next[0] - mid[0], dy = next[1] - mid[1];
            const len = Math.hypot(dx, dy) || 0.001;
            const nx = -dy / len, ny = dx / len;

            for (const delta of [0.002, 0.005, 0.01, 0.02, 0.05]) {
              const testPt = [mid[0] + nx * delta, mid[1] + ny * delta];
              if (pointInGeo(testPt, g1)) {
                name_left = getCleanName(n1);
                name_right = getCleanName(n2);
                determined = true;
                break;
              } else if (pointInGeo(testPt, g2)) {
                name_left = getCleanName(n2);
                name_right = getCleanName(n1);
                determined = true;
                break;
              }
            }
            if (determined) break;
          }

          countryFeatures.push({
            type: 'Feature',
            properties: {
              kind: 'country_border',
              name_left: name_left,
              name_right: name_right
            },
            geometry: {
              type: 'LineString',
              coordinates: line.map(p => [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000])
            }
          });
        });
      }
    }
  }

  console.log(`Generated ${countryFeatures.length} continuous international land boundary lines.`);

  // Load existing 581 clean 50m state/province lines
  const existingGeo = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/world_boundaries.geojson'), 'utf8'));
  const stateFeatures = existingGeo.features.filter(f => f.properties && f.properties.kind === 'state_border');
  console.log(`Preserved ${stateFeatures.length} state/province administrative borders.`);

  const finalGeo = {
    type: 'FeatureCollection',
    features: [...countryFeatures, ...stateFeatures]
  };

  const outPath = path.join(__dirname, '../public/data/world_boundaries.geojson');
  fs.writeFileSync(outPath, JSON.stringify(finalGeo));
  console.log(`Successfully wrote ${outPath} (${finalGeo.features.length} total features).`);
}

build();

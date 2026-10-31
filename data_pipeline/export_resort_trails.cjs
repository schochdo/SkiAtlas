const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'trails.db');
const db = new DatabaseSync(dbPath);

const globalAreasPath = path.join(__dirname, '../public/data/global_ski_areas.json');
const globalAreas = JSON.parse(fs.readFileSync(globalAreasPath, 'utf8')).features;

// Read all curated flagship resorts from src/data/resorts.ts
const resortsText = fs.readFileSync(path.join(__dirname, '../src/data/resorts.ts'), 'utf8');
const atlasResorts = [];
const itemRegex = /{\s*id:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?lat:\s*([0-9.-]+)[\s\S]*?lng:\s*([0-9.-]+)/g;
let m;
while ((m = itemRegex.exec(resortsText)) !== null) {
  atlasResorts.push({ id: m[1], name: m[2], lat: parseFloat(m[3]), lng: parseFloat(m[4]) });
}

console.log(`Found ${atlasResorts.length} curated resorts in src/data/resorts.ts.`);

function dist(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const bboxStmt = db.prepare(`
  SELECT geojson FROM trails
  WHERE min_lng <= ? AND max_lng >= ? AND min_lat <= ? AND max_lat >= ?
  LIMIT 2500
`);

const outDir = path.join(__dirname, '../public/data/trails');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Exporting curated resort trails and polygon areas to public/data/trails/...');

let exportedCount = 0;
const manifest = {};

for (const r of atlasResorts) {
  // Find candidates in global_ski_areas within 25km
  const candidates = [];
  for (const g of globalAreas) {
    const [gLng, gLat] = g.geometry.coordinates;
    const d = dist(r.lat, r.lng, gLat, gLng);
    if (d < 25) {
      candidates.push({ feat: g, dist: d });
    }
  }

  candidates.sort((a, b) => {
    const aDownhill = a.feat.properties.category === 'downhill' ? 1 : 0;
    const bDownhill = b.feat.properties.category === 'downhill' ? 1 : 0;
    if (aDownhill !== bDownhill) return bDownhill - aDownhill;

    const firstWord = r.name.toLowerCase().split(' ')[0];
    const aNameMatch = a.feat.properties.name?.toLowerCase().includes(firstWord) ? 1 : 0;
    const bNameMatch = b.feat.properties.name?.toLowerCase().includes(firstWord) ? 1 : 0;
    if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

    return a.dist - b.dist;
  });

  const chosenArea = candidates[0]?.feat || null;

  // Spatial query centered on resort summit/base bounds (tight ~6-7 km window)
  const dLng = 0.065;
  const dLat = 0.05;
  const rows = bboxStmt.all(r.lng + dLng, r.lng - dLng, r.lat + dLat, r.lat - dLat);

  let features = [];
  for (const row of rows) {
    const f = JSON.parse(row.geojson);
    const p = f.properties;
    if (!p) continue;

    // Filter out abandoned/proposed lifts
    if (p.kind === 'lift') {
      if (p.status && p.status !== 'operating') continue;
      const n = (p.name || '').toLowerCase();
      if (n.includes('proposed') || n.includes('planned') || n.includes('abandoned') || n.includes('disused') || n.includes('in project')) {
        continue;
      }
    } else if (p.kind === 'piste') {
      const ptype = p['piste:type'];
      // Filter out non-ski municipal features (fatbike, hike, sled, playgrounds)
      if (
        (ptype && ['fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other'].includes(ptype))
      ) {
        continue;
      }
    }

    if (!f.id && p.id) f.id = p.id;
    features.push(f);
  }

  const pisteCount = features.filter(f => f.properties?.kind === 'piste').length;
  const polyCount = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon').length;
  const liftCount = features.filter(f => f.properties?.kind === 'lift').length;

  const fc = {
    type: 'FeatureCollection',
    properties: {
      atlas_id: r.id,
      name: r.name,
      matched_area_id: chosenArea?.properties?.id,
      matched_area_name: chosenArea?.properties?.name,
      feature_count: features.length,
      pistes: pisteCount,
      polygons: polyCount,
      lifts: liftCount,
    },
    features,
  };

  // Write by atlas slug: e.g. crested-butte.json, jackson-hole.json
  const slugPath = path.join(outDir, `${r.id}.json`);
  fs.writeFileSync(slugPath, JSON.stringify(fc));

  // Also write by hex id if matched
  if (chosenArea?.properties?.id) {
    const hexPath = path.join(outDir, `${chosenArea.properties.id}.json`);
    fs.writeFileSync(hexPath, JSON.stringify(fc));
    manifest[r.id] = chosenArea.properties.id;
  }

  exportedCount++;
  console.log(`[${exportedCount}/${atlasResorts.length}] ${r.name} (${r.id}): ${pisteCount} pistes (${polyCount} areas/polygons), ${liftCount} lifts -> ${r.id}.json`);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('All curated resort trails and terrain areas exported successfully!');

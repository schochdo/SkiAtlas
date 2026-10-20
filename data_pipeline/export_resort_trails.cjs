const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'trails.db');
const db = new DatabaseSync(dbPath);

const globalAreasPath = path.join(__dirname, '../public/data/global_ski_areas.json');
const globalAreas = JSON.parse(fs.readFileSync(globalAreasPath, 'utf8')).features;

const appText = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const match = appText.match(/const GLOBAL_SKI_ATLAS: SkiResort\[\] = \[([\s\S]*?)\];/);

const atlasResorts = [];
const itemRegex = /{\s*id:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?lat:\s*([0-9.-]+)[\s\S]*?lng:\s*([0-9.-]+)/g;
let m;
while ((m = itemRegex.exec(match[1])) !== null) {
  atlasResorts.push({ id: m[1], name: m[2], lat: parseFloat(m[3]), lng: parseFloat(m[4]) });
}

function dist(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const idStmt = db.prepare(`
  SELECT t.geojson FROM trails t
  JOIN resort_trails rt ON t.id = rt.trail_id
  WHERE rt.resort_id = ?
`);

const bboxStmt = db.prepare(`
  SELECT geojson FROM trails
  WHERE min_lng <= ? AND max_lng >= ? AND min_lat <= ? AND max_lat >= ?
  LIMIT 800
`);

const outDir = path.join(__dirname, '../public/data/trails');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Exporting curated resort trails to public/data/trails/...');

let exportedCount = 0;
const manifest = {};

for (const r of atlasResorts) {
  // Find candidates within 25km
  const candidates = [];
  for (const g of globalAreas) {
    const [gLng, gLat] = g.geometry.coordinates;
    const d = dist(r.lat, r.lng, gLat, gLng);
    if (d < 25) {
      candidates.push({ feat: g, dist: d });
    }
  }

  // Sort candidates: prefer category === 'downhill', then name match, then closest distance
  candidates.sort((a, b) => {
    const aDownhill = a.feat.properties.category === 'downhill' ? 1 : 0;
    const bDownhill = b.feat.properties.category === 'downhill' ? 1 : 0;
    if (aDownhill !== bDownhill) return bDownhill - aDownhill;

    const aNameMatch = a.feat.properties.name?.toLowerCase().includes(r.name.toLowerCase().split(' ')[0]) ? 1 : 0;
    const bNameMatch = b.feat.properties.name?.toLowerCase().includes(r.name.toLowerCase().split(' ')[0]) ? 1 : 0;
    if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

    return a.dist - b.dist;
  });

  let features = [];
  let chosenArea = null;

  for (const cand of candidates) {
    const rows = idStmt.all(cand.feat.properties.id);
    if (rows.length > features.length) {
      features = rows.map(row => JSON.parse(row.geojson));
      chosenArea = cand.feat;
    }
  }

  // If still empty or few features, try spatial bounding box query around resort coordinates
  if (features.length < 5) {
    const dDeg = 0.07;
    const rows = bboxStmt.all(r.lng + dDeg, r.lng - dDeg, r.lat + dDeg, r.lat - dDeg);
    if (rows.length > features.length) {
      features = rows.map(row => JSON.parse(row.geojson));
    }
  }

  const fc = {
    type: 'FeatureCollection',
    properties: {
      atlas_id: r.id,
      name: r.name,
      matched_area_id: chosenArea?.properties?.id,
      matched_area_name: chosenArea?.properties?.name,
      feature_count: features.length,
      pistes: features.filter(f => f.properties?.kind === 'piste').length,
      lifts: features.filter(f => f.properties?.kind === 'lift').length
    },
    features
  };

  // Write by atlas slug: e.g. jackson-hole.json
  const slugPath = path.join(outDir, `${r.id}.json`);
  fs.writeFileSync(slugPath, JSON.stringify(fc));

  // Also write by hex id if matched
  if (chosenArea?.properties?.id) {
    const hexPath = path.join(outDir, `${chosenArea.properties.id}.json`);
    fs.writeFileSync(hexPath, JSON.stringify(fc));
    manifest[r.id] = chosenArea.properties.id;
  }

  exportedCount++;
  console.log(`[${exportedCount}/${atlasResorts.length}] ${r.name} (${r.id}): ${fc.properties.pistes} pistes, ${fc.properties.lifts} lifts -> ${r.id}.json`);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('All curated trails exported successfully!');

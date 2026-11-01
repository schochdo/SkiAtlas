const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'trails.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}
const db = new DatabaseSync(dbPath);

const globalAreasPath = path.join(__dirname, '../public/data/global_ski_areas.json');
const globalAreas = JSON.parse(fs.readFileSync(globalAreasPath, 'utf8')).features;

const resortsText = fs.readFileSync(path.join(__dirname, '../src/data/resorts.ts'), 'utf8');
const atlasResorts = [];
const itemRegex = /{\s*id:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?lat:\s*([0-9.-]+)[\s\S]*?lng:\s*([0-9.-]+)/g;
let m;
while ((m = itemRegex.exec(resortsText)) !== null) {
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
  LIMIT 3000
`);

const outDir = path.join(__dirname, '../public/data/trails');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function filterTrails(rows) {
  const features = [];
  const seenIds = new Set();

  for (const row of rows) {
    const f = typeof row === 'string' ? JSON.parse(row) : JSON.parse(row.geojson);
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
      if (ptype && ['fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other'].includes(ptype)) {
        continue;
      }
    }

    const fid = String(f.id || p.id || '');
    if (fid && seenIds.has(fid)) continue;
    if (fid) seenIds.add(fid);

    if (!f.id && p.id) f.id = p.id;
    features.push(f);
  }

  return features;
}

console.log(`Starting systematic trail export for all ski areas...`);
console.time('total_export');

const manifest = {};
const exportedSet = new Set();
let exportedCount = 0;

// 1. Export Curated Flagship Resorts first
console.log(`Exporting ${atlasResorts.length} curated flagship resorts...`);
for (const r of atlasResorts) {
  // Find matching global ski area within 25km
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
  const hexId = chosenArea?.properties?.id;

  // Flagship curated resorts must ALWAYS query spatial bounds to capture
  // all freeride bowls, chutes, glades, and unassociated steeps (not just relation members)
  const spatialRows = bboxStmt.all(r.lng + 0.065, r.lng - 0.065, r.lat + 0.05, r.lat - 0.05);
  const relRows = hexId ? idStmt.all(hexId) : [];
  const rawRows = [...spatialRows, ...relRows];

  const features = filterTrails(rawRows);
  if (features.length > 0) {
    const pisteCount = features.filter(f => f.properties?.kind === 'piste').length;
    const polyCount = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon').length;
    const liftCount = features.filter(f => f.properties?.kind === 'lift').length;

    const fc = {
      type: 'FeatureCollection',
      properties: {
        atlas_id: r.id,
        name: r.name,
        matched_area_id: hexId,
        matched_area_name: chosenArea?.properties?.name,
        feature_count: features.length,
        pistes: pisteCount,
        polygons: polyCount,
        lifts: liftCount,
      },
      features,
    };

    const jsonStr = JSON.stringify(fc);
    fs.writeFileSync(path.join(outDir, `${r.id}.json`), jsonStr);
    exportedSet.add(r.id);

    if (hexId) {
      fs.writeFileSync(path.join(outDir, `${hexId}.json`), jsonStr);
      manifest[r.id] = hexId;
      manifest[hexId] = r.id;
      exportedSet.add(hexId);
    }
    exportedCount++;
  }
}
console.log(`Exported ${exportedCount} curated flagship resorts.`);

// 2. Export All Global Ski Areas Worldwide
console.log(`Scanning and exporting all ${globalAreas.length} global ski areas...`);
let globalExported = 0;

for (const a of globalAreas) {
  const p = a.properties;
  if (!p || !p.id) continue;
  const id = p.id;

  // Skip if already exported
  if (exportedSet.has(id)) continue;

  const [lng, lat] = a.geometry.coordinates;
  // Systematic spatial query: captures 100% of trails, steeps, bowls, chutes, and glades
  const spatialRows = bboxStmt.all(lng + 0.045, lng - 0.045, lat + 0.035, lat - 0.035);
  const relRows = id ? idStmt.all(id) : [];
  const rows = [...spatialRows, ...relRows];

  if (!rows || rows.length === 0) continue;

  const features = filterTrails(rows);
  if (features.length === 0) continue;

  const pisteCount = features.filter(f => f.properties?.kind === 'piste').length;
  const polyCount = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon').length;
  const liftCount = features.filter(f => f.properties?.kind === 'lift').length;

  const fc = {
    type: 'FeatureCollection',
    properties: {
      id: p.id,
      name: p.name,
      country: p.country,
      region: p.region,
      feature_count: features.length,
      pistes: pisteCount,
      polygons: polyCount,
      lifts: liftCount,
    },
    features,
  };

  const jsonStr = JSON.stringify(fc);
  fs.writeFileSync(path.join(outDir, `${id}.json`), jsonStr);
  exportedSet.add(id);
  manifest[id] = id;
  globalExported++;
}

console.log(`Exported ${globalExported} global ski areas.`);
console.log(`Total exported trail datasets: ${exportedSet.size}`);

// Write manifest
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
console.timeEnd('total_export');
console.log('Systematic trail export completed successfully!');

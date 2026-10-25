const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const DB_PATH = path.join(__dirname, 'trails.db');
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = OFF;');
db.exec('PRAGMA cache_size = 50000;');

db.exec(`
  CREATE TABLE trails (
    id TEXT PRIMARY KEY,
    kind TEXT,
    name TEXT,
    difficulty TEXT,
    lift_type TEXT,
    geojson TEXT,
    min_lng REAL,
    min_lat REAL,
    max_lng REAL,
    max_lat REAL
  );

  CREATE TABLE resort_trails (
    resort_id TEXT,
    trail_id TEXT,
    PRIMARY KEY (resort_id, trail_id)
  );

  CREATE INDEX idx_rt_resort ON resort_trails(resort_id);
  CREATE INDEX idx_rt_trail ON resort_trails(trail_id);
  CREATE INDEX idx_trails_bbox ON trails(min_lng, max_lng, min_lat, max_lat);
`);

const insertTrailStmt = db.prepare(`
  INSERT OR REPLACE INTO trails (id, kind, name, difficulty, lift_type, geojson, min_lng, min_lat, max_lng, max_lat)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertResortTrailStmt = db.prepare(`
  INSERT OR IGNORE INTO resort_trails (resort_id, trail_id)
  VALUES (?, ?)
`);

function getBbox(coords) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  function walk(c) {
    if (typeof c[0] === 'number') {
      const lng = c[0], lat = c[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(c)) {
      for (const item of c) walk(item);
    }
  }
  walk(coords);
  return [minLng, minLat, maxLng, maxLat];
}

async function processLifts() {
  console.log('Processing lifts...');
  const fileStream = fs.createReadStream(path.join(__dirname, 'lifts.geojson'));
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  db.exec('BEGIN TRANSACTION;');

  for await (const line of rl) {
    if (!line.includes('{"type":"Feature"')) continue;
    const trimmed = line.trim().replace(/,$/, '');
    try {
      const feat = JSON.parse(trimmed);
      const props = feat.properties || {};
      const id = String(props.id || Math.random());
      const name = props.name || props.ref || 'Unnamed Lift';
      const liftType = props.liftType || 'chair_lift';
      const [minLng, minLat, maxLng, maxLat] = getBbox(feat.geometry?.coordinates || []);

      // Standardize properties for MapLibre client
      const normalizedFeature = {
        type: 'Feature',
        id,
        geometry: feat.geometry,
        properties: {
          id,
          kind: 'lift',
          name,
          lift_type: liftType,
          aerialway: liftType,
          status: props.status || 'operating',
          occupancy: props.occupancy,
          capacity: props.capacity
        }
      };

      insertTrailStmt.run(
        id,
        'lift',
        name,
        null,
        liftType,
        JSON.stringify(normalizedFeature),
        minLng,
        minLat,
        maxLng,
        maxLat
      );

      if (Array.isArray(props.skiAreas)) {
        for (const s of props.skiAreas) {
          const sid = s.properties?.id || s.id;
          if (sid) {
            insertResortTrailStmt.run(sid, id);
          }
        }
      }

      count++;
      if (count % 5000 === 0) {
        db.exec('COMMIT;');
        db.exec('BEGIN TRANSACTION;');
        console.log(`Indexed ${count} lifts...`);
      }
    } catch (e) {}
  }
  db.exec('COMMIT;');
  console.log(`Finished indexing ${count} lifts.`);
}

async function processRuns() {
  console.log('Processing runs...');
  const fileStream = fs.createReadStream(path.join(__dirname, 'runs.geojson'));
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  db.exec('BEGIN TRANSACTION;');

  for await (const line of rl) {
    if (!line.includes('{"type":"Feature"')) continue;
    const trimmed = line.trim().replace(/,$/, '');
    try {
      const feat = JSON.parse(trimmed);
      const props = feat.properties || {};
      const id = String(props.id || Math.random());
      const name = props.name || props.ref || 'Unnamed Trail';
      const diff = props.difficulty || 'intermediate';
      const [minLng, minLat, maxLng, maxLat] = getBbox(feat.geometry?.coordinates || []);

      // Standardize properties for MapLibre client
      const normalizedFeature = {
        type: 'Feature',
        id,
        geometry: feat.geometry,
        properties: {
          id,
          kind: 'piste',
          name,
          difficulty: diff,
          'piste:type': props.uses?.includes('nordic') ? 'nordic' : 'downhill',
          'piste:difficulty': diff,
          grooming: props.grooming,
          gladed: props.gladed
        }
      };

      insertTrailStmt.run(
        id,
        'piste',
        name,
        diff,
        null,
        JSON.stringify(normalizedFeature),
        minLng,
        minLat,
        maxLng,
        maxLat
      );

      if (Array.isArray(props.skiAreas)) {
        for (const s of props.skiAreas) {
          const sid = s.properties?.id || s.id;
          if (sid) {
            insertResortTrailStmt.run(sid, id);
          }
        }
      }

      count++;
      if (count % 10000 === 0) {
        db.exec('COMMIT;');
        db.exec('BEGIN TRANSACTION;');
        console.log(`Indexed ${count} runs...`);
      }
    } catch (e) {}
  }
  db.exec('COMMIT;');
  console.log(`Finished indexing ${count} runs.`);
}

async function main() {
  const start = Date.now();
  await processLifts();
  await processRuns();
  console.log(`Done building trails database in ${(Date.now() - start) / 1000}s!`);
}

main();

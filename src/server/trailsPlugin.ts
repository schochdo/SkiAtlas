import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

let DatabaseSyncClass: any = null;
try {
  const sqliteMod = await import('node:sqlite');
  DatabaseSyncClass = sqliteMod.DatabaseSync;
} catch (_) {}

function getSamplePoint(geom: any): [number, number] | null {
  if (!geom || !geom.coordinates) return null;
  let c = geom.coordinates;
  while (Array.isArray(c) && c.length > 0 && Array.isArray(c[0])) {
    c = c[0];
  }
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return [c[0], c[1]];
  }
  return null;
}

export function localTrailsPlugin(): Plugin {
  let db: any = null;
  let dbMtime = 0;
  const dbPath = path.resolve(process.cwd(), 'data_pipeline/trails.db');
  // Map of resort id -> [lng, lat, category]
  let areaCoordsMap: Map<string, [number, number, string]> | null = null;

  function getDb() {
    if (fs.existsSync(dbPath) && DatabaseSyncClass) {
      try {
        const stat = fs.statSync(dbPath);
        if (!db || stat.mtimeMs !== dbMtime) {
          if (db) {
            try { db.close(); } catch (_) {}
          }
          db = new DatabaseSyncClass(dbPath, { readOnly: true });
          db.exec('PRAGMA cache_size = 20000;');
          dbMtime = stat.mtimeMs;
        }
      } catch (err) {
        console.warn('[LocalTrailsPlugin] Failed to open trails.db:', err);
      }
    }
    return db;
  }

  function getAreaCoords() {
    if (!areaCoordsMap) {
      areaCoordsMap = new Map();
      try {
        // Load global ski areas (downhill, nordic, heli_cat) from the public dataset
        const p = path.resolve(process.cwd(), 'public/data/global_ski_areas.json');
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const f of raw.features || []) {
            const id = f.properties?.id;
            const coords = f.geometry?.coordinates;
            const category = f.properties?.category || 'downhill';
            if (id && Array.isArray(coords) && coords.length >= 2) {
              areaCoordsMap.set(id, [coords[0], coords[1], category]);
            }
          }
        }
        // Also add curated heli/cat operations from their known coordinates
        // so cat-ski tenure areas are always recognized, even if not in the global dataset
        const heliCatOps: Array<{ id: string; lng: number; lat: number }> = [
          { id: 'heli-mica',            lng: -118.5714,  lat: 52.0532 },
          { id: 'cat-island-lake',      lng: -115.1472,  lat: 49.5292 },
          { id: 'cat-baldface',         lng: -117.3825,  lat: 49.7592 },
          { id: 'cat-selkirk',          lng: -117.8900,  lat: 51.1700 },
          { id: 'cat-chatter-creek',    lng: -117.7770,  lat: 51.1600 },
          { id: 'cat-bella-coola',      lng: -126.7644,  lat: 52.3722 },
          { id: 'heli-cmh-bugaboos',    lng: -116.7786,  lat: 50.7442 },
          { id: 'heli-mike-wiegele',    lng: -119.2814,  lat: 51.9553 },
          { id: 'heli-last-frontier',   lng: -129.9833,  lat: 56.8042 },
          { id: 'heli-chugach',         lng: -149.1081,  lat: 60.9702 },
          { id: 'heli-valdez',          lng: -146.3500,  lat: 61.1200 },
          { id: 'cat-steam-powdercats', lng: -106.6789,  lat: 40.5401 },
          { id: 'cat-silverton',        lng: -107.6658,  lat: 37.8847 },
          { id: 'heli-southern-lakes',  lng:  168.7231,  lat: -44.8512 },
          { id: 'heli-air-zermatt',     lng:    7.8668,  lat: 45.9372 },
          { id: 'heli-hokkaido',        lng:  140.8576,  lat: 42.8465 },
        ];
        for (const op of heliCatOps) {
          if (!areaCoordsMap.has(op.id)) {
            areaCoordsMap.set(op.id, [op.lng, op.lat, 'heli_cat']);
          }
        }
      } catch (e) {
        console.warn('[LocalTrailsPlugin] Failed to load global_ski_areas:', e);
      }
    }
    return areaCoordsMap;
  }

  return {
    name: 'local-trails-api',
    configureServer(server) {
      server.middlewares.use('/api/trails', (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const resort = url.searchParams.get('resort');
          const bbox = url.searchParams.get('bbox');

          // 1. Check if pre-exported JSON exists in public/data/trails/
          if (resort) {
            const staticPath = path.resolve(process.cwd(), `public/data/trails/${resort}.json`);
            if (fs.existsSync(staticPath)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              const stream = fs.createReadStream(staticPath);
              stream.pipe(res);
              return;
            }
          }

          // 2. Query local SQLite database
          const database = getDb();
          if (!database) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Trails database not available' }));
            return;
          }

          let features: any[] = [];

          if (resort) {
            const stmt = database.prepare(`
              SELECT t.geojson FROM trails t
              JOIN resort_trails rt ON t.id = rt.trail_id
              WHERE rt.resort_id = ?
            `);
            const rows = stmt.all(resort) as { geojson: string }[];
            features = rows.map((r) => {
              const f = JSON.parse(r.geojson);
              if (!f.id && f.properties?.id) f.id = f.properties.id;
              return f;
            });

            // Automatic spatial fallback: If no trails linked directly by ID, query around mountain coordinates
            if (features.length === 0) {
              const coordsMap = getAreaCoords();
              const pt = coordsMap?.get(resort);
              if (pt) {
                const [lng, lat] = pt;
                const dDeg = 0.045; // ~4-5 km radius
                const bboxStmt = database.prepare(`
                  SELECT DISTINCT t.geojson FROM trails t
                  WHERE t.min_lng <= ? AND t.max_lng >= ? AND t.min_lat <= ? AND t.max_lat >= ?
                  LIMIT 2500
                `);
                const bboxRows = bboxStmt.all(lng + dDeg, lng - dDeg, lat + dDeg, lat - dDeg) as { geojson: string }[];
                features = bboxRows.map((r) => {
                  const f = JSON.parse(r.geojson);
                  if (!f.id && f.properties?.id) f.id = f.properties.id;
                  return f;
                });
              }
            }
          } else if (bbox) {
            const parts = bbox.split(',').map(Number);
            if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
              const [minLng, minLat, maxLng, maxLat] = parts;
              // Only query valid, tight bounding boxes (ignore massive state/continent queries)
              if (Math.abs(maxLng - minLng) <= 0.6 && Math.abs(maxLat - minLat) <= 0.5) {
                // Query all pistes and operating lifts in the bounding box directly from trails table
                const stmt = database.prepare(`
                  SELECT DISTINCT t.geojson, rt.resort_id FROM trails t
                  LEFT JOIN resort_trails rt ON t.id = rt.trail_id
                  WHERE t.min_lng <= ? AND t.max_lng >= ? AND t.min_lat <= ? AND t.max_lat >= ?
                  LIMIT 5000
                `);
                const rows = stmt.all(maxLng, minLng, maxLat, minLat) as { geojson: string; resort_id: string | null }[];
                features = rows.map((r) => {
                  const f = JSON.parse(r.geojson);
                  if (!f.id && f.properties?.id) f.id = f.properties.id;
                  if (r.resort_id && f.properties) {
                    f.properties.resort_id = r.resort_id;
                  }
                  return f;
                });
              }
            }
          }

          // Strictly filter out non-operating lifts and non-ski municipal features
          features = features.filter((f) => {
            const p = f.properties;
            if (!p) return true;
            if (p.kind === 'lift') {
              if (p.status && p.status !== 'operating') return false;
              const nameLower = (p.name || '').toLowerCase();
              if (
                nameLower.includes('(proposed)') ||
                nameLower.includes('(planned)') ||
                nameLower.includes('(abandoned)') ||
                nameLower.includes('(disused)') ||
                nameLower.includes('(in project)')
              ) {
                return false;
              }
            } else if (p.kind === 'piste') {
              const ptype = p['piste:type'];
              const uses = Array.isArray(p.uses) ? p.uses : [];
              const isBackcountryGrooming = p.grooming === 'backcountry' || p['piste:grooming'] === 'backcountry' || p.backcountry === 'yes';

              // Reject non-resort pistes: backcountry touring/mountaineering routes, fatbike, hike, sled, playgrounds, etc.
              if (
                (ptype && ['skitour', 'backcountry', 'fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other'].includes(ptype)) ||
                uses.includes('skitour') ||
                uses.includes('backcountry')
              ) {
                return false;
              }

              // Reject wild backcountry trails not associated with any ski resort.
              // Use the closest resort to determine ownership. If the closest resort is a
              // heli/cat operation, tag the trail as is_heli_cat=true so the client can
              // suppress it when the Cat/Heli toggle is off.
              if (isBackcountryGrooming && !p.resort_id) {
                const coordsMap = getAreaCoords();
                const samplePt = getSamplePoint(f.geometry);

                if (!samplePt || !coordsMap) {
                  return false; // Cannot geolocate — drop it
                }

                const [lng, lat] = samplePt;
                let closestDist = Infinity;
                let closestCategory = '';

                for (const [, [rLng, rLat, rCat]] of coordsMap) {
                  const d = Math.hypot(lng - rLng, lat - rLat);
                  if (d < closestDist) {
                    closestDist = d;
                    closestCategory = rCat;
                  }
                }

                // No resort within a reasonable radius (~25 km, ~0.22 deg) → drop
                if (closestDist > 0.22 || !closestCategory) {
                  return false;
                }

                if (closestCategory === 'heli_cat') {
                  // Exclusively cat/heli terrain — tag for client-side toggle filtering
                  if (f.properties) f.properties.is_heli_cat = true;
                }
                // If closest is downhill/nordic, allow through untagged
              }
            }
            return true;
          });

          const responseData = {
            type: 'FeatureCollection',
            features,
          };

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(JSON.stringify(responseData));
        } catch (err: any) {
          console.error('[LocalTrailsPlugin] Error handling request:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
        }
      });
    },
  };
}

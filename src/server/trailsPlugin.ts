import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

export function localTrailsPlugin(): Plugin {
  let db: DatabaseSync | null = null;
  let dbMtime = 0;
  const dbPath = path.resolve(process.cwd(), 'data_pipeline/trails.db');
  let areaCoordsMap: Map<string, [number, number]> | null = null;

  function getDb() {
    if (fs.existsSync(dbPath)) {
      try {
        const stat = fs.statSync(dbPath);
        if (!db || stat.mtimeMs !== dbMtime) {
          if (db) {
            try { db.close(); } catch (_) {}
          }
          db = new DatabaseSync(dbPath, { readOnly: true });
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
        const p = path.resolve(process.cwd(), 'public/data/global_ski_areas.json');
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const f of raw.features || []) {
            const id = f.properties?.id;
            const coords = f.geometry?.coordinates;
            if (id && Array.isArray(coords) && coords.length >= 2) {
              areaCoordsMap.set(id, [coords[0], coords[1]]);
            }
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

              // Reject wild backcountry trails not associated with any ski resort
              if (isBackcountryGrooming && !p.resort_id) {
                const coordsMap = getAreaCoords();
                const coords = f.geometry?.coordinates;
                const samplePt = Array.isArray(coords) && typeof coords[0] === 'number'
                  ? coords
                  : (Array.isArray(coords) && Array.isArray(coords[0]) && typeof coords[0][0] === 'number' ? coords[0] : null);

                let nearResort = false;
                if (samplePt && coordsMap) {
                  const [lng, lat] = samplePt;
                  for (const [, [rLng, rLat]] of coordsMap) {
                    if (Math.abs(lng - rLng) < 0.06 && Math.abs(lat - rLat) < 0.05) {
                      nearResort = true;
                      break;
                    }
                  }
                }
                if (!nearResort) {
                  return false;
                }
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

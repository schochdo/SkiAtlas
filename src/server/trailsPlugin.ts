import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

export function localTrailsPlugin(): Plugin {
  let db: DatabaseSync | null = null;
  const dbPath = path.resolve(process.cwd(), 'data_pipeline/trails.db');
  let areaCoordsMap: Map<string, [number, number]> | null = null;

  function getDb() {
    if (!db && fs.existsSync(dbPath)) {
      try {
        db = new DatabaseSync(dbPath, { readOnly: true });
        db.exec('PRAGMA cache_size = 20000;');
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
              delete f.id;
              return f;
            });

            // Automatic spatial fallback: If no trails linked directly by ID, query around mountain coordinates
            if (features.length === 0) {
              const coordsMap = getAreaCoords();
              const pt = coordsMap?.get(resort);
              if (pt) {
                const [lng, lat] = pt;
                const dDeg = 0.055; // ~5-6 km radius
                const bboxStmt = database.prepare(`
                  SELECT geojson FROM trails
                  WHERE min_lng <= ? AND max_lng >= ? AND min_lat <= ? AND max_lat >= ?
                  LIMIT 600
                `);
                const bboxRows = bboxStmt.all(lng + dDeg, lng - dDeg, lat + dDeg, lat - dDeg) as { geojson: string }[];
                features = bboxRows.map((r) => {
                  const f = JSON.parse(r.geojson);
                  delete f.id;
                  return f;
                });
              }
            }
          } else if (bbox) {
            const parts = bbox.split(',').map(Number);
            if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
              const [minLng, minLat, maxLng, maxLat] = parts;
              const stmt = database.prepare(`
                SELECT geojson FROM trails
                WHERE min_lng <= ? AND max_lng >= ? AND min_lat <= ? AND max_lat >= ?
                LIMIT 3000
              `);
              const rows = stmt.all(maxLng, minLng, maxLat, minLat) as { geojson: string }[];
              features = rows.map((r) => {
                const f = JSON.parse(r.geojson);
                delete f.id;
                return f;
              });
            }
          }

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

const fs = require('fs');
const path = require('path');

const geojsonPath = path.resolve(__dirname, '../public/data/major_peaks.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const osm = JSON.parse(fs.readFileSync('/tmp/co_peaks_osm.json', 'utf8'));

const osmByName = new Map();
for (const el of osm.elements) {
  if (el.tags && el.tags.name) {
    const key = el.tags.name.toLowerCase().trim();
    if (!osmByName.has(key)) osmByName.set(key, []);
    osmByName.get(key).push(el);
  }
}

// Manual aliases for known Colorado naming variations
const aliases = {
  'el diente': 'el diente peak',
  'maroon bells': 'maroon peak',
  'king solomon mtn': 'king solomon mountain',
  'mount ypsilon': 'ypsilon mountain',
  'chrysolite': 'chrysolite mountain',
  'mount otis': 'otis peak',
  'mount french': 'french mountain',
  'two buttes mountain': 'two buttes'
};

let updated = 0;
for (const f of data.features) {
  const [lng, lat] = f.geometry.coordinates;
  // Colorado bounding box
  if (lng >= -109.5 && lng <= -102.0 && lat >= 36.8 && lat <= 41.2) {
    let name = f.properties.name.toLowerCase().trim();
    if (aliases[name]) name = aliases[name];
    let candidates = osmByName.get(name);
    if (!candidates) {
      const noMount = name.replace(/^mount\s+/, '');
      candidates = osmByName.get(noMount);
    }
    if (candidates && candidates.length > 0) {
      let best = null;
      let minDist = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.lon - lng, c.lat - lat);
        if (d < minDist) {
          minDist = d;
          best = c;
        }
      }
      if (minDist < 0.08) { // within ~8km
        const distM = minDist * 100000;
        if (distM > 5) { // displaced by > 5 meters
          const origCoords = [...f.geometry.coordinates];
          f.geometry.coordinates = [parseFloat(best.lon.toFixed(6)), parseFloat(best.lat.toFixed(6))];
          
          // If OSM has surveyed elevation, verify/preserve elevation
          if (best.tags && best.tags.ele) {
            const eleM = parseFloat(best.tags.ele);
            if (!isNaN(eleM) && eleM > 500 && Math.abs(eleM - f.properties.elevation_m) < 400) {
              const elevM = Math.round(eleM);
              const elevFt = Math.round(elevM * 3.28084);
              f.properties.elevation_m = elevM;
              f.properties.elevation_ft = elevFt;
              f.properties.elevation_formatted_ft = elevFt.toLocaleString() + "'";
              f.properties.elevation_formatted_m = elevM.toLocaleString() + ' m';
              f.properties.label_ft = `▲ ${f.properties.name} · ${elevFt.toLocaleString()}'`;
              f.properties.label_m = `▲ ${f.properties.name} · ${elevM.toLocaleString()} m`;
              f.properties.label_stacked_ft = `▲ ${f.properties.name}\n${elevFt.toLocaleString()}'`;
              f.properties.label_stacked_m = `▲ ${f.properties.name}\n${elevM.toLocaleString()} m`;
              f.properties.sort_key = 40000 - elevFt;
            }
          }
          
          updated++;
          console.log(`Updated ${f.properties.name}: [${origCoords}] -> [${f.geometry.coordinates}] (~${Math.round(distM)}m offset corrected)`);
        }
      }
    }
  }
}

console.log(`\nSuccessfully updated ${updated} Colorado peaks to exact surveyed benchmarks.`);
fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2));

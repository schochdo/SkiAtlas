const fs = require('fs');
const path = require('path');

const geojsonPath = path.resolve(__dirname, '../public/data/major_peaks.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// 1. Whitelist of iconic ski resort peaks and famous world mountains under 4,000 ft
const lowElevationWhitelist = new Set([
  'Mount Mansfield',
  'Killington Peak',
  'Mount Ellen',
  'Jay Peak',
  'Barker Mountain',
  'Sugarloaf',
  'Cannon Mountain',
  'Wildcat Mountain',
  'Whiteface Mountain',
  'Mont Tremblant',
  'Mont-Sainte-Anne',
  'Massif de Charlevoix',
  'Ben Nevis',
  'Cairn Gorm',
  'Åreskutan',
  'Trysilfjellet',
  'Hemsedal',
  'Levi',
  'Table Mountain',
  'Mount Taranaki',
  'Mt. Taranaki',
  'Schilthorn',
  'Drei Türme',
  'Zugspitze',
  'Biberkopf',
  'Mädelegabel',
  'Grigna Meridionale',
  'Resegone',
  'Chörblispitz',
  'Hinderi Spillgerte',
  'Vorderi Spillgerte',
  'Lobhörner',
  'Rohrbachstein',
  'Tomlishorn (Pilatus)',
  'Pilatus',
  'Säntis',
  'Torri del Vajolet',
  'Moncucco',
  'Hoher Freschen',
  'Myogi San'
]);

// 2. Filter step: Remove non-mountain noise under 4,000 ft unless on whitelist
const initialCount = data.features.length;
data.features = data.features.filter((f) => {
  const elev = f.properties.elevation_ft;
  if (elev >= 4000) return true;
  const name = f.properties.name.trim();
  for (const w of lowElevationWhitelist) {
    if (name.toLowerCase().includes(w.toLowerCase())) return true;
  }
  return false;
});
console.log(`Filtered low-elevation noise: ${initialCount} -> ${data.features.length} features.`);

// 3. Clean all names (strip parenthetical disambiguations)
for (const f of data.features) {
  if (/\(/.test(f.properties.name)) {
    // Keep Tomlishorn (Pilatus) if desired, but clean others
    if (!f.properties.name.includes('Pilatus')) {
      f.properties.name = f.properties.name.replace(/\s*\([^)]*\)/g, '').trim();
    }
  }
}

// 4. Identify all remaining arcminute-truncated peaks
function isArcminute(coords) {
  const [lng, lat] = coords;
  const latM = lat * 60, lngM = lng * 60;
  return Math.abs(latM - Math.round(latM)) < 0.001 || Math.abs(lngM - Math.round(lngM)) < 0.001;
}

const badIndices = [];
for (let i = 0; i < data.features.length; i++) {
  if (isArcminute(data.features[i].geometry.coordinates)) {
    badIndices.push(i);
  }
}
console.log(`Found ${badIndices.length} arcminute-truncated peaks to resolve via authoritative Wikidata geodetic API.`);

// Helper for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function reconcile() {
  let resolved = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 0; i < badIndices.length; i++) {
    const idx = badIndices[i];
    const f = data.features[idx];
    const origCoords = f.geometry.coordinates;
    const cleanName = f.properties.name;

    try {
      const sUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanName)}&language=en&format=json`;
      const sRes = await fetchWithTimeout(sUrl, {
        headers: { 'User-Agent': 'SkiAtlasBot/1.0 (mountain research cartography; mailto:admin@skiatlas.org)' }
      });

      if (!sRes.ok) {
        if (sRes.status === 429) {
          console.warn(`Rate limit hit at ${i}, backing off 3 seconds...`);
          await new Promise(r => setTimeout(r, 3000));
          i--; // retry
          continue;
        }
        notFound++;
        continue;
      }

      const sData = await sRes.json();
      if (!sData.search || sData.search.length === 0) {
        notFound++;
        continue;
      }

      // Find mountain candidate
      let candidate = null;
      for (const res of sData.search) {
        const desc = (res.description || '').toLowerCase();
        if (
          desc.includes('mountain') ||
          desc.includes('peak') ||
          desc.includes('volcano') ||
          desc.includes('summit') ||
          desc.includes('alps') ||
          desc.includes('massif') ||
          desc.includes('highest point') ||
          desc.includes('stratovolcano') ||
          desc.includes('ridge') ||
          desc.includes('spitze') ||
          desc.includes('berg')
        ) {
          candidate = res;
          break;
        }
      }

      if (!candidate && sData.search.length === 1) {
        candidate = sData.search[0];
      }

      if (!candidate) {
        notFound++;
        continue;
      }

      // Fetch entity coordinates
      const eUrl = `https://www.wikidata.org/wiki/Special:EntityData/${candidate.id}.json`;
      const eRes = await fetchWithTimeout(eUrl, {
        headers: { 'User-Agent': 'SkiAtlasBot/1.0 (mountain research cartography; mailto:admin@skiatlas.org)' }
      });

      if (!eRes.ok) {
        notFound++;
        continue;
      }

      const eData = await eRes.json();
      const entity = eData.entities?.[candidate.id];
      const p625 = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;

      if (!p625 || p625.longitude === undefined || p625.latitude === undefined) {
        notFound++;
        continue;
      }

      const newLng = p625.longitude;
      const newLat = p625.latitude;

      // Distance check: must be within ~35 km (0.35 deg lat, 0.45 deg lng)
      const dLat = Math.abs(newLat - origCoords[1]);
      const dLng = Math.abs(newLng - origCoords[0]);
      if (dLat > 0.35 || dLng > 0.45) {
        skipped++;
        continue;
      }

      // Precision check: new coords must NOT be arcminutes
      if (isArcminute([newLng, newLat])) {
        skipped++;
        continue;
      }

      // Elevation check
      let elevM = f.properties.elevation_m;
      let elevFt = f.properties.elevation_ft;
      const p2044 = entity?.claims?.P2044?.[0]?.mainsnak?.datavalue?.value?.amount;
      if (p2044) {
        const parsedM = parseInt(p2044, 10);
        if (parsedM > 0 && Math.abs(parsedM - elevM) < 500) {
          elevM = parsedM;
          elevFt = Math.round(elevM * 3.28084);
        }
      }

      // Update feature
      f.geometry.coordinates = [parseFloat(newLng.toFixed(6)), parseFloat(newLat.toFixed(6))];
      f.properties.elevation_m = elevM;
      f.properties.elevation_ft = elevFt;
      f.properties.elevation_formatted_ft = `${elevFt.toLocaleString()}'`;
      f.properties.elevation_formatted_m = `${elevM.toLocaleString()} m`;
      f.properties.label_ft = `▲ ${cleanName} · ${elevFt.toLocaleString()}'`;
      f.properties.label_m = `▲ ${cleanName} · ${elevM.toLocaleString()} m`;
      f.properties.label_stacked_ft = `▲ ${cleanName}\n${elevFt.toLocaleString()}'`;
      f.properties.label_stacked_m = `▲ ${cleanName}\n${elevM.toLocaleString()} m`;
      f.properties.sort_key = 40000 - elevFt;

      resolved++;
      console.log(`[${resolved}/${badIndices.length}] ${cleanName} -> [${f.geometry.coordinates}] (${elevFt}') [${candidate.id}]`);

      // Save progress every 25 resolved
      if (resolved % 25 === 0) {
        fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2));
      }
    } catch (err) {
      notFound++;
    }

    // Paced polite delay: 350ms
    await new Promise(r => setTimeout(r, 350));
  }

  // Final save
  fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2));
  console.log(`\nReconciliation Complete!`);
  console.log(`Resolved & Snapped: ${resolved}`);
  console.log(`Skipped (mismatch/still arcmin): ${skipped}`);
  console.log(`Not Found / Unmatched: ${notFound}`);

  // Count remaining arcminute peaks
  let remainingBad = 0;
  for (const f of data.features) {
    if (isArcminute(f.geometry.coordinates)) remainingBad++;
  }
  console.log(`Remaining arcminute peaks in final dataset: ${remainingBad}`);
}

reconcile();

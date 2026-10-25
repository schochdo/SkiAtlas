const fs = require('fs');

async function reconcileBatch(limit = 50) {
  const geojsonPath = './public/data/major_peaks.geojson';
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  const arcminutePeaks = [];
  for (let i = 0; i < data.features.length; i++) {
    const f = data.features[i];
    const [lng, lat] = f.geometry.coordinates;
    const latM = lat * 60, lngM = lng * 60;
    const isLatArc = Math.abs(latM - Math.round(latM)) < 0.001;
    const isLngArc = Math.abs(lngM - Math.round(lngM)) < 0.001;
    if (isLatArc || isLngArc) {
      arcminutePeaks.push({ index: i, feature: f });
    }
  }

  console.log(`Found ${arcminutePeaks.length} arcminute-truncated peaks. Processing first ${limit}...`);

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  const toProcess = arcminutePeaks.slice(0, limit);

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const f = item.feature;
    const originalCoords = f.geometry.coordinates;
    let cleanName = f.properties.name.replace(/\s*\(.*?\)\s*/g, '').trim();

    try {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanName)}&language=en&format=json`;
      const sRes = await fetch(searchUrl, { headers: { 'User-Agent': 'SkiAtlasBot/1.0 (mountain geodetic reconciliation)' } });
      const sData = await sRes.json();

      if (!sData.search || sData.search.length === 0) {
        console.log(`[${i + 1}/${limit}] No Wikidata hit for "${cleanName}"`);
        failed++;
        continue;
      }

      // Find best entity matching mountain keywords
      let candidate = null;
      for (const res of sData.search) {
        const desc = (res.description || '').toLowerCase();
        if (
          desc.includes('mountain') ||
          desc.includes('peak') ||
          desc.includes('volcano') ||
          desc.includes('summit') ||
          desc.includes('alps') ||
          desc.includes('elevation') ||
          desc.includes('stratovolcano')
        ) {
          candidate = res;
          break;
        }
      }

      if (!candidate) {
        // Fallback to first if only one result
        if (sData.search.length === 1) candidate = sData.search[0];
      }

      if (!candidate) {
        console.log(`[${i + 1}/${limit}] No mountain candidate for "${cleanName}"`);
        failed++;
        continue;
      }

      // Fetch entity data
      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${candidate.id}.json`;
      const eRes = await fetch(entityUrl, { headers: { 'User-Agent': 'SkiAtlasBot/1.0 (mountain geodetic reconciliation)' } });
      const eData = await eRes.json();
      const entity = eData.entities[candidate.id];
      const claims = entity.claims;

      const p625 = claims.P625?.[0]?.mainsnak?.datavalue?.value;
      if (!p625 || p625.longitude === undefined || p625.latitude === undefined) {
        console.log(`[${i + 1}/${limit}] Entity ${candidate.id} (${cleanName}) lacks coordinates`);
        failed++;
        continue;
      }

      const newLng = p625.longitude;
      const newLat = p625.latitude;

      // Distance check: must be within ~30 km
      const dLat = Math.abs(newLat - originalCoords[1]);
      const dLng = Math.abs(newLng - originalCoords[0]);
      if (dLat > 0.3 || dLng > 0.4) {
        console.log(`[${i + 1}/${limit}] Coordinate mismatch for "${cleanName}": old [${originalCoords}], new [${newLng}, ${newLat}]`);
        skipped++;
        continue;
      }

      // Precision check: new coordinates must NOT be arcminutes
      const newLatM = newLat * 60, newLngM = newLng * 60;
      if (Math.abs(newLatM - Math.round(newLatM)) < 0.001 && Math.abs(newLngM - Math.round(newLngM)) < 0.001) {
        console.log(`[${i + 1}/${limit}] Wikidata entity ${candidate.id} also has arcminute coords for "${cleanName}"`);
        skipped++;
        continue;
      }

      // Check elevation
      let elevM = f.properties.elevation_m;
      let elevFt = f.properties.elevation_ft;
      const p2044 = claims.P2044?.[0]?.mainsnak?.datavalue?.value?.amount;
      if (p2044) {
        const parsedM = parseInt(p2044, 10);
        if (parsedM > 0) {
          elevM = parsedM;
          elevFt = Math.round(elevM * 3.28084);
        }
      }

      // Update feature
      f.geometry.coordinates = [parseFloat(newLng.toFixed(6)), parseFloat(newLat.toFixed(6))];
      f.properties.elevation_m = elevM;
      f.properties.elevation_ft = elevFt;
      f.properties.elevation_formatted_ft = elevFt.toLocaleString() + "'";
      f.properties.elevation_formatted_m = elevM.toLocaleString() + ' m';
      f.properties.label_ft = `▲ ${cleanName} · ${elevFt.toLocaleString()}'`;
      f.properties.label_m = `▲ ${cleanName} · ${elevM.toLocaleString()} m`;
      f.properties.label_stacked_ft = `▲ ${cleanName}\n${elevFt.toLocaleString()}'`;
      f.properties.label_stacked_m = `▲ ${cleanName}\n${elevM.toLocaleString()} m`;
      f.properties.sort_key = 40000 - elevFt;

      console.log(`✓ RESOLVED: ${cleanName} -> [${f.geometry.coordinates}] (${elevFt}ft) [Wikidata ${candidate.id}]`);
      resolved++;

      // Small delay to be polite
      await new Promise(r => setTimeout(r, 60));
    } catch (err) {
      console.error(`Error processing ${cleanName}:`, err.message);
      failed++;
    }
  }

  console.log(`\nReconciliation summary: ${resolved} resolved, ${skipped} skipped, ${failed} failed out of ${toProcess.length}`);
  fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2));
}

reconcileBatch(50);

const fs = require('fs');

async function reconcileAll() {
  const geojsonPath = './public/data/major_peaks.geojson';
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  // 1. First, identify arcminute peaks
  const arcminuteIndices = [];
  for (let i = 0; i < data.features.length; i++) {
    const f = data.features[i];
    const [lng, lat] = f.geometry.coordinates;
    const latM = lat * 60, lngM = lng * 60;
    const isLatArc = Math.abs(latM - Math.round(latM)) < 0.001;
    const isLngArc = Math.abs(lngM - Math.round(lngM)) < 0.001;
    if (isLatArc || isLngArc) {
      arcminuteIndices.push(i);
    }
  }

  console.log(`Total features: ${data.features.length}`);
  console.log(`Found ${arcminuteIndices.length} arcminute-truncated peaks to reconcile.`);

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  // Process in concurrent batches of 6
  const BATCH_SIZE = 6;
  for (let b = 0; b < arcminuteIndices.length; b += BATCH_SIZE) {
    const batch = arcminuteIndices.slice(b, b + BATCH_SIZE);
    await Promise.all(batch.map(async (idx) => {
      const f = data.features[idx];
      const origCoords = f.geometry.coordinates;
      let cleanName = f.properties.name.replace(/\s*\(.*?\)\s*/g, '').trim();

      try {
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanName)}&language=en&format=json`;
        const sRes = await fetch(searchUrl, { headers: { 'User-Agent': 'SkiAtlasBot/1.0 (geodetic peak reconciliation)' } });
        if (!sRes.ok) { failed++; return; }
        const sData = await sRes.json();

        if (!sData.search || sData.search.length === 0) {
          // Try without common prefixes like "Mount " or "Mt. "
          const altName = cleanName.replace(/^(Mount|Mt\.|Pic|Piz|Pico|Mont|Monte)\s+/i, '').trim();
          if (altName !== cleanName && altName.length > 2) {
            const altUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(altName)}&language=en&format=json`;
            const altRes = await fetch(altUrl, { headers: { 'User-Agent': 'SkiAtlasBot/1.0' } });
            if (altRes.ok) {
              const altData = await altRes.json();
              if (altData.search?.length > 0) {
                sData.search = altData.search;
              }
            }
          }
        }

        if (!sData.search || sData.search.length === 0) {
          failed++;
          return;
        }

        // Look for mountain/peak/volcano/summit entity
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
            desc.includes('stratovolcano') ||
            desc.includes('massif') ||
            desc.includes('berg') ||
            desc.includes('spitze') ||
            desc.includes('kogel')
          ) {
            candidate = res;
            break;
          }
        }

        if (!candidate && sData.search.length === 1) {
          candidate = sData.search[0];
        }

        if (!candidate) {
          failed++;
          return;
        }

        // Fetch entity data
        const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${candidate.id}.json`;
        const eRes = await fetch(entityUrl, { headers: { 'User-Agent': 'SkiAtlasBot/1.0' } });
        if (!eRes.ok) { failed++; return; }
        const eData = await eRes.json();
        const entity = eData.entities[candidate.id];
        if (!entity || !entity.claims) { failed++; return; }

        const p625 = entity.claims.P625?.[0]?.mainsnak?.datavalue?.value;
        if (!p625 || p625.longitude === undefined || p625.latitude === undefined) {
          failed++;
          return;
        }

        const newLng = p625.longitude;
        const newLat = p625.latitude;

        // Proximity check: must be within ~35 km (0.35 deg lat, 0.45 deg lng)
        const dLat = Math.abs(newLat - origCoords[1]);
        const dLng = Math.abs(newLng - origCoords[0]);
        if (dLat > 0.35 || dLng > 0.45) {
          skipped++;
          return;
        }

        // Precision check: new coordinates must NOT be arcminute-truncated
        const newLatM = newLat * 60, newLngM = newLng * 60;
        if (Math.abs(newLatM - Math.round(newLatM)) < 0.001 && Math.abs(newLngM - Math.round(newLngM)) < 0.001) {
          skipped++;
          return;
        }

        // Elevation check
        let elevM = f.properties.elevation_m;
        let elevFt = f.properties.elevation_ft;
        const p2044 = entity.claims.P2044?.[0]?.mainsnak?.datavalue?.value?.amount;
        if (p2044) {
          const parsedM = parseInt(p2044, 10);
          if (parsedM > 0 && Math.abs(parsedM - elevM) < 600) {
            elevM = parsedM;
            elevFt = Math.round(elevM * 3.28084);
          }
        }

        // Update feature
        f.geometry.coordinates = [parseFloat(newLng.toFixed(6)), parseFloat(newLat.toFixed(6))];
        f.properties.name = cleanName;
        f.properties.elevation_m = elevM;
        f.properties.elevation_ft = elevFt;
        f.properties.elevation_formatted_ft = elevFt.toLocaleString() + "'";
        f.properties.elevation_formatted_m = elevM.toLocaleString() + ' m';
        f.properties.label_ft = `▲ ${cleanName} · ${elevFt.toLocaleString()}'`;
        f.properties.label_m = `▲ ${cleanName} · ${elevM.toLocaleString()} m`;
        f.properties.label_stacked_ft = `▲ ${cleanName}\n${elevFt.toLocaleString()}'`;
        f.properties.label_stacked_m = `▲ ${cleanName}\n${elevM.toLocaleString()} m`;
        f.properties.sort_key = 40000 - elevFt;

        resolved++;
        console.log(`[${resolved}] Snapped ${cleanName} -> [${f.geometry.coordinates}] (${elevFt}') [${candidate.id}]`);
      } catch (err) {
        failed++;
      }
    }));

    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\nReconciliation Finished!`);
  console.log(`Resolved: ${resolved}`);
  console.log(`Skipped (out of radius/still arcmin): ${skipped}`);
  console.log(`Failed (no entity or no coords): ${failed}`);

  fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2));
}

reconcileAll();

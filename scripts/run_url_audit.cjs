const fs = require('fs');
const path = require('path');
const {
  GLOBAL_AREAS_PATH,
  isParkedOrScam,
  normalizeUrl,
  checkUrl,
  mapConcurrent
} = require('./sweep_all_urls.cjs');

async function main() {
  const data = JSON.parse(fs.readFileSync(GLOBAL_AREAS_PATH, 'utf8'));
  const features = data.features;

  const urlToFeatures = new Map();
  for (let i = 0; i < features.length; i++) {
    const w = features[i].properties.website;
    if (w && typeof w === 'string' && w.trim()) {
      const norm = normalizeUrl(w);
      if (!norm) continue;
      if (!urlToFeatures.has(norm)) {
        urlToFeatures.set(norm, []);
      }
      urlToFeatures.get(norm).push(i);
    }
  }

  const allUrls = Array.from(urlToFeatures.keys());
  console.log(`Found ${allUrls.length} unique URLs across ${features.length} features.`);

  // Prioritize deep URLs first, then root URLs
  const deepUrls = [];
  const rootUrls = [];

  for (const u of allUrls) {
    try {
      const parsed = new URL(u);
      if (parsed.pathname && parsed.pathname !== '/') {
        deepUrls.push(u);
      } else {
        rootUrls.push(u);
      }
    } catch (e) {
      rootUrls.push(u);
    }
  }

  console.log(`Deep URLs: ${deepUrls.length}, Root URLs: ${rootUrls.length}`);

  const results = {};
  let processed = 0;
  const total = allUrls.length;

  async function processOne(url) {
    if (isParkedOrScam(url)) {
      results[url] = { action: 'remove', reason: 'known_parked_or_scam' };
      return;
    }

    const check = await checkUrl(url, 7000);

    // If redirected to parked/scam domain
    if (check.finalUrl && isParkedOrScam(check.finalUrl)) {
      results[url] = { action: 'remove', reason: 'redirected_to_parked', finalUrl: check.finalUrl };
      return;
    }

    // 200 OK or clean redirect
    if (check.status >= 200 && check.status < 400) {
      results[url] = { action: 'keep', status: check.status, finalUrl: check.finalUrl };
      return;
    }

    // Bot protection: 401, 403, 503 (Cloudflare/Akamai challenge)
    if (check.status === 401 || check.status === 403 || check.status === 503) {
      results[url] = { action: 'keep', status: check.status, note: 'bot_protected_alive' };
      return;
    }

    // If 404 or server error or connection error:
    // Check if it's a deep URL and if root domain works
    try {
      const parsed = new URL(url);
      if (parsed.pathname && parsed.pathname !== '/') {
        const rootUrl = `${parsed.protocol}//${parsed.host}/`;
        const rootCheck = await checkUrl(rootUrl, 6000);
        if (rootCheck.status && (rootCheck.status < 400 || rootCheck.status === 403 || rootCheck.status === 401)) {
          if (!rootCheck.finalUrl || !isParkedOrScam(rootCheck.finalUrl)) {
            results[url] = {
              action: 'replace',
              newUrl: rootUrl,
              reason: `deep_path_${check.status || check.error}_root_alive`,
              originalStatus: check.status || check.error
            };
            return;
          }
        }
      }
    } catch (e) {}

    // If here, neither the deep path nor the domain is functioning
    results[url] = {
      action: 'remove',
      reason: check.status ? `http_${check.status}` : (check.error || 'unreachable')
    };
  }

  console.log(`Starting concurrent audit (concurrency=30)...`);
  const startTime = Date.now();

  // Audit deep URLs first
  await mapConcurrent(deepUrls, 30, async (url, idx) => {
    await processOne(url);
    processed++;
    if (processed % 100 === 0 || processed === deepUrls.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[DEEP] Processed ${processed}/${deepUrls.length} (${elapsed}s)...`);
    }
  });

  const deepElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Deep URLs completed in ${deepElapsed}s. Now auditing root URLs...`);

  // Audit root URLs
  const rootStart = Date.now();
  let rootProcessed = 0;
  await mapConcurrent(rootUrls, 35, async (url, idx) => {
    await processOne(url);
    processed++;
    rootProcessed++;
    if (rootProcessed % 250 === 0 || rootProcessed === rootUrls.length) {
      const elapsed = ((Date.now() - rootStart) / 1000).toFixed(1);
      console.log(`[ROOT] Processed ${rootProcessed}/${rootUrls.length} (${elapsed}s)... Total: ${processed}/${total}`);
    }
  });

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`All ${total} URLs audited in ${totalElapsed}s.`);

  // Write out results
  const outPath = path.join(__dirname, 'url_audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results saved to ${outPath}`);

  // Summary counts
  let keepCount = 0;
  let replaceCount = 0;
  let removeCount = 0;
  for (const r of Object.values(results)) {
    if (r.action === 'keep') keepCount++;
    else if (r.action === 'replace') replaceCount++;
    else if (r.action === 'remove') removeCount++;
  }
  console.log(`Summary:`);
  console.log(`- Keep (Valid/Alive): ${keepCount}`);
  console.log(`- Replace (Deep 404/Error -> Alive Root): ${replaceCount}`);
  console.log(`- Remove (Dead 404 / Expired / DNS Dead / Parked): ${removeCount}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

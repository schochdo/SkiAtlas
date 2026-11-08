const fs = require('fs');
const path = require('path');

const AUDIT_RESULTS_PATH = path.join(__dirname, 'url_audit_results.json');
const GLOBAL_AREAS_PATH = path.join(__dirname, '../public/data/global_ski_areas.json');

function main() {
  if (!fs.existsSync(AUDIT_RESULTS_PATH)) {
    console.error(`Audit results not found at ${AUDIT_RESULTS_PATH}`);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(AUDIT_RESULTS_PATH, 'utf8'));
  const data = JSON.parse(fs.readFileSync(GLOBAL_AREAS_PATH, 'utf8'));

  let kept = 0;
  let replaced = 0;
  let removed = 0;
  let unchanged = 0;

  for (const feature of data.features) {
    const raw = feature.properties.website;
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      unchanged++;
      continue;
    }

    let u = raw.trim();
    if (u.startsWith('hhttps://')) u = u.slice(1);
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      if (u.includes('.') && !u.includes(' ')) {
        u = 'https://' + u;
      }
    }

    const audit = results[u] || results[raw.trim()];
    if (!audit) {
      unchanged++;
      continue;
    }

    if (audit.action === 'keep') {
      kept++;
      // If there is an upgraded finalUrl or clean URL, we can preserve it
    } else if (audit.action === 'replace' && audit.newUrl) {
      feature.properties.website = audit.newUrl;
      replaced++;
    } else if (audit.action === 'remove') {
      feature.properties.website = '';
      removed++;
    }
  }

  fs.writeFileSync(GLOBAL_AREAS_PATH, JSON.stringify(data, null, 2), 'utf8');

  console.log(`URL Fix Application Complete:`);
  console.log(`- Kept (Active): ${kept}`);
  console.log(`- Replaced (Rescued to working domain): ${replaced}`);
  console.log(`- Removed (Defunct/Dead/Spam/Parked): ${removed}`);
  console.log(`- Unchanged/Empty: ${unchanged}`);
}

main();

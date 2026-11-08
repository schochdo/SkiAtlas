import json
from urllib.parse import urlparse

GLOBAL_JSON_PATH = 'public/data/global_ski_areas.json'
DEEP_AUDIT_PATH = 'scripts/deep_url_audit.json'

with open(GLOBAL_JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(DEEP_AUDIT_PATH, 'r', encoding='utf-8') as f:
    deep_audit = json.load(f)

# Build map of rescued deep 404s
rescued_map = {}
for r in deep_audit['rescued']:
    if r.get('status') == 404 and r.get('base_status') in (200, 301, 302):
        u = r['url']
        p = urlparse(u)
        base = f"{p.scheme}://{p.netloc}/"
        rescued_map[u] = base

# Known explicit rebrands / replacements
explicit_replacements = {
    'https://www.skiparadies-kranzberg.de/': 'https://www.familienparadies-kranzberg.de/',
    'http://www.skiparadies-kranzberg.de/': 'https://www.familienparadies-kranzberg.de/',
    'http://www.skiparadies-kranzberg.de': 'https://www.familienparadies-kranzberg.de/',
    'https://www.stubai.at/skigebiete/elferlifte/': 'https://www.stubai.at/skigebiete/elferbahnen/',
    'https://www.stubai.at/skigebiete/elferlifte': 'https://www.stubai.at/skigebiete/elferbahnen/',
}

# Dead / spam / defunct URLs to purge (set to "")
dead_purge_urls = {
    'https://www.lapinilla.es/',
    'http://www.lapinilla.es/',
    'https://lapinilla.es/',
    'http://lapinilla.es/',
    'https://www.freeski.fi/',
    'http://www.freeski.fi/',
    'https://freeski.fi/',
    'http://freeski.fi/',
    'http://www.bellefontaine-hautjura.fr/ski-haut-jura-alpin-fond/ski-alpin.html',
    'https://sportski-centar-milici.business.site/',
    'https://www.zahmerkaiser.com/',
    'https://www.daisen-resort.jp/',
    'https://jetskisrentalfortlauderdale.com/blog/cleveland-ski-club-big-creek/',
    'https://gilmanwi.com/downloads/places/ptown.pdf',
    'https://www.mariborskopohorje.si/',
    'https://www.redhillskiclub.org/',
    'https://www.mugen.click/',
    'https://www.vasjobacken.com/',
}

rescued_count = 0
replaced_count = 0
purged_count = 0

for f in data['features']:
    props = f['properties']
    w = props.get('website')
    if not w or not isinstance(w, str) or not w.strip():
        continue
    w_clean = w.strip()

    # 1. Explicit rebrand check
    if w_clean in explicit_replacements:
        props['website'] = explicit_replacements[w_clean]
        replaced_count += 1
        continue

    # 2. Dead / spam purge check
    if w_clean in dead_purge_urls or any(pattern in w_clean.lower() for pattern in ['jetskisrentalfortlauderdale', 'business.site']):
        props['website'] = ''
        purged_count += 1
        continue

    # 3. Rescued deep 404 check
    # Check exact match or with/without trailing slash
    target_base = rescued_map.get(w_clean) or rescued_map.get(w_clean + '/') or rescued_map.get(w_clean.rstrip('/'))
    if target_base:
        props['website'] = target_base
        rescued_count += 1
        continue

with open(GLOBAL_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Comprehensive URL Cleanup Applied:")
print(f"- Rescued Deep 404s to Root Portals: {rescued_count}")
print(f"- Rebranded/Replaced Domains: {replaced_count}")
print(f"- Purged Defunct/Spam/Dead URLs: {purged_count}")

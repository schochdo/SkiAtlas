const fs = require('fs');
const path = require('path');

const GLOBAL_AREAS_PATH = path.join(__dirname, '../public/data/global_ski_areas.json');
const RESORTS_PATH = path.join(__dirname, '../src/data/resorts.ts');

const PARKED_DOMAINS = [
  'hugedomains',
  'sedoparking',
  'sedo.com',
  'dan.com',
  'godaddy.com/domainsearch',
  'afternic.com',
  'bodis.com',
  'namebright.com',
  'parkingcrew.net',
  'domainmarket.com',
  'parik24',
  '1xbet',
  'vulkan777',
  'sultan-casino',
  'winwins.pl',
  'shortshortawards',
  'inmobiliariacasitas',
  'sseseislands',
  'buktijpmantra62',
  'b288-onlen',
  'autok.io',
  'truthlect',
  'jetskisrentalfortlauderdale',
  'domaincatcher',
  'nicsell',
  'vetlab-ufa',
  's-vidnoe',
  'kocianka.com',
  'clearwaterskihill.com',
  'nevelandia.it',
  'skigora.ru',
  'ermitage-resort.com',
  'skizentrum-ludwigsstadt.de',
  'natanay.ru',
  'listvennaya.com',
  'hoteldivniy.com',
  'westsportcenter.com.ua',
  '.casino'
];

function isParkedOrScam(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return PARKED_DOMAINS.some(p => lower.includes(p));
}

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let u = input.trim();
  if (u.startsWith('hhttps://')) u = u.slice(1);
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    if (u.includes('.') && !u.includes(' ')) {
      u = 'https://' + u;
    } else {
      return null;
    }
  }
  return u;
}

async function checkUrl(url, timeoutMs = 7000) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    });
    return {
      status: res.status,
      ok: res.ok,
      finalUrl: res.url
    };
  } catch (err) {
    const code = err.name === 'TimeoutError' ? 'TIMEOUT' : (err.cause?.code || err.message || 'FAILED');
    return { error: code };
  }
}

// Concurrency pool
async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

module.exports = {
  GLOBAL_AREAS_PATH,
  isParkedOrScam,
  normalizeUrl,
  checkUrl,
  mapConcurrent
};

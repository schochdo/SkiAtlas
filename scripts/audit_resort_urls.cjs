const fs = require('fs');
const path = require('path');

const PARKED_PATTERNS = [
  'hugedomains',
  'sedoparking',
  'sedo.com',
  'dan.com',
  'godaddy',
  'afternic',
  'bodis.com',
  'namebright',
  'parkingcrew',
  'domainmarket',
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
  '.casino'
];

function isParkedOrScam(url) {
  const lower = url.toLowerCase();
  return PARKED_PATTERNS.some(p => lower.includes(p));
}

function cleanUrl(input) {
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

async function fetchWithTimeout(url, timeoutMs = 8000) {
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
      finalUrl: res.url,
      headers: Object.fromEntries(res.headers.entries())
    };
  } catch (err) {
    return {
      error: err.name === 'TimeoutError' ? 'TIMEOUT' : (err.cause?.code || err.message || 'FAILED')
    };
  }
}

async function auditUrl(rawUrl) {
  const normalized = cleanUrl(rawUrl);
  if (!normalized) {
    return { action: 'remove', reason: 'invalid_syntax', original: rawUrl };
  }

  if (isParkedOrScam(normalized)) {
    return { action: 'remove', reason: 'parked_scam', original: rawUrl };
  }

  const res = await fetchWithTimeout(normalized);

  // If fetch succeeded with response
  if (res.status !== undefined) {
    // Check if redirected to scam/parked domain
    if (res.finalUrl && isParkedOrScam(res.finalUrl)) {
      return { action: 'remove', reason: 'redirected_to_parked', original: rawUrl, finalUrl: res.finalUrl };
    }

    // 200 OK or 3xx redirect follow OK
    if (res.status >= 200 && res.status < 400) {
      // If HTTP upgraded to HTTPS or clean redirect
      return { action: 'keep', status: res.status, original: rawUrl, finalUrl: res.finalUrl };
    }

    // 401 / 403 / Cloudflare 503 bot check - server is alive, bot protection triggered
    if (res.status === 401 || res.status === 403 || res.status === 503) {
      return { action: 'keep', status: res.status, note: 'bot_protected_alive', original: rawUrl };
    }

    // 404 / 410 (Not Found / Gone)
    if (res.status === 404 || res.status === 410) {
      // Test base origin
      try {
        const parsed = new URL(normalized);
        const originUrl = `${parsed.protocol}//${parsed.host}/`;
        if (originUrl !== normalized && parsed.pathname && parsed.pathname !== '/') {
          const baseRes = await fetchWithTimeout(originUrl, 6000);
          if (baseRes.status && (baseRes.status < 400 || baseRes.status === 403 || baseRes.status === 401)) {
            if (baseRes.finalUrl && !isParkedOrScam(baseRes.finalUrl)) {
              return { action: 'fallback_root', original: rawUrl, newUrl: originUrl, note: 'deep_path_404_root_alive' };
            }
          }
        }
      } catch (e) {}
      return { action: 'remove', status: res.status, reason: '404_not_found', original: rawUrl };
    }

    // 500, 502, 504 server errors
    if (res.status >= 500) {
      // Test base origin if deep
      try {
        const parsed = new URL(normalized);
        const originUrl = `${parsed.protocol}//${parsed.host}/`;
        if (originUrl !== normalized && parsed.pathname && parsed.pathname !== '/') {
          const baseRes = await fetchWithTimeout(originUrl, 6000);
          if (baseRes.status && baseRes.status < 400) {
            return { action: 'fallback_root', original: rawUrl, newUrl: originUrl, note: 'deep_path_5xx_root_alive' };
          }
        }
      } catch (e) {}
      return { action: 'remove', status: res.status, reason: 'server_error_5xx', original: rawUrl };
    }
  }

  // Error handling: DNS failure, connection refused, or timeout
  // If it was a deep path, check if the base domain is alive
  try {
    const parsed = new URL(normalized);
    const originUrl = `${parsed.protocol}//${parsed.host}/`;
    if (originUrl !== normalized && parsed.pathname && parsed.pathname !== '/') {
      const baseRes = await fetchWithTimeout(originUrl, 6000);
      if (baseRes.status && (baseRes.status < 400 || baseRes.status === 403)) {
        if (!isParkedOrScam(baseRes.finalUrl || originUrl)) {
          return { action: 'fallback_root', original: rawUrl, newUrl: originUrl, note: 'deep_path_error_root_alive' };
        }
      }
    }
  } catch (e) {}

  // DNS failure: domain expired/unregistered
  if (res.error && (res.error.includes('ENOTFOUND') || res.error.includes('EAI_AGAIN'))) {
    return { action: 'remove', reason: 'dns_not_found', original: rawUrl };
  }

  // Connection refused or timeout
  return { action: 'remove', reason: res.error || 'unreachable', original: rawUrl };
}

module.exports = { auditUrl, cleanUrl, isParkedOrScam };

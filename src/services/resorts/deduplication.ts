import type { CuratedResortSeed } from './types';
import { cleanNameForMatching, getSignificantTokens } from '../../utils/classification';

/* =========================================================================
   RESORT QUALITY, HYGIENE & DEDUPLICATION PROTOCOLS
   ========================================================================= */

/**
 * Builds an optimized lookup index of curated seed resorts for O(N) duplicate suppression
 */
export function buildCuratedSeedIndex(curatedResorts: Array<{ id: string; name: string; lat: number; lng: number }>): CuratedResortSeed[] {
  return curatedResorts.map((r) => ({
    id: r.id,
    name: r.name.toLowerCase().trim(),
    cleanName: cleanNameForMatching(r.name),
    tokens: getSignificantTokens(r.name),
    lat: r.lat,
    lng: r.lng,
  }));
}

/**
 * High-performance spatial & token duplicate detection.
 * Checks coordinate proximity (<800m), vicinity (<15km) substring match, and token similarity.
 */
export function isDuplicateAgainstCurated(
  candidate: { cleanName: string; tokens: string[]; lat: number; lng: number },
  curatedIndex: CuratedResortSeed[]
): boolean {
  const { cleanName: gClean, tokens: gTokens, lat: pLat, lng: pLng } = candidate;

  for (const cr of curatedIndex) {
    const dist = Math.hypot(pLat - cr.lat, pLng - cr.lng);

    // 1. Extreme proximity: coordinate pin within ~800m
    if (dist < 0.008) {
      return true;
    }

    // 2. Vicinity check (< 0.14 deg ~15 km)
    if (dist < 0.14) {
      const cClean = cr.cleanName;
      const cTokens = cr.tokens;

      // Whole substring match after punctuation stripping
      const subMatch =
        (cClean.length >= 4 && gClean.includes(cClean)) ||
        (gClean.length >= 4 && cClean.includes(gClean));

      if (subMatch) {
        return true;
      }

      // Token matching (require >= 2 common tokens or 1 distinctive token within 5km)
      const commonTokens = cTokens.filter((t) => gTokens.includes(t));
      if (
        (commonTokens.length >= 2 && dist < 0.12) ||
        (commonTokens.length >= 1 && (dist < 0.05 || commonTokens.some((t) => t.length >= 5)))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Quality filter: Excludes permanently closed, defunct, abandoned, or historic ski areas
 */
export function isDefunctOrClosed(p: any, pNameLower: string): boolean {
  if (!p) return true;

  return (
    p.status === 'abandoned' ||
    p.status === 'closed' ||
    p.status === 'disused' ||
    p.status === 'defunct' ||
    p.status === 'historic' ||
    p.is_closed === true ||
    (p.archetype && (p.archetype.includes('Defunct') || p.archetype.includes('Lost Ski Area') || p.archetype.includes('Historic'))) ||
    (p.infrastructure && (p.infrastructure.toLowerCase().includes('defunct') || p.infrastructure.toLowerCase().includes('abandoned') || p.infrastructure.toLowerCase().includes('historic'))) ||
    pNameLower.includes('(closed)') ||
    pNameLower.includes('(abandoned)') ||
    pNameLower.includes('(defunct)') ||
    pNameLower.includes('(historic)') ||
    pNameLower.includes('(fermé)') ||
    pNameLower === 'a venir' ||
    pNameLower === 'à venir' ||
    pNameLower === 'unknown' ||
    pNameLower.startsWith('former ') ||
    pNameLower.startsWith('touring -') ||
    pNameLower.startsWith('hors-piste -')
  );
}

/**
 * Quality filter: Excludes zero-infrastructure ghost entries with no verifiable lifts, runs, or official website
 */
export function isGhostOrZeroInfra(p: any, hasWebsite: boolean): boolean {
  if (p.category !== 'downhill') return false;

  const lifts = p.lift_count || 0;
  const runs = p.run_count || 0;
  const vert = p.vertical_ft || 0;
  const acres = p.skiable_acres || 0;

  if (lifts === 0 && runs <= 1 && !hasWebsite) {
    return true;
  }
  if (lifts === 0 && runs === 0 && vert <= 50 && acres <= 5 && !hasWebsite) {
    return true;
  }

  return false;
}

const CASINO_AND_SPAM_DOMAINS = [
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
  'business.site',
  'lapinilla.es',
  'freeski.fi',
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
  'hugedomains',
  'sedoparking',
];

/**
 * Sanitizes and validates website URLs, filtering spam and dead domains
 */
export function sanitizeWebsiteUrl(rawUrl: any): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = rawUrl.trim();
  if (!clean) return '';

  // Canonical redirects
  if (clean.includes('westsportcenter.com.ua')) return 'https://westsportcenter.in.ua/';
  if (clean.includes('sayama-ski.jp')) return 'https://www.seibu-leisure.co.jp/ski_web/';
  if (clean.includes('stubai.at/skigebiete/elferlifte')) return 'https://www.stubai.at/skigebiete/elferbahnen/';
  if (clean.includes('skiparadies-kranzberg.de')) return 'https://www.familienparadies-kranzberg.de/';

  // Spam & casino check
  if (CASINO_AND_SPAM_DOMAINS.some((domain) => clean.includes(domain)) || clean.endsWith('.casino')) {
    return '';
  }

  // Typo & protocol repair
  if (clean.startsWith('hhttps://')) {
    clean = clean.replace('hhttps://', 'https://');
  } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.includes('.') && !clean.includes(' ')) {
      clean = `https://${clean}`;
    } else {
      return '';
    }
  }

  return clean;
}

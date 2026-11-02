import type { PassNetwork, SkiActivityCategory, SkiResort } from '../types';

/* =========================================================================
   PASS NETWORK CONSTANTS & PALETTE (MINERAL INKS)
   ========================================================================= */

export const PASS_COLORS: Record<PassNetwork, string> = {
  Epic: '#2E5A44',              // Alpine Pine
  Ikon: '#B84A39',              // Terracotta Vermilion
  'Mountain Collective': '#3B627E', // Glacier Indigo
  Indy: '#C2842F',              // Raw Ochre
  Independent: '#8A847C',       // Muted Stone
};

export const PASS_DISPLAY_NAMES: Record<PassNetwork, string> = {
  Epic: 'Epic Pass (Vail Resorts & Global Partners)',
  Ikon: 'Ikon Pass (Alterra & Global Partners)',
  'Mountain Collective': 'Mountain Collective',
  Indy: 'Indy Pass (180+ Independent Partner Resorts)',
  Independent: 'Unaffiliated / Independent (No Multi-Pass)',
};

export const PASS_SHORT_LABELS: Record<PassNetwork, string> = {
  Epic: 'Epic',
  Ikon: 'Ikon',
  'Mountain Collective': 'Mtn Collective',
  Indy: 'Indy',
  Independent: 'Unaffiliated',
};

/* =========================================================================
   CATEGORY CLASSIFICATION HELPER
   ========================================================================= */

export function classifySkiFeature(
  p: any,
  coords: [number, number]
): {
  category: SkiActivityCategory;
  archetype: string;
  infrastructure: string;
  cleanedVertFt: number | null;
  cleanedSummitFt: number | null;
  cleanedBaseFt: number | null;
} {
  const stats = p.statistics || {};
  const runs = stats.runs?.byActivity || {};
  const lifts = stats.lifts?.byType || {};

  const downhillRuns = runs.downhill || 0;
  const nordicRuns = runs.nordic || 0;
  const totalLifts = Object.values(lifts).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || (p.lift_count ?? 0);

  const nameLower = (p.name || '').toLowerCase();
  const xcKeywords = [
    'nordic',
    'cross-country',
    'cross country',
    'crosscountry',
    'ski de fond',
    'sci di fondo',
    'langlauf',
    'loipe',
    'loipen',
    'outdoor center',
    'outdoor centre',
    'touring center',
    'touring centre',
    'biathlon',
  ];
  const downhillExceptions = ['nordic valley', 'nordic mountain', 'sugarloaf mountain'];
  const isDownhillException = downhillExceptions.some(
    (ex) => nameLower === ex || (ex === 'sugarloaf mountain' && nameLower.includes('sugarloaf mountain'))
  );
  const hasXcName = !isDownhillException && xcKeywords.some((k) => nameLower.includes(k));

  let category: SkiActivityCategory = 'downhill';
  if (
    p.category === 'nordic' ||
    p.archetype === 'Cross-Country Ski Center' ||
    p.archetype === 'Nordic Center' ||
    p.archetype === 'National Park Nordic Center'
  ) {
    category = 'nordic';
  } else if (p.category === 'heli_cat') {
    category = 'heli_cat';
  } else if (hasXcName && totalLifts <= 4) {
    category = 'nordic';
  } else if (nordicRuns > 0 && downhillRuns === 0) {
    category = 'nordic';
  } else if (nordicRuns >= 20 && nordicRuns > downhillRuns * 2.5 && totalLifts <= 6) {
    category = 'nordic';
  } else if (nameLower.includes('callaghan') && totalLifts <= 1) {
    category = 'nordic';
  }

  let summitElevFt: number | null = null;
  let baseElevFt: number | null = null;
  let verticalDropFt: number | null = null;

  if (p.elevation) {
    if (typeof p.elevation.top === 'number') {
      summitElevFt = Math.round(p.elevation.top * 3.28084);
    }
    if (typeof p.elevation.bottom === 'number') {
      baseElevFt = Math.round(p.elevation.bottom * 3.28084);
    }
    if (summitElevFt !== null && baseElevFt !== null && summitElevFt > baseElevFt) {
      verticalDropFt = summitElevFt - baseElevFt;
    }
  }

  let infrastructure = 'Alpine Ski Area';
  if (category === 'nordic') {
    infrastructure = p.infrastructure || (p.run_count ? `${p.run_count} Nordic cross-country trails` : 'Cross-Country Nordic Center');
  } else if (totalLifts > 0) {
    infrastructure = `${totalLifts} Lift${totalLifts > 1 ? 's' : ''}`;
  }

  return {
    category,
    archetype: category === 'nordic' ? (p.archetype || 'Cross-Country Ski Center') : (p.archetype || 'Downhill Alpine'),
    infrastructure,
    cleanedVertFt: verticalDropFt,
    cleanedSummitFt: summitElevFt,
    cleanedBaseFt: baseElevFt,
  };
}

export function getPassNetworksForSkiArea(
  name: string,
  region: string,
  country: string,
  id: string
): PassNetwork[] {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('vail') || lowerName.includes('breckenridge') || lowerName.includes('whistler') || lowerName.includes('park city') || lowerName.includes('keystone')) {
    return ['Epic'];
  }
  if (
    lowerName.includes('jackson hole') ||
    lowerName.includes('palisades') ||
    lowerName.includes('mammoth') ||
    lowerName.includes('alta') ||
    lowerName.includes('snowbird') ||
    lowerName.includes('big sky') ||
    lowerName.includes('big bear') ||
    lowerName.includes('snow summit') ||
    lowerName.includes('bear mountain') ||
    lowerName.includes('snow valley')
  ) {
    return ['Ikon'];
  }
  return ['Independent'];
}

export function getResortStats(resort: SkiResort | null | undefined): {
  lifts: number | null;
  pistes: number | null;
  acres: number | null;
} {
  if (!resort) return { lifts: null, pistes: null, acres: null };

  let lifts: number | null =
    resort.lift_count !== undefined && resort.lift_count !== null && resort.lift_count > 0
      ? resort.lift_count
      : null;

  let pistes: number | null =
    resort.run_count !== undefined && resort.run_count !== null && resort.run_count > 0
      ? resort.run_count
      : null;

  let acres: number | null =
    resort.skiable_acres && resort.skiable_acres > 0
      ? resort.skiable_acres
      : null;

  if (lifts === null && resort.infrastructure) {
    const m = resort.infrastructure.match(/(\\d+)\\s*(?:lifts?|aerialways?|chairs?|gondolas?)/i);
    if (m) lifts = parseInt(m[1], 10);
  }

  if (pistes === null && resort.infrastructure) {
    const m = resort.infrastructure.match(/(\\d+)\\s*(?:pistes?|runs?|trails?)/i);
    if (m) pistes = parseInt(m[1], 10);
  }

  return { lifts, pistes, acres };
}

export function getResortWebsite(resort: SkiResort | null | undefined): string | null {
  if (!resort) return null;
  let direct = resort.website || (resort as any).tags?.website || (resort as any).tags?.['contact:website'];
  if (direct && typeof direct === 'string') {
    direct = direct.trim();
    if (direct.startsWith('hhttps://')) {
      direct = direct.slice(1);
    }
    const withProto = direct.startsWith('http://') || direct.startsWith('https://') ? direct : `https://${direct}`;
    try {
      const parsed = new URL(withProto);
      const host = parsed.hostname.toLowerCase();
      // Route hijacked domain to verified official website
      if (host === 'westsportcenter.com.ua' || host === 'www.westsportcenter.com.ua') {
        return 'https://westsportcenter.in.ua/';
      }
      // Safety filter against scam / casino affiliate sites and malicious redirects
      if (
        host.includes('parik24') ||
        host.includes('1xbet') ||
        host.includes('vulkan777') ||
        host.endsWith('.casino')
      ) {
        return null;
      }
      if (parsed.hostname && parsed.hostname.includes('.') && parsed.hostname.length >= 4) {
        return withProto;
      }
    } catch (_) {
      // Invalid URL string
    }
  }
  return null;
}

/**
 * Sanitizes bloated resort names (e.g. raw OpenStreetMap imports containing
 * comma-separated multi-language translations or excessive administrative titles)
 * into concise editorial cartographic names.
 */
export function cleanResortName(name: string, _country?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length < 35 && !trimmed.includes(',')) return trimmed;

  // Specific known long administrative titles
  if (trimmed.includes('Western Rehabilitation') || trimmed.includes('Західний реабілітаційно')) {
    return 'Western Rehabilitation & Sports Center';
  }
  if (trimmed.includes('Dvorišta Nordic Ski Centar') || trimmed.includes('Дворишта центар нордијског')) {
    return 'Dvorišta Nordic Ski Center (Pale)';
  }
  if (trimmed.includes('Xiaohaituo') || trimmed.includes('国家高山滑雪中心')) {
    return 'National Alpine Skiing Centre (Xiaohaituo)';
  }

  // Handle comma-separated multi-language duplicates: e.g. "Local Name, English Name, Transliteration"
  if (trimmed.includes(',')) {
    // Avoid breaking parenthesized lists: e.g. "Waakirchen (Village A, Village B)"
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const pStart = trimmed.indexOf('(');
      const pEnd = trimmed.lastIndexOf(')');
      const cPos = trimmed.indexOf(',');
      if (pStart < cPos && cPos < pEnd) {
        return trimmed;
      }
    }

    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      // If trailing parts are merely subsets of the first part, use the first part
      const p0 = parts[0];
      if (parts.slice(1).every((p) => p0.toLowerCase().includes(p.toLowerCase()))) {
        return p0;
      }

      // If one part is non-Latin and another is Latin/English, prefer the Latin/English name
      const hasLatin = (s: string) => /[a-zA-Z]/.test(s);
      const latinParts = parts.filter(hasLatin);
      const nonLatinParts = parts.filter((s) => !hasLatin(s));

      if (latinParts.length > 0 && nonLatinParts.length > 0) {
        const priority = latinParts.find((p) =>
          /\b(ski|resort|mountain|snow|park|center|centre|area|slopes)\b/i.test(p)
        );
        return priority || latinParts[0];
      }

      // If multiple Latin parts are duplicates or variations
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const p of parts) {
        const low = p.toLowerCase();
        if (!seen.has(low)) {
          seen.add(low);
          unique.push(p);
        }
      }
      if (unique.length === 1) return unique[0];
      if (unique.length > 1 && parts.slice(1).every((u) => unique[0].toLowerCase().includes(u.toLowerCase()))) {
        return unique[0];
      }
    }
  }

  return trimmed;
}

export function getCategoryBadge(category?: SkiActivityCategory) {
  switch (category) {
    case 'nordic':
      return {
        label: 'Nordic XC',
        icon: '🎿',
        bg: 'bg-[#2E5A44]/10',
        text: 'text-[#2E5A44]',
        border: 'border-[#2E5A44]/30',
        dot: '#2E5A44',
      };
    case 'heli_cat':
      return {
        label: 'Cat & Heli',
        icon: '🚁',
        bg: 'bg-[#B84A39]/10',
        text: 'text-[#B84A39]',
        border: 'border-[#B84A39]/30',
        dot: '#B84A39',
      };
    case 'downhill':
    default:
      return {
        label: 'Downhill',
        icon: '⛷️',
        bg: 'bg-[#3B627E]/10',
        text: 'text-[#3B627E]',
        border: 'border-[#3B627E]/30',
        dot: '#3B627E',
      };
  }
}

/* =========================================================================
   GEOSPATIAL & NAME DEDUPLICATION HELPERS
   Prevents overlapping / duplicate labels between curated atlas & global sources
   ========================================================================= */

export const DUP_STOP_WORDS = new Set([
  'ski', 'skis', 'resort', 'resorts', 'mountain', 'mountains', 'mt', 'mtn', 'area', 'areas',
  'cat', 'heli', 'heliskiing', 'heliski', 'lodge', 'backcountry', 'powder', 'domain',
  'domaine', 'paradise', 'center', 'centre', 'park', 'the', 'and', 'am', 'le', 'la',
  'les', 'du', 'des', 'de', 'val', 'vallee', 'vallee', 'valley', 'basin', 'bowl', 'peak',
  'summit', 'onsen', 'village', 'lake', 'pass', 'ridge', 'creek', 'hill', 'springs',
  'alps', 'alpen', 'snow', 'nordic', 'cross', 'country', 'trail', 'trails', 'touring',
  'grand', 'club', 'station', 'operation', 'operations', 'adventures', 'tours'
]);

export function cleanNameForMatching(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['`’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getSignificantTokens(str: string): string[] {
  return cleanNameForMatching(str)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !DUP_STOP_WORDS.has(w));
}


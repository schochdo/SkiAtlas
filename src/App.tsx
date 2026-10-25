/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);

import {
  Mountain,
  Snowflake,
  Wind,
  Compass,
  Layers,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sliders,
  RefreshCw,
  MapPin,
  ExternalLink,
  Globe,
  Menu,
  X,
  Plus,
  Minus,
  Maximize,
  Minimize,
  ArrowLeft,
} from 'lucide-react';

/* =========================================================================
   TYPES
   ========================================================================= */

export type PassNetwork = 'Ikon' | 'Epic' | 'Indy' | 'Mountain Collective' | 'Independent';

// Only genuine ski categories: Downhill, Nordic, Cat/Heli (No novelty / wild / touring clutter)
export type SkiActivityCategory = 'downhill' | 'nordic' | 'heli_cat';

export type EarthProjectionMode = 'globe' | 'mercator';

export interface DailyForecast {
  date: string;
  snowfall_in: number;
  snowfall_cm: number;
  temp_max_f: number;
  temp_min_f: number;
  temp_max_c: number;
  temp_min_c: number;
}

export interface ResortWeatherData {
  snowfall_72h_in: number;
  snowfall_7d_in: number;
  snowfall_72h_cm: number;
  snowfall_7d_cm: number;
  current_temp_f: number;
  current_temp_c: number;
  summit_wind_gust_mph: number;
  freezing_level_ft: number;
  rain_to_base_risk: boolean;
  daily_forecast: DailyForecast[];
  is_live: boolean;
  last_updated: string;
}

export interface SkiResort {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  default_bearing: number;
  base_elev_ft: number | null;
  summit_elev_ft: number | null;
  vertical_drop_ft: number | null;
  skiable_acres: number;
  pass_networks: PassNetwork[];
  infrastructure: string;
  archetype: string;
  summary: string;
  weather?: ResortWeatherData;
  category?: SkiActivityCategory;
  activities?: ('downhill' | 'nordic' | 'heli_cat')[];
  operation_type?: 'resort' | 'nordic_center' | 'cat_ski' | 'heli_ski';
  tenure_acres?: number;
  lift_count?: number | null;
  run_count?: number | null;
  is_closed?: boolean;
  is_private?: boolean;
  website?: string;
  trail_km?: number | null;
  trail_mi?: number | null;
  avg_snowfall_in?: number | null;
}

export type BasemapMode = 'satellite' | 'osm' | 'topo';

export interface PisteFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    id: string;
    kind: 'piste' | 'lift';
    name: string;
    difficulty: 'novice' | 'intermediate' | 'advanced' | 'expert' | 'unknown';
    lift_type?: string;
  };
}

/* =========================================================================
   GEOMETRY HELPER: EXTRACT CANONICAL [LNG, LAT] POINT
   ========================================================================= */

export function extractPointCoordinates(geom: any): [number, number] | null {
  if (!geom || !geom.coordinates) return null;
  const { type, coordinates } = geom;
  if (type === 'Point') {
    if (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number' &&
      !isNaN(coordinates[0]) &&
      !isNaN(coordinates[1])
    ) {
      return [coordinates[0], coordinates[1]];
    }
    return null;
  }
  if (type === 'Polygon' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    const ring = coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const pt of ring) {
      if (
        Array.isArray(pt) &&
        typeof pt[0] === 'number' &&
        typeof pt[1] === 'number' &&
        !isNaN(pt[0]) &&
        !isNaN(pt[1])
      ) {
        sumLng += pt[0];
        sumLat += pt[1];
        count++;
      }
    }
    if (count > 0) return [sumLng / count, sumLat / count];
  }
  return null;
}

/* =========================================================================
   SAFE MAP CAMERA CONTROLS
   ========================================================================= */

let isProgrammaticFlightActive = false;

export function safeFlyTo(map: MapLibreMap | null, options: any) {
  if (!map || !options) return;
  if (options.center) {
    const c = options.center;
    let lng: number | undefined;
    let lat: number | undefined;
    if (Array.isArray(c)) {
      lng = Number(c[0]);
      lat = Number(c[1]);
    } else if (c && typeof c === 'object') {
      lng = Number(c.lng ?? c.lon);
      lat = Number(c.lat);
    }
    if (
      lng === undefined ||
      lat === undefined ||
      !isFinite(lng) ||
      !isFinite(lat) ||
      isNaN(lng) ||
      isNaN(lat)
    ) {
      console.warn('safeFlyTo rejected invalid coordinates:', c);
      return;
    }
    options.center = [lng, lat];
  }
  try {
    isProgrammaticFlightActive = true;
    map.flyTo(options);
    const onEnd = () => {
      isProgrammaticFlightActive = false;
      map.off('moveend', onEnd);
    };
    map.once('moveend', onEnd);
  } catch (err) {
    console.warn('safeFlyTo caught exception:', err);
    isProgrammaticFlightActive = false;
  }
}

export function safeEaseTo(map: MapLibreMap | null, options: any) {
  if (!map || !options) return;
  try {
    map.easeTo(options);
  } catch (err) {
    console.warn('safeEaseTo caught exception:', err);
  }
}

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
  Epic: 'Epic Pass',
  Ikon: 'Ikon Pass',
  'Mountain Collective': 'Mountain Collective',
  Indy: 'Indy Pass',
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

  // Determine authoritative category without blindly forcing downhill
  let category: SkiActivityCategory = 'downhill';
  if (p.category === 'nordic' || p.archetype === 'Cross-Country Ski Center' || p.archetype === 'Nordic Center') {
    category = 'nordic';
  } else if (p.category === 'heli_cat') {
    category = 'heli_cat';
  } else if (hasXcName && totalLifts <= 1) {
    category = 'nordic';
  } else if (nordicRuns > 0 && downhillRuns === 0 && totalLifts <= 1) {
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

/* =========================================================================
   CURATED SEED RESORTS & HELI/CAT OPERATIONS
   ========================================================================= */

export const GLOBAL_SKI_ATLAS: SkiResort[] = [
  {
    id: 'jackson-hole',
    avg_snowfall_in: 458,
    lift_count: 13,
    run_count: 133,
    name: 'Jackson Hole',
    region: 'Wyoming',
    country: 'USA',
    lat: 43.5875,
    lng: -110.8279,
    default_bearing: 290,
    base_elev_ft: 6311,
    summit_elev_ft: 10450,
    vertical_drop_ft: 4139,
    skiable_acres: 2500,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Aerial Tram, 2 Gondolas, 10 Quads',
    archetype: 'Steep Alpine',
    summary: 'Legendary steep and deep fall-line terrain where mountaineers, film crews, and icons have skied, crowned by Corbet\'s Couloir and the 4,139-foot vertical drop of the Aerial Tram.',
    website: 'https://www.jacksonhole.com',
  },
  {
    id: 'snowbird',
    avg_snowfall_in: 500,
    lift_count: 14,
    run_count: 140,
    name: 'Snowbird',
    region: 'Utah',
    country: 'USA',
    lat: 40.58,
    lng: -111.655,
    default_bearing: 175,
    base_elev_ft: 7760,
    summit_elev_ft: 11000,
    vertical_drop_ft: 3240,
    skiable_acres: 2500,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Aerial Tram, Peruvian Tunnel, High-Speed Quads',
    archetype: 'Steep Alpine',
    summary: 'Little Cottonwood Canyon titan boasting 500+ inches of the greatest snow on earth, rugged chutes, and non-stop vertical beneath the Mineral Basin Tram.',
    website: 'https://www.snowbird.com',
  },
  {
    id: 'alta',
    avg_snowfall_in: 500,
    lift_count: 6,
    run_count: 116,
    name: 'Alta',
    region: 'Utah',
    country: 'USA',
    lat: 40.5883,
    lng: -111.6378,
    default_bearing: 185,
    base_elev_ft: 8538,
    summit_elev_ft: 11060,
    vertical_drop_ft: 2538,
    skiable_acres: 2614,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Supreme & Collins High-Speed Quads',
    archetype: 'Powder / Tree Glades',
    summary: 'A pure skier\'s sanctuary at the head of Little Cottonwood Canyon, preserved in tradition with high-speed lifts unlocking supreme powder runs like Alf\'s High Rustler.',
    website: 'https://www.alta.com',
  },
  {
    id: 'park-city',
    avg_snowfall_in: 355,
    lift_count: 43,
    run_count: 330,
    name: 'Park City Mountain',
    region: 'Utah',
    country: 'USA',
    lat: 40.6514,
    lng: -111.508,
    default_bearing: 225,
    base_elev_ft: 6800,
    summit_elev_ft: 10026,
    vertical_drop_ft: 3226,
    skiable_acres: 7300,
    pass_networks: ['Epic'],
    infrastructure: 'Quicksilver Gondola, 43 Lifts, 330+ Trails',
    archetype: 'Mega Continental Resort',
    summary: 'The largest lift-served ski and snowboard resort in the United States, spanning 7,300 skiable acres across Park City and Canyons with high-alpine bowls, extensive tree glades, and world-class terrain parks.',
    website: 'https://www.parkcitymountain.com/',
  },
  {
    id: 'powder-mountain',
    avg_snowfall_in: 500,
    lift_count: 9,
    run_count: 154,
    name: 'Powder Mountain',
    region: 'Utah',
    country: 'USA',
    lat: 41.3789,
    lng: -111.7806,
    default_bearing: 180,
    base_elev_ft: 6900,
    summit_elev_ft: 9422,
    vertical_drop_ft: 2522,
    skiable_acres: 8464,
    pass_networks: ['Independent'],
    infrastructure: 'Timberline, Hidden Lake, Lightning Ridge Cat',
    archetype: 'Powder / Tree Glades',
    summary: 'North America\'s largest skiable acreage, capping daily ticket sales to preserve pristine untracked powder across endless rolling bowls and snowcat terrain.',
    website: 'https://powdermountain.com',
  },
  {
    id: 'vail',
    avg_snowfall_in: 354,
    lift_count: 34,
    run_count: 195,
    name: 'Vail',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6403,
    lng: -106.3742,
    default_bearing: 170,
    base_elev_ft: 8120,
    summit_elev_ft: 11570,
    vertical_drop_ft: 3450,
    skiable_acres: 5317,
    pass_networks: ['Epic'],
    infrastructure: 'Gondola One, High-Speed 6-Packs',
    archetype: 'Flagship Mega-Resort',
    summary: 'Iconic Colorado flagship famous worldwide for its seven legendary Back Bowls and Blue Sky Basin, delivering expansive European-scale skiing in the heart of the Rockies.',
    website: 'https://www.vail.com',
  },
  {
    id: 'aspen-snowmass',
    avg_snowfall_in: 300,
    lift_count: 21,
    run_count: 98,
    name: 'Aspen Snowmass',
    region: 'Colorado',
    country: 'USA',
    lat: 39.2083,
    lng: -106.9497,
    default_bearing: 205,
    base_elev_ft: 8104,
    summit_elev_ft: 12510,
    vertical_drop_ft: 4406,
    skiable_acres: 3342,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Village Express, High Alpine, Cirque',
    archetype: 'Flagship Mega-Resort',
    summary: 'The crown jewel of Aspen\'s four mountains, offering 4,406 feet of vertical rise, expansive gladed cruisers, the legendary Highland Bowl hikes, and world-class alpine culture.',
    website: 'https://www.aspensnowmass.com',
  },
  {
    id: 'breckenridge',
    avg_snowfall_in: 350,
    lift_count: 35,
    run_count: 187,
    name: 'Breckenridge',
    region: 'Colorado',
    country: 'USA',
    lat: 39.4802,
    lng: -106.0667,
    default_bearing: 265,
    base_elev_ft: 9600,
    summit_elev_ft: 12998,
    vertical_drop_ft: 3398,
    skiable_acres: 2908,
    pass_networks: ['Epic'],
    infrastructure: 'Imperial Express SuperChair, 35 Lifts, Peak 6-10',
    archetype: 'High-Alpine Continental Resort',
    summary: 'High-altitude Tenmile Range titan featuring five interconnected peaks and North America\'s highest chairlift, the Imperial Express SuperChair at 12,840 feet, unlocking sheer above-treeline bowl skiing.',
    website: 'https://www.breckenridge.com/',
  },
  {
    id: 'steamboat',
    avg_snowfall_in: 336,
    lift_count: 23,
    run_count: 181,
    name: 'Steamboat',
    region: 'Colorado',
    country: 'USA',
    lat: 40.4572,
    lng: -106.7745,
    default_bearing: 105,
    base_elev_ft: 6900,
    summit_elev_ft: 10568,
    vertical_drop_ft: 3668,
    skiable_acres: 3741,
    pass_networks: ['Ikon'],
    infrastructure: 'Wild Blue Gondola (Longest 10-person in NA)',
    archetype: 'Powder / Tree Glades',
    summary: 'Home of trademarked Champagne Powder and the finest aspen glade skiing on earth, backed by genuine Western ski heritage and the newly expanded Mahogany Ridge terrain.',
    website: 'https://www.steamboat.com',
  },
  {
    id: 'telluride',
    avg_snowfall_in: 280,
    lift_count: 17,
    run_count: 148,
    name: 'Telluride',
    region: 'Colorado',
    country: 'USA',
    lat: 37.9375,
    lng: -107.8123,
    default_bearing: 180,
    base_elev_ft: 8725,
    summit_elev_ft: 13150,
    vertical_drop_ft: 4425,
    skiable_acres: 2000,
    pass_networks: ['Epic','Mountain Collective'],
    infrastructure: 'Free Inter-Town Transit Gondola, Revelation Lift',
    archetype: 'Steep Alpine',
    summary: 'Dramatic box-canyon grandeur in the San Juans; an unforgettable combination of 4,400-foot drops, Gold Hill chute hikes, and historic Victorian mining architecture.',
    website: 'https://tellurideskiresort.com',
  },
  {
    id: 'arapahoe-basin',
    avg_snowfall_in: 350,
    lift_count: 9,
    run_count: 145,
    name: 'Arapahoe Basin',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6425,
    lng: -105.8719,
    default_bearing: 200,
    base_elev_ft: 10780,
    summit_elev_ft: 13050,
    vertical_drop_ft: 2270,
    skiable_acres: 1428,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'High-speed quads, fixed-grip chairs',
    archetype: 'High Alpine / Steeps',
    summary: 'High-altitude Continental Divide outpost rising above 13,000 ft, renowned for its gritty local vibe, Pallavicini steeps, East Wall hikes, and spring Beach tailgates.',
    website: 'https://www.arapahoebasin.com',
  },
  {
    id: 'big-sky',
    avg_snowfall_in: 400,
    lift_count: 38,
    run_count: 300,
    name: 'Big Sky',
    region: 'Montana',
    country: 'USA',
    lat: 45.2858,
    lng: -111.4011,
    default_bearing: 255,
    base_elev_ft: 6800,
    summit_elev_ft: 11166,
    vertical_drop_ft: 4366,
    skiable_acres: 5850,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'New Lone Peak Tram, Heated 8-Packs',
    archetype: 'Steep Alpine',
    summary: 'The biggest skiing in America beneath the rugged pyramid of Lone Mountain, delivering high-alpine tram access to sheer chutes and untamed Montana powder bowls.',
    website: 'https://bigskyresort.com',
  },
  {
    id: 'sun-valley',
    avg_snowfall_in: 220,
    lift_count: 18,
    run_count: 121,
    name: 'Sun Valley',
    region: 'Idaho',
    country: 'USA',
    lat: 43.68,
    lng: -114.36,
    default_bearing: 215,
    base_elev_ft: 5750,
    summit_elev_ft: 9150,
    vertical_drop_ft: 3400,
    skiable_acres: 2054,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: '1 Gondola, Modern High-Speed Chairs',
    archetype: 'Flagship Mega-Resort',
    summary: 'America\'s original 1936 destination ski resort where Hollywood stars and Olympians carved Bald Mountain\'s relentless, continuous-pitch fall lines.',
    website: 'https://www.sunvalley.com',
  },
  {
    id: 'palisades-tahoe',
    avg_snowfall_in: 400,
    lift_count: 44,
    run_count: 270,
    name: 'Palisades Tahoe',
    region: 'California',
    country: 'USA',
    lat: 39.197,
    lng: -120.2356,
    default_bearing: 225,
    base_elev_ft: 6200,
    summit_elev_ft: 9050,
    vertical_drop_ft: 2850,
    skiable_acres: 6000,
    pass_networks: ['Ikon'],
    infrastructure: 'Base-to-Base Gondola, Aerial Tram',
    archetype: 'Steep Alpine',
    summary: 'Historic host of the 1960 Winter Olympics and crucible of extreme skiing, famous for KT-22, the Palisades cliffs, and sun-drenched Sierra spring corn.',
    website: 'https://www.palisadestahoe.com',
  },
  {
    id: 'mammoth',
    avg_snowfall_in: 400,
    lift_count: 25,
    run_count: 175,
    name: 'Mammoth Mountain',
    region: 'California',
    country: 'USA',
    lat: 37.6308,
    lng: -119.0326,
    default_bearing: 220,
    base_elev_ft: 7953,
    summit_elev_ft: 11053,
    vertical_drop_ft: 3100,
    skiable_acres: 3500,
    pass_networks: ['Ikon'],
    infrastructure: 'Panorama Gondola, 25 Modern Lifts',
    archetype: 'Flagship Mega-Resort',
    summary: 'Eastern Sierra giant towering above the volcanic caldera at 11,053 feet, blessed with colossal Pacific storm dumps and a legendary season stretching into July.',
    website: 'https://www.mammothmountain.com',
  },
  {
    id: 'stowe',
    avg_snowfall_in: 314,
    lift_count: 12,
    run_count: 116,
    name: 'Stowe Mountain Resort',
    region: 'Vermont',
    country: 'USA',
    lat: 44.53,
    lng: -72.78,
    default_bearing: 265,
    base_elev_ft: 1280,
    summit_elev_ft: 3640,
    vertical_drop_ft: 2360,
    skiable_acres: 485,
    pass_networks: ['Epic'],
    infrastructure: 'Mansfield Gondola & Over Easy Transfer',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Ski Capital of the East; classic Vermont stone lodges and steep, serpentine wooded trails winding down Mount Mansfield, including the infamous Front Four.',
    website: 'https://www.stowe.com',
  },
  {
    id: 'killington',
    avg_snowfall_in: 250,
    lift_count: 22,
    run_count: 155,
    name: 'Killington',
    region: 'Vermont',
    country: 'USA',
    lat: 43.6261,
    lng: -72.7969,
    default_bearing: 240,
    base_elev_ft: 1165,
    summit_elev_ft: 4215,
    vertical_drop_ft: 3050,
    skiable_acres: 1509,
    pass_networks: ['Ikon'],
    infrastructure: 'K-1 Express Gondola, 22 Lifts across 6 Peaks',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Beast of the East; six interconnected peaks delivering 3,050 feet of vertical, the legendary Superstar moguls, and the longest ski season in Eastern North America.',
    website: 'https://www.killington.com',
  },
  {
    id: 'whistler-blackcomb',
    avg_snowfall_in: 465,
    lift_count: 37,
    run_count: 200,
    name: 'Whistler Blackcomb',
    region: 'British Columbia',
    country: 'Canada',
    lat: 50.1163,
    lng: -122.9574,
    default_bearing: 140,
    base_elev_ft: 2214,
    summit_elev_ft: 7494,
    vertical_drop_ft: 5280,
    skiable_acres: 8171,
    pass_networks: ['Epic'],
    infrastructure: 'PEAK 2 PEAK Gondola, Blackcomb Gondola',
    archetype: 'Flagship Mega-Resort',
    summary: 'The undisputed heavyweight of North American skiing, spanning two immense glaciated peaks linked by the record-breaking PEAK 2 PEAK Gondola across 8,100+ acres.',
    website: 'https://www.whistlerblackcomb.com',
  },
  {
    id: 'revelstoke',
    avg_snowfall_in: 413,
    lift_count: 7,
    run_count: 75,
    name: 'Revelstoke',
    region: 'British Columbia',
    country: 'Canada',
    lat: 50.958,
    lng: -118.163,
    default_bearing: 95,
    base_elev_ft: 1680,
    summit_elev_ft: 7300,
    vertical_drop_ft: 5620,
    skiable_acres: 3121,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Revelation Gondola, Stellar Chair',
    archetype: 'Steep Alpine',
    summary: 'Possessing the greatest continuous vertical drop in North America at 5,620 feet, serving up high-alpine bowls, ancient hemlock tree glades, and limitless Selkirk powder.',
    website: 'https://www.revelstokemountainresort.com',
  },
  {
    id: 'lake-louise',
    avg_snowfall_in: 180,
    lift_count: 11,
    run_count: 160,
    name: 'Lake Louise',
    region: 'Alberta',
    country: 'Canada',
    lat: 51.4447,
    lng: -116.1608,
    default_bearing: 50,
    base_elev_ft: 5400,
    summit_elev_ft: 8650,
    vertical_drop_ft: 3250,
    skiable_acres: 4200,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Grizzly Express Gondola, Summit Quad',
    archetype: 'Flagship Mega-Resort',
    summary: 'A breathtaking Canadian Rockies panorama overlooking Lake Louise and Mount Victoria, home to World Cup speed events, sweeping back bowls, and dry continental powder.',
    website: 'https://www.skilouise.com',
  },
  {
    id: 'banff-sunshine',
    avg_snowfall_in: 360,
    lift_count: 12,
    run_count: 137,
    name: 'Banff Sunshine',
    region: 'Alberta',
    country: 'Canada',
    lat: 51.1147,
    lng: -115.7644,
    default_bearing: 180,
    base_elev_ft: 5440,
    summit_elev_ft: 8954,
    vertical_drop_ft: 3514,
    skiable_acres: 3358,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Sunshine Gondola, Teepee Town Heated Quad',
    archetype: 'Continental Divide Snow Magnet',
    summary: 'Perched high on the Continental Divide in Banff National Park, receiving up to 30 feet of feather-light champagne powder across three alpine mountains, including the legendary extreme freeride zone Delirium Dive.',
    website: 'https://www.skibanff.com/',
  },
  {
    id: 'chamonix',
    avg_snowfall_in: 380,
    lift_count: 47,
    run_count: 119,
    name: 'Chamonix-Mont-Blanc',
    region: 'Haute-Savoie',
    country: 'France',
    lat: 45.9237,
    lng: 6.8694,
    default_bearing: 160,
    base_elev_ft: 3396,
    summit_elev_ft: 12601,
    vertical_drop_ft: 9205,
    skiable_acres: 4200,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Aiguille du Midi Cable Car, Grands Montets',
    archetype: 'Steep Alpine',
    summary: 'The world capital of big-mountain alpinism beneath the granite spire of Mont Blanc; home to the 20 km Vallée Blanche descent and intense glaciated freeride chutes.',
    website: 'https://www.chamonix.com',
  },
  {
    id: 'val-disere',
    avg_snowfall_in: 350,
    lift_count: 78,
    run_count: 159,
    name: 'Val d’Isère / Tignes',
    region: 'Savoie',
    country: 'France',
    lat: 45.448,
    lng: 6.9802,
    default_bearing: 175,
    base_elev_ft: 5085,
    summit_elev_ft: 11353,
    vertical_drop_ft: 5268,
    skiable_acres: 10000,
    pass_networks: ['Epic','Independent'],
    infrastructure: 'Funicular, Cable Cars, Grande Motte Glacier',
    archetype: 'Flagship Mega-Resort',
    summary: 'The legendary Espace Killy spanning 300 km of high-altitude runs, two glaciated massifs, Olympic downhill speed runs, and some of the world\'s finest off-piste descents.',
    website: 'https://www.valdisere.com',
  },
  {
    id: 'courchevel',
    avg_snowfall_in: 280,
    lift_count: 58,
    run_count: 109,
    name: 'Courchevel (Les 3 Vallées)',
    region: 'Savoie',
    country: 'France',
    lat: 45.415,
    lng: 6.634,
    default_bearing: 180,
    base_elev_ft: 4265,
    summit_elev_ft: 8970,
    vertical_drop_ft: 4705,
    skiable_acres: 15000,
    pass_networks: ['Epic','Independent'],
    infrastructure: '600 km linked piste network in Les Trois Vallées',
    archetype: 'Flagship Mega-Resort',
    summary: 'The glamorous crown of the world\'s largest linked ski domain (Les 3 Vallées); perfectly groomed boulevards, steep couloirs on the Saulire, and Michelin-starred alpine luxury.',
    website: 'https://www.courchevel.com',
  },
  {
    id: 'val-thorens',
    avg_snowfall_in: 350,
    lift_count: 32,
    run_count: 88,
    name: 'Val Thorens (Les 3 Vallées)',
    region: 'Savoie',
    country: 'France',
    lat: 45.2983,
    lng: 6.58,
    default_bearing: 125,
    base_elev_ft: 7545,
    summit_elev_ft: 10597,
    vertical_drop_ft: 4691,
    skiable_acres: 15000,
    pass_networks: ['Epic','Independent'],
    infrastructure: 'Cime Caron Cable Car, Funitel Thorens',
    archetype: 'Glaciated High-Altitude Citadel',
    summary: 'The highest ski resort village in Europe at 2,300 meters, perched at the pinnacle of Les Trois Vallées. Offers vast glacier-fed powder bowls below Cime Caron (3,200m) and 100% snow certainty from November to May.',
    website: 'https://www.valthorens.com/',
  },
  {
    id: 'alpe-dhuez',
    avg_snowfall_in: 315,
    lift_count: 70,
    run_count: 111,
    name: 'Alpe d’Huez',
    region: 'Isère',
    country: 'France',
    lat: 45.0924,
    lng: 6.0697,
    default_bearing: 60,
    base_elev_ft: 3675,
    summit_elev_ft: 10925,
    vertical_drop_ft: 7250,
    skiable_acres: 7500,
    pass_networks: ['Independent'],
    infrastructure: 'Pic Blanc Cable Car, 70 Modern Lifts',
    archetype: 'South-Facing Alpine Massif',
    summary: 'The legendary \'Island in the Sun\' in the Grandes Rousses massif, home to Pic Blanc (3,330m) and the world-famous La Sarenne—the longest continuous black piste on the planet at 16 kilometers with 2,200m of vertical drop.',
    website: 'https://www.alpedhuez.com/',
  },
  {
    id: 'zermatt',
    avg_snowfall_in: 300,
    lift_count: 52,
    run_count: 148,
    name: 'Zermatt Matterhorn',
    region: 'Valais',
    country: 'Switzerland',
    lat: 45.9763,
    lng: 7.7317,
    default_bearing: 180,
    base_elev_ft: 5315,
    summit_elev_ft: 12805,
    vertical_drop_ft: 7490,
    skiable_acres: 8800,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Matterhorn Glacier Ride 3S, Gornergrat Cog Railway',
    archetype: 'Flagship Mega-Resort',
    summary: 'The highest ski area in Switzerland, offering year-round glacier skiing beneath the iconic pyramid of the Matterhorn with seamless cross-border descents into Cervinia, Italy.',
    website: 'https://www.zermatt.ch',
  },
  {
    id: 'verbier',
    avg_snowfall_in: 320,
    lift_count: 67,
    run_count: 142,
    name: 'Verbier (4 Vallées)',
    region: 'Valais',
    country: 'Switzerland',
    lat: 46.0961,
    lng: 7.2286,
    default_bearing: 130,
    base_elev_ft: 4920,
    summit_elev_ft: 10925,
    vertical_drop_ft: 6005,
    skiable_acres: 9500,
    pass_networks: ['Epic','Independent'],
    infrastructure: 'Mont-Fort Cable Car, 410 km in 4 Vallées',
    archetype: 'Steep Alpine',
    summary: 'Switzerland\'s premier freeride capital; steep glaciated descents off the 3,330m Mont-Fort summit, world-class itinerary trails, and pulsating alpine nightlife.',
    website: 'https://verbier.ch',
  },
  {
    id: 'st-moritz',
    avg_snowfall_in: 230,
    lift_count: 56,
    run_count: 88,
    name: 'St. Moritz (Corviglia & Diavolezza)',
    region: 'Graubünden',
    country: 'Switzerland',
    lat: 46.498,
    lng: 9.839,
    default_bearing: 310,
    base_elev_ft: 5971,
    summit_elev_ft: 10837,
    vertical_drop_ft: 4866,
    skiable_acres: 3800,
    pass_networks: ['Ikon'],
    infrastructure: 'Corvatsch, Diavolezza Glacier, Corviglia funicular',
    archetype: 'Flagship Mega-Resort',
    summary: 'The birthplace of winter tourism; champagne climate, high-altitude glacier descents on the Morteratsch, and sun-soaked World Cup speed runs above Lake St. Moritz.',
    website: 'https://www.engadin.ch',
  },
  {
    id: 'davos-klosters',
    avg_snowfall_in: 330,
    lift_count: 54,
    run_count: 85,
    name: 'Davos Klosters',
    region: 'Graubünden',
    country: 'Switzerland',
    lat: 46.8143,
    lng: 9.8528,
    default_bearing: 270,
    base_elev_ft: 2657,
    summit_elev_ft: 9331,
    vertical_drop_ft: 6674,
    skiable_acres: 6400,
    pass_networks: ['Independent'],
    infrastructure: 'Parsenn Funicular, Jakobshorn Cable Cars',
    archetype: 'Historic Alpine Titan',
    summary: 'Historic cradle of international alpine winter sports in the Swiss Grisons, encompassing the legendary 12 km Parsenn descent, extreme freeride chutes on the Jakobshorn, and five interconnected massif valleys.',
    website: 'https://www.davos.ch/',
  },
  {
    id: 'saas-fee',
    avg_snowfall_in: 320,
    lift_count: 22,
    run_count: 45,
    name: 'Saas-Fee',
    region: 'Valais',
    country: 'Switzerland',
    lat: 46.1089,
    lng: 7.9289,
    default_bearing: 175,
    base_elev_ft: 5905,
    summit_elev_ft: 11811,
    vertical_drop_ft: 5906,
    skiable_acres: 3700,
    pass_networks: ['Independent'],
    infrastructure: 'Metro Alpin Funicular, Allalin Glacier Cable Car',
    archetype: 'Glaciated High-Alpine Amphitheater',
    summary: 'Car-free Swiss alpine jewel enclosed by an amphitheater of eighteen 4,000-meter peaks. Features high-altitude glacier skiing up to 3,600m on the Fee Glacier, the world\'s highest underground funicular, and year-round snow.',
    website: 'https://www.saas-fee.ch/',
  },
  {
    id: 'st-anton',
    avg_snowfall_in: 430,
    lift_count: 85,
    run_count: 130,
    name: 'St. Anton am Arlberg',
    region: 'Tyrol',
    country: 'Austria',
    lat: 47.13,
    lng: 10.268,
    default_bearing: 340,
    base_elev_ft: 4278,
    summit_elev_ft: 9222,
    vertical_drop_ft: 4944,
    skiable_acres: 7500,
    pass_networks: ['Epic'],
    infrastructure: 'Valluga Cable Car, Flexenbahn connecting Lech-Zürs',
    archetype: 'Steep Alpine',
    summary: 'The cradle of alpine skiing; legendary Arlberg off-piste itineraries off the Valluga summit, demanding steep terrain, and the world\'s most riotous après-ski culture.',
    website: 'https://www.stantonamarlberg.com',
  },
  {
    id: 'kitzbuehel',
    avg_snowfall_in: 250,
    lift_count: 57,
    run_count: 96,
    name: 'Kitzbühel',
    region: 'Tyrol',
    country: 'Austria',
    lat: 47.446,
    lng: 12.392,
    default_bearing: 145,
    base_elev_ft: 2625,
    summit_elev_ft: 6560,
    vertical_drop_ft: 3935,
    skiable_acres: 4700,
    pass_networks: ['Ikon'],
    infrastructure: '3S-Bahn, Hahnenkammbahn, 230 km pistes',
    archetype: 'Flagship Mega-Resort',
    summary: 'Home of the Hahnenkamm and the terrifying Streif downhill course; medieval Tyrolean charm paired with a sprawling, state-of-the-art ski safari circuit.',
    website: 'https://www.kitzski.at',
  },
  {
    id: 'ischgl',
    avg_snowfall_in: 300,
    lift_count: 45,
    run_count: 90,
    name: 'Ischgl (Silvretta Arena)',
    region: 'Tyrol',
    country: 'Austria',
    lat: 47.0114,
    lng: 10.2917,
    default_bearing: 135,
    base_elev_ft: 4518,
    summit_elev_ft: 9423,
    vertical_drop_ft: 4905,
    skiable_acres: 5800,
    pass_networks: ['Independent'],
    infrastructure: 'Silvrettabahn, 45 Lifts · 239 km Pistes',
    archetype: 'Transnational High-Alpine Circuit',
    summary: 'High-octane Tyrolean mega-domain linked seamlessly with Samnaun in Switzerland, offering 239 kilometers of state-of-the-art groomed corduroy, duty-free cross-border tours, and legendary high-altitude bowl skiing.',
    website: 'https://www.ischgl.com/',
  },
  {
    id: 'soelden',
    avg_snowfall_in: 310,
    lift_count: 31,
    run_count: 39,
    name: 'Sölden',
    region: 'Tyrol',
    country: 'Austria',
    lat: 46.9655,
    lng: 11.0076,
    default_bearing: 270,
    base_elev_ft: 4429,
    summit_elev_ft: 10958,
    vertical_drop_ft: 6529,
    skiable_acres: 4700,
    pass_networks: ['Independent','Ikon'],
    infrastructure: 'Giggijochbahn, Golden Gate Glacier Connection',
    archetype: 'Glaciated World Cup Massif',
    summary: 'Ötztal Valley powerhouse boasting two vast interconnected glaciers (Rettenbach and Tiefenbach) and three 3,000-meter peaks linked by the Golden Gate lift network, hosting the annual FIS Alpine World Cup opener.',
    website: 'https://www.soelden.com/',
  },
  {
    id: 'cortina',
    avg_snowfall_in: 180,
    lift_count: 27,
    run_count: 66,
    name: 'Cortina d’Ampezzo',
    region: 'Veneto',
    country: 'Italy',
    lat: 46.54,
    lng: 12.135,
    default_bearing: 265,
    base_elev_ft: 3976,
    summit_elev_ft: 10603,
    vertical_drop_ft: 6627,
    skiable_acres: 3000,
    pass_networks: ['Ikon'],
    infrastructure: 'Freccia nel Cielo, Faloria Cable Cars',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Queen of the Dolomites; host of the 1956 and 2026 Winter Olympics beneath the towering limestone walls of the Tofane, combining world-class racing with elegant Italian style.',
    website: 'https://www.dolomiti.org/en/cortina/',
  },
  {
    id: 'val-gardena',
    avg_snowfall_in: 180,
    lift_count: 79,
    run_count: 105,
    name: 'Val Gardena / Sellaronda',
    region: 'South Tyrol',
    country: 'Italy',
    lat: 46.556,
    lng: 11.756,
    default_bearing: 200,
    base_elev_ft: 4055,
    summit_elev_ft: 8262,
    vertical_drop_ft: 4207,
    skiable_acres: 4300,
    pass_networks: ['Ikon'],
    infrastructure: 'Saslong Downhill, Sellaronda Orange/Green loops',
    archetype: 'Flagship Mega-Resort',
    summary: 'The majestic heart of Dolomiti Superski; home to the legendary Saslong World Cup downhill and the 40 km Sellaronda loop circling the towering Sella massif.',
    website: 'https://www.valgardena.it',
  },
  {
    id: 'hemsedal',
    avg_snowfall_in: 240,
    lift_count: 21,
    run_count: 53,
    name: 'Hemsedal',
    region: 'Viken',
    country: 'Norway',
    lat: 60.86,
    lng: 8.55,
    default_bearing: 180,
    base_elev_ft: 2034,
    summit_elev_ft: 4757,
    vertical_drop_ft: 2723,
    skiable_acres: 1100,
    pass_networks: ['Independent'],
    infrastructure: 'Express 6-Packs, Tinden lift',
    archetype: 'Flagship Mega-Resort',
    summary: 'Known as the Scandinavian Alps; jagged Norwegian peaks, reliable sub-zero dry powder, vast above-treeline bowls, and the liveliest après-ski in the north.',
    website: 'https://www.skistar.com',
  },
  {
    id: 'are-sweden',
    avg_snowfall_in: 200,
    lift_count: 42,
    run_count: 89,
    name: 'Åre',
    region: 'Jämtland',
    country: 'Sweden',
    lat: 63.4,
    lng: 13.08,
    default_bearing: 25,
    base_elev_ft: 1247,
    summit_elev_ft: 4173,
    vertical_drop_ft: 2926,
    skiable_acres: 2200,
    pass_networks: ['Independent'],
    infrastructure: 'Åre Bergbana, Cable Car, Duved connection',
    archetype: 'Flagship Mega-Resort',
    summary: 'Northern Europe\'s largest and most cosmopolitan ski resort, hosting multiple FIS Alpine World Championships with panoramic descents down Åreskutan above Lake Åresjön.',
    website: 'https://www.skistar.com',
  },
  {
    id: 'baqueira-beret',
    avg_snowfall_in: 350,
    lift_count: 36,
    run_count: 112,
    name: 'Baqueira-Beret',
    region: 'Catalonia',
    country: 'Spain',
    lat: 42.7,
    lng: 0.93,
    default_bearing: 95,
    base_elev_ft: 4921,
    summit_elev_ft: 8564,
    vertical_drop_ft: 3643,
    skiable_acres: 5360,
    pass_networks: ['Independent'],
    infrastructure: 'Baqueira Gondola, Jorge Jordana Chair',
    archetype: 'Flagship Mega-Resort',
    summary: 'The royal winter resort of Spain in the Pyrenean Val d\'Aran; Atlantic storm systems produce deep powder snow, wide open bowls across four valleys, and world-class Aranese gastronomy.',
    website: 'https://www.baqueira.es',
  },
  {
    id: 'niseko-united',
    avg_snowfall_in: 600,
    lift_count: 32,
    run_count: 80,
    name: 'Niseko United',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 42.8622,
    lng: 140.7042,
    default_bearing: 315,
    base_elev_ft: 853,
    summit_elev_ft: 4291,
    vertical_drop_ft: 3438,
    skiable_acres: 2191,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Hanazono Symphony Gondola, Ace Quad',
    archetype: 'Powder / Tree Glades',
    summary: 'The undisputed international powder capital of the world; Siberian winter storms continuously drop over 50 feet of ultra-dry snow onto Mount Annupuri\'s birch glades.',
    website: 'https://www.niseko.ne.jp',
  },
  {
    id: 'rusutsu',
    avg_snowfall_in: 550,
    lift_count: 18,
    run_count: 37,
    name: 'Rusutsu',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 42.7486,
    lng: 140.9039,
    default_bearing: 285,
    base_elev_ft: 1312,
    summit_elev_ft: 3261,
    vertical_drop_ft: 1949,
    skiable_acres: 1050,
    pass_networks: ['Epic'],
    infrastructure: '4 Gondolas, Express Quads',
    archetype: 'Powder / Tree Glades',
    summary: 'Hokkaido powder sanctuary spreading across three mountains, famous for magical tree glades, natural gullies, and untracked snow without the crowds.',
    website: 'https://rusutsu.com',
  },
  {
    id: 'hakuba-happo-one',
    avg_snowfall_in: 450,
    lift_count: 22,
    run_count: 16,
    name: 'Hakuba Happo-One',
    region: 'Nagano',
    country: 'Japan',
    lat: 36.7025,
    lng: 137.8444,
    default_bearing: 270,
    base_elev_ft: 2493,
    summit_elev_ft: 6004,
    vertical_drop_ft: 3511,
    skiable_acres: 1280,
    pass_networks: ['Epic'],
    infrastructure: 'Gondola & Quad Network',
    archetype: 'Steep Alpine',
    summary: 'Crown jewel of the Japanese Northern Alps in Nagano, site of the 1998 Olympic downhills with steep fall-line ridges and immense backcountry alpine access.',
    website: 'https://www.happo-one.jp',
  },
  {
    id: 'nozawa-onsen',
    avg_snowfall_in: 400,
    lift_count: 20,
    run_count: 36,
    name: 'Nozawa Onsen',
    region: 'Nagano',
    country: 'Japan',
    lat: 36.9208,
    lng: 138.4503,
    default_bearing: 120,
    base_elev_ft: 1853,
    summit_elev_ft: 5413,
    vertical_drop_ft: 3560,
    skiable_acres: 740,
    pass_networks: ['Indy'],
    infrastructure: 'Nagasaka 10-Passenger Gondola',
    archetype: 'Powder / Tree Glades',
    summary: 'Eighth-century hot-spring village where ancient bathhouse tradition meets deep Honshu snow, renowned for Yamabiko tree skiing and classic lantern-lit village streets.',
    website: 'https://nozawaski.com',
  },
  {
    id: 'portillo',
    avg_snowfall_in: 300,
    lift_count: 14,
    run_count: 35,
    name: 'Portillo',
    region: 'Valparaíso',
    country: 'Chile',
    lat: -32.836,
    lng: -70.133,
    default_bearing: 15,
    base_elev_ft: 9450,
    summit_elev_ft: 10862,
    vertical_drop_ft: 1412,
    skiable_acres: 1235,
    pass_networks: ['Ikon'],
    infrastructure: 'Unique Va-et-Vient slingshot lifts, Juncalillo chair',
    archetype: 'Steep Alpine',
    summary: 'Legendary private Andean jewel perched on the sapphire Laguna del Inca, home to the iconic yellow hotel, slingshot surface lifts, and extreme freeride couloirs like the Super C.',
    website: 'https://skiportillo.com',
  },
  {
    id: 'valle-nevado',
    avg_snowfall_in: 280,
    lift_count: 16,
    run_count: 44,
    name: 'Valle Nevado',
    region: 'Santiago',
    country: 'Chile',
    lat: -33.354,
    lng: -70.249,
    default_bearing: 45,
    base_elev_ft: 9925,
    summit_elev_ft: 12565,
    vertical_drop_ft: 2640,
    skiable_acres: 2200,
    pass_networks: ['Ikon','Mountain Collective'],
    infrastructure: 'Modern high-speed chairs, Andes Express',
    archetype: 'High Alpine / Steeps',
    summary: 'The highest and most modern resort in South America, perched above the clouds at nearly 10,000 feet with access to the interconnected Tres Valles and boundless heli-ski terrain.',
    website: 'https://vallenevado.com',
  },
  {
    id: 'cerro-catedral',
    avg_snowfall_in: 240,
    lift_count: 28,
    run_count: 60,
    name: 'Cerro Catedral (Bariloche)',
    region: 'Río Negro',
    country: 'Argentina',
    lat: -41.17,
    lng: -71.44,
    default_bearing: 265,
    base_elev_ft: 3379,
    summit_elev_ft: 7152,
    vertical_drop_ft: 3773,
    skiable_acres: 2965,
    pass_networks: ['Independent'],
    infrastructure: 'Amancay Gondola, Cable Car, modern chairlift fleet',
    archetype: 'Flagship Mega-Resort',
    summary: 'The largest ski resort in South America; panoramic granite spires towering over Lake Nahuel Huapi with extensive off-piste tree skiing in native lenga forests.',
    website: 'https://catedralaltapatagonia.com',
  },
  {
    id: 'treble-cone',
    avg_snowfall_in: 220,
    lift_count: 4,
    run_count: 24,
    name: 'Treble Cone',
    region: 'Otago',
    country: 'New Zealand',
    lat: -44.634,
    lng: 168.898,
    default_bearing: 295,
    base_elev_ft: 4133,
    summit_elev_ft: 6850,
    vertical_drop_ft: 2717,
    skiable_acres: 1358,
    pass_networks: ['Independent'],
    infrastructure: 'Home Basin Express 6-pack, Saddle Quad',
    archetype: 'Steep Alpine',
    summary: 'The South Island\'s premier freeride proving ground; immense vertical, natural halfpipes in the Saddle Basin, and jaw-dropping vistas over Lake Wanaka and Mount Aspiring.',
    website: 'https://www.treblecone.com',
  },
  {
    id: 'cardrona',
    avg_snowfall_in: 110,
    lift_count: 8,
    run_count: 60,
    name: 'Cardrona Alpine Resort',
    region: 'Otago',
    country: 'New Zealand',
    lat: -44.87,
    lng: 168.95,
    default_bearing: 340,
    base_elev_ft: 5446,
    summit_elev_ft: 7414,
    vertical_drop_ft: 1968,
    skiable_acres: 1150,
    pass_networks: ['Independent'],
    infrastructure: 'McDougall\'s Chondola, Soho Basin expansion',
    archetype: 'Flagship Mega-Resort',
    summary: 'New Zealand\'s Olympic training mecca with world-class terrain parks, wide alpine bowls, and the historic new Soho Basin expansion adding vast advanced freeride acreage.',
    website: 'https://www.cardrona.com',
  },
  {
    id: 'perisher',
    avg_snowfall_in: 100,
    lift_count: 47,
    run_count: 100,
    name: 'Perisher',
    region: 'New South Wales',
    country: 'Australia',
    lat: -36.4,
    lng: 148.41,
    default_bearing: 295,
    base_elev_ft: 5262,
    summit_elev_ft: 6673,
    vertical_drop_ft: 1411,
    skiable_acres: 3076,
    pass_networks: ['Epic'],
    infrastructure: 'Skitube underground railway, 47 lifts across 4 resort areas',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Southern Hemisphere\'s largest ski resort; four interconnected resort areas (Perisher, Smiggin Holes, Blue Cow, Guthega) set amidst the iconic snow gums of the Snowy Mountains.',
    website: 'https://www.perisher.com.au',
  },
  {
    id: 'deer-valley',
    avg_snowfall_in: 300,
    lift_count: 37,
    run_count: 103,
    name: 'Deer Valley Resort',
    region: 'Utah',
    country: 'USA',
    lat: 40.6370,
    lng: -111.4780,
    default_bearing: 220,
    base_elev_ft: 6570,
    summit_elev_ft: 9570,
    vertical_drop_ft: 3000,
    skiable_acres: 5726,
    pass_networks: ['Ikon'],
    infrastructure: 'Gondola, 16 High-Speed Quads, East Village Express',
    archetype: 'Cruiser / Family',
    summary: 'Iconic ski-only luxury destination in the Wasatch Range renowned for meticulously groomed cruisers, gourmet dining, and premier Olympic slalom and mogul heritage.',
    website: 'https://www.deervalley.com',
  },
  {
    id: 'snowbasin',
    avg_snowfall_in: 300,
    lift_count: 12,
    run_count: 106,
    name: 'Snowbasin Resort',
    region: 'Utah',
    country: 'USA',
    lat: 41.2160,
    lng: -111.8569,
    default_bearing: 240,
    base_elev_ft: 6391,
    summit_elev_ft: 9350,
    vertical_drop_ft: 2959,
    skiable_acres: 3000,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Needles Gondola, John Paul Express, Allen Peak Tram',
    archetype: 'Steep Alpine',
    summary: '2002 Winter Olympic downhill venue featuring massive vertical, grand day lodges, and sweeping wide-open bowls beneath Mount Ogden.',
    website: 'https://www.snowbasin.com',
  },
  {
    id: 'beaver-creek',
    avg_snowfall_in: 325,
    lift_count: 25,
    run_count: 150,
    name: 'Beaver Creek Resort',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6042,
    lng: -106.5165,
    default_bearing: 195,
    base_elev_ft: 8100,
    summit_elev_ft: 11440,
    vertical_drop_ft: 3340,
    skiable_acres: 2082,
    pass_networks: ['Epic'],
    infrastructure: 'Centennial Express, Birds of Prey Express, Grouse Mountain',
    archetype: 'Cruiser / Family',
    summary: 'World Cup Birds of Prey downhill mountain renowned for pristine corduroy groomers, steep double-black glades, and escalators to the lifts.',
    website: 'https://www.beavercreek.com',
  },
  {
    id: 'keystone',
    avg_snowfall_in: 235,
    lift_count: 21,
    run_count: 130,
    name: 'Keystone Resort',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6050,
    lng: -105.9437,
    default_bearing: 170,
    base_elev_ft: 9280,
    summit_elev_ft: 12408,
    vertical_drop_ft: 3128,
    skiable_acres: 3149,
    pass_networks: ['Epic'],
    infrastructure: 'River Run Gondola, Bergman Bowl Express, Montezuma Quad',
    archetype: 'Cruiser / Family',
    summary: 'Three expansive peaks spanning Dercum Mountain, North Peak, and the newly lift-served alpine bowls of Bergman Bowl with night skiing and family cruisers.',
    website: 'https://www.keystoneresort.com',
  },
  {
    id: 'winter-park',
    avg_snowfall_in: 348,
    lift_count: 23,
    run_count: 166,
    name: 'Winter Park Resort',
    region: 'Colorado',
    country: 'USA',
    lat: 39.8869,
    lng: -105.7625,
    default_bearing: 225,
    base_elev_ft: 9000,
    summit_elev_ft: 12060,
    vertical_drop_ft: 3060,
    skiable_acres: 3081,
    pass_networks: ['Ikon'],
    infrastructure: 'The Gondola, Super Gauge Express, Panoramic Express',
    archetype: 'Moguls / Glades',
    summary: 'Colorado\'s longest continually operating resort; world-renowned for the legendary Mary Jane moguls, steep tree glades, and high-alpine Parsenn Bowl.',
    website: 'https://www.winterparkresort.com',
  },
  {
    id: 'copper-mountain',
    avg_snowfall_in: 305,
    lift_count: 24,
    run_count: 140,
    name: 'Copper Mountain',
    region: 'Colorado',
    country: 'USA',
    lat: 39.5022,
    lng: -106.1564,
    default_bearing: 205,
    base_elev_ft: 9712,
    summit_elev_ft: 12450,
    vertical_drop_ft: 2738,
    skiable_acres: 2507,
    pass_networks: ['Ikon'],
    infrastructure: 'American Eagle Gondola/Chondola, American Flyer, Super Bee',
    archetype: 'Cruiser / Family',
    summary: 'Naturally divided terrain where beginners, intermediates, and experts ski distinct mountain sections, crowned by Tucker Mountain cat skiing and US Ski Team training runs.',
    website: 'https://www.coppercolorado.com',
  },
  {
    id: 'crested-butte',
    avg_snowfall_in: 236,
    lift_count: 15,
    run_count: 121,
    name: 'Crested Butte Mountain Resort',
    region: 'Colorado',
    country: 'USA',
    lat: 38.9008,
    lng: -106.9658,
    default_bearing: 70,
    base_elev_ft: 9375,
    summit_elev_ft: 12162,
    vertical_drop_ft: 3062,
    skiable_acres: 1547,
    pass_networks: ['Epic'],
    infrastructure: 'Silver Queen Express, Red Lady Express, North Face T-Bar',
    archetype: 'Steep Alpine',
    summary: 'The birthplace of extreme freeskiing, boasting steep cliffs, narrow couloirs, and technical rocky chutes across the High Lift and North Face.',
    website: 'https://www.skicb.com',
  },
  {
    id: 'grand-targhee',
    avg_snowfall_in: 500,
    lift_count: 6,
    run_count: 99,
    name: 'Grand Targhee Resort',
    region: 'Wyoming',
    country: 'USA',
    lat: 43.7888,
    lng: -110.9570,
    default_bearing: 92,
    base_elev_ft: 7851,
    summit_elev_ft: 9862,
    vertical_drop_ft: 2237,
    skiable_acres: 2602,
    pass_networks: ['Mountain Collective'],
    infrastructure: 'Dreamcatcher High-Speed Quad, Sacajawea, Colter Lift',
    archetype: 'Powder / Tree Glades',
    summary: 'Western slope Teton powder kingdom receiving over 500 inches of dry powder annually with wide open snow bowls, glades, and spectacular views of the Grand Teton.',
    website: 'https://www.grandtarghee.com',
  },
  {
    id: 'heavenly',
    avg_snowfall_in: 360,
    lift_count: 28,
    run_count: 97,
    name: 'Heavenly Mountain Resort',
    region: 'California',
    country: 'USA',
    lat: 38.9353,
    lng: -119.9405,
    default_bearing: 140,
    base_elev_ft: 6567,
    summit_elev_ft: 10067,
    vertical_drop_ft: 3500,
    skiable_acres: 4800,
    pass_networks: ['Epic'],
    infrastructure: 'Heavenly Sightseeing Gondola, Gunbarrel Express, Dipper Express',
    archetype: 'Cruiser / Family',
    summary: 'Straddling the California-Nevada state line above cobalt Lake Tahoe, featuring 3,500 vertical feet, vast tree skiing, and dramatic high-altitude desert and alpine lake views.',
    website: 'https://www.skiheavenly.com',
  },
  {
    id: 'kirkwood',
    avg_snowfall_in: 500,
    lift_count: 15,
    run_count: 86,
    name: 'Kirkwood Mountain Resort',
    region: 'California',
    country: 'USA',
    lat: 38.6845,
    lng: -120.0654,
    default_bearing: 190,
    base_elev_ft: 7800,
    summit_elev_ft: 9800,
    vertical_drop_ft: 2000,
    skiable_acres: 2300,
    pass_networks: ['Epic'],
    infrastructure: 'Cornice Express, The Wall (Chair 10), Caples Crest',
    archetype: 'Steep Alpine',
    summary: 'High-elevation Sierra ridgeline famous for the "K-Factor" microclimate dumping 500+ inches of dry snow on The Wall, steep chutes, and natural cliff bands.',
    website: 'https://www.kirkwood.com',
  },
  {
    id: 'northstar',
    avg_snowfall_in: 350,
    lift_count: 20,
    run_count: 100,
    name: 'Northstar California',
    region: 'California',
    country: 'USA',
    lat: 39.2746,
    lng: -120.1215,
    default_bearing: 195,
    base_elev_ft: 6330,
    summit_elev_ft: 8610,
    vertical_drop_ft: 2280,
    skiable_acres: 3170,
    pass_networks: ['Epic'],
    infrastructure: 'Big Springs Gondola, Comstock Express, Martis Camp Express',
    archetype: 'Cruiser / Family',
    summary: 'Upscale North Lake Tahoe resort on Mount Pluto offering manicured cruising terrain, world-class terrain parks, and protected tree glades.',
    website: 'https://www.northstarcalifornia.com',
  },
  {
    id: 'taos',
    avg_snowfall_in: 300,
    lift_count: 14,
    run_count: 110,
    name: 'Taos Ski Valley',
    region: 'New Mexico',
    country: 'USA',
    lat: 36.5960,
    lng: -105.4510,
    default_bearing: 160,
    base_elev_ft: 9207,
    summit_elev_ft: 12481,
    vertical_drop_ft: 3274,
    skiable_acres: 1294,
    pass_networks: ['Ikon'],
    infrastructure: 'Kachina Peak Triple, Lift 1 High-Speed Quad',
    archetype: 'Steep Alpine',
    summary: 'Sangre de Cristo icon founded by Ernie Blake, revered for extreme hiking ridges, technical chutes, and the lift-served 12,481-foot Kachina Peak.',
    website: 'https://www.skitaos.com',
  },
  {
    id: 'whitefish',
    avg_snowfall_in: 300,
    lift_count: 14,
    run_count: 105,
    name: 'Whitefish Mountain Resort',
    region: 'Montana',
    country: 'USA',
    lat: 48.4820,
    lng: -114.3540,
    default_bearing: 350,
    base_elev_ft: 4464,
    summit_elev_ft: 6817,
    vertical_drop_ft: 2353,
    skiable_acres: 3000,
    pass_networks: ['Independent'],
    infrastructure: 'Chair 1 (Big Mountain Express), Snow Ghost Express, Chair 2',
    archetype: 'Powder / Tree Glades',
    summary: 'Big Mountain in Northern Montana overlooking Glacier National Park, famous for snow ghosts (rime-caked trees), expansive bowls, and unpretentious ski culture.',
    website: 'https://www.skiwhitefish.com',
  },
  {
    id: 'schweitzer',
    avg_snowfall_in: 300,
    lift_count: 10,
    run_count: 92,
    name: 'Schweitzer',
    region: 'Idaho',
    country: 'USA',
    lat: 48.3678,
    lng: -116.6231,
    default_bearing: 290,
    base_elev_ft: 3960,
    summit_elev_ft: 6400,
    vertical_drop_ft: 2440,
    skiable_acres: 2900,
    pass_networks: ['Ikon'],
    infrastructure: 'Great Escape Quad, Stella Six-Pack, Lakeview Triple',
    archetype: 'Powder / Tree Glades',
    summary: 'Overlooking magnificent Lake Pend Oreille in northern Idaho, featuring two massive snow bowls, cliff bands, and open glades in the Selkirk Mountains.',
    website: 'https://www.schweitzer.com',
  },
  {
    id: 'crystal-mountain',
    avg_snowfall_in: 486,
    lift_count: 11,
    run_count: 85,
    name: 'Crystal Mountain',
    region: 'Washington',
    country: 'USA',
    lat: 46.9355,
    lng: -121.5030,
    default_bearing: 225,
    base_elev_ft: 3912,
    summit_elev_ft: 7012,
    vertical_drop_ft: 3100,
    skiable_acres: 2600,
    pass_networks: ['Ikon'],
    infrastructure: 'Mt. Rainier Gondola, Green Valley Express, Chair 6',
    archetype: 'Steep Alpine',
    summary: 'Washington State\'s largest ski resort; features unmatched views of Mount Rainier, steep avalanche chutes in the King, and deep maritime powder.',
    website: 'https://www.crystalmountainresort.com',
  },
  {
    id: 'mt-baker',
    avg_snowfall_in: 663,
    lift_count: 8,
    run_count: 31,
    name: 'Mt. Baker Ski Area',
    region: 'Washington',
    country: 'USA',
    lat: 48.8640,
    lng: -121.6660,
    default_bearing: 190,
    base_elev_ft: 3500,
    summit_elev_ft: 5089,
    vertical_drop_ft: 1589,
    skiable_acres: 1000,
    pass_networks: ['Independent'],
    infrastructure: 'Chair 1, Chair 6, Chair 8 Quad',
    archetype: 'Powder / Tree Glades',
    summary: 'World-record holder for seasonal snowfall (1,140 inches in 1998-99); backcountry soul skiing capital with steep pillow lines and natural halfpipes.',
    website: 'https://www.mtbaker.us',
  },
  {
    id: 'kicking-horse',
    avg_snowfall_in: 295,
    lift_count: 5,
    run_count: 120,
    name: 'Kicking Horse Mountain Resort',
    region: 'British Columbia',
    country: 'Canada',
    lat: 51.2980,
    lng: -117.0480,
    default_bearing: 250,
    base_elev_ft: 3900,
    summit_elev_ft: 8214,
    vertical_drop_ft: 4314,
    skiable_acres: 3400,
    pass_networks: ['Epic'],
    infrastructure: 'Golden Eagle Express Gondola, Stairway to Heaven Quad',
    archetype: 'Steep Alpine',
    summary: 'The "Champagne Powder Capital of Canada" on the Powder Highway, offering 4,314 feet of leg-burning continuous vertical, four massive alpine bowls, and 85+ steep couloirs.',
    website: 'https://www.kickinghorseresort.com',
  },
  {
    id: 'mont-tremblant',
    avg_snowfall_in: 163,
    lift_count: 14,
    run_count: 102,
    name: 'Mont Tremblant',
    region: 'Quebec',
    country: 'Canada',
    lat: 46.2120,
    lng: -74.5850,
    default_bearing: 45,
    base_elev_ft: 755,
    summit_elev_ft: 2871,
    vertical_drop_ft: 2116,
    skiable_acres: 755,
    pass_networks: ['Ikon'],
    infrastructure: 'Express Gondola, Flying Mile, Duncan Express, Lowell Thomas',
    archetype: 'Cruiser / Family',
    summary: 'The crown jewel of Eastern Canadian skiing, nestled in the Laurentian Mountains with a colorful pedestrian village and four distinct mountain faces.',
    website: 'https://www.tremblant.ca',
  },
  {
    id: 'fernie',
    avg_snowfall_in: 360,
    lift_count: 10,
    run_count: 142,
    name: 'Fernie Alpine Resort',
    region: 'British Columbia',
    country: 'Canada',
    lat: 49.4630,
    lng: -115.0860,
    default_bearing: 240,
    base_elev_ft: 3450,
    summit_elev_ft: 7000,
    vertical_drop_ft: 3550,
    skiable_acres: 2504,
    pass_networks: ['Epic'],
    infrastructure: 'Polar Peak Chair, Timber Bowl Express, White Pass Quad',
    archetype: 'Powder / Tree Glades',
    summary: 'Legendary Lizard Range destination featuring five huge alpine bowls, steep glades, and consistent Rocky Mountain snow on the Powder Highway.',
    website: 'https://www.skifernie.com',
  },
  {
    id: 'les-arcs',
    avg_snowfall_in: 350,
    lift_count: 53,
    run_count: 128,
    name: 'Les Arcs (Paradiski)',
    region: 'Savoie',
    country: 'France',
    lat: 45.5720,
    lng: 6.8280,
    default_bearing: 110,
    base_elev_ft: 3937,
    summit_elev_ft: 10580,
    vertical_drop_ft: 6643,
    skiable_acres: 4942,
    pass_networks: ['Independent'],
    infrastructure: 'Vanoise Express, Aiguille Rouge Cable Car, Transarc Gondola',
    archetype: 'Steep Alpine',
    summary: 'Linked with La Plagne via the double-decker Vanoise Express cable car to form Paradiski (425 km), crowned by the 2,000m non-stop descent from the Aiguille Rouge summit.',
    website: 'https://www.lesarcs.com',
  },
  {
    id: 'laax',
    avg_snowfall_in: 380,
    lift_count: 28,
    run_count: 110,
    name: 'Laax (Flims Laax Falera)',
    region: 'Graubünden',
    country: 'Switzerland',
    lat: 46.8180,
    lng: 9.2650,
    default_bearing: 330,
    base_elev_ft: 3609,
    summit_elev_ft: 9908,
    vertical_drop_ft: 6299,
    skiable_acres: 5535,
    pass_networks: ['Independent'],
    infrastructure: 'Vorab Glacier Cable Car, Crap Sogn Gion Cable Car',
    archetype: 'Steep Alpine',
    summary: 'Europe\'s premier freestyle and freeride playground, featuring the world\'s biggest permanent superpipe on Crap Sogn Gion and wide-open glacier descents down the Vorab.',
    website: 'https://www.flimslaax.com',
  },
  {
    id: 'cervinia',
    avg_snowfall_in: 350,
    lift_count: 19,
    run_count: 75,
    name: 'Breuil-Cervinia',
    region: 'Valle d’Aosta',
    country: 'Italy',
    lat: 45.9340,
    lng: 7.6310,
    default_bearing: 30,
    base_elev_ft: 6726,
    summit_elev_ft: 12795,
    vertical_drop_ft: 6070,
    skiable_acres: 3700,
    pass_networks: ['Ikon'],
    infrastructure: 'Plateau Rosà Cable Car, Plan Maison Gondola',
    archetype: 'Steep Alpine',
    summary: 'The southern, sunnier side of the Matterhorn (Il Cervino), offering endless high-altitude cruisers connecting cross-border with Zermatt on the highest ski lifts in Europe.',
    website: 'https://www.cervinia.it',
  },
  {
    id: 'saalbach',
    avg_snowfall_in: 320,
    lift_count: 70,
    run_count: 140,
    name: 'Saalbach Hinterglemm (Skicircus)',
    region: 'Salzburg',
    country: 'Austria',
    lat: 47.3920,
    lng: 12.6360,
    default_bearing: 200,
    base_elev_ft: 2723,
    summit_elev_ft: 6877,
    vertical_drop_ft: 4154,
    skiable_acres: 6670,
    pass_networks: ['Independent'],
    infrastructure: 'Schattberg X-press, Zwölferkogelbahn, Asitzbahn',
    archetype: 'Cruiser / Family',
    summary: 'The Skicircus links Saalbach, Hinterglemm, Leogang, and Fieberbrunn into 270 km of modern interconnected lift circuits, freeride powder slopes, and world-class après-ski.',
    website: 'https://www.saalbach.com',
  },
  {
    id: 'andermatt',
    avg_snowfall_in: 450,
    lift_count: 33,
    run_count: 85,
    name: 'Andermatt-Sedrun-Disentis',
    region: 'Uri',
    country: 'Switzerland',
    lat: 46.6340,
    lng: 8.5940,
    default_bearing: 185,
    base_elev_ft: 4738,
    summit_elev_ft: 9711,
    vertical_drop_ft: 4973,
    skiable_acres: 3000,
    pass_networks: ['Epic'],
    infrastructure: 'Gemsstock Cable Car, Gütsch Express Gondola',
    archetype: 'Steep Alpine',
    summary: 'Heart of the Swiss Alps where the historic Gemsstock cable car ascends to 2,961m, unveiling the legendary Bernhard Russi Run and some of Europe\'s most revered freeride couloirs.',
    website: 'https://www.andermatt-sedrun-disentis.ch',
  },
  {
    id: 'madonna-di-campiglio',
    avg_snowfall_in: 280,
    lift_count: 58,
    run_count: 100,
    name: 'Madonna di Campiglio',
    region: 'Trentino',
    country: 'Italy',
    lat: 46.2290,
    lng: 10.8260,
    default_bearing: 290,
    base_elev_ft: 2788,
    summit_elev_ft: 8202,
    vertical_drop_ft: 5414,
    skiable_acres: 3700,
    pass_networks: ['Epic'],
    infrastructure: '5 Laghi Express, Spinale Express, Grostè Gondola',
    archetype: 'Cruiser / Family',
    summary: 'Elegant Brenta Dolomites resort linked to Pinzolo, Folgarida, and Marilleva (150 km pistes), featuring the 3-Tre World Cup slalom slope and dramatic limestone spires.',
    website: 'https://www.campigliodolomiti.it',
  },
];


/* =========================================================================
   CAT SKI & HELI SKI OPERATIONS DATASET
   ========================================================================= */

export const HELI_CAT_OPERATIONS: SkiResort[] = [
  {
    id: 'heli-cmh-bugaboos',
    avg_snowfall_in: 550,
    name: 'CMH Bugaboos Heli-Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 50.8524,
    lng: -116.7905,
    default_bearing: 210,
    base_elev_ft: 4900,
    summit_elev_ft: 11150,
    vertical_drop_ft: 6250,
    skiable_acres: 250000,
    tenure_acres: 250000,
    pass_networks: ['Independent'],
    infrastructure: 'Luxury remote backcountry lodge · Bell 212 helicopters · Certified ACMG/IFMGA guides',
    archetype: 'Heli Skiing',
    summary: 'The birthplace of heli-skiing in 1965 in the legendary granite spires of the Bugaboo Range, with 1,000+ named runs.',
    website: 'https://www.cmhheli.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-mike-wiegele',
    avg_snowfall_in: 600,
    name: 'Mike Wiegele Helicopter Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 52.1283,
    lng: -119.3039,
    default_bearing: 195,
    base_elev_ft: 2200,
    summit_elev_ft: 11600,
    vertical_drop_ft: 9400,
    skiable_acres: 1200000,
    tenure_acres: 1200000,
    pass_networks: ['Independent'],
    infrastructure: 'Blue River heli-village resort · 10+ AStar / Bell helicopters · 1.2M acres tenure',
    archetype: 'Heli Skiing',
    summary: 'World-renowned vast wilderness heli-skiing encompassing both the Cariboo and Monashee mountain ranges.',
    website: 'https://www.wiegele.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'cat-baldface-lodge',
    avg_snowfall_in: 500,
    name: 'Baldface Lodge Snowcat Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 49.6385,
    lng: -117.3486,
    default_bearing: 180,
    base_elev_ft: 4500,
    summit_elev_ft: 7900,
    vertical_drop_ft: 3400,
    skiable_acres: 32000,
    tenure_acres: 32000,
    pass_networks: ['Independent'],
    infrastructure: 'Fly-in timber backcountry lodge · Custom heated snowcats · Natural Selection venue',
    archetype: 'Cat Skiing',
    summary: 'Cult-status cat skiing mecca with legendary steeps, cliffs, and pillow lines in the Selkirks, receiving 500+ inches of snow.',
    website: 'https://baldface.com',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-selkirk-snowcat',
    avg_snowfall_in: 550,
    name: 'Selkirk Snowcat Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 50.2197,
    lng: -117.0371,
    default_bearing: 170,
    base_elev_ft: 4200,
    summit_elev_ft: 8600,
    vertical_drop_ft: 4400,
    skiable_acres: 40000,
    tenure_acres: 40000,
    pass_networks: ['Independent'],
    infrastructure: 'Historic Meadow Creek lodge · Custom powder snowcats · Limited to 24 guests per day',
    archetype: 'Cat Skiing',
    summary: 'The world’s first snowcat skiing operation founded in 1975, offering 15,000 to 20,000 vertical feet of untracked snow per day.',
    website: 'https://selkirksnowcatskiing.com',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'heli-chugach-powder-guides',
    avg_snowfall_in: 750,
    name: 'Chugach Powder Guides',
    region: 'Alaska',
    country: 'United States',
    lat: 60.9702,
    lng: -149.1081,
    default_bearing: 200,
    base_elev_ft: 250,
    summit_elev_ft: 7000,
    vertical_drop_ft: 6750,
    skiable_acres: 750000,
    tenure_acres: 750000,
    pass_networks: ['Independent'],
    infrastructure: 'Aerospatiale AStar B3 helicopters · Alyeska base · Backup snowcat powder tenure',
    archetype: 'Heli Skiing',
    summary: 'Legendary maritime steep Alaskan spine skiing and massive glaciated powder descents across 750,000 permitted acres.',
    website: 'https://chugachpowderguides.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-valdez-heli-ski-guides',
    avg_snowfall_in: 800,
    name: 'Valdez Heli-Ski Guides',
    region: 'Alaska',
    country: 'United States',
    lat: 61.1308,
    lng: -145.8617,
    default_bearing: 190,
    base_elev_ft: 1800,
    summit_elev_ft: 7800,
    vertical_drop_ft: 6000,
    skiable_acres: 600000,
    tenure_acres: 600000,
    pass_networks: ['Independent'],
    infrastructure: 'Tsaina Lodge on Thompson Pass · AStar helicopters · Founded by Doug Coombs',
    archetype: 'Heli Skiing',
    summary: 'The spiritual epicenter of extreme steep Alaskan helicopter skiing on Thompson Pass with 600–900 inches of snow.',
    website: 'https://valdezheliskiguides.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'cat-steamboat-powdercats',
    avg_snowfall_in: 450,
    name: 'Steamboat Powdercats',
    region: 'Colorado',
    country: 'United States',
    lat: 40.5401,
    lng: -106.6789,
    default_bearing: 180,
    base_elev_ft: 8500,
    summit_elev_ft: 10800,
    vertical_drop_ft: 2300,
    skiable_acres: 10000,
    tenure_acres: 10000,
    pass_networks: ['Independent'],
    infrastructure: 'Custom heated 12-passenger snowcats · Buffalo Pass USFS permit · Avalanche safety gear',
    archetype: 'Cat Skiing',
    summary: 'Colorado’s premier snowcat operation famous for the lightest Champagne Powder on snow-record-holding Buffalo Pass.',
    website: 'https://steamboatpowdercats.com',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-silverton-powdercats',
    avg_snowfall_in: 400,
    name: 'Silverton Mountain Cat & Heli',
    region: 'Colorado',
    country: 'United States',
    lat: 37.8847,
    lng: -107.6658,
    default_bearing: 180,
    base_elev_ft: 10400,
    summit_elev_ft: 13487,
    vertical_drop_ft: 3087,
    skiable_acres: 22000,
    tenure_acres: 22000,
    pass_networks: ['Indy'],
    infrastructure: 'AStar B3 helicopter · High-altitude Kassbohrer snowcat · Single double chairlift',
    archetype: 'Cat & Heli',
    summary: 'The highest and steepest guided ski mountain in North America with 100% expert terrain in the rugged San Juan Mountains.',
    website: 'https://silvertonmountain.com',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-island-lake',
    avg_snowfall_in: 450,
    name: 'Island Lake Cat Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 49.5292,
    lng: -115.1472,
    default_bearing: 200,
    base_elev_ft: 4000,
    summit_elev_ft: 7000,
    vertical_drop_ft: 3000,
    skiable_acres: 7000,
    tenure_acres: 7000,
    pass_networks: ['Independent'],
    infrastructure: 'Luxury log backcountry lodges · Cedar Valley cats · 5-star backcountry dining',
    archetype: 'Cat Skiing',
    summary: 'Exclusive luxury snowcat retreat set in a private cirque beneath the dramatic Lizard Range in Fernie, BC.',
    website: 'https://islandlakelodge.com',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-chatter-creek',
    avg_snowfall_in: 550,
    name: 'Chatter Creek Snowcat Skiing',
    region: 'British Columbia',
    country: 'Canada',
    lat: 51.7828,
    lng: -117.2711,
    default_bearing: 190,
    base_elev_ft: 4800,
    summit_elev_ft: 9800,
    vertical_drop_ft: 5000,
    skiable_acres: 58000,
    tenure_acres: 58000,
    pass_networks: ['Independent'],
    infrastructure: 'Spruce Meadow lodge · 4 custom PistenBully powder cats · Kinbasket Lake helicopter transfer',
    archetype: 'Cat Skiing',
    summary: 'One of the largest cat-ski tenures in the world covering 238 sq km on the western slopes of the Canadian Rockies.',
    website: 'https://chattercreek.ca',
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'heli-bella-coola',
    avg_snowfall_in: 700,
    name: 'Bella Coola Heli Sports',
    region: 'British Columbia',
    country: 'Canada',
    lat: 52.3789,
    lng: -126.7567,
    default_bearing: 210,
    base_elev_ft: 1500,
    summit_elev_ft: 10500,
    vertical_drop_ft: 9000,
    skiable_acres: 3250000,
    tenure_acres: 3250000,
    pass_networks: ['Independent'],
    infrastructure: 'Tweedsmuir Park Lodge & chalets · Small group AStar B2/B3 helis · 3.25M acres tenure',
    archetype: 'Heli Skiing',
    summary: 'Winner of World’s Best Heli-Ski Operator with the largest single tenure on Earth in BC’s dramatic Coast Range.',
    website: 'https://bellacoolahelisports.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-southern-lakes',
    avg_snowfall_in: 250,
    name: 'Southern Lakes Heliski',
    region: 'Otago',
    country: 'New Zealand',
    lat: -44.8512,
    lng: 168.7231,
    default_bearing: 30,
    base_elev_ft: 2000,
    summit_elev_ft: 8500,
    vertical_drop_ft: 6500,
    skiable_acres: 500000,
    tenure_acres: 500000,
    pass_networks: ['Independent'],
    infrastructure: 'Queenstown and Wanaka bases · Squirrel / AStar helicopters · 17 mountain ranges',
    archetype: 'Heli Skiing',
    summary: 'Southern Hemisphere’s premier helicopter ski operator across New Zealand’s Southern Alps chutes and glaciers.',
    website: 'https://heliskinz.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-air-zermatt',
    avg_snowfall_in: 350,
    name: 'Air Zermatt Monte Rosa Heliski',
    region: 'Valais',
    country: 'Switzerland',
    lat: 45.9372,
    lng: 7.8668,
    default_bearing: 345,
    base_elev_ft: 5300,
    summit_elev_ft: 14100,
    vertical_drop_ft: 8800,
    skiable_acres: 45000,
    tenure_acres: 45000,
    pass_networks: ['Independent'],
    infrastructure: 'Air Zermatt Bell 429 & Ecureuil helis · UIAGM Zermatt guides · High Alps glaciers',
    archetype: 'Heli Skiing',
    summary: 'Landing at 14,000 ft on Monte Rosa and skiing 8,800 vertical ft down the Grenzgletscher glacier back to Zermatt.',
    website: 'https://www.air-zermatt.ch',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-niseko-shiribetsu',
    avg_snowfall_in: 650,
    name: 'Hokkaido Backcountry Club Heli-Ski',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 42.8465,
    lng: 140.8576,
    default_bearing: 180,
    base_elev_ft: 1100,
    summit_elev_ft: 3632,
    vertical_drop_ft: 2532,
    skiable_acres: 15000,
    tenure_acres: 15000,
    pass_networks: ['Independent'],
    infrastructure: 'Aerospatiale AStar helicopter · Volcano crater drops · Guided small groups',
    archetype: 'Heli Skiing',
    summary: 'Japan’s premier commercial helicopter skiing operation on the volcanic cones of Mt. Shiribetsu with bottomless Japow.',
    website: 'https://hokkaidobackcountryclub.com',
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
];


/* =========================================================================
   CATEGORY BADGES HELPER
   ========================================================================= */

/* =========================================================================
   RESORT STATS & WEBSITE HELPERS
   ========================================================================= */

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
    // Correct common typo like "hhttps://"
    if (direct.startsWith('hhttps://')) {
      direct = direct.slice(1);
    }
    const withProto = direct.startsWith('http://') || direct.startsWith('https://') ? direct : `https://${direct}`;
    try {
      const parsed = new URL(withProto);
      // Ensure it has a genuine domain name with at least one dot (e.g. "example.com")
      if (parsed.hostname && parsed.hostname.includes('.') && parsed.hostname.length >= 4) {
        return withProto;
      }
    } catch (_) {
      // Invalid URL string
    }
  }

  // Strictly do NOT redirect to generic Google search; only return genuine, verified websites
  return null;
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
   REAL WEATHER ENGINE (OPEN-METEO)
   ========================================================================= */

function getNeutralWeather(resort: SkiResort): ResortWeatherData {
  const elev = resort.summit_elev_ft || 8000;
  const baseTempF = Math.round(30 - (elev / 1000) * 1.5);
  return {
    snowfall_72h_in: 0,
    snowfall_7d_in: 0,
    snowfall_72h_cm: 0,
    snowfall_7d_cm: 0,
    current_temp_f: baseTempF,
    current_temp_c: Math.round(((baseTempF - 32) * 5) / 9),
    summit_wind_gust_mph: 15,
    freezing_level_ft: Math.max(0, elev - 2500),
    rain_to_base_risk: false,
    daily_forecast: [],
    is_live: false,
    last_updated: 'Checking Open-Meteo...',
  };
}

async function fetchLiveWeather(resort: SkiResort): Promise<ResortWeatherData | null> {
  try {
    const summitElevFt = resort.summit_elev_ft || (resort.base_elev_ft ? resort.base_elev_ft + 2000 : 3000);
    const summitElevM = Math.round(summitElevFt * 0.3048);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${resort.lat}&longitude=${resort.lng}&elevation=${summitElevM}&hourly=snowfall,freezing_level_height,wind_gusts_10m,temperature_2m&daily=snowfall_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();

    const hourlySnow: number[] = data?.hourly?.snowfall || [];
    let snow72cm = 0;
    const hoursToSum = Math.min(72, hourlySnow.length);
    for (let i = 0; i < hoursToSum; i++) {
      snow72cm += hourlySnow[i] || 0;
    }
    const snow72in = Math.round((snow72cm / 2.54) * 10) / 10;

    const dailySnow: number[] = data?.daily?.snowfall_sum || [];
    const snow7dCm = dailySnow.reduce((a, b) => a + (b || 0), 0);
    const snow7dIn = Math.round((snow7dCm / 2.54) * 10) / 10;

    const daily_forecast: DailyForecast[] = (data?.daily?.time || []).map((t: string, idx: number) => {
      const cm = Math.round((data.daily.snowfall_sum?.[idx] || 0) * 10) / 10;
      const inches = Math.round((cm / 2.54) * 10) / 10;
      const tMaxC = Math.round(data.daily.temperature_2m_max?.[idx] || 0);
      const tMinC = Math.round(data.daily.temperature_2m_min?.[idx] || 0);
      return {
        date: t,
        snowfall_in: inches,
        snowfall_cm: cm,
        temp_max_f: Math.round((tMaxC * 9) / 5 + 32),
        temp_min_f: Math.round((tMinC * 9) / 5 + 32),
        temp_max_c: tMaxC,
        temp_min_c: tMinC,
      };
    });

    const curTempC = Math.round(data?.hourly?.temperature_2m?.[0] ?? -3);
    const curTempF = Math.round((curTempC * 9) / 5 + 32);

    return {
      snowfall_72h_in: snow72in,
      snowfall_7d_in: snow7dIn,
      snowfall_72h_cm: Math.round(snow72cm * 10) / 10,
      snowfall_7d_cm: Math.round(snow7dCm * 10) / 10,
      current_temp_f: curTempF,
      current_temp_c: curTempC,
      summit_wind_gust_mph: Math.round((data?.hourly?.wind_gusts_10m?.[0] || 15) * 0.621371),
      freezing_level_ft: Math.round((data?.hourly?.freezing_level_height?.[0] || 2500) * 3.28084),
      rain_to_base_risk: Boolean(data?.hourly?.temperature_2m?.[0] > 1.5 && (data?.hourly?.snowfall?.[0] || 0) > 0),
      daily_forecast,
      is_live: true,
      last_updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (e) {
    return null;
  }
}

/* =========================================================================
   APP COMPONENT
   ========================================================================= */

export default function App() {
  const [resorts, setResorts] = useState<SkiResort[]>(() =>
    GLOBAL_SKI_ATLAS.map((r) => ({
      ...r,
      weather: getNeutralWeather(r),
    }))
  );

  const [selectedResortId, setSelectedResortId] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<'directory' | 'profile'>('directory');
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full'>('peek');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const filtersMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [earthProjection, setEarthProjection] = useState<EarthProjectionMode>('mercator');
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('osm');
  const [unitsMetric, setUnitsMetric] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  const [leftDockOpen, setLeftDockOpen] = useState(true);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [mapLegendOpen, setMapLegendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Basemap & Layer Overlays State
  const [show3DTerrain, setShow3DTerrain] = useState(true);
  const [terrainExaggeration, setTerrainExaggeration] = useState<number>(0.70);
  const [showHillshade, setShowHillshade] = useState(true);
  const basemapMenuRef = useRef<HTMLDivElement | null>(null);
  const mapLegendRef = useRef<HTMLDivElement | null>(null);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const attributionRef = useRef<HTMLDivElement | null>(null);

  const handleTerrainExaggerationChange = (val: number) => {
    setTerrainExaggeration(val);
    if (mapRef.current && mapLoaded && show3DTerrain) {
      try {
        mapRef.current.setTerrain({ source: 'terrain-dem', exaggeration: val });
      } catch (_) {}
    }
  };

  // Category Individual Toggles (Default: Downhill only)
  // Controls all associated points, clusters, trails, and infrastructure
  const [showDownhill, setShowDownhill] = useState(true);
  const [showNordic, setShowNordic] = useState(false);
  const [showHeliCat, setShowHeliCat] = useState(false);

  // Dedicated Imperial and Metric Filter Slider States
  // Imperial defaults: 500' vertical, 100 acres, 0 mi
  const [minVerticalFt, setMinVerticalFt] = useState(500);
  const [minAreaAcres, setMinAreaAcres] = useState(100);
  const [minNordicMi, setMinNordicMi] = useState(0);

  // Metric defaults: 150 m vertical (clean rounded equiv to 500'), 50 ha area (clean rounded equiv to 100 ac), 0 km
  const [minVerticalM, setMinVerticalM] = useState(150);
  const [minAreaHa, setMinAreaHa] = useState(50);
  const [minNordicKm, setMinNordicKm] = useState(0);

  // Unified Effective Filtering Thresholds (derived from active unit system)
  const effectiveMinVerticalFt = useMemo(() => {
    if (unitsMetric) {
      return minVerticalM > 0 ? Math.round(minVerticalM * 3.28084) : 0;
    }
    return minVerticalFt;
  }, [unitsMetric, minVerticalM, minVerticalFt]);

  const effectiveMinAcreage = useMemo(() => {
    if (unitsMetric) {
      return minAreaHa > 0 ? Math.round(minAreaHa * 2.47105) : 0;
    }
    return minAreaAcres;
  }, [unitsMetric, minAreaHa, minAreaAcres]);

  const effectiveMinNordicKm = useMemo(() => {
    if (!unitsMetric) {
      return minNordicMi > 0 ? Math.round(minNordicMi * 1.60934) : 0;
    }
    return minNordicKm;
  }, [unitsMetric, minNordicMi, minNordicKm]);

  // Navigation Instrument (Compass/Gyro HUD)
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(0);
  // Derived 3D perspective state based on camera tilt angle (> 3° is oblique 3D perspective)
  const is3D = mapPitch > 3;
  const [mapScale, setMapScale] = useState({ distStr: '500 km', barWidth: 80 });
  const isDraggingCompassRef = useRef(false);
  const didDragCompassRef = useRef(false);
  const [isCompassDragging, setIsCompassDragging] = useState(false);
  const isDraggingTiltRef = useRef(false);
  const didDragTiltRef = useRef(false);
  const [isTiltDragging, setIsTiltDragging] = useState(false);

  // Mountain Directory Scope & Sorting
  const [directoryScope, setDirectoryScope] = useState<'in_frame' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'vert' | 'acres' | 'name' | 'snow'>('snow');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pass Network filters
  const [selectedPasses, setSelectedPasses] = useState<PassNetwork[]>([
    'Ikon',
    'Epic',
    'Indy',
    'Mountain Collective',
    'Independent',
  ]);

  // Viewport bounds for In Viewport listing
  const [viewportBounds, setViewportBounds] = useState<[number, number, number, number] | null>(null);

  // Global Points Ref & Features
  const [showGlobalPoints, setShowGlobalPoints] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({ downhill: 6955, nordic: 5276, heli_cat: 15 });
  const allGlobalFeaturesRef = useRef<any[]>([]);
  const globalFeaturesRef = useRef<any[]>([]);

  // Localhost SQLite Trails Cache & Refs
  const liveFeaturesMapRef = useRef<Map<string, any>>(new Map());
  const activeOverpassAbortRef = useRef<AbortController | null>(null);
  const lastFetchedBboxKeyRef = useRef<string>('');

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedPasses.length < 5) count++;
    if (unitsMetric) {
      if (minVerticalM !== 150) count++;
      if (minAreaHa !== 50) count++;
      if (minNordicKm !== 0) count++;
    } else {
      if (minVerticalFt !== 500) count++;
      if (minAreaAcres !== 100) count++;
      if (minNordicMi !== 0) count++;
    }
    if (!showDownhill || showNordic || showHeliCat) count++;
    return count;
  }, [selectedPasses, unitsMetric, minVerticalFt, minVerticalM, minAreaAcres, minAreaHa, minNordicMi, minNordicKm, showDownhill, showNordic, showHeliCat]);

  // Dynamic Category Counts Matching Sliders & Pass Network Filters
  const categoryFilterCounts = useMemo(() => {
    let downhill = 0;
    let nordic = 0;
    let heli_cat = 0;
    for (const r of resorts) {
      if (r.is_closed) continue;
      const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
      if (!passMatch) continue;
      const cat = r.category || 'downhill';
      if (cat === 'downhill') {
        const vert = r.vertical_drop_ft || 0;
        if (effectiveMinVerticalFt > 0 && vert < effectiveMinVerticalFt) continue;
        const acres = r.skiable_acres || 0;
        if (effectiveMinAcreage > 0 && acres < effectiveMinAcreage) continue;
        downhill++;
      } else if (cat === 'nordic') {
        if (effectiveMinNordicKm > 0 && ((r.trail_km || 0) < effectiveMinNordicKm)) continue;
        nordic++;
      } else if (cat === 'heli_cat') {
        heli_cat++;
      }
    }
    return { downhill, nordic, heli_cat };
  }, [resorts, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, selectedPasses]);

  const handleResetFilters = () => {
    setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent']);
    setMinVerticalFt(500);
    setMinVerticalM(150);
    setMinAreaAcres(100);
    setMinAreaHa(50);
    setMinNordicMi(0);
    setMinNordicKm(0);
    setShowDownhill(true);
    setShowNordic(false);
    setShowHeliCat(false);
  };

  // Filtered Resorts across entire world dataset
  const filteredResorts = useMemo(() => {
    const list = resorts.filter((r) => {
      if (r.is_closed) return false;
      const cat = r.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) return false;
      if (cat === 'nordic' && !showNordic) return false;
      if (cat === 'heli_cat' && !showHeliCat) return false;

      const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
      if (!passMatch) return false;

      // Downhill alpine resorts filtered by vertical drop and skiable acreage
      if (cat === 'downhill') {
        if (effectiveMinVerticalFt > 0 && (r.vertical_drop_ft === null || r.vertical_drop_ft === undefined || r.vertical_drop_ft < effectiveMinVerticalFt)) return false;
        if (effectiveMinAcreage > 0 && (r.skiable_acres === null || r.skiable_acres === undefined || r.skiable_acres < effectiveMinAcreage)) return false;
      } else if (cat === 'nordic') {
        // Nordic cross-country networks filtered by trail network length (km)
        if (effectiveMinNordicKm > 0 && ((r.trail_km || 0) < effectiveMinNordicKm)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesRegion = (r.region || '').toLowerCase().includes(q);
        const matchesCountry = (r.country || '').toLowerCase().includes(q);
        const matchesSummary = (r.summary || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRegion && !matchesCountry && !matchesSummary) return false;
      }

      return true;
    });

    const multiplier = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'snow') {
        const diff = (a.weather?.snowfall_7d_in ?? 0) - (b.weather?.snowfall_7d_in ?? 0);
        return diff * multiplier;
      } else if (sortBy === 'vert') {
        const diff = (a.vertical_drop_ft || 0) - (b.vertical_drop_ft || 0);
        return diff * multiplier;
      } else if (sortBy === 'acres') {
        const valA = a.category === 'nordic' ? (a.trail_km || a.run_count || 0) : (a.skiable_acres || 0);
        const valB = b.category === 'nordic' ? (b.trail_km || b.run_count || 0) : (b.skiable_acres || 0);
        const diff = valA - valB;
        return diff * multiplier;
      } else {
        return a.name.localeCompare(b.name) * multiplier;
      }
    });

    return list;
  }, [resorts, selectedPasses, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, searchQuery, showDownhill, showNordic, showHeliCat, sortBy, sortOrder]);

  // Resorts in current map viewport bounds
  const inViewResorts = useMemo(() => {
    if (!viewportBounds) return filteredResorts;
    const [west, south, east, north] = viewportBounds;
    return filteredResorts.filter((r) => {
      const inLng = west <= east ? r.lng >= west && r.lng <= east : r.lng >= west || r.lng <= east;
      const inLat = r.lat >= south && r.lat <= north;
      return inLng && inLat;
    });
  }, [filteredResorts, viewportBounds]);

  // Ski Areas Directory: In Frame vs All Matching Filters
  const displayedResorts = useMemo(() => {
    const source = directoryScope === 'in_frame' ? inViewResorts : filteredResorts;
    return source.slice(0, 200);
  }, [directoryScope, inViewResorts, filteredResorts]);

  const selectedResort = useMemo(() => {
    if (!selectedResortId) return null;
    return displayedResorts.find((r) => r.id === selectedResortId) || resorts.find((r) => r.id === selectedResortId) || null;
  }, [displayedResorts, resorts, selectedResortId]);

  /* =========================================================================
     LOCALHOST TRAILS STREAMING ENGINE
     ========================================================================= */

  const fetchOverpassBbox = useCallback(async (south: number, west: number, north: number, east: number) => {
    if (north - south > 0.35 || east - west > 0.45) return;
    const bboxKey = `${south.toFixed(2)},${west.toFixed(2)},${north.toFixed(2)},${east.toFixed(2)}`;
    if (lastFetchedBboxKeyRef.current === bboxKey) return;

    if (activeOverpassAbortRef.current) {
      activeOverpassAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeOverpassAbortRef.current = controller;
    lastFetchedBboxKeyRef.current = bboxKey;

    try {
      const res = await fetch(`/api/trails?bbox=${west},${south},${east},${north}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.features || !data.features.length || !mapRef.current) return;

      for (const f of data.features) {
        const p = f.properties;
        if (p?.kind === 'lift') {
          if (p.status && p.status !== 'operating') continue;
          const n = (p.name || '').toLowerCase();
          if (n.includes('proposed') || n.includes('planned') || n.includes('abandoned') || n.includes('disused') || n.includes('in project')) {
            continue;
          }
        }
        liveFeaturesMapRef.current.set(String(f.id || f.properties?.id), f);
      }

      if (liveFeaturesMapRef.current.size > 4500) {
        const keys = Array.from(liveFeaturesMapRef.current.keys());
        const toDelete = keys.slice(0, keys.length - 3500);
        toDelete.forEach((k) => liveFeaturesMapRef.current.delete(k));
      }

      const src = mapRef.current.getSource('live-pistes-vector') as GeoJSONSource;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: Array.from(liveFeaturesMapRef.current.values()),
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Local bbox query fallback:', err);
    }
  }, []);

  const fetchOverpassBboxRef = useRef(fetchOverpassBbox);
  useEffect(() => {
    fetchOverpassBboxRef.current = fetchOverpassBbox;
  }, [fetchOverpassBbox]);

  /* =========================================================================
     BACKGROUND WEATHER PREFETCH — load 7-day snow for all resorts on mount
     Batched (5 concurrent) to avoid hammering the API.
     ========================================================================= */

  useEffect(() => {
    let cancelled = false;
    const allResorts = [...GLOBAL_SKI_ATLAS];
    const BATCH = 5;

    async function prefetchAll() {
      for (let i = 0; i < allResorts.length; i += BATCH) {
        if (cancelled) break;
        const batch = allResorts.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map((r) => fetchLiveWeather(r)));
        if (cancelled) break;
        setResorts((prev) => {
          const updated = [...prev];
          results.forEach((result, j) => {
            if (result.status === 'fulfilled' && result.value) {
              const id = batch[j].id;
              const idx = updated.findIndex((r) => r.id === id);
              if (idx !== -1) updated[idx] = { ...updated[idx], weather: result.value! };
            }
          });
          return updated;
        });
        // Small delay between batches to be polite to the API
        if (i + BATCH < allResorts.length) await new Promise((res) => setTimeout(res, 200));
      }
    }

    prefetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================================
     MAP INITIALIZATION (MapLibre GL)
     ========================================================================= */

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const initialLeftPad = initialIsMobile ? 0 : (leftDockOpen ? 404 : 20);
    const initialRightPad = 0;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      attributionControl: false,
      renderWorldCopies: false,
      style: {
        version: 8,
        projection: { type: earthProjection },
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          // 1. Esri World Imagery Satellite (Crisp 3D photo terrain)
          'satellite-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Esri Satellite',
          },
          // 2. OpenStreetMap (Clean vector roads, towns & trails)
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'OpenStreetMap',
          },
          // 3. Esri World Physical Map (Painted relief up to zoom 8)
          'physical-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 8,
            attribution: 'Esri Physical',
          },
          // 4. Esri World Topo Map (Clean contours, summits, elevations & passes)
          'topo-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri Topo',
          },
          // 5. Mapterhorn Global DEM (Copernicus GLO-30 + JAXA void-free 3D elevation mesh - eliminates SRTM radar void spikes)
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
            encoding: 'terrarium',
            tileSize: 512,
            maxzoom: 15,
            attribution: '© Mapterhorn',
          },
          // 6. Dedicated DEM source for painted hillshade relief
          'hillshade-dem': {
            type: 'raster-dem',
            tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
            encoding: 'terrarium',
            tileSize: 512,
            maxzoom: 15,
          },
        },
        layers: [
          // Base 1: Satellite 3D
          {
            id: 'basemap-satellite',
            type: 'raster',
            source: 'satellite-tiles',
            layout: { visibility: basemapMode === 'satellite' ? 'visible' : 'none' },
            paint: { 'raster-contrast': 0.1 },
          },
          // Base 2: OpenStreetMap
          {
            id: 'basemap-osm',
            type: 'raster',
            source: 'osm-tiles',
            layout: { visibility: basemapMode === 'osm' ? 'visible' : 'none' },
            paint: { 'raster-contrast': 0.06, 'raster-saturation': 0.05, 'raster-brightness-min': 0.02 },
          },
          // Base 3A: Alpine Physical Landcover (Visible at globe & regional zooms)
          {
            id: 'basemap-physical',
            type: 'raster',
            source: 'physical-tiles',
            layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
            paint: {
              'raster-contrast': 0.08,
              'raster-saturation': -0.15,
              'raster-brightness-min': 0.08,
              'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 8, 1.0, 9.5, 0.0] as any,
            },
          },
          // Base 3B: Topo Map Contours (Cross-fades in as you zoom in)
          {
            id: 'basemap-topo',
            type: 'raster',
            source: 'topo-tiles',
            layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
            paint: {
              'raster-contrast': 0.10,
              'raster-saturation': 0.12,
              'raster-brightness-min': 0.05,
              'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.0, 8, 0.5, 9.5, 1.0] as any,
            },
          },
          // Alpine Multi-Color Painted Hillshade
          {
            id: 'alpine-painted-hillshade',
            type: 'hillshade',
            source: 'hillshade-dem',
            layout: { visibility: basemapMode === 'topo' ? 'visible' : 'none' },
            paint: {
              'hillshade-exaggeration': 0.45,
              'hillshade-illumination-direction': 315,
              'hillshade-illumination-anchor': 'map',
              'hillshade-shadow-color': 'rgba(44, 62, 80, 0.42)',
              'hillshade-highlight-color': 'rgba(255, 255, 255, 0.75)',
              'hillshade-accent-color': 'rgba(74, 107, 83, 0.22)',
            },
          },
          // Subtle hillshade for OSM mode
          {
            id: 'hillshade-relief',
            type: 'hillshade',
            source: 'hillshade-dem',
            layout: { visibility: basemapMode === 'osm' ? 'visible' : 'none' },
            paint: {
              'hillshade-exaggeration': 0.35,
              'hillshade-shadow-color': 'rgba(51, 65, 85, 0.40)',
              'hillshade-highlight-color': 'rgba(255, 255, 255, 0.90)',
              'hillshade-accent-color': 'rgba(148, 163, 184, 0.30)',
            },
          },
        ],
      },
      center: [12, 28], // Global scope flat map (Mercator)
      zoom: 1.8,
      minZoom: 1.2,
      maxZoom: 16.5, // Prevent over-zooming past DEM resolution into the subterranean surface
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      dragRotate: true,
    });

    // Apply viewport padding synchronously before first render so globe never slides on start
    map.setPadding({ left: initialLeftPad, right: initialRightPad, top: 44, bottom: initialIsMobile ? 80 : 0 });

    mapRef.current = map;
    (window as any).__skiAtlasMap = map;

    // Enable native linear drag-to-rotate around center with ground-clamped terrain elevation
    try {
      (map as any).setCenterClampedToGround?.(true);
      map.dragRotate.enable({ around: 'center', movement: 'linear' });
    } catch (_) {}

    // Tablet & Touchscreen Controls (two-finger pitch tilt, rotate & pinch-zoom)
    try {
      map.touchZoomRotate.enable({ around: 'center' });
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
    } catch (_) {}

    // Mac Trackpad Gestures (Twist to rotate, Pinch to zoom, Shift + Scroll to tilt)
    const container = map.getContainer();
    let gestureStartBearing = 0;
    let gestureStartZoom = 0;
    let isGestureActive = false;

    const onGestureStart = (e: any) => {
      e.preventDefault();
      gestureStartBearing = map.getBearing();
      gestureStartZoom = map.getZoom();
      isGestureActive = true;
    };

    const onGestureChange = (e: any) => {
      e.preventDefault();
      if (!isGestureActive) return;

      // 1. Twist to rotate heading (in degrees)
      if (typeof e.rotation === 'number') {
        const nextBearing = Math.round(gestureStartBearing + e.rotation);
        map.setBearing(nextBearing);
        setMapBearing(nextBearing);
      }

      // 2. Continuous pinch to zoom
      if (typeof e.scale === 'number' && e.scale > 0) {
        const nextZoom = gestureStartZoom + Math.log2(e.scale);
        const clampedZoom = Math.max(1.2, Math.min(16.5, nextZoom));
        map.setZoom(clampedZoom);
      }
    };

    const onGestureEnd = (e: any) => {
      e.preventDefault();
      isGestureActive = false;
      setMapBearing(Math.round(map.getBearing()));
    };

    // Trackpad & Mouse Wheel Controller (Pinch Zoom, Shift-Tilt, Option-Rotate)
    // Works across Brave, Chrome, Safari, and Firefox
    const onWheel = (e: WheelEvent) => {
      // 1. Pinch-to-Zoom (Brave & Chrome on Mac dispatch wheel with e.ctrlKey = true)
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const zoomDelta = -e.deltaY * 0.015;
        const curZoom = map.getZoom();
        const nextZoom = Math.max(1.2, Math.min(16.5, curZoom + zoomDelta));
        map.setZoom(nextZoom);
        return;
      }

      // 2. Shift + Two-Finger Scroll: Tilt 3D Camera Pitch directly
      if (e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const curPitch = map.getPitch();
        const pitchDelta = e.deltaY * 0.15;
        const newPitch = Math.max(0, Math.min(85, Math.round(curPitch - pitchDelta)));
        map.setPitch(newPitch);
        setMapPitch(newPitch);
        return;
      }

      // 3. Option (⌥) / Alt + Two-Finger Scroll: Rotate Camera Heading in Brave/Chrome
      if (e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const curBearing = map.getBearing();
        const rotDelta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.25;
        const nextBearing = Math.round(curBearing + rotDelta);
        map.setBearing(nextBearing);
        setMapBearing(nextBearing);
        return;
      }
    };

    container.addEventListener('gesturestart', onGestureStart as any, { passive: false });
    container.addEventListener('gesturechange', onGestureChange as any, { passive: false });
    container.addEventListener('gestureend', onGestureEnd as any, { passive: false });
    container.addEventListener('wheel', onWheel, { passive: false, capture: true });

    const canvas = map.getCanvas();
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('contextmenu', onContextMenu);

    map.on('rotate', () => setMapBearing(Math.round(map.getBearing())));
    map.on('pitch', () => {
      setMapPitch(Math.round(map.getPitch()));
      map.setRenderWorldCopies(false);
    });

    const handleMapZoom = () => {
      // Do not fight programmatic flights across continents
      if (isProgrammaticFlightActive) return;
      const z = map.getZoom();
      // Ensure camera does not dip below terrain surface when pitched steeply at high zoom
      if (z > 16.0 && map.getPitch() > 65) {
        map.setPitch(65);
        setMapPitch(65);
      }
      // Ensure globe always stays centered when in view:
      // When zooming out to globe level, smoothly constrain pitch toward 0° so globe never drops down
      if (z < 5.0) {
        const curPitch = map.getPitch();
        const maxAllowedPitch = Math.max(0, (z - 2.5) * 24);
        if (curPitch > maxAllowedPitch) {
          map.setPitch(maxAllowedPitch);
          setMapPitch(Math.round(maxAllowedPitch));
        }
      }
    };
    map.on('zoom', handleMapZoom);

    const updateScale = () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const latRad = (center.lat * Math.PI) / 180;
        const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);
        const targetPixels = 90;
        const targetMeters = metersPerPixel * targetPixels;
        if (targetMeters >= 1000) {
          const km = Math.round(targetMeters / 1000);
          setMapScale({ distStr: `${km} km`, barWidth: Math.round(km * 1000 / metersPerPixel) });
        } else {
          const m = Math.round(targetMeters / 10) * 10;
          setMapScale({ distStr: `${m} m`, barWidth: Math.round(m / metersPerPixel) });
        }
      } catch (_) {}
    };

    const updateBounds = () => {
      try {
        const b = map.getBounds();
        setViewportBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      } catch (_) {}
    };

    const handleMapMoveEnd = () => {
      updateBounds();
      updateScale();
      setMapBearing(Math.round(map.getBearing()));
      setMapPitch(Math.round(map.getPitch()));
      const z = map.getZoom();
      // Ensure camera does not dip below terrain surface when pitched steeply at high zoom
      if (z > 16.0 && map.getPitch() > 65) {
        map.setPitch(65);
        setMapPitch(65);
      }
      if (z >= 10.5 && fetchOverpassBboxRef.current) {
        try {
          const center = map.getCenter();
          const b = map.getBounds();
          const rawHalfLng = Math.abs(b.getEast() - b.getWest()) / 2;
          const rawHalfLat = Math.abs(b.getNorth() - b.getSouth()) / 2;
          const halfLng = Math.min(0.12, rawHalfLng * 1.15);
          const halfLat = Math.min(0.10, rawHalfLat * 1.15);
          fetchOverpassBboxRef.current(
            center.lat - halfLat,
            center.lng - halfLng,
            center.lat + halfLat,
            center.lng + halfLng
          );
        } catch (_) {}
      }
    };

    map.on('moveend', handleMapMoveEnd);

    map.on('load', () => {
      // Strictly enforce SINGLE planet - zero repeating earths in 2D or 3D
      map.setRenderWorldCopies(false);
      map.on('projectiontransition', () => map.setRenderWorldCopies(false));
      map.on('styledata', () => map.setRenderWorldCopies(false));
      map.on('style.load', () => map.setRenderWorldCopies(false));

      // Ensure canvas is 100% painted immediately on start
      map.resize();
      updateBounds();
      updateScale();

      // Enable 3D Terrain mesh (calibrated mountain relief)
      try {
        if (show3DTerrain) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration });
        }
      } catch (e) {
        console.warn('SetTerrain error:', e);
      }

      // 1. Localhost SQLite Real Vector Ski Trails Source & Layers
      map.addSource('live-pistes-vector', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Outer Casing line (Off by default for speed; toggled via showTrails)
      // Geometry strictly filtered to LineStrings to prevent duplicate strokes on area polygons
      map.addLayer({
        id: 'live-pistes-casing',
        type: 'line',
        source: 'live-pistes-vector',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#FAF8F3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.0, 14, 3.6, 17, 4.6],
          'line-opacity': 0.85,
        },
      });

      // Color lines (Off by default for speed; toggled via showTrails)
      // Geometry strictly filtered to LineStrings to eliminate 3-parallel-line duplicate boundary strokes
      map.addLayer({
        id: 'live-pistes-lines',
        type: 'line',
        source: 'live-pistes-vector',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'novice', '#2E7D32',       // Alpine Green
            'easy', '#2E7D32',         // Alpine Green
            'intermediate', '#1565C0', // Cobalt Blue
            'advanced', '#1C1B18',     // Black Diamond
            'expert', '#B84A39',       // Double Black Vermilion
            'extreme', '#B84A39',      // Double Black Vermilion
            'freeride', '#B84A39',     // Double Black / Freeride Vermilion
            '#8A847C',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 14, 2.2, 17, 3.0],
          'line-opacity': 0.95,
        },
      });

      // Aerialways / Lifts (Terracotta dashed line)
      map.addLayer({
        id: 'live-pistes-lifts',
        type: 'line',
        source: 'live-pistes-vector',
        filter: [
          'all',
          ['==', ['get', 'kind'], 'lift'],
          ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
          ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
        ],
        paint: {
          'line-color': '#B84A39',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });

      // Upright 3D Trail & Lift Names (Off by default for speed; suppresses Unnamed/Unknown labels)
      map.addLayer({
        id: 'live-pistes-labels',
        type: 'symbol',
        source: 'live-pistes-vector',
        minzoom: 12.5,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: {
          'visibility': 'none',
          'symbol-placement': 'line-center',
          'text-field': [
            'case',
            [
              'any',
              ['!', ['has', 'name']],
              ['==', ['coalesce', ['get', 'name'], ''], ''],
              ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]],
              ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]],
            ],
            '',
            ['get', 'name']
          ],
          'text-size': 11,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-keep-upright': true,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2,
        },
      });

      // Dedicated Aerialway / Lift Cable-Aligned Labels
      map.addLayer({
        id: 'live-pistes-lifts-labels',
        type: 'symbol',
        source: 'live-pistes-vector',
        minzoom: 12.5,
        filter: [
          'all',
          ['==', ['get', 'kind'], 'lift'],
          ['==', ['coalesce', ['get', 'status'], 'operating'], 'operating'],
          ['has', 'name'],
          ['!=', ['coalesce', ['get', 'name'], ''], ''],
          ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'proposed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'planned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'abandoned', ['downcase', ['coalesce', ['get', 'name'], '']]]],
          ['!', ['in', 'disused', ['downcase', ['coalesce', ['get', 'name'], '']]]],
        ],
        layout: {
          'visibility': showDownhill ? 'visible' : 'none',
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12.5, 9.5,
            14, 11,
            16, 12.5,
          ],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-offset': [0, -0.75],
          'text-keep-upright': true,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
          'text-letter-spacing': 0.04,
          'text-max-angle': 35,
        },
        paint: {
          'text-color': '#8F3628',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2.5,
          'text-halo-blur': 0.5,
        },
      });

      // 2. Curated Seed Resorts Source (Concentric Ring Markers)
      const curatedFeatures = GLOBAL_SKI_ATLAS.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          name: r.name,
          category: r.category || 'downhill',
          primary_pass: r.pass_networks[0] || 'Independent',
          pass_color: PASS_COLORS[r.pass_networks[0] || 'Independent'],
          vertical_ft: r.vertical_drop_ft || 0,
          vertical_drop_ft: r.vertical_drop_ft || 0,
          skiable_acres: r.skiable_acres || 0,
        },
      }));

      map.addSource('resorts-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: curatedFeatures as any },
      });

      // Curated Outer Ring (Visible across all zoom levels with smooth zoom interpolation)
      map.addLayer({
        id: 'resorts-outer-ring',
        type: 'circle',
        source: 'resorts-source',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, 6,
            6, 8,
            10, 11,
          ],
          'circle-color': ['get', 'pass_color'],
          'circle-opacity': 0.25,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'pass_color'],
        },
      });

      // Curated Inner Ring (Visible across all zoom levels with crisp halo)
      map.addLayer({
        id: 'resorts-inner-dot',
        type: 'circle',
        source: 'resorts-source',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, 3,
            6, 4,
            10, 5,
          ],
          'circle-color': ['get', 'pass_color'],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      // Curated Single Label (Visible from zoom 6.0+)
      map.addLayer({
        id: 'resorts-labels',
        type: 'symbol',
        source: 'resorts-source',
        minzoom: 6.0,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 1.5,
        },
      });

      // 3. Global OpenSkiData Points Source
      map.addSource('global-ski-areas-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: allGlobalFeaturesRef.current },
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 40,
      });

      // Color-coded cluster badges: High-contrast mineral progression (Blue -> Amber -> Vermilion -> Crimson)
      // Eliminates murky green-on-green clashing over satellite and terrain basemaps
      map.addLayer({
        id: 'global-clusters',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#0284C7', // Sky Blue / Glacier Indigo (< 15 resorts)
            15,
            '#D97706', // Warm Ochre / Amber (15 - 49 resorts)
            50,
            '#E05216', // Terracotta Vermilion (50 - 99 resorts)
            100,
            '#B91C1C', // Crimson Carmine (100+ resorts)
          ],
          'circle-opacity': 0.88,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14,
            15,
            18,
            50,
            22,
            100,
            26,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      map.addLayer({
        id: 'global-cluster-count',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#1C1B18',
          'text-halo-width': 0.8,
        },
      });

      // Global Ski Areas Outer Concentric Ring
      map.addLayer({
        id: 'global-unclustered-outer-ring',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 6.0,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, 7,
            10, 10,
            15, 14
          ],
          'circle-color': [
            'match',
            ['get', 'category'],
            'nordic', '#2E5A44',
            'heli_cat', '#C25916',
            ['coalesce', ['get', 'pass_color'], '#3B627E'],
          ],
          'circle-opacity': 0.22,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': [
            'match',
            ['get', 'category'],
            'nordic', '#2E5A44',
            'heli_cat', '#C25916',
            ['coalesce', ['get', 'pass_color'], '#3B627E'],
          ],
        },
      });

      // Global Ski Areas Core Point
      map.addLayer({
        id: 'global-unclustered-point',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'category'],
            'nordic', '#2E5A44',
            'heli_cat', '#C25916',
            ['coalesce', ['get', 'pass_color'], '#3B627E'],
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, 3,
            6, 4,
            10, 5,
            15, 6.5
          ],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      // Global Ski Areas Name Label
      map.addLayer({
        id: 'global-unclustered-label',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 6.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 1.5,
        },
      });

      // Click on curated resort
      const onResortClick = (e: any) => {
        if (!e.features || !e.features[0]) return;
        const id = e.features[0].properties?.id;
        if (id) handleSelectResort(id);
      };

      map.on('click', 'resorts-outer-ring', onResortClick);
      map.on('click', 'resorts-inner-dot', onResortClick);
      map.on('click', 'resorts-labels', onResortClick);

      // Click on global ski area
      const onGlobalClick = (e: any) => {
        if (!e.features || !e.features[0]) return;
        const p = e.features[0].properties;
        const coords = (e.features[0].geometry as any).coordinates;
        handleSelectGlobalResort(p, coords);
      };

      map.on('click', 'global-unclustered-outer-ring', onGlobalClick);
      map.on('click', 'global-unclustered-point', onGlobalClick);
      map.on('click', 'global-unclustered-label', onGlobalClick);

      // Click on cluster to zoom in
      map.on('click', 'global-clusters', (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ['global-clusters'] });
        const clusterId = feats[0]?.properties?.cluster_id;
        const source = map.getSource('global-ski-areas-source') as any;
        if (source && clusterId != null) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err || zoom == null) return;
            const geom = feats[0].geometry as any;
            safeEaseTo(map, {
              center: geom.coordinates,
              zoom: Math.min(zoom + 0.5, 14),
              duration: 600,
            });
          });
        }
      });

      // Pointer cursor
      ['resorts-outer-ring', 'resorts-inner-dot', 'resorts-labels', 'global-clusters', 'global-unclustered-outer-ring', 'global-unclustered-point', 'global-unclustered-label'].forEach((layerId) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      setMapLoaded(true);
    });

    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('gesturestart', onGestureStart as any);
      container.removeEventListener('gesturechange', onGestureChange as any);
      container.removeEventListener('gestureend', onGestureEnd as any);
      container.removeEventListener('wheel', onWheel as any, { capture: true } as any);
      map.remove();
    };
  }, []);

  /* =========================================================================
     VIEWPORT CENTERING VIA PADDING (Ensures globe is always dead-center)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (isProgrammaticFlightActive) return;
    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const rightPad = 0;
    const bottomPad = isMob ? (mobileSheetState === 'half' ? 220 : (mobileSheetState === 'peek' ? 80 : 0)) : 0;
    const topPad = 44;

    try {
      const curPad = mapRef.current.getPadding();
      if (
        curPad &&
        Math.abs((curPad.left ?? 0) - leftPad) < 2 &&
        Math.abs((curPad.right ?? 0) - rightPad) < 2 &&
        Math.abs((curPad.top ?? 0) - topPad) < 2 &&
        Math.abs((curPad.bottom ?? 0) - bottomPad) < 2
      ) {
        return; // Already at target padding, prevent unwanted sliding on start
      }
    } catch (_) {}

    mapRef.current.easeTo({
      padding: { left: leftPad, right: rightPad, top: topPad, bottom: bottomPad },
      duration: 300,
    });
  }, [leftDockOpen, mobileSheetState, isMobile, mapLoaded]);

  /* =========================================================================
     TRAILS & INFRASTRUCTURE OVERLAY VISIBILITY
     Directly tied to the 3 category master toggles:
     - Downhill: alpine pistes (green/blue/black) + aerialway lifts
     - Nordic: cross-country & skate ski trails (piste:type == 'nordic')
     - Heli/Cat: backcountry ski tours & freeride routes
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const anyTrails = showDownhill || showNordic || showHeliCat;

    // Build conditions for each active category
    const allowedConditions: any[] = [];

    if (showDownhill) {
      allowedConditions.push(['!=', ['get', 'piste:type'], 'nordic']);
    }

    if (showNordic) {
      allowedConditions.push(['==', ['get', 'piste:type'], 'nordic']);
    }

    if (showHeliCat && !showDownhill) {
      allowedConditions.push(['!=', ['get', 'piste:type'], 'nordic']);
    }

    // Restrict piste strokes to LineStrings to avoid stroking perimeter boundaries of clearing polygons
    const isLineGeom = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']];

    let pisteFilter: any;
    if (allowedConditions.length === 0) {
      pisteFilter = ['==', '1', '0']; // match nothing
    } else if (allowedConditions.length === 3) {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom]; // all line pistes
    } else if (allowedConditions.length === 1) {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, allowedConditions[0]];
    } else {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, ['any', ...allowedConditions]];
    }

    // Suppress text labels for Unnamed, Unknown, or empty trail names while keeping lines visible
    const labelFilter: any = [
      'all',
      pisteFilter,
      ['has', 'name'],
      ['!=', ['coalesce', ['get', 'name'], ''], ''],
      ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ];

    ['live-pistes-casing', 'live-pistes-lines'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
        if (anyTrails) map.setFilter(id, pisteFilter);
      }
    });

    if (map.getLayer('live-pistes-labels')) {
      map.setLayoutProperty('live-pistes-labels', 'visibility', anyTrails ? 'visible' : 'none');
      if (anyTrails) map.setFilter('live-pistes-labels', labelFilter);
    }

    // Aerialway Lifts & Cable-Aligned Labels are tied directly to Downhill ski infrastructure
    if (map.getLayer('live-pistes-lifts')) {
      map.setLayoutProperty('live-pistes-lifts', 'visibility', showDownhill ? 'visible' : 'none');
    }
    if (map.getLayer('live-pistes-lifts-labels')) {
      map.setLayoutProperty('live-pistes-lifts-labels', 'visibility', showDownhill ? 'visible' : 'none');
    }
  }, [showDownhill, showNordic, showHeliCat, mapLoaded]);

  /* =========================================================================
     MAP POINTS GPU FILTERING (Keeps map markers strictly in sync with filters)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const allowedCats: string[] = [];
    if (showDownhill) allowedCats.push('downhill');
    if (showNordic) allowedCats.push('nordic');
    if (showHeliCat) allowedCats.push('heli_cat');

    const downhillConditions: any[] = ['all'];
    if (effectiveMinVerticalFt > 0) {
      downhillConditions.push(['>=', ['coalesce', ['get', 'vertical_ft'], ['get', 'vertical_drop_ft'], 0], effectiveMinVerticalFt]);
    }
    if (effectiveMinAcreage > 0) {
      downhillConditions.push(['>=', ['coalesce', ['get', 'skiable_acres'], 0], effectiveMinAcreage]);
    }

    const nordicConditions: any[] = ['all'];
    if (effectiveMinNordicKm > 0) {
      nordicConditions.push(['>=', ['coalesce', ['get', 'trail_km'], 0], effectiveMinNordicKm]);
    }

    const filterExpr: any[] = [
      'all',
      ['in', ['get', 'category'], ['literal', allowedCats]],
      [
        'case',
        ['==', ['get', 'category'], 'downhill'],
        downhillConditions,
        ['==', ['get', 'category'], 'nordic'],
        nordicConditions,
        true,
      ],
    ];

    // Curated layers
    ['resorts-outer-ring', 'resorts-inner-dot', 'resorts-labels'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filterExpr as any);
      }
    });

    // Unclustered global points & labels (must retain ['!', ['has', 'point_count']])
    const unclusteredFilter: any = ['all', ['!', ['has', 'point_count']], filterExpr];
    if (map.getLayer('global-unclustered-outer-ring')) {
      map.setFilter('global-unclustered-outer-ring', unclusteredFilter);
    }
    if (map.getLayer('global-unclustered-point')) {
      map.setFilter('global-unclustered-point', unclusteredFilter);
    }
    if (map.getLayer('global-unclustered-label')) {
      map.setFilter('global-unclustered-label', unclusteredFilter);
    }
  }, [showDownhill, showNordic, showHeliCat, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, mapLoaded]);

  /* =========================================================================
     DYNAMIC MAP GEOJSON SOURCES FILTER SYNC
     Ensures clusters and map markers dynamically re-calculate counts on filter changes!
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // 1. Sync global clustered ski areas source
    const globalSrc = map.getSource('global-ski-areas-source') as GeoJSONSource;
    if (globalSrc && allGlobalFeaturesRef.current.length > 0) {
      const allowedCats = new Set<string>();
      if (showDownhill) allowedCats.add('downhill');
      if (showNordic) allowedCats.add('nordic');
      if (showHeliCat) allowedCats.add('heli_cat');

      const filteredFeatures = allGlobalFeaturesRef.current.filter((f) => {
        const p = f.properties;
        const cat = p.category || 'downhill';
        if (!allowedCats.has(cat)) return false;

        // Pass Networks filter (matches any active pass network)
        const passes: PassNetwork[] = p.pass_networks && p.pass_networks.length > 0 ? p.pass_networks : ['Independent'];
        const passMatch = passes.some((pn) => selectedPasses.includes(pn));
        if (!passMatch) return false;

        if (cat === 'downhill') {
          const vert = p.vertical_ft || p.vertical_drop_ft || 0;
          if (effectiveMinVerticalFt > 0 && vert < effectiveMinVerticalFt) return false;
          const acres = p.skiable_acres || 0;
          if (effectiveMinAcreage > 0 && acres < effectiveMinAcreage) return false;
        } else if (cat === 'nordic') {
          if (effectiveMinNordicKm > 0 && ((p.trail_km || 0) < effectiveMinNordicKm)) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (p.name || '').toLowerCase().includes(q);
          const matchReg = (p.region || '').toLowerCase().includes(q);
          const matchCountry = (p.country || '').toLowerCase().includes(q);
          if (!matchName && !matchReg && !matchCountry) return false;
        }
        return true;
      });

      globalSrc.setData({ type: 'FeatureCollection', features: filteredFeatures });
    }

    // 2. Sync curated seed resorts source
    const curatedSrc = map.getSource('resorts-source') as GeoJSONSource;
    if (curatedSrc) {
      const allowedCats = new Set<string>();
      if (showDownhill) allowedCats.add('downhill');
      if (showNordic) allowedCats.add('nordic');
      if (showHeliCat) allowedCats.add('heli_cat');

      const filteredCurated = GLOBAL_SKI_ATLAS.filter((r) => {
        const cat = r.category || 'downhill';
        if (!allowedCats.has(cat)) return false;
        const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
        if (!passMatch) return false;

        if (cat === 'downhill') {
          const vert = r.vertical_drop_ft || 0;
          if (effectiveMinVerticalFt > 0 && vert < effectiveMinVerticalFt) return false;
          const acres = r.skiable_acres || 0;
          if (effectiveMinAcreage > 0 && acres < effectiveMinAcreage) return false;
        } else if (cat === 'nordic') {
          if (effectiveMinNordicKm > 0 && ((r.trail_km || 0) < effectiveMinNordicKm)) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = r.name.toLowerCase().includes(q);
          const matchReg = (r.region || '').toLowerCase().includes(q);
          const matchCountry = (r.country || '').toLowerCase().includes(q);
          if (!matchName && !matchReg && !matchCountry) return false;
        }
        return true;
      }).map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          name: r.name,
          category: r.category || 'downhill',
          primary_pass: r.pass_networks[0] || 'Independent',
          pass_color: PASS_COLORS[r.pass_networks[0] || 'Independent'],
          vertical_ft: r.vertical_drop_ft || 0,
          vertical_drop_ft: r.vertical_drop_ft || 0,
          skiable_acres: r.skiable_acres || 0,
          trail_km: r.trail_km || null,
          trail_mi: r.trail_mi || null,
        },
      }));

      curatedSrc.setData({ type: 'FeatureCollection', features: filteredCurated as any });
    }
  }, [showDownhill, showNordic, showHeliCat, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, selectedPasses, searchQuery, mapLoaded, resorts]);

  /* =========================================================================
     EARTH PROJECTION TOGGLE (3D Spherical Globe vs 2D Planar Mercator)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    try {
      if (earthProjection === 'globe') {
        map.setProjection({ type: 'globe' });
        // If at low zoom, ensure camera is facing perpendicularly so globe stays centered
        if (map.getZoom() < 5 && map.getPitch() > 0) {
          safeEaseTo(map, { pitch: 0, duration: 400 });
          setMapPitch(0);
        }
      } else {
        map.setProjection({ type: 'mercator' });
      }
      if (show3DTerrain) {
        try { map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration }); } catch (_) {}
      } else {
        try { map.setTerrain(null); } catch (_) {}
      }
      map.setRenderWorldCopies(false);
    } catch (err) {
      console.warn('Projection transition error:', err);
    }
  }, [earthProjection, show3DTerrain, terrainExaggeration, mapLoaded]);

  /* =========================================================================
     SINGLE PLANET ENFORCEMENT (ZERO REPEATING EARTHS IN 2D OR 3D)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.setRenderWorldCopies(false);
  }, [mapPitch, earthProjection, mapLoaded]);

  /* =========================================================================
     OUTSIDE-CLICK DISMISSAL FOR BASEMAP, MAP KEY & DISPLAY/FILTERS PANELS
     ========================================================================= */

  useEffect(() => {
    if (!filtersMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(e.target as Node)) {
        setFiltersMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtersMenuOpen]);

  useEffect(() => {
    if (!mapMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (basemapMenuRef.current && !basemapMenuRef.current.contains(e.target as Node)) {
        setMapMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMapMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mapMenuOpen]);

  useEffect(() => {
    if (!mapLegendOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (mapLegendRef.current && !mapLegendRef.current.contains(e.target as Node)) {
        setMapLegendOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMapLegendOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mapLegendOpen]);

  useEffect(() => {
    if (!attributionOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (attributionRef.current && !attributionRef.current.contains(e.target as Node)) {
        setAttributionOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttributionOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [attributionOpen]);



  /* =========================================================================
     3D TERRAIN ELEVATION MESH TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    try {
      if (show3DTerrain) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration });
      } else {
        map.setTerrain(null);
      }
      map.setRenderWorldCopies(false);
    } catch (err) {
      console.warn('SetTerrain toggle error:', err);
    }
  }, [show3DTerrain, terrainExaggeration, mapLoaded]);

  /* =========================================================================
     HILLSHADE RELIEF TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer('alpine-painted-hillshade')) {
      map.setLayoutProperty(
        'alpine-painted-hillshade',
        'visibility',
        basemapMode === 'topo' && showHillshade ? 'visible' : 'none'
      );
    }
    if (map.getLayer('hillshade-relief')) {
      map.setLayoutProperty(
        'hillshade-relief',
        'visibility',
        basemapMode === 'osm' && showHillshade ? 'visible' : 'none'
      );
    }
  }, [showHillshade, basemapMode, mapLoaded]);

  /* =========================================================================
     BASEMAP STYLE TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Satellite
    if (map.getLayer('basemap-satellite')) {
      map.setLayoutProperty('basemap-satellite', 'visibility', basemapMode === 'satellite' ? 'visible' : 'none');
    }
    // OpenStreetMap
    if (map.getLayer('basemap-osm')) {
      map.setLayoutProperty('basemap-osm', 'visibility', basemapMode === 'osm' ? 'visible' : 'none');
    }
    if (map.getLayer('hillshade-relief')) {
      map.setLayoutProperty('hillshade-relief', 'visibility', basemapMode === 'osm' && showHillshade ? 'visible' : 'none');
    }
    // Alpine Topo
    if (map.getLayer('basemap-physical')) {
      map.setLayoutProperty('basemap-physical', 'visibility', basemapMode === 'topo' ? 'visible' : 'none');
    }
    if (map.getLayer('basemap-topo')) {
      map.setLayoutProperty('basemap-topo', 'visibility', basemapMode === 'topo' ? 'visible' : 'none');
    }
    if (map.getLayer('alpine-painted-hillshade')) {
      map.setLayoutProperty('alpine-painted-hillshade', 'visibility', basemapMode === 'topo' && showHillshade ? 'visible' : 'none');
    }
  }, [basemapMode, showHillshade, mapLoaded]);

  /* =========================================================================
     60 FPS KEYBOARD CAMERA FLIGHT ENGINE (WASD + QE + ARROW KEYS)
     ========================================================================= */

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    try {
      map.keyboard.disable();
    } catch (_) {}

    const activeKeys = new Set<string>();
    let animationFrameId: number | null = null;
    let lastTimestamp: number | null = null;
    let smoothedElevation: number | null = null;
    let isSettling = false;
    let settleStartTime = 0;

    const NAVIGATION_KEYS = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyZ',
      'KeyX',
      'Equal',
      'Minus',
      'NumpadAdd',
      'NumpadSubtract',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const flightStep = (timestamp: number) => {
      if (!mapRef.current) {
        animationFrameId = null;
        lastTimestamp = null;
        smoothedElevation = null;
        isSettling = false;
        return;
      }

      if (isProgrammaticFlightActive) {
        try { (mapRef.current as any).setCenterClampedToGround?.(true); } catch (_) {}
        smoothedElevation = null;
        isSettling = false;
        animationFrameId = null;
        lastTimestamp = null;
        activeKeys.clear();
        return;
      }

      const map = mapRef.current;

      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
      lastTimestamp = timestamp;

      // Settle Phase: Active keys released, gently ease remaining elevation delta to terrain
      if (activeKeys.size === 0) {
        if (isSettling && smoothedElevation !== null) {
          const curCenter = map.getCenter();
          const ground = map.queryTerrainElevation(curCenter);
          const targetElev = (ground !== null && ground !== undefined && isFinite(ground)) ? ground : smoothedElevation;
          const settleDiff = targetElev - smoothedElevation;
          const elapsed = timestamp - settleStartTime;

          if (Math.abs(settleDiff) > 0.4 && elapsed < 400) {
            smoothedElevation += settleDiff * (1 - Math.exp(-dt * 6.0));
            map.jumpTo({ elevation: smoothedElevation });
            animationFrameId = requestAnimationFrame(flightStep);
            return;
          }

          // Settle complete: snap the last sub-half-meter and restore native ground clamping
          map.jumpTo({ elevation: targetElev });
          try { (map as any).setCenterClampedToGround?.(true); } catch (_) {}
        }
        smoothedElevation = null;
        isSettling = false;
        animationFrameId = null;
        lastTimestamp = null;
        return;
      }

      // Active Flight Phase
      isSettling = false;

      // Initialize smoothedElevation and disable instantaneous ground clamping
      if (smoothedElevation === null) {
        try { (map as any).setCenterClampedToGround?.(false); } catch (_) {}
        const curCenter = map.getCenter();
        const ground = map.queryTerrainElevation(curCenter);
        const curElev = map.getCenterElevation();
        smoothedElevation = (ground !== null && ground !== undefined && isFinite(ground)) ? ground : (curElev || 0);
      }

      const isShift = activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight');

      let pitchDelta = 0;
      let rotateBearing = 0;
      let zoomDelta = 0;
      let moveForward = 0;
      let moveStrafe = 0;

      // WASD: Direct Camera Orientation Controls (No Shift required!)
      // W/S: Tilt pitch (up towards 3D horizon / down towards 2D nadir)
      if (activeKeys.has('KeyW')) pitchDelta += 1;
      if (activeKeys.has('KeyS')) pitchDelta -= 1;

      // A/D: Rotate bearing (spin camera heading left / right)
      if (activeKeys.has('KeyA')) rotateBearing += 1;
      if (activeKeys.has('KeyD')) rotateBearing -= 1;

      // Arrow Keys: Direct Ground Panning Controls (No Shift required!)
      if (activeKeys.has('ArrowUp')) moveForward += 1;
      if (activeKeys.has('ArrowDown')) moveForward -= 1;
      if (activeKeys.has('ArrowRight')) moveStrafe += 1;
      if (activeKeys.has('ArrowLeft')) moveStrafe -= 1;

      // Zoom In / Out: + / - (or Z / X for single-hand left keyboard use)
      if (activeKeys.has('Equal') || activeKeys.has('NumpadAdd') || activeKeys.has('KeyZ')) zoomDelta += 1;
      if (activeKeys.has('Minus') || activeKeys.has('NumpadSubtract') || activeKeys.has('KeyX')) zoomDelta -= 1;

      if (pitchDelta !== 0) {
        const curPitch = map.getPitch();
        const pitchSpeed = (isShift ? 2.0 : 1.0) * 36;
        const nextPitch = Math.max(0, Math.min(85, curPitch + pitchDelta * pitchSpeed * dt));
        map.setPitch(nextPitch);
        setMapPitch(Math.round(nextPitch));
      }

      if (rotateBearing !== 0) {
        const curBearing = map.getBearing();
        const bearingSpeed = (isShift ? 2.0 : 1.0) * 42;
        const nextBearing = (curBearing + rotateBearing * bearingSpeed * dt) % 360;
        const normalized = nextBearing < 0 ? nextBearing + 360 : nextBearing;
        map.setBearing(normalized);
        setMapBearing(Math.round(normalized));
      }

      if (zoomDelta !== 0) {
        const curZoom = map.getZoom();
        const zoomSpeed = (isShift ? 2.0 : 1.0) * 1.5;
        const nextZoom = Math.max(1.0, Math.min(19.0, curZoom + zoomDelta * zoomSpeed * dt));
        map.setZoom(nextZoom);
      }

      // Smooth damped terrain panning: filters out micro-ridges and terrain bumps while contouring macro slopes
      if (moveForward !== 0 || moveStrafe !== 0) {
        const len = Math.hypot(moveForward, moveStrafe);
        moveForward /= len;
        moveStrafe /= len;

        const curZoom = map.getZoom();
        const curCenter = map.getCenter();
        const curBearing = map.getBearing();
        const bearingRad = (curBearing * Math.PI) / 180;

        const speedMps = 720 * Math.pow(2, 14 - curZoom) * (isShift ? 2.5 : 1.0);
        const distMeters = speedMps * dt;

        const sinB = Math.sin(bearingRad);
        const cosB = Math.cos(bearingRad);
        const deltaEastMeters = (sinB * moveForward + cosB * moveStrafe) * distMeters;
        const deltaNorthMeters = (cosB * moveForward - sinB * moveStrafe) * distMeters;

        const latRad = (curCenter.lat * Math.PI) / 180;
        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.max(0.1, Math.cos(latRad));

        const deltaLat = deltaNorthMeters / metersPerDegLat;
        const deltaLng = deltaEastMeters / metersPerDegLng;

        const nextLat = Math.max(-85, Math.min(85, curCenter.lat + deltaLat));
        const nextLng = curCenter.lng + deltaLng;

        // Damped elevation tracking: sample ground terrain, apply low-pass filtering and vertical speed limits
        const rawGround = map.queryTerrainElevation([nextLng, nextLat]);
        const targetGroundElev = (rawGround !== null && rawGround !== undefined && isFinite(rawGround)) ? rawGround : smoothedElevation;
        const diff = targetGroundElev - smoothedElevation;

        // Asymmetric damping: responsive climb uphill (3.2), gentle glide downhill/over ridges (1.8)
        const dampingLambda = diff > 0 ? 3.2 : 1.8;
        const maxVerticalSpeed = Math.max(300, speedMps * 0.75); // m/s
        const maxDeltaPerFrame = maxVerticalSpeed * dt;
        const unclampedDelta = diff * (1 - Math.exp(-dt * dampingLambda));
        const deltaElevation = Math.max(-maxDeltaPerFrame, Math.min(maxDeltaPerFrame, unclampedDelta));

        smoothedElevation += deltaElevation;

        map.jumpTo({
          center: [nextLng, nextLat],
          elevation: smoothedElevation,
        });
      } else if (smoothedElevation !== null) {
        // Not panning horizontally, but if smoothedElevation has minor offset from ground, ease gently
        const curCenter = map.getCenter();
        const rawGround = map.queryTerrainElevation(curCenter);
        if (rawGround !== null && rawGround !== undefined && isFinite(rawGround)) {
          const diff = rawGround - smoothedElevation;
          if (Math.abs(diff) > 0.5) {
            smoothedElevation += diff * (1 - Math.exp(-dt * 3.5));
            map.jumpTo({ elevation: smoothedElevation });
          }
        }
      }

      animationFrameId = requestAnimationFrame(flightStep);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (NAVIGATION_KEYS.has(e.code) || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (NAVIGATION_KEYS.has(e.code)) e.preventDefault();
        activeKeys.add(e.code);
        isProgrammaticFlightActive = false;
        isSettling = false;

        if (animationFrameId === null) {
          lastTimestamp = performance.now();
          animationFrameId = requestAnimationFrame(flightStep);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);
      if (activeKeys.size === 0 && animationFrameId !== null) {
        // Begin smooth settle phase instead of abruptly snapping
        isSettling = true;
        settleStartTime = performance.now();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      try { (mapRef.current as any)?.setCenterClampedToGround?.(true); } catch (_) {}
    };
  }, [mapLoaded]);

  /* =========================================================================
     INGEST OPENSKIDATA & DEDUPLICATE AGAINST CURATED SEED RESORTS
     (Guarantees ZERO double names on the map!)
     ========================================================================= */

  useEffect(() => {
    let cancelled = false;
    const fetchGlobal = async () => {
      try {
        // Load local curated JSON first, fallback to CDN
        let data: any = null;
        try {
          const localRes = await fetch('/data/global_ski_areas.json');
          if (localRes.ok) data = await localRes.json();
        } catch (_) {}

        if (!data) {
          const remoteRes = await fetch('https://tiles.openskimap.org/geojson/ski_areas.geojson');
          if (remoteRes.ok) data = await remoteRes.json();
        }

        if (cancelled || !data || !data.features) return;

        // Curated resort definitions for duplicate suppression
        const curatedList = GLOBAL_SKI_ATLAS.map((r) => ({
          name: r.name.toLowerCase().trim(),
          lat: r.lat,
          lng: r.lng,
        }));

        const features: any[] = [];
        let dhTotal = 0;
        let nordTotal = 0;

        for (const f of data.features) {
          const pt = extractPointCoordinates(f.geometry);
          if (!pt) continue;
          const p = f.properties;
          if (!p || !p.name) continue;

          const pName = p.name.trim();
          const pNameLower = pName.toLowerCase();

          // Quality filter: Exclude permanently closed, defunct, or abandoned ski areas
          if (
            p.status === 'abandoned' ||
            p.status === 'closed' ||
            p.status === 'disused' ||
            p.status === 'defunct' ||
            p.is_closed === true ||
            (p.archetype && (p.archetype.includes('Defunct') || p.archetype.includes('Lost Ski Area'))) ||
            (p.infrastructure && (p.infrastructure.toLowerCase().includes('defunct') || p.infrastructure.toLowerCase().includes('abandoned'))) ||
            pNameLower.includes('(closed)') ||
            pNameLower.includes('(abandoned)') ||
            pNameLower.includes('(defunct)')
          ) {
            continue;
          }

          // Quality filter: Exclude zero-infrastructure downhill ghost entries
          const lifts = p.lift_count || 0;
          const runs = p.run_count || 0;
          const vert = p.vertical_ft || 0;
          const acres = p.skiable_acres || 0;
          const hasSite = !!p.website && typeof p.website === 'string' && p.website.trim().length > 0;
          if (p.category === 'downhill' && lifts === 0 && runs === 0 && vert <= 50 && acres <= 5 && !hasSite) {
            continue;
          }

          // Check if already in curated seed list -> SKIP to prevent double label!
          const pLng = pt[0];
          const pLat = pt[1];

          let isDuplicate = false;
          for (const cr of curatedList) {
            const dLat = Math.abs(pLat - cr.lat);
            const dLng = Math.abs(pLng - cr.lng);
            const dist = Math.hypot(dLat, dLng);
            const nameMatch = pNameLower.includes(cr.name) || cr.name.includes(pNameLower);
            // Genuine duplicate check: require name match within vicinity (0.12 deg) or practically identical coordinate pin (< 0.008 deg / ~800m)
            // Prevents adjacent mountains (e.g. Park City & Deer Valley, Alta & Solitude, Stowe & Smugglers' Notch) from falsely suppressing each other
            if ((nameMatch && dist < 0.12) || dist < 0.008) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) continue;

          // Website protocol hygiene
          let cleanSite = p.website ? String(p.website).trim() : '';
          if (cleanSite) {
            if (cleanSite.startsWith('hhttps://')) cleanSite = cleanSite.replace('hhttps://', 'https://');
            else if (!cleanSite.startsWith('http://') && !cleanSite.startsWith('https://')) {
              if (cleanSite.includes('.') && !cleanSite.includes(' ')) {
                cleanSite = `https://${cleanSite}`;
              } else {
                cleanSite = '';
              }
            }
          }

          const place = p.places?.[0]?.localized?.en;
          const country = place?.country || p.country || '';
          const region = place?.region || p.region || '';
          const classified = classifySkiFeature(p, pt);

          const rVert = p.vertical_ft || classified.cleanedVertFt || 0;
          // Nordic cross-country networks do not have alpine skiable acreage; zero out to prevent clogging
          const rAcres = classified.category === 'nordic' ? 0 : (p.skiable_acres || 0);

          if (classified.category === 'downhill') dhTotal++;
          else if (classified.category === 'nordic') nordTotal++;

          const passNets = (p.pass_networks && p.pass_networks.length > 0 ? p.pass_networks : ['Independent']) as PassNetwork[];
          const primaryPass = passNets[0] || 'Independent';
          const passColor = PASS_COLORS[primaryPass] || '#8A847C';

          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: pt },
            properties: {
              ...p,
              id: p.id,
              name: p.name,
              country,
              region,
              lng: pt[0],
              lat: pt[1],
              category: classified.category,
              archetype: classified.archetype,
              infrastructure: p.infrastructure || classified.infrastructure || 'Ski area',
              vertical_drop_ft: rVert,
              vertical_ft: rVert,
              summit_elev_ft: p.summit_elev_ft || classified.cleanedSummitFt || 0,
              base_elev_ft: p.base_elev_ft || classified.cleanedBaseFt || 0,
              skiable_acres: rAcres,
              website: cleanSite || p.website || '',
              trail_km: p.trail_km || null,
              trail_mi: p.trail_mi || null,
              pass_networks: passNets,
              primary_pass: primaryPass,
              pass_color: passColor,
              avg_snowfall_in: p.avg_snowfall_in || null,
            },
          });
        }

        allGlobalFeaturesRef.current = features;
        globalFeaturesRef.current = features;
        setCategoryCounts({ downhill: dhTotal, nordic: nordTotal, heli_cat: HELI_CAT_OPERATIONS.length });

        // Populate master resorts dataset with ALL 6,592 worldwide ski areas!
        const globalResortItems: SkiResort[] = features.map((f) => {
          const props = f.properties;
          return {
            id: props.id,
            name: props.name,
            country: props.country,
            region: props.region,
            lng: props.lng,
            lat: props.lat,
            default_bearing: props.default_bearing || (props.lat < 0 ? 0 : 180),
            category: props.category,
            archetype: props.archetype,
            infrastructure: props.infrastructure,
            vertical_drop_ft: props.vertical_ft || 0,
            summit_elev_ft: props.summit_elev_ft || 0,
            base_elev_ft: props.base_elev_ft || 0,
            skiable_acres: props.category === 'nordic' ? 0 : (props.skiable_acres || 0),
            pass_networks: (props.pass_networks && props.pass_networks.length > 0 ? props.pass_networks : ['Independent']) as PassNetwork[],
            summary: props.summary || '',
            website: props.website || '',
            lift_count: props.lift_count || null,
            run_count: props.run_count || null,
            trail_km: props.trail_km || null,
            trail_mi: props.trail_mi || null,
            avg_snowfall_in: props.avg_snowfall_in || null,
          };
        });

        setResorts([
          ...GLOBAL_SKI_ATLAS.map((r) => ({ ...r, weather: getNeutralWeather(r) })),
          ...HELI_CAT_OPERATIONS.map((r) => ({ ...r, weather: getNeutralWeather(r) })),
          ...globalResortItems,
        ]);

        // Update GeoJSON source on map
        if (mapRef.current) {
          const src = mapRef.current.getSource('global-ski-areas-source') as GeoJSONSource;
          if (src) src.setData({ type: 'FeatureCollection', features });
        }
      } catch (err) {
        console.warn('Could not load global ski areas:', err);
      }
    };

    fetchGlobal();
    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================================
     BATCH WEATHER INITIALIZATION ON STARTUP
     (Pre-populates live snow data for curated resorts immediately without clicking!)
     ========================================================================= */

  useEffect(() => {
    const batchFetchWeather = async () => {
      try {
        // Batch query top 20 curated resorts in a single Open-Meteo call!
        const targets = resorts.slice(0, 20);
        const lats = targets.map((r) => r.lat.toFixed(4)).join(',');
        const lngs = targets.map((r) => r.lng.toFixed(4)).join(',');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&daily=snowfall_sum,temperature_2m_max&hourly=temperature_2m&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const dataList = Array.isArray(data) ? data : [data];

        setResorts((prev) =>
          prev.map((r, idx) => {
            const item = dataList[idx];
            if (!item || !item.daily) return r;

            const dailySnow: number[] = item.daily.snowfall_sum || [];
            const snow72cm = (dailySnow[0] || 0) + (dailySnow[1] || 0) + (dailySnow[2] || 0);
            const snow72in = Math.round((snow72cm / 2.54) * 10) / 10;
            const curTempC = Math.round(item.hourly?.temperature_2m?.[0] ?? -3);
            const curTempF = Math.round((curTempC * 9) / 5 + 32);

            return {
              ...r,
              weather: {
                ...getNeutralWeather(r),
                snowfall_72h_in: snow72in,
                snowfall_72h_cm: Math.round(snow72cm * 10) / 10,
                current_temp_f: curTempF,
                current_temp_c: curTempC,
                is_live: true,
                last_updated: 'Just now',
              },
            };
          })
        );
      } catch (_) {}
    };

    batchFetchWeather();
  }, []);

  /* =========================================================================
     CARTOGRAPHIC CONCENTRIC NAVIGATION INSTRUMENT HANDLERS
     - Outer Bezel: Rotary Compass heading & True North snap
     - Inner Core: 3D Horizon perspective gimbal & 2D/3D toggle
     ========================================================================= */

  const handleCompassMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;

    isDraggingCompassRef.current = true;
    didDragCompassRef.current = false;
    setIsCompassDragging(true);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    const startBearing = mapRef.current.getBearing();

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingCompassRef.current || !mapRef.current) return;
      const currentAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - startAngle;

      if (Math.abs(deltaAngle) > 2) {
        didDragCompassRef.current = true;
      }

      let newBearing = (startBearing - deltaAngle) % 360;
      if (newBearing < 0) newBearing += 360;

      mapRef.current.setBearing(newBearing);
      setMapBearing(Math.round(newBearing));
    };

    const onMouseUp = () => {
      isDraggingCompassRef.current = false;
      setIsCompassDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => {
        didDragCompassRef.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleResetNorth = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (didDragCompassRef.current) return;
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom?.() ?? 3;
    const targetPitch = currentZoom < 5 ? 0 : mapRef.current.getPitch();
    safeEaseTo(mapRef.current, {
      bearing: 0,
      pitch: targetPitch,
      duration: 350,
    });
    setMapBearing(0);
    if (currentZoom < 5) setMapPitch(0);
  }, []);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;
    mapRef.current.zoomIn({ duration: 250 });
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;
    mapRef.current.zoomOut({ duration: 250 });
  }, []);

  const handleTiltMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;

    isDraggingTiltRef.current = true;
    didDragTiltRef.current = false;
    setIsTiltDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startBearing = mapRef.current.getBearing();
    const startPitch = mapRef.current.getPitch();

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingTiltRef.current || !mapRef.current) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (Math.hypot(dx, dy) > 2) {
        didDragTiltRef.current = true;
      }

      // Horizontal Drag (dx): Rotates camera heading / bearing left and right
      let newBearing = (startBearing + dx * 0.65) % 360;
      if (newBearing < 0) newBearing += 360;
      mapRef.current.setBearing(newBearing);
      setMapBearing(Math.round(newBearing));

      // Vertical Drag (dy): Tilts 3D pitch / perspective up and down
      const curZ = mapRef.current.getZoom();
      const maxAllowedPitch = curZ < 5.0 ? Math.max(0, (curZ - 2.5) * 24) : 85;
      const newPitch = Math.max(0, Math.min(maxAllowedPitch, startPitch - dy * 0.5));
      mapRef.current.setPitch(newPitch);
      setMapPitch(Math.round(newPitch));
    };

    const onMouseUp = () => {
      isDraggingTiltRef.current = false;
      setIsTiltDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => {
        didDragTiltRef.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleToggle3D = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (didDragTiltRef.current) return;
    if (!mapRef.current) return;
    const curPitch = mapRef.current.getPitch();

    if (curPitch > 10) {
      safeEaseTo(mapRef.current, {
        pitch: 0,
        duration: 500,
      });
      setMapPitch(0);
      mapRef.current.setRenderWorldCopies(false);
    } else {
      safeEaseTo(mapRef.current, {
        pitch: 62,
        duration: 600,
      });
      setMapPitch(62);
      mapRef.current.setRenderWorldCopies(false);
    }
  }, []);

  /* =========================================================================
     SELECTION HANDLERS WITH HEMISPHERE-AWARE 65° 3D SUN ANGLE
     ========================================================================= */

  const handleSelectResort = async (id: string) => {
    setSelectedResortId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('half');
    }
    try {
      window.history.replaceState({}, '', `?resort=${encodeURIComponent(id)}`);
    } catch {
      // ignore
    }
    const resort = displayedResorts.find((r) => r.id === id) || resorts.find((r) => r.id === id);
    if (!resort || !mapRef.current) return;

    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const rightPad = 0;
    const bottomPad = isMob ? 220 : 0;
    const topPad = 60;

    const isNordic = resort.category === 'nordic';
    // Bearing: use resort's calibrated default_bearing (fall-line looking up from valley to peak)
    const bearing = isNordic ? 0 : (resort.default_bearing ?? (resort.lat < 0 ? 0 : 180));

    // Zoom: scale with both vertical drop and skiable acreage so sprawling resorts (Vail, Zermatt)
    // pull back appropriately, while maintaining an intimate, framed view of the ski network.
    let zoom: number;
    if (isNordic) {
      const km = Math.max(resort.trail_km || 20, 5);
      zoom = Math.max(11.0, Math.min(14.0, 13.8 - Math.log2(km / 10) * 0.65));
    } else {
      const vert = Math.max(resort.vertical_drop_ft || 1500, 500);
      const acres = Math.max(resort.skiable_acres || 500, 200);
      zoom = Math.max(10.8, Math.min(14.5, 13.6 - Math.log2(vert / 1000) * 0.45 - Math.log2(acres / 1000) * 0.35));
    }

    // Midpoint calculation:
    // Curated flagships in GLOBAL_SKI_ATLAS have base lodge / village coordinates.
    // Advancing along default_bearing centers the physical mountain between base and summit.
    // Global ski areas are already centered on the mountain polygon centroid, so do not double-advance.
    let targetCenter: [number, number] = [resort.lng, resort.lat];
    if (!isNordic) {
      const isCuratedBase = GLOBAL_SKI_ATLAS.some((g) => g.id === resort.id);
      if (isCuratedBase) {
        const vert = Math.max(resort.vertical_drop_ft || 1500, 500);
        const midpointKm = Math.min(1.6, Math.max(0.5, (vert * 0.3048) / (2 * Math.tan(22 * Math.PI / 180)) / 1000));
        const bearingRad = (bearing * Math.PI) / 180;
        const dLat = (midpointKm / 111.32) * Math.cos(bearingRad);
        const dLng = (midpointKm / (111.32 * Math.cos((resort.lat * Math.PI) / 180))) * Math.sin(bearingRad);
        targetCenter = [resort.lng + dLng, resort.lat + dLat];
      }
    }

    // 46° pitch gives an authentic alpine skier perspective: standing at base looking up into the peaks
    const pitch = isNordic ? 28 : 46;

    // Compute dynamic duration based on flight distance across the globe so transcontinental jumps don't stall
    const curCenter = mapRef.current.getCenter();
    const distDeg = Math.hypot(resort.lng - curCenter.lng, resort.lat - curCenter.lat);
    const flightDuration = distDeg > 40 ? 2800 : (distDeg > 15 ? 2200 : 1600);

    safeFlyTo(mapRef.current, {
      center: targetCenter,
      zoom,
      pitch,
      bearing,
      padding: { left: leftPad, right: rightPad, top: topPad, bottom: bottomPad },
      duration: flightDuration,
      essential: true,
    });
    setMapPitch(pitch);
    setMapBearing(bearing);

    // Stream trails for this mountain with tight resort bounding box
    if (fetchOverpassBboxRef.current) {
      fetchOverpassBboxRef.current(
        resort.lat - 0.05,
        resort.lng - 0.06,
        resort.lat + 0.05,
        resort.lng + 0.06
      );
    }

    // Fetch deep weather for profile
    const live = await fetchLiveWeather(resort);
    if (live) {
      setResorts((prev) => prev.map((r) => (r.id === id ? { ...r, weather: live } : r)));
    }
  };

  const handleSelectGlobalResort = async (p: any, coords: [number, number]) => {
    const id = p.id || `global-${Math.round(coords[0] * 1000)}-${Math.round(coords[1] * 1000)}`;
    setSelectedResortId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('half');
    }

    // If already in resorts master state, forward to handleSelectResort for unified weather and geometry
    const existing = resorts.find((r) => r.id === id);
    if (existing) {
      handleSelectResort(id);
      return;
    }

    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const rightPad = 0;
    const bottomPad = isMob ? 220 : 0;
    const topPad = 60;

    const isNordic = p.category === 'nordic';
    const bearing = isNordic ? 0 : (Number(p.default_bearing) || (coords[1] < 0 ? 0 : 180));

    let gZoom: number;
    if (isNordic) {
      const km = Math.max(p.trail_km || 20, 5);
      gZoom = Math.max(11.0, Math.min(14.0, 13.8 - Math.log2(km / 10) * 0.65));
    } else {
      const gVert = Math.max(p.vertical_ft || 1500, 500);
      const gAcres = Math.max(p.skiable_acres || 500, 200);
      gZoom = Math.max(10.8, Math.min(14.5, 13.6 - Math.log2(gVert / 1000) * 0.45 - Math.log2(gAcres / 1000) * 0.35));
    }

    const pitch = isNordic ? 28 : 46;

    safeFlyTo(mapRef.current, {
      center: [coords[0], coords[1]],
      zoom: gZoom,
      pitch,
      bearing,
      padding: { left: leftPad, right: rightPad, top: topPad, bottom: bottomPad },
      duration: 1800,
      essential: true,
    });
    setMapPitch(pitch);
    setMapBearing(bearing);

    if (fetchOverpassBboxRef.current) {
      fetchOverpassBboxRef.current(
        coords[1] - 0.05,
        coords[0] - 0.06,
        coords[1] + 0.05,
        coords[0] + 0.06
      );
    }
  };

  const handleDeselectResort = () => {
    setSelectedResortId(null);
    setPanelView('directory');
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('peek');
    }
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // ignore
    }
    if (mapRef.current) {
      const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
      const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
      const bottomPad = isMob ? 80 : 0;
      mapRef.current.easeTo({
        padding: { left: leftPad, right: 0, top: 44, bottom: bottomPad },
        duration: 300,
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedResortId) {
        handleDeselectResort();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResortId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const resortParam = params.get('resort');
    const sheetParam = params.get('sheet') as 'peek' | 'half' | 'full' | null;
    if (sheetParam && ['peek', 'half', 'full'].includes(sheetParam)) {
      setMobileSheetState(sheetParam);
    }
    if (resortParam) {
      const match = displayedResorts.find((r) => r.id.toLowerCase() === resortParam.toLowerCase()) ||
                    resorts.find((r) => r.id.toLowerCase() === resortParam.toLowerCase() || r.name.toLowerCase() === resortParam.toLowerCase());
      if (match) {
        handleSelectResort(match.id);
      }
    }
  }, [mapLoaded]);

  const handleSortClick = (type: 'vert' | 'acres' | 'name' | 'snow') => {
    if (sortBy === type) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(type);
      setSortOrder(type === 'name' ? 'asc' : 'desc');
    }
  };

  const formatVert = (ft: number | null | undefined) => {
    if (!ft || ft <= 0) return '—';
    if (unitsMetric) return `${Math.round(ft * 0.3048).toLocaleString()} m`;
    return `${ft.toLocaleString()}'`;
  };

  const formatAcres = (acres: number | null | undefined) => {
    if (!acres || acres <= 0) return '—';
    if (unitsMetric) return `${Math.round(acres * 0.404686).toLocaleString()} ha`;
    return `${acres.toLocaleString()} ac`;
  };

  const formatSnow = (inches: number) => {
    if (unitsMetric) return `${Math.round(inches * 2.54)} cm`;
    return `${inches}"`;
  };

  const formatDistance = (km: number | null | undefined) => {
    if (!km || km <= 0) return '—';
    if (unitsMetric) return `${km} km`;
    const mi = Math.round(km * 0.621371 * 10) / 10;
    return `${mi} mi`;
  };

  const handleSetUnitsMetric = (toMetric: boolean) => {
    if (toMetric === unitsMetric) return;
    if (toMetric) {
      // Switching to Metric: cleanly snap to nearest round metric increments
      const newM = minVerticalFt > 0 ? Math.max(50, Math.round((minVerticalFt * 0.3048) / 50) * 50) : 0;
      const newHa = minAreaAcres > 0 ? Math.max(25, Math.round((minAreaAcres * 0.404686) / 25) * 25) : 0;
      const newKm = minNordicMi > 0 ? Math.max(5, Math.round((minNordicMi * 1.60934) / 5) * 5) : 0;
      setMinVerticalM(newM);
      setMinAreaHa(newHa);
      setMinNordicKm(newKm);
      setUnitsMetric(true);
    } else {
      // Switching to Imperial: cleanly snap to nearest round imperial increments
      const newFt = minVerticalM > 0 ? Math.max(100, Math.round((minVerticalM * 3.28084) / 100) * 100) : 0;
      const newAc = minAreaHa > 0 ? Math.max(100, Math.round((minAreaHa * 2.47105) / 100) * 100) : 0;
      const newMi = minNordicKm > 0 ? Math.max(5, Math.round((minNordicKm * 0.621371) / 5) * 5) : 0;
      setMinVerticalFt(newFt);
      setMinAreaAcres(newAc);
      setMinNordicMi(newMi);
      setUnitsMetric(false);
    }
  };

  const renderProfileContent = (resort: SkiResort) => {
    const stats = getResortStats(resort);
    const url = getResortWebsite(resort);
    const snow72 = resort.weather?.snowfall_72h_in ?? 0;
    const snow7d = resort.weather?.daily_forecast
      ? Math.round(
          resort.weather.daily_forecast.reduce(
            (sum, d) => sum + (unitsMetric ? d.snowfall_cm / 2.54 : d.snowfall_in),
            0
          ) * 10
        ) / 10
      : 0;

    return (
      <div className="flex flex-col h-full min-h-0 bg-[#F7F4ED] overflow-hidden">
        {/* Mountain Profile Header */}
        <div className="p-3.5 border-b border-[#D6D0C2] bg-[#FAF8F3] shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#5C5852] font-medium">
                <span>{resort.region ? `${resort.region}, ` : ''}{resort.country}</span>
                <span className="text-[#A8A299]">·</span>
                <span className="text-[#8A847C] uppercase tracking-wider font-semibold text-[10px]">Mountain Profile</span>
              </div>
              <h2 className="text-lg font-bold text-[#1C1B18] tracking-tight mt-0.5 truncate">
                {resort.name}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-0.5">
              {/* On mobile, show sheet resize buttons */}
              <div className="md:hidden flex items-center gap-1 mr-1 pr-1 border-r border-[#D6D0C2]">
                {mobileSheetState === 'half' ? (
                  <button
                    onClick={() => setMobileSheetState('full')}
                    className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                    title="Expand to Fullscreen"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setMobileSheetState('half')}
                    className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                    title="Collapse to Half"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setMobileSheetState('peek')}
                  className="p-1 text-[#8A847C] hover:text-[#1C1B18] rounded cursor-pointer"
                  title="Minimize to Peek"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleDeselectResort}
                className="p-1 hover:bg-[#EFECE4] text-[#8A847C] hover:text-[#1C1B18] rounded-md transition-colors cursor-pointer"
                title="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Official Website Link */}
          {url && (
            <div className="mt-1.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E5A44] hover:text-[#1C1B18] hover:underline transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Official Website</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            </div>
          )}

          {/* Pass Affiliations */}
          {resort.pass_networks && resort.pass_networks.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {resort.pass_networks.map((pass) => (
                <span
                  key={pass}
                  className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-md border bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] shadow-2xs"
                  title={PASS_DISPLAY_NAMES[pass]}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PASS_COLORS[pass] || '#8A847C' }}
                  />
                  <span>{PASS_SHORT_LABELS[pass] || pass}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mountain Profile Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 bg-[#F7F4ED]">
          {/* Metric Tables */}
          <div className="bg-[#FAF8F3] border border-[#D6D0C2] rounded-md overflow-hidden text-center shadow-2xs">
            {/* Row 1: Infrastructure */}
            <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] border-b border-[#D6D0C2] p-2.5">
              {resort.category === 'nordic' ? (
                <>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Trails</div>
                    <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{resort.run_count ?? stats.pistes ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Network</div>
                    <div className="text-sm font-bold text-[#2E5A44] mt-0.5">{resort.trail_km ? formatDistance(resort.trail_km) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Type</div>
                    <div className="text-sm font-bold text-[#1C1B18] mt-0.5">Nordic XC</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Lifts</div>
                    <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.lifts ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Pistes</div>
                    <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.pistes ?? resort.run_count ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Acres</div>
                    <div className="text-sm font-bold text-[#1C1B18] mt-0.5">
                      {stats.acres && stats.acres > 0 ? formatAcres(stats.acres) : '—'}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Row 2: Elevations */}
            <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] p-2.5 bg-[#F7F4ED]">
              <div>
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Vertical</div>
                <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.vertical_drop_ft)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Summit</div>
                <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.summit_elev_ft)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Base</div>
                <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.base_elev_ft)}</div>
              </div>
            </div>
          </div>

          {/* Summit Weather Forecast */}
          <div className="bg-[#FAF8F3] p-3.5 rounded-md border border-[#D6D0C2] space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#1C1B18]">
                <Snowflake className="w-3.5 h-3.5 text-[#3B627E]" />
                <span>Summit Meteorology</span>
              </div>
              {resort.weather?.is_live && (
                <span className="text-[10px] font-medium text-[#8A847C]">{resort.weather.last_updated}</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">72h Snow</div>
                <div className="text-base font-bold text-[#3B627E] mt-0.5">
                  {formatSnow(snow72)}
                </div>
              </div>
              <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">7-Day Snow</div>
                <div className="text-base font-bold text-[#3B627E] mt-0.5">
                  {resort.weather?.daily_forecast ? formatSnow(snow7d) : '—'}
                </div>
              </div>
              <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
                <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">Avg Annual</div>
                <div className="text-base font-bold text-[#1C1B18] mt-0.5">
                  {resort.avg_snowfall_in ? formatSnow(resort.avg_snowfall_in) : '—'}
                </div>
              </div>
            </div>

            {/* 7-Day Snowfall Bars */}
            {resort.weather?.daily_forecast && resort.weather.daily_forecast.length > 0 && (
              <div className="grid grid-cols-7 gap-1 h-16 items-end bg-[#F7F4ED] p-2 border border-[#D6D0C2] rounded-md">
                {resort.weather.daily_forecast.map((day, idx) => {
                  const val = unitsMetric ? day.snowfall_cm : day.snowfall_in;
                  const maxVal = Math.max(1, ...resort.weather!.daily_forecast.map((d) => (unitsMetric ? d.snowfall_cm : d.snowfall_in)));
                  const heightPercent = Math.max(8, Math.min(100, Math.round((val / maxVal) * 100)));
                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-xs transition-all ${
                          val > 0 ? 'bg-[#3B627E]' : 'bg-[#D6D0C2]'
                        }`}
                        title={`${day.date}: ${val}${unitsMetric ? 'cm' : 'in'} snow`}
                      />
                      <span className="text-[10px] font-bold text-[#8A847C] mt-1">
                        {new Date(day.date).toLocaleDateString([], { weekday: 'narrow' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDirectoryContent = () => {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#F7F4ED] overflow-hidden">
        {/* Search & Directory Controls */}
        <div className="p-3 border-b border-[#D6D0C2] bg-[#FAF8F3] space-y-2.5 shrink-0">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-[#8A847C] pointer-events-none" />
            <input
              type="text"
              placeholder="Search alpine resorts, peaks, countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F7F4ED] border border-[#D6D0C2] rounded-md pl-9.5 pr-8 py-2 text-sm text-[#1C1B18] placeholder-[#8A847C] font-medium focus:outline-none focus:border-[#8A847C] focus:bg-[#FAF8F3] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-[#8A847C] hover:text-[#1C1B18]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Controls Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[#736E67] uppercase tracking-wider font-bold text-[11px] shrink-0">
              Sort:
            </span>
            <div className="flex items-center gap-1 bg-[#FAF8F3] p-0.5 rounded-md border border-[#D6D0C2]">
              <button
                onClick={() => handleSortClick('vert')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === 'vert' ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs' : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>Vert</span>
                {sortBy === 'vert' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
              <button
                onClick={() => handleSortClick('acres')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === 'acres' ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs' : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>{showNordic && !showDownhill && !showHeliCat ? 'Network' : 'Acres'}</span>
                {sortBy === 'acres' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
              <button
                onClick={() => handleSortClick('name')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === 'name' ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs' : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>A-Z</span>
                {sortBy === 'name' && <span className="text-[10px] ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </button>
              <button
                onClick={() => handleSortClick('snow')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === 'snow' ? 'bg-[#EAE5D9] text-[#3B627E] font-bold border border-[#A8A299] shadow-2xs' : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>7-Day ❄</span>
                {sortBy === 'snow' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Directory Scope Category Tabs: All Matching vs In Frame */}
        <div className="px-3 py-2 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDirectoryScope('all')}
            className={`flex-1 py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
              directoryScope === 'all'
                ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
                : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
            }`}
            title="Show all ski areas matching current filters worldwide"
          >
            <span className="tabular-nums">{filteredResorts.length.toLocaleString()}</span>
            <span>ALL MATCHING</span>
          </button>
          <button
            onClick={() => setDirectoryScope('in_frame')}
            className={`flex-1 py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
              directoryScope === 'in_frame'
                ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
                : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
            }`}
            title="Show only ski areas currently inside the map view frame"
          >
            <span className="tabular-nums">{inViewResorts.length.toLocaleString()}</span>
            <span>IN FRAME</span>
          </button>
        </div>

        {/* Directory Cards List */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F4ED] p-2.5 space-y-2">
          {displayedResorts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A847C] space-y-2">
              <div>
                {directoryScope === 'in_frame'
                  ? '0 ski areas in current map view frame.'
                  : 'No ski areas match current filters.'}
              </div>
              {directoryScope === 'in_frame' && filteredResorts.length > 0 && (
                <button
                  onClick={() => setDirectoryScope('all')}
                  className="inline-block px-3 py-1.5 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#8A847C] rounded-md hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                >
                  View all {filteredResorts.length.toLocaleString()} matching areas →
                </button>
              )}
            </div>
          ) : (
            displayedResorts.map((r) => {
              const isSelected = r.id === selectedResortId;
              const snow7d = r.weather?.snowfall_7d_in ?? 0;
              const badge = getCategoryBadge(r.category);
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    if (isSelected) {
                      setPanelView('profile');
                    } else {
                      handleSelectResort(r.id);
                    }
                  }}
                  className={`p-3 rounded-lg transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-[#FAF8F3] border-2 border-[#1C1B18] ring-1 ring-[#1C1B18] shadow-md'
                      : 'bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#A8A299] hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-[#1C1B18] tracking-tight truncate">
                          {r.name}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border} shrink-0`}>
                          {badge.icon} {badge.label}
                        </span>
                        {r.pass_networks && r.pass_networks.length > 0 && r.pass_networks[0] !== 'Independent' && (
                          <span
                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded border shrink-0 text-white shadow-2xs"
                            style={{
                              backgroundColor: PASS_COLORS[r.pass_networks[0]] || '#8A847C',
                              borderColor: PASS_COLORS[r.pass_networks[0]] || '#8A847C',
                            }}
                          >
                            {PASS_SHORT_LABELS[r.pass_networks[0]] || r.pass_networks[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#5C5852] font-medium mt-1 flex items-center flex-wrap gap-x-1.5">
                        <span>{r.region ? `${r.region}, ` : ''}{r.country}</span>
                        {r.category !== 'nordic' && r.vertical_drop_ft && r.vertical_drop_ft > 0 && ` · ${formatVert(r.vertical_drop_ft)}`}
                        {r.category !== 'nordic' && r.skiable_acres > 0 && ` · ${formatAcres(r.skiable_acres)}`}
                        {r.avg_snowfall_in && r.avg_snowfall_in > 0 && ` · ${formatSnow(r.avg_snowfall_in)}/yr`}
                        {r.category === 'nordic' && (
                          <>
                            {r.trail_km && r.trail_km > 0 ? ` · ${formatDistance(r.trail_km)}` : ''}
                            {r.run_count && r.run_count > 0 ? ` (${r.run_count} trails)` : ''}
                            {r.vertical_drop_ft && r.vertical_drop_ft > 0 ? ` · ${formatVert(r.vertical_drop_ft)} vert` : ''}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Live Upcoming Snowfall Forecast Chip */}
                    {r.weather?.is_live && (
                      <div className="shrink-0 flex items-center text-xs">
                        <span
                          className={`px-2 py-1 rounded-md border flex items-center gap-1 text-xs font-bold ${
                            snow7d > 0
                              ? 'bg-[#3B627E]/10 border-[#3B627E]/40 text-[#3B627E]'
                              : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C]'
                          }`}
                          title="Upcoming 7-day forecast snowfall"
                        >
                          <Snowflake className="w-3 h-3 text-[#3B627E]" />
                          <span>{formatSnow(snow7d)}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-[#D6D0C2] flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPanelView('profile');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1C1B18] hover:bg-[#33312B] text-[#FAF8F3] text-xs font-bold rounded transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Mountain Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  /* =========================================================================
     RENDER: EDWARD TUFTE × BERANN DAYLIGHT CARTOGRAPHY
     ========================================================================= */

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F7F4ED] text-[#1C1B18] font-sans select-none">
      {/* 3D MAP CANVAS (ALWAYS 100% INSET-0, NEVER BLANK ON START) */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full z-0 bg-[#E8EFF2]"
      />

      {/* EDITORIAL TOP BAR (WARM COTTON RAG PAPER & SERIF TITLE - NO VANITY PADDING) */}
      <header className="absolute top-0 inset-x-0 z-40 h-11 flex items-center justify-between px-4 bg-[#F7F4ED] border-b border-[#D6D0C2]">
        <div className="flex items-center min-w-0">
          {/* Tracked Mountain Editorial Wordmark with Alpine Snow Globe Crest in the center */}
          <div className="flex items-center select-none shrink-0">
            <span className="font-bold tracking-[0.16em] text-[17px] uppercase text-[#1C1B18] leading-none">
              SNOW
            </span>

            {/* Alpine Snow Globe Crest in between SNOW and GLOBE */}
            <svg
              className="w-6.5 h-6.5 mx-2.5 shrink-0 -mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Glass Sphere Dome */}
              <circle cx="12" cy="10.5" r="8" stroke="#1C1B18" strokeWidth="1.3" />
              {/* Pedestal Base */}
              <path d="M7 20H17" stroke="#1C1B18" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M8.5 18.5L7 20M15.5 18.5L17 20" stroke="#1C1B18" strokeWidth="1.2" strokeLinecap="round" />
              {/* Alpine Mountain Silhouette inside Dome */}
              <path d="M6 16L10.5 10L13.5 14L15 12L18 16" stroke="#5C5852" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Vermilion Summit Accent */}
              <polygon points="10.5,10 12,12 9,12" fill="#B84A39" />
              {/* Drifting Snow Crystals */}
              <circle cx="10" cy="6" r="0.75" fill="#B84A39" />
              <circle cx="14.5" cy="7.2" r="0.65" fill="#8A847C" />
              <circle cx="7.5" cy="9.5" r="0.5" fill="#8A847C" />
            </svg>

            <span className="font-bold tracking-[0.16em] text-[17px] uppercase text-[#1C1B18] leading-none">
              GLOBE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium">
          {/* Display & Filters Popover Trigger & Floating Panel */}
          <div className="relative" ref={filtersMenuRef}>
            <button
              onClick={() => setFiltersMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                filtersMenuOpen || activeFiltersCount > 0
                  ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
                  : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
              }`}
              title="Display Settings & Resort Filters"
              aria-label="Display Settings & Resort Filters"
              aria-expanded={filtersMenuOpen}
            >
              <Sliders className="w-3.5 h-3.5 text-[#5C5852]" />
              <span className="hidden sm:inline">Display & Filters</span>
              <span className="sm:hidden">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#1C1B18] text-[#FAF8F3] text-[9.5px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Popover Panel */}
            {filtersMenuOpen && (
              <div className="fixed inset-x-3 top-13 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-92 max-h-[calc(100vh-70px)] sm:max-h-[calc(100vh-64px)] overflow-y-auto bg-[#FAF8F3] border border-[#D6D0C2] rounded-lg shadow-xl p-3.5 z-50 text-[#1C1B18] space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D6D0C2]">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#5C5852]" />
                    <span className="font-bold text-sm text-[#1C1B18] tracking-tight">Display & Filters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={handleResetFilters}
                        className="text-[#B84A39] hover:underline cursor-pointer text-xs font-bold"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => setFiltersMenuOpen(false)}
                      className="p-1 hover:bg-[#EFECE4] text-[#8A847C] hover:text-[#1C1B18] rounded-md transition-colors cursor-pointer"
                      title="Close panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Display Settings Section */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-[#5C5852] uppercase tracking-wider">
                    Display
                  </div>

                  {/* Projection Segmented */}
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5852] font-medium">Earth Projection</div>
                    <div className="grid grid-cols-2 gap-1 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md p-0.5">
                      <button
                        onClick={() => {
                          setEarthProjection('globe');
                          if (mapRef.current && mapRef.current.getZoom() < 5) {
                            safeEaseTo(mapRef.current, { pitch: 0, duration: 400 });
                            setMapPitch(0);
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                          earthProjection === 'globe'
                            ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                            : 'text-[#736E67] hover:text-[#1C1B18]'
                        }`}
                        title="3D Globe Projection"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>3D Globe</span>
                      </button>
                      <button
                        onClick={() => setEarthProjection('mercator')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                          earthProjection === 'mercator'
                            ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                            : 'text-[#736E67] hover:text-[#1C1B18]'
                        }`}
                        title="Flat Map Projection"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Flat Map</span>
                      </button>
                    </div>
                  </div>

                  {/* Unit System Segmented */}
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5852] font-medium">Units of Measure</div>
                    <div className="grid grid-cols-2 gap-1 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md p-0.5">
                      <button
                        onClick={() => handleSetUnitsMetric(false)}
                        className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                          !unitsMetric
                            ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                            : 'text-[#736E67] hover:text-[#1C1B18]'
                        }`}
                        title="Imperial Units (ft, in, °F)"
                      >
                        Imperial (ft, in, °F)
                      </button>
                      <button
                        onClick={() => handleSetUnitsMetric(true)}
                        className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                          unitsMetric
                            ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                            : 'text-[#736E67] hover:text-[#1C1B18]'
                        }`}
                        title="Metric Units (m, cm, °C)"
                      >
                        Metric (m, cm, °C)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#D6D0C2]" />

                {/* Resort Filters Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#5C5852] uppercase tracking-wider">
                      Resort Filters
                    </span>
                    <span className="text-xs text-[#736E67] font-semibold tabular-nums">
                      {filteredResorts.length.toLocaleString()} matching
                    </span>
                  </div>

                  {/* Categories */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setShowDownhill(!showDownhill)}
                      className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        showDownhill
                          ? 'bg-[#3B627E]/10 border-[#3B627E] text-[#3B627E] shadow-2xs'
                          : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
                      }`}
                      title={`Toggle Downhill Ski Areas (${categoryFilterCounts.downhill.toLocaleString()})`}
                    >
                      <span className="truncate">⛷️ Downhill</span>
                    </button>
                    <button
                      onClick={() => setShowNordic(!showNordic)}
                      className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        showNordic
                          ? 'bg-[#2E5A44]/10 border-[#2E5A44] text-[#2E5A44] shadow-2xs'
                          : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
                      }`}
                      title={`Toggle Nordic Centers (${categoryFilterCounts.nordic.toLocaleString()})`}
                    >
                      <span className="truncate">🎿 Nordic</span>
                    </button>
                    <button
                      onClick={() => setShowHeliCat(!showHeliCat)}
                      className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        showHeliCat
                          ? 'bg-[#B84A39]/10 border-[#B84A39] text-[#B84A39] shadow-2xs'
                          : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
                      }`}
                      title={`Toggle Guided Heli/Cat Operations (${categoryFilterCounts.heli_cat.toLocaleString()})`}
                    >
                      <span className="truncate">🚁 Heli/Cat</span>
                    </button>
                  </div>

                  {/* Pass Networks */}
                  <div className="space-y-1.5 pt-1 border-t border-[#D6D0C2]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] text-[#4A463F] font-semibold">Pass Networks</span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          onClick={() => setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'])}
                          className="text-[#5C5852] hover:text-[#1C1B18] hover:underline cursor-pointer font-medium"
                        >
                          All
                        </button>
                        <span className="text-[#D6D0C2]">·</span>
                        <button
                          onClick={() => setSelectedPasses([])}
                          className="text-[#5C5852] hover:text-[#1C1B18] hover:underline cursor-pointer font-medium"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'] as PassNetwork[]).map((pass) => {
                        const active = selectedPasses.includes(pass);
                        const color = PASS_COLORS[pass];
                        const label = PASS_SHORT_LABELS[pass] || pass;
                        return (
                          <button
                            key={pass}
                            onClick={() => {
                              setSelectedPasses((prev) => {
                                if (prev.length === 5) {
                                  return [pass];
                                }
                                if (prev.length === 1 && prev.includes(pass)) {
                                  return ['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'];
                                }
                                return prev.includes(pass) ? prev.filter((p) => p !== pass) : [...prev, pass];
                              });
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                              active
                                ? 'bg-[#FAF8F3] border-[#1C1B18] text-[#1C1B18] shadow-2xs'
                                : 'bg-[#F2EFE8] border-[#D6D0C2] text-[#8A847C] opacity-60 hover:opacity-100'
                            }`}
                            title={PASS_DISPLAY_NAMES[pass] || `Filter by ${label}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Downhill Sliders */}
                  {showDownhill && (
                    <>
                      {/* Min Vertical Drop Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[12.5px] text-[#4A463F] font-semibold">Min Vertical Drop</span>
                          <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                            {unitsMetric
                              ? (minVerticalM > 0 ? `${minVerticalM.toLocaleString()} m` : 'Any')
                              : (minVerticalFt > 0 ? `${minVerticalFt.toLocaleString()}'` : 'Any')}
                          </span>
                        </div>
                        {unitsMetric ? (
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="1500"
                              step="50"
                              value={minVerticalM}
                              onChange={(e) => setMinVerticalM(Number(e.target.value))}
                              className="w-full tufte-slider cursor-pointer"
                              aria-label="Minimum vertical drop filter in meters"
                            />
                            <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                              <span>Any</span>
                              <span>300m</span>
                              <span>600m</span>
                              <span>1,000m</span>
                              <span>1,500m</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="4000"
                              step="100"
                              value={minVerticalFt}
                              onChange={(e) => setMinVerticalFt(Number(e.target.value))}
                              className="w-full tufte-slider cursor-pointer"
                              aria-label="Minimum vertical drop filter in feet"
                            />
                            <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                              <span>Any</span>
                              <span>1,000'</span>
                              <span>2,000'</span>
                              <span>3,000'</span>
                              <span>4,000'</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Min Skiable Area Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[12.5px] text-[#4A463F] font-semibold">
                            {unitsMetric ? 'Min Skiable Area' : 'Min Skiable Acres'}
                          </span>
                          <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                            {unitsMetric
                              ? (minAreaHa > 0 ? `${minAreaHa.toLocaleString()} ha` : 'Any')
                              : (minAreaAcres > 0 ? `${minAreaAcres.toLocaleString()} ac` : 'Any')}
                          </span>
                        </div>
                        {unitsMetric ? (
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="1200"
                              step="25"
                              value={minAreaHa}
                              onChange={(e) => setMinAreaHa(Number(e.target.value))}
                              className="w-full tufte-slider cursor-pointer"
                              aria-label="Minimum skiable area filter in hectares"
                            />
                            <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                              <span>Any</span>
                              <span>200 ha</span>
                              <span>500 ha</span>
                              <span>800 ha</span>
                              <span>1,200 ha</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="3000"
                              step="100"
                              value={minAreaAcres}
                              onChange={(e) => setMinAreaAcres(Number(e.target.value))}
                              className="w-full tufte-slider cursor-pointer"
                              aria-label="Minimum skiable acreage filter in acres"
                            />
                            <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                              <span>Any</span>
                              <span>500 ac</span>
                              <span>1,000 ac</span>
                              <span>2,000 ac</span>
                              <span>3,000 ac</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Nordic Network Slider */}
                  {showNordic && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[12.5px] text-[#4A463F] font-semibold">
                          {showDownhill ? 'Min Nordic Network' : 'Min Trail Network'}
                        </span>
                        <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                          {unitsMetric
                            ? (minNordicKm > 0 ? `${minNordicKm} km` : 'Any')
                            : (minNordicMi > 0 ? `${minNordicMi} mi` : 'Any')}
                        </span>
                      </div>
                      {unitsMetric ? (
                        <div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={minNordicKm}
                            onChange={(e) => setMinNordicKm(Number(e.target.value))}
                            className="w-full tufte-slider cursor-pointer"
                            aria-label="Minimum nordic trail network filter in kilometers"
                          />
                          <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                            <span>Any</span>
                            <span>25 km</span>
                            <span>50 km</span>
                            <span>75 km</span>
                            <span>100 km</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="range"
                            min="0"
                            max="60"
                            step="5"
                            value={minNordicMi}
                            onChange={(e) => setMinNordicMi(Number(e.target.value))}
                            className="w-full tufte-slider cursor-pointer"
                            aria-label="Minimum nordic trail network filter in miles"
                          />
                          <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                            <span>Any</span>
                            <span>15 mi</span>
                            <span>30 mi</span>
                            <span>45 mi</span>
                            <span>60 mi</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="h-7 w-7 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-md transition-colors cursor-pointer flex items-center justify-center"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 text-[#5C5852]" />
            ) : (
              <Maximize className="w-3.5 h-3.5 text-[#5C5852]" />
            )}
          </button>
        </div>
      </header>

      {/* DESKTOP UNIFIED MOUNTAIN GUIDE (LEFT DOCK) */}
      <div
        className={`hidden md:flex absolute top-11 bottom-0 left-0 z-30 flex-col transition-transform duration-300 ease-in-out pointer-events-none ${
          leftDockOpen ? 'w-80 md:w-96 translate-x-0' : 'w-80 md:w-96 -translate-x-full'
        }`}
      >
        <div className="relative flex flex-col h-full bg-[#F7F4ED] border-r border-[#D6D0C2] shadow-2xl overflow-hidden pointer-events-auto">
          {panelView === 'profile' && selectedResort
            ? renderProfileContent(selectedResort)
            : renderDirectoryContent()}
        </div>

        {/* Tray Edge Pull Tab */}
        <button
          onClick={() => setLeftDockOpen(!leftDockOpen)}
          className="absolute top-0 bottom-0 left-full pointer-events-auto z-40 flex items-center justify-center w-5 bg-[#FAF8F3] hover:bg-[#EFECE4] border-r border-[#D6D0C2] hover:border-[#8A847C] shadow-[2px_0_6px_rgba(0,0,0,0.06)] transition-colors cursor-pointer group"
          title={leftDockOpen ? "Collapse directory tray" : "Open directory tray"}
          aria-label={leftDockOpen ? "Collapse directory tray" : "Open directory tray"}
        >
          <div className="flex items-center justify-center w-4 h-8 rounded-md group-hover:bg-[#E5E0D5] transition-colors">
            <svg
              className="w-2.5 h-3 text-[#5A554E] group-hover:text-[#1C1B18] transition-colors"
              viewBox="0 0 8 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {leftDockOpen ? (
                <polyline points="5.5 1.5 2 5 5.5 8.5" />
              ) : (
                <polyline points="2.5 1.5 6 5 2.5 8.5" />
              )}
            </svg>
          </div>
        </button>
      </div>

      {/* MOBILE UNIFIED MOUNTAIN GUIDE (BOTTOM SHEET) */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#F7F4ED] rounded-t-2xl border-t border-[#D6D0C2] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out ${
          mobileSheetState === 'peek'
            ? 'h-20'
            : mobileSheetState === 'half'
            ? 'h-[50vh]'
            : 'h-[88vh]'
        }`}
      >
        {/* Pull tab / Drag handle pill */}
        <div
          onClick={() => {
            setMobileSheetState((prev) => (prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'));
          }}
          className="w-full py-2 flex items-center justify-center cursor-pointer shrink-0"
        >
          <div className="w-10 h-1.5 rounded-full bg-[#C4BEB1] hover:bg-[#8A847C] transition-colors" />
        </div>

        {mobileSheetState === 'peek' ? (
          /* Mobile Peek Glance */
          <div
            onClick={() => setMobileSheetState('half')}
            className="flex items-center justify-between px-4 pb-3 cursor-pointer select-none flex-1"
          >
            {selectedResort ? (
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-sm text-[#1C1B18] truncate">
                    {selectedResort.name}
                  </span>
                  <span className="text-[11px] font-semibold text-[#5C5852] truncate">
                    · {selectedResort.country}
                  </span>
                </div>
                <div className="text-xs text-[#5C5852] font-medium truncate mt-0.5">
                  {selectedResort.vertical_drop_ft && selectedResort.vertical_drop_ft > 0
                    ? `${formatVert(selectedResort.vertical_drop_ft)} vert · `
                    : ''}
                  {selectedResort.weather?.snowfall_7d_in
                    ? `${formatSnow(selectedResort.weather.snowfall_7d_in)} 7d snow`
                    : 'Tap for Mountain Profile'}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#5C5852] min-w-0 flex-1 pr-2">
                <Search className="w-4 h-4 text-[#8A847C] shrink-0" />
                <span className="font-bold text-sm text-[#1C1B18] truncate">
                  {filteredResorts.length.toLocaleString()} ski areas
                </span>
                {activeFiltersCount > 0 && (
                  <span className="bg-[#EAE5D9] text-[#1C1B18] border border-[#A8A299] text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums shrink-0">
                    {activeFiltersCount} active
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileSheetState('half');
                }}
                className="p-1.5 rounded-md bg-[#FAF8F3] border border-[#D6D0C2] text-[#1C1B18] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                title="Expand panel"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Mobile Half or Full Sheet */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Sheet Control Strip (Shown in Directory view; Profile view integrates controls in its header) */}
            {panelView === 'directory' && (
              <div className="px-3.5 py-1.5 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center justify-between shrink-0 select-none">
                <span className="text-xs font-bold text-[#1C1B18] uppercase tracking-wider truncate">
                  Mountain Directory ({filteredResorts.length.toLocaleString()})
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  {mobileSheetState === 'half' ? (
                    <button
                      onClick={() => setMobileSheetState('full')}
                      className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                      title="Expand to Fullscreen"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setMobileSheetState('half')}
                      className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                      title="Collapse to Half"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setMobileSheetState('peek')}
                    className="p-1 text-[#8A847C] hover:text-[#1C1B18] rounded cursor-pointer"
                    title="Minimize to Peek"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Content inside sheet */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {panelView === 'profile' && selectedResort
                ? renderProfileContent(selectedResort)
                : renderDirectoryContent()}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING TOP-LEFT MAP VIEWPORT CONTROLS: NORTH ARROW & ZOOM */}
      <div
        className={`absolute top-14 left-3 md:left-8 ${
          leftDockOpen ? 'md:left-[420px]' : 'md:left-8'
        } z-20 flex flex-col bg-[#FAF8F3] border border-[#D6D0C2] rounded-md shadow-sm divide-y divide-[#D6D0C2] overflow-hidden transition-all duration-300 ease-in-out`}
        role="group"
        aria-label="Map navigation controls"
      >
        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
        </button>

        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus className="w-3.5 h-3.5" strokeWidth={2.2} />
        </button>

        {/* Reorient North Button (Solid Cartographic Arrow in Muted Grayish Stone, No Mini N) */}
        <button
          onClick={handleResetNorth}
          className="w-8 h-8 flex items-center justify-center text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer group"
          title="Reorient to True North (0°)"
          aria-label="Reorient to True North"
        >
          <svg
            className="w-3.5 h-3.5 pointer-events-none transition-transform duration-150 ease-out"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ transform: `rotate(${-mapBearing}deg)`, transformOrigin: 'center' }}
          >
            {/* Solid Cartographic North Arrow in muted grayish stone */}
            <polygon points="12,2.5 19,20.5 12,16.5 5,20.5" />
          </svg>
        </button>
      </div>

      {/* FLOATING TOP-RIGHT CARTO CONTROLS: BASEMAP POPOVER */}
      <div
        ref={basemapMenuRef}
        className="absolute top-14 right-3 md:right-4 z-20 flex items-center gap-2 transition-all duration-300"
      >
        {/* Basemap Styles & Earth Projection Dropdown Anchor */}
        <div className="relative">
          <button
            onClick={() => setMapMenuOpen(!mapMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              mapMenuOpen
                ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-semibold'
                : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
            }`}
            title="Basemap Styles & Earth Projection"
          >
            <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
            <span className="text-xs font-semibold">Basemap</span>
          </button>

          {mapMenuOpen && (
            <div className="absolute right-0 top-10 w-80 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md p-3.5 space-y-3 z-30 text-xs shadow-xl animate-in fade-in duration-150 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
                  <span className="text-xs font-bold text-[#1C1B18] tracking-tight">
                    Cartographic Controls
                  </span>
                </div>
                <button
                  onClick={() => setMapMenuOpen(false)}
                  className="p-0.5 text-[#8A847C] hover:text-[#1C1B18] cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* BASEMAP STYLE SELECTION */}
              <div>
                <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider mb-1.5">
                  Cartographic Base
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'satellite', label: 'Satellite 3D' },
                    { id: 'osm', label: 'OpenStreetMap' },
                    { id: 'topo', label: 'Alpine Topo' },
                  ].map((item) => {
                    const isSelected = basemapMode === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setBasemapMode(item.id as BasemapMode)}
                        className={`w-full flex items-center justify-between p-2 rounded-md border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                            : 'bg-[#F7F4ED] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4] font-medium'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#EAE5D9] text-[#1C1B18] border border-[#A8A299]">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3D TERRAIN RELIEF (DEM EXAGGERATION MULTIPLIER) */}
              <div className="pt-2.5 border-t border-[#D6D0C2] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                    Terrain Relief Multiplier
                  </span>
                  <span className="text-xs font-bold text-[#1C1B18] tabular-nums">
                    {terrainExaggeration.toFixed(2)}×
                  </span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.05"
                    value={terrainExaggeration}
                    onChange={(e) => handleTerrainExaggerationChange(parseFloat(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="3D terrain relief vertical exaggeration multiplier"
                  />

                  {/* Preset Quick Toggles */}
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { label: 'Flat (0×)', val: 0.0 },
                      { label: '0.7×', val: 0.7 },
                      { label: '1.0×', val: 1.0 },
                      { label: 'Alpine (2×)', val: 2.0 },
                    ].map((preset) => {
                      const isActive = Math.abs(terrainExaggeration - preset.val) < 0.04;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleTerrainExaggerationChange(preset.val)}
                          className={`py-1 px-1 text-center rounded-[4px] border text-[10px] transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                              : 'bg-[#F7F4ED] text-[#5C5852] border-[#D6D0C2] hover:bg-[#EFECE4] hover:text-[#1C1B18] font-medium'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARTOGRAPHIC MAP FURNITURE: ALTERNATING BAR SCALE & LEGEND */}
      <div ref={mapLegendRef} className={`hidden md:block absolute bottom-5 ${leftDockOpen ? 'left-88 md:left-106' : 'left-8'} z-20 transition-all duration-300 select-none`}>
        {mapLegendOpen && (
          <div className="absolute bottom-11 left-0 w-72 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md p-3.5 space-y-3 z-30 text-xs shadow-xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-2">
              <span className="text-xs font-bold text-[#1C1B18] tracking-tight">Cartographic Key</span>
              <button onClick={() => setMapLegendOpen(false)} className="text-[#8A847C] hover:text-[#1C1B18]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Piste Key */}
            <div className="space-y-1.5 text-xs text-[#5C5852] font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-xs bg-[#2E7D32]" />
                <span>Novice (Green)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-xs bg-[#1565C0]" />
                <span>Intermediate (Blue)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-xs bg-[#1C1B18]" />
                <span>Advanced (Black)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-xs bg-[#B84A39]" />
                <span>Expert / Freeride (Double Black)</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-[#D6D0C2]">
                <span className="w-3 border-t-2 border-dashed border-[#B84A39]" />
                <span>Aerialway / Ski Lift</span>
              </div>
            </div>
            {/* Navigation & Gesture Guide */}
            <div className="pt-2 border-t border-[#D6D0C2] text-xs text-[#5C5852] space-y-1">
              <div><strong className="font-semibold text-[#1C1B18]">Trackpad:</strong> Pinch zoom · ⌥+scroll or right-drag rotate · Shift+scroll tilt</div>
              <div><strong className="font-semibold text-[#1C1B18]">Tablet:</strong> 2-finger pinch & rotate · 2-finger drag tilt</div>
              <div><strong className="font-semibold text-[#1C1B18]">Keyboard:</strong> W/S tilt · A/D rotate · Arrows pan</div>
            </div>
          </div>
        )}

        {/* Alternating Scale Bar */}
        <div className="flex items-center gap-2.5 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md px-3 py-1.5 text-xs font-semibold text-[#1C1B18] shadow-xs">
          <button
            onClick={() => setMapLegendOpen(!mapLegendOpen)}
            className="flex items-center gap-1 text-[#5C5852] hover:text-[#1C1B18] transition-colors cursor-pointer mr-0.5"
            title="Toggle Map Key & Controls"
          >
            <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
            <span className="font-semibold hover:underline">Key</span>
          </button>
          <div className="h-3 w-px bg-[#D6D0C2]" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold tabular-nums text-[#1C1B18]">{mapScale.distStr}</span>
            <div className="flex h-1.5 border border-[#BDB7A9] rounded-[1px] overflow-hidden" style={{ width: `${mapScale.barWidth}px` }}>
              <div className="h-full bg-[#5C5852] flex-1" />
              <div className="h-full bg-[#FAF8F3] flex-1" />
              <div className="h-full bg-[#5C5852] flex-1" />
              <div className="h-full bg-[#FAF8F3] flex-1" />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          UNIFIED CARTOGRAPHIC NAVIGATION GIMBAL & COMPASS INSTRUMENT
          Integrated concentric dual-action dial:
          - Outer Ring (Ø 66px): Rotary Compass heading & True North snap
          - Inner Core (Ø 38px): 3D Horizon gimbal & 2D/3D perspective tilt
          ===================================================================== */}
      <div
        className="hidden md:block absolute bottom-8 right-6 z-20 select-none transition-all duration-300"
      >
        <div
          className="relative w-[66px] h-[66px] rounded-full bg-[#FAF8F3] border border-[#D6D0C2] shadow-sm flex items-center justify-center p-0"
          title="Navigation Instrument: Outer ring controls heading (click to reset North) · Inner disc controls 3D tilt & perspective"
        >
          {/* 1. OUTER ROTARY COMPASS BEZEL (HEADING / BEARING) */}
          <div
            onMouseDown={handleCompassMouseDown}
            onClick={handleResetNorth}
            className={`absolute inset-0 rounded-full flex items-center justify-center cursor-pointer transition-all ${
              isCompassDragging ? 'cursor-grabbing scale-[1.02] ring-1 ring-[#1C1B18]' : 'cursor-grab hover:bg-[#F2EFE8]'
            }`}
          >
            {/* Dynamic Rotating SVG Bezel */}
            <svg
              className="w-full h-full pointer-events-none transition-transform ease-out"
              viewBox="0 0 66 66"
              style={{
                transform: `rotate(${-mapBearing}deg)`,
                transitionDuration: isCompassDragging ? '0ms' : '150ms',
              }}
            >
              {/* Soft Calibration Ring */}
              <circle cx="33" cy="33" r="28" fill="none" stroke="#EAE5D9" strokeWidth="1" />

              {/* Cardinal North Indicator (Alpine Vermilion #B84A39) */}
              <polygon points="33,5 36,11 33,9.5 30,11" fill="#B84A39" />
              <text
                x="33"
                y="18.5"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fill="#B84A39"
              >
                N
              </text>

              {/* Minimal Cardinal Ticks at East, South, West */}
              <line x1="56" y1="33" x2="60" y2="33" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
              <line x1="33" y1="56" x2="33" y2="60" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
              <line x1="6" y1="33" x2="10" y2="33" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>

          {/* 2. INNER 3D HORIZON & PITCH GIMBAL DISC */}
          <div
            onMouseDown={handleTiltMouseDown}
            onClick={handleToggle3D}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!mapRef.current) return;
              safeEaseTo(mapRef.current, { bearing: 0, pitch: 0, duration: 400 });
              setMapBearing(0);
              setMapPitch(0);
              mapRef.current.setRenderWorldCopies(false);
            }}
            className={`relative z-10 w-[38px] h-[38px] rounded-full bg-[#FAF8F3] border border-[#D6D0C2] shadow-2xs flex items-center justify-center transition-all ${
              isTiltDragging
                ? 'cursor-grabbing scale-105 ring-1 ring-[#1C1B18]'
                : 'cursor-grab hover:bg-[#EFECE4]'
            }`}
            title="Navigation Gimbal: Drag horizontally to rotate heading · Drag vertically to tilt pitch · Click to toggle 2D/3D · Double-click to flatten"
          >
            {/* SVG Perimeter Ring & Dynamic Pitch Arc Meter */}
            <svg className="w-[32px] h-[32px] pointer-events-none" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13.5" fill="none" stroke="#EAE5D9" strokeWidth="1" />
              {/* Pitch Arc Angle Meter */}
              <circle
                cx="16"
                cy="16"
                r="13.5"
                fill="none"
                stroke="#B84A39"
                strokeWidth="1.5"
                strokeDasharray={`${(mapPitch / 85) * 34} 100`}
                strokeLinecap="round"
                transform="rotate(-90 16 16)"
                opacity={is3D ? 0.9 : 0}
              />
            </svg>

            {/* Viewing Angle Display - Strictly Centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-[11px] font-bold tabular-nums text-[#1C1B18] tracking-tight leading-none">
                {is3D ? `${mapPitch}°` : '2D'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAP DATA ATTRIBUTION (COLLAPSIBLE ARCHIVAL PAPER AT BOTTOM RIGHT) */}
      <div
        ref={attributionRef}
        className="absolute bottom-2 right-3 md:right-6 z-20 transition-all duration-300 pointer-events-auto select-none"
      >
        {!attributionOpen ? (
          <button
            onClick={() => setAttributionOpen(true)}
            className="flex items-center justify-center w-5 h-5 rounded-md bg-[#FAF8F3]/90 hover:bg-[#FAF8F3] backdrop-blur-xs border border-[#D6D0C2] hover:border-[#1C1B18] text-[#5C5852] hover:text-[#1C1B18] shadow-xs transition-colors cursor-pointer"
            title="Map Attribution & Data Sources"
            aria-label="Toggle map attribution"
          >
            <span className="font-sans italic font-bold text-[11px] leading-none">i</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-[9.5px] font-medium px-2 py-0.5 rounded-md bg-[#FAF8F3]/95 backdrop-blur-xs border border-[#D6D0C2] text-[#8A847C] shadow-sm animate-in fade-in duration-150">
            <button
              onClick={() => setAttributionOpen(false)}
              className="text-[#5C5852] hover:text-[#1C1B18] cursor-pointer font-sans italic font-bold text-[10px] pr-0.5"
              title="Collapse attribution"
            >
              i
            </button>
            <span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">OpenStreetMap</a></span>
            <span>·</span>
            <span><a href="https://openskidata.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">OpenSkiData</a></span>
            <span>·</span>
            <span><a href="https://www.esri.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">Esri</a></span>
            <span>·</span>
            <span><a href="https://github.com/tilezen/joerd" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">Mapterhorn</a></span>
            <button
              onClick={() => setAttributionOpen(false)}
              className="ml-0.5 text-[#8A847C] hover:text-[#1C1B18] cursor-pointer"
              title="Close attribution"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

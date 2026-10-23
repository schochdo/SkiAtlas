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
  const totalLifts = Object.values(lifts).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);

  let category: SkiActivityCategory = 'downhill';
  if (nordicRuns > 0 && downhillRuns === 0 && totalLifts === 0) {
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
  if (totalLifts > 0) {
    infrastructure = `${totalLifts} Lift${totalLifts > 1 ? 's' : ''}`;
  } else if (category === 'nordic') {
    infrastructure = 'Cross-Country Nordic Center';
  }

  return {
    category,
    archetype: category === 'nordic' ? 'Nordic Center' : 'Downhill Alpine',
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
  if (lowerName.includes('jackson hole') || lowerName.includes('palisades') || lowerName.includes('mammoth') || lowerName.includes('alta') || lowerName.includes('snowbird') || lowerName.includes('big sky')) {
    return ['Ikon'];
  }
  return ['Independent'];
}

/* =========================================================================
   CURATED SEED RESORTS & HELI/CAT OPERATIONS
   ========================================================================= */

export const GLOBAL_SKI_ATLAS: SkiResort[] = [
  // US Rockies & Intermountain
  {
    id: 'jackson-hole',
    lift_count: 13,
    run_count: 133,
    name: 'Jackson Hole',
    region: 'Wyoming',
    country: 'USA',
    lat: 43.5875,
    lng: -110.8279,
    default_bearing: 255, // looking from valley up to Rendezvous Peak
    base_elev_ft: 6311,
    summit_elev_ft: 10450,
    vertical_drop_ft: 4139,
    skiable_acres: 2500,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Aerial Tram, 2 Gondolas, 10 Quads',
    archetype: 'Steep Alpine',
    summary: 'Legendary steep and deep fall-line terrain where mountaineers, film crews, and icons have skied, crowned by Corbet\'s Couloir and the 4,139-foot vertical drop of the Aerial Tram.',
  },
  {
    id: 'grand-targhee',
    lift_count: 5,
    run_count: 95,
    name: 'Grand Targhee',
    region: 'Wyoming',
    country: 'USA',
    lat: 43.7901,
    lng: -110.9578,
    default_bearing: 285,
    base_elev_ft: 7851,
    summit_elev_ft: 9862,
    vertical_drop_ft: 2011,
    skiable_acres: 2602,
    pass_networks: ['Mountain Collective', 'Indy'],
    infrastructure: '5 Quad Chairs',
    archetype: 'Powder / Tree Glades',
    summary: 'Uncrowded powder sanctuary on the western slope of the Tetons, celebrated for reliable, storm-blanketed snow cycles, open alpine bowls, and gladed tree skiing.',
  },
  {
    id: 'snowbird',
    lift_count: 11,
    run_count: 140,
    name: 'Snowbird',
    region: 'Utah',
    country: 'USA',
    lat: 40.5815,
    lng: -111.656,
    default_bearing: 195,
    base_elev_ft: 7760,
    summit_elev_ft: 11000,
    vertical_drop_ft: 3240,
    skiable_acres: 2500,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Aerial Tram, 6 High-Speed Quads',
    archetype: 'Steep Alpine',
    summary: 'Formidable high-alpine cirques and relentless powder steeps plunging off the 11,000-ft Hidden Peak Tram, blessed with over 500 inches of Wasatch storm totals.',
  },
  {
    id: 'alta',
    lift_count: 6,
    run_count: 116,
    name: 'Alta',
    region: 'Utah',
    country: 'USA',
    lat: 40.5883,
    lng: -111.6378,
    default_bearing: 175,
    base_elev_ft: 8530,
    summit_elev_ft: 11068,
    vertical_drop_ft: 2538,
    skiable_acres: 2614,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: '6 Quads, Skiers Only',
    archetype: 'Powder / Tree Glades',
    summary: 'Historic, skiers-only sanctuary in Little Cottonwood Canyon revered worldwide for 500+ inches of pristine Utah blower powder, timeless lodge culture, and purist alpine ethos.',
  },
  {
    id: 'powder-mountain',
    lift_count: 9,
    run_count: 154,
    name: 'Powder Mountain',
    region: 'Utah',
    country: 'USA',
    lat: 41.38,
    lng: -111.78,
    default_bearing: 85,
    base_elev_ft: 6900,
    summit_elev_ft: 9422,
    vertical_drop_ft: 2522,
    skiable_acres: 8464,
    pass_networks: ['Indy', 'Independent'],
    infrastructure: 'Fixed-Grip Quads & Snowcats',
    archetype: 'Uncrowded / Soul Hill',
    summary: 'Sprawling, uncrowded giant spanning over 8,400 skiable acres across the Wasatch, capping daily lift tickets to preserve vast fields of untracked powder.',
  },
  {
    id: 'vail',
    lift_count: 33,
    run_count: 193,
    name: 'Vail',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6061,
    lng: -106.355,
    default_bearing: 180,
    base_elev_ft: 8120,
    summit_elev_ft: 11570,
    vertical_drop_ft: 3450,
    skiable_acres: 5317,
    pass_networks: ['Epic'],
    infrastructure: '2 Gondolas, 20+ Express Chairs',
    archetype: 'Flagship Mega-Resort',
    summary: 'A vast alpine kingdom spanning seven miles of legendary Back Bowls and Blue Sky Basin, defining modern American destination ski culture since 1962.',
  },
  {
    id: 'aspen-snowmass',
    lift_count: 43,
    run_count: 336,
    name: 'Aspen Snowmass',
    region: 'Colorado',
    country: 'USA',
    lat: 39.2084,
    lng: -106.949,
    default_bearing: 215,
    base_elev_ft: 8104,
    summit_elev_ft: 12510,
    vertical_drop_ft: 4406,
    skiable_acres: 3342,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: '3 Gondolas, High-Speed Modern',
    archetype: 'Flagship Mega-Resort',
    summary: 'Storied 19th-century silver-mining town turned cultural alpine capital, beloved by artists, celebrities, and mountaineers for Highland Bowl powder hikes and Ajax fall lines.',
  },
  {
    id: 'steamboat',
    lift_count: 17,
    run_count: 170,
    name: 'Steamboat',
    region: 'Colorado',
    country: 'USA',
    lat: 40.4572,
    lng: -106.7445,
    default_bearing: 110,
    base_elev_ft: 6900,
    summit_elev_ft: 10568,
    vertical_drop_ft: 3668,
    skiable_acres: 3741,
    pass_networks: ['Ikon'],
    infrastructure: 'Wild Blue Gondola (10-passenger), Modern Express',
    archetype: 'Powder / Tree Glades',
    summary: 'Rich cowboy and ranching heritage nestled in the Yampa Valley, famous for featherlight Champagne Powder and spaced aspen tree glades.',
  },
  {
    id: 'arapahoe-basin',
    lift_count: 9,
    run_count: 147,
    name: 'Arapahoe Basin',
    region: 'Colorado',
    country: 'USA',
    lat: 39.6425,
    lng: -105.8719,
    default_bearing: 165,
    base_elev_ft: 10780,
    summit_elev_ft: 13050,
    vertical_drop_ft: 2270,
    skiable_acres: 1428,
    pass_networks: ['Ikon'],
    infrastructure: 'High-speed quads, fixed-grip chairs',
    archetype: 'High Alpine / Steeps',
    summary: 'High-altitude Continental Divide outpost rising above 13,000 ft, renowned for its gritty local vibe, Pallavicini steeps, East Wall hikes, and spring Beach tailgates.',
  },
  {
    id: 'monarch-mountain',
    lift_count: 7,
    run_count: 67,
    name: 'Monarch',
    region: 'Colorado',
    country: 'USA',
    lat: 38.5122,
    lng: -106.3256,
    default_bearing: 240,
    base_elev_ft: 10790,
    summit_elev_ft: 11952,
    vertical_drop_ft: 1162,
    skiable_acres: 800,
    pass_networks: ['Indy'],
    infrastructure: '5 Double/Triple Chairs',
    archetype: 'Uncrowded / Soul Hill',
    summary: 'Pure Colorado skiing at Monarch Pass, relying exclusively on 100% natural Continental Divide snowfall across open bowls and untamed glades.',
  },
  {
    id: 'silverton',
    lift_count: 1,
    run_count: 69,
    name: 'Silverton Mountain',
    region: 'Colorado',
    country: 'USA',
    lat: 37.8847,
    lng: -107.6653,
    default_bearing: 330,
    base_elev_ft: 10400,
    summit_elev_ft: 13487,
    vertical_drop_ft: 3087,
    skiable_acres: 1819,
    pass_networks: ['Independent'],
    infrastructure: '1 Double Chair, Heli-Skiing',
    archetype: 'Extreme Steeps',
    summary: 'Raw, no-frills big-mountain mountaineering in the San Juans; a solitary double chair accessing sheer couloirs where avalanche gear is mandatory.',
  },
  {
    id: 'big-sky',
    lift_count: 38,
    run_count: 300,
    name: 'Big Sky',
    region: 'Montana',
    country: 'USA',
    lat: 45.2858,
    lng: -111.4011,
    default_bearing: 245,
    base_elev_ft: 6800,
    summit_elev_ft: 11166,
    vertical_drop_ft: 4366,
    skiable_acres: 5850,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'New Lone Peak Tram, Heated 8-Packs',
    archetype: 'Steep Alpine',
    summary: 'The biggest skiing in America beneath the rugged pyramid of Lone Mountain, delivering high-alpine tram access to sheer chutes and untamed Montana powder bowls.',
  },
  {
    id: 'bridger-bowl',
    lift_count: 8,
    run_count: 75,
    name: 'Bridger Bowl',
    region: 'Montana',
    country: 'USA',
    lat: 45.8172,
    lng: -110.8967,
    default_bearing: 275,
    base_elev_ft: 6100,
    summit_elev_ft: 8700,
    vertical_drop_ft: 2600,
    skiable_acres: 2000,
    pass_networks: ['Independent'],
    infrastructure: 'Non-profit community lifts',
    archetype: 'Uncrowded / Soul Hill',
    summary: 'Bozeman\'s spirited non-profit community hill, legendary for the cold-smoke powder of the Bridger Ridge where skiers hike with avalanche transceivers.',
  },
  {
    id: 'sun-valley',
    lift_count: 18,
    run_count: 121,
    name: 'Sun Valley',
    region: 'Idaho',
    country: 'USA',
    lat: 43.68,
    lng: -114.36,
    default_bearing: 210,
    base_elev_ft: 5750,
    summit_elev_ft: 9150,
    vertical_drop_ft: 3400,
    skiable_acres: 2054,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: '1 Gondola, Modern High-Speed Chairs',
    archetype: 'Flagship Mega-Resort',
    summary: 'America\'s original 1936 destination ski resort where Hollywood stars and Olympians carved Bald Mountain\'s relentless, continuous-pitch fall lines.',
  },
  {
    id: 'brundage',
    lift_count: 6,
    run_count: 70,
    name: 'Brundage',
    region: 'Idaho',
    country: 'USA',
    lat: 45.0053,
    lng: -116.1558,
    default_bearing: 180,
    base_elev_ft: 5840,
    summit_elev_ft: 7640,
    vertical_drop_ft: 1800,
    skiable_acres: 1920,
    pass_networks: ['Indy'],
    infrastructure: 'Centennial Express 6-pack & quads',
    archetype: 'Uncrowded / Soul Hill',
    summary: 'Idaho powder gem overlooking Payette Lake, celebrated for reliable central Idaho storm tracks, wide uncrowded glades, and panoramic views of Salmon River mountains.',
  },

  // US Pacific & Canada
  {
    id: 'mt-baker',
    lift_count: 10,
    run_count: 31,
    name: 'Mt. Baker',
    region: 'Washington',
    country: 'USA',
    lat: 48.857,
    lng: -121.666,
    default_bearing: 135,
    base_elev_ft: 3500,
    summit_elev_ft: 5089,
    vertical_drop_ft: 1589,
    skiable_acres: 1000,
    pass_networks: ['Independent'],
    infrastructure: 'Fixed-Grip Quads',
    archetype: 'Powder / Tree Glades',
    summary: 'World-record snowfall mecca in Washington\'s North Cascades, the birthplace of freeride culture where storms dump legendary maritime powder on volcanic bowls.',
  },
  {
    id: 'whistler-blackcomb',
    lift_count: 37,
    run_count: 240,
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
    infrastructure: 'Peak 2 Peak 3S Gondola, 37 Lifts',
    archetype: 'Flagship Mega-Resort',
    summary: 'Mammoth coastal Canadian giant linking two towering peaks via the Peak 2 Peak Gondola, famous for Olympian steeps, alpine glaciers, and world-renowned ski energy.',
  },
  {
    id: 'revelstoke',
    lift_count: 5,
    run_count: 75,
    name: 'Revelstoke',
    region: 'British Columbia',
    country: 'Canada',
    lat: 50.9583,
    lng: -118.1633,
    default_bearing: 115,
    base_elev_ft: 1680,
    summit_elev_ft: 7300,
    vertical_drop_ft: 5620,
    skiable_acres: 3121,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Gondola & 4 Express Chairs',
    archetype: 'Steep Alpine',
    summary: 'North America\'s longest lift-served continuous vertical drop (5,620 ft) in British Columbia\'s Selkirks, known for deep storm skiing and steep alpine bowls.',
  },
  {
    id: 'mammoth',
    lift_count: 25,
    run_count: 175,
    name: 'Mammoth Mountain',
    region: 'California',
    country: 'USA',
    lat: 37.6308,
    lng: -119.0326,
    default_bearing: 215,
    base_elev_ft: 7953,
    summit_elev_ft: 11053,
    vertical_drop_ft: 3100,
    skiable_acres: 3500,
    pass_networks: ['Ikon'],
    infrastructure: '3 Gondolas, 25 Chairs',
    archetype: 'Flagship Mega-Resort',
    summary: 'Iconic Eastern Sierra volcano rising to 11,053 feet, known for massive Pacific storm cycles, open summit wind-buff bowls, and vibrant California ski heritage.',
  },
  {
    id: 'palisades-tahoe',
    lift_count: 43,
    run_count: 270,
    name: 'Palisades Tahoe',
    region: 'California',
    country: 'USA',
    lat: 39.197,
    lng: -120.2357,
    default_bearing: 240,
    base_elev_ft: 6200,
    summit_elev_ft: 9050,
    vertical_drop_ft: 2850,
    skiable_acres: 6000,
    pass_networks: ['Ikon'],
    infrastructure: 'Base-to-Base Gondola, Aerial Tram',
    archetype: 'Steep Alpine',
    summary: 'Historic host of the 1960 Winter Olympics and crucible of extreme skiing, famous for KT-22, the Palisades cliffs, and sun-drenched Sierra spring corn.',
  },
  {
    id: 'telluride',
    lift_count: 17,
    run_count: 148,
    name: 'Telluride',
    region: 'Colorado',
    country: 'USA',
    lat: 37.9375,
    lng: -107.8123,
    default_bearing: 195,
    base_elev_ft: 8725,
    summit_elev_ft: 13150,
    vertical_drop_ft: 4425,
    skiable_acres: 2000,
    pass_networks: ['Epic'],
    infrastructure: 'Free Town Gondola, Modern Express Chairs',
    archetype: 'Steep Alpine',
    summary: 'Dramatically tucked inside a stunning San Juan box canyon, fusing Victorian gold-rush architecture with hair-raising high-alpine steeps on Palmyra Peak.',
  },

  // European Alps
  {
    id: 'chamonix',
    lift_count: 65,
    run_count: 119,
    name: 'Chamonix-Mont-Blanc',
    region: 'Haute-Savoie',
    country: 'France',
    lat: 45.9237,
    lng: 6.8694,
    default_bearing: 160,
    base_elev_ft: 3400,
    summit_elev_ft: 12605,
    vertical_drop_ft: 9205,
    skiable_acres: 4200,
    pass_networks: ['Mountain Collective'],
    infrastructure: 'Aiguille du Midi Cable Car',
    archetype: 'Steep Alpine',
    summary: 'Spiritual home of extreme alpinism beneath Mont Blanc, celebrated for the 20-km Vallée Blanche descent and pioneering mountain guide tradition.',
  },
  {
    id: 'val-disere',
    lift_count: 78,
    run_count: 159,
    name: 'Val d’Isère / Tignes',
    region: 'Savoie',
    country: 'France',
    lat: 45.448,
    lng: 6.9802,
    default_bearing: 200,
    base_elev_ft: 6070,
    summit_elev_ft: 11338,
    vertical_drop_ft: 5268,
    skiable_acres: 10000,
    pass_networks: ['Epic'],
    infrastructure: 'Over 75 Lifts, Funiculars & Cable Cars',
    archetype: 'Flagship Mega-Resort',
    summary: 'Legendary French Tarentaise high-altitude terrain linking with Tignes across the Espace Killy, famed for the Face de Bellevarde Olympic downhill and vast off-piste.',
  },
  {
    id: 'verbier',
    lift_count: 67,
    run_count: 80,
    name: 'Verbier (4 Vallées)',
    region: 'Valais',
    country: 'Switzerland',
    lat: 46.0968,
    lng: 7.2286,
    default_bearing: 175,
    base_elev_ft: 4920,
    summit_elev_ft: 10925,
    vertical_drop_ft: 6005,
    skiable_acres: 9500,
    pass_networks: ['Epic'],
    infrastructure: 'Mont-Fort Cable Car & Express Network',
    archetype: 'Steep Alpine',
    summary: 'The freeride jewel of the Swiss 4 Valleys, famous for the daunting Bec des Rosses face, high-altitude Mont Fort descents, and cosmopolitan alpine nightlife.',
  },
  {
    id: 'zermatt',
    lift_count: 53,
    run_count: 148,
    name: 'Zermatt Matterhorn',
    region: 'Valais',
    country: 'Switzerland',
    lat: 45.9765,
    lng: 7.7491,
    default_bearing: 190,
    base_elev_ft: 5249,
    summit_elev_ft: 12739,
    vertical_drop_ft: 7490,
    skiable_acres: 8800,
    pass_networks: ['Ikon'],
    infrastructure: 'Matterhorn Alpine Crossing 3S Cable Car',
    archetype: 'Flagship Mega-Resort',
    summary: 'Iconic car-free Swiss village backdropped by the majestic Matterhorn, featuring glaciated year-round ski descents and historic high-alpine trans-border terrain into Italy.',
  },
  {
    id: 'st-anton',
    lift_count: 85,
    run_count: 131,
    name: 'St. Anton am Arlberg',
    region: 'Tyrol',
    country: 'Austria',
    lat: 47.1296,
    lng: 10.2682,
    default_bearing: 210,
    base_elev_ft: 4278,
    summit_elev_ft: 9222,
    vertical_drop_ft: 4944,
    skiable_acres: 7500,
    pass_networks: ['Epic'],
    infrastructure: 'Flexenbahn & Galzigbahn Gondolas',
    archetype: 'Steep Alpine',
    summary: 'Historic cradle of alpine ski technique in the Austrian Arlberg, famed for legendary Valluga steeps, untracked backcountry routes, and raucous Krazy Kanguruh après lore.',
  },

  // Japan
  {
    id: 'niseko-united',
    lift_count: 30,
    run_count: 80,
    name: 'Niseko United',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 42.8622,
    lng: 140.6994,
    default_bearing: 330,
    base_elev_ft: 853,
    summit_elev_ft: 4291,
    vertical_drop_ft: 3438,
    skiable_acres: 2191,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: '4 Interconnected Areas, 30+ Lifts',
    archetype: 'Powder / Tree Glades',
    summary: 'Global capital of bottomless powder snow on Hokkaido, renowned for Siberian storm cycles that blanket birch glades in ultra-light dry powder.',
  },
  {
    id: 'rusutsu',
    lift_count: 18,
    run_count: 37,
    name: 'Rusutsu',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 42.7525,
    lng: 140.9056,
    default_bearing: 290,
    base_elev_ft: 1312,
    summit_elev_ft: 3261,
    vertical_drop_ft: 1949,
    skiable_acres: 1050,
    pass_networks: ['Epic'],
    infrastructure: '4 Gondolas, Express Quads',
    archetype: 'Powder / Tree Glades',
    summary: 'Hokkaido powder sanctuary spreading across three mountains, famous for magical tree glades, natural gullies, and untracked snow without the crowds.',
  },
  {
    id: 'furano',
    lift_count: 10,
    run_count: 28,
    name: 'Furano',
    region: 'Hokkaido',
    country: 'Japan',
    lat: 43.3422,
    lng: 142.3556,
    default_bearing: 310,
    base_elev_ft: 787,
    summit_elev_ft: 3514,
    vertical_drop_ft: 2727,
    skiable_acres: 1200,
    pass_networks: ['Independent'],
    infrastructure: '100-passenger Furano Ropeway',
    archetype: 'Powder / Tree Glades',
    summary: 'Central Hokkaido destination known for exceptionally cold, dry snow, World Cup downhill heritage, and panoramic views across the Daisetsuzan mountain range.',
  },
  {
    id: 'hakuba-happo-one',
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
  },
  {
    id: 'nozawa-onsen',
    lift_count: 20,
    run_count: 36,
    name: 'Nozawa Onsen',
    region: 'Nagano',
    country: 'Japan',
    lat: 36.9208,
    lng: 138.4503,
    default_bearing: 240,
    base_elev_ft: 1853,
    summit_elev_ft: 5413,
    vertical_drop_ft: 3560,
    skiable_acres: 740,
    pass_networks: ['Indy'],
    infrastructure: 'Nagasaka 10-Passenger Gondola',
    archetype: 'Powder / Tree Glades',
    summary: 'Eighth-century hot-spring village where ancient bathhouse tradition meets deep Honshu snow, renowned for Yamabiko tree skiing and classic lantern-lit village streets.',
  },
  {
    id: 'myoko-kogen',
    lift_count: 15,
    run_count: 32,
    name: 'Myoko Kogen',
    region: 'Niigata',
    country: 'Japan',
    lat: 36.8833,
    lng: 138.2,
    default_bearing: 260,
    base_elev_ft: 2400,
    summit_elev_ft: 6070,
    vertical_drop_ft: 3670,
    skiable_acres: 1200,
    pass_networks: ['Indy'],
    infrastructure: 'Akakura Onsen & Kanko Combined',
    archetype: 'Powder / Tree Glades',
    summary: 'Deep-snow haven on Mount Myoko receiving immense Sea of Japan snowfall, rich in traditional Japanese ski history dating back to 1911.',
  },

  // Southern Hemisphere
  {
    id: 'treble-cone',
    lift_count: 4,
    run_count: 45,
    name: 'Treble Cone',
    region: 'Otago',
    country: 'New Zealand',
    lat: -44.6361,
    lng: 168.8953,
    default_bearing: 240,
    base_elev_ft: 4133,
    summit_elev_ft: 6850,
    vertical_drop_ft: 2717,
    skiable_acres: 1358,
    pass_networks: ['Mountain Collective'],
    infrastructure: 'Home Basin 6-Pack',
    archetype: 'Steep Alpine',
    summary: 'Premier freeride mountain of New Zealand\'s South Island, famed for the legendary Motatapu Chutes, natural halfpipes, and spectacular views over Lake Wanaka.',
  },
  {
    id: 'valle-nevado',
    lift_count: 14,
    run_count: 40,
    name: 'Valle Nevado',
    region: 'Santiago',
    country: 'Chile',
    lat: -33.3547,
    lng: -70.2483,
    default_bearing: 210,
    base_elev_ft: 9400,
    summit_elev_ft: 12040,
    vertical_drop_ft: 2640,
    skiable_acres: 2200,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Modern Gondola & High-Speed Detachables',
    archetype: 'Steep Alpine',
    summary: 'Modern high-altitude resort perched above 10,000 ft in the Chilean Andes, offering expansive above-treeline powder bowls beneath 18,000-ft glaciated peaks.',
  },
  {
    id: 'portillo',
    lift_count: 14,
    run_count: 35,
    name: 'Portillo',
    region: 'Valparaíso',
    country: 'Chile',
    lat: -32.8361,
    lng: -70.1294,
    default_bearing: 200,
    base_elev_ft: 9448,
    summit_elev_ft: 10860,
    vertical_drop_ft: 1412,
    skiable_acres: 1235,
    pass_networks: ['Independent'],
    infrastructure: 'Va-et-Vient slingshot lifts on 45° pitches',
    archetype: 'Steep Alpine',
    summary: 'Storied yellow hotel perched beside Laguna del Inca high in the Chilean Andes, celebrated for steep couloirs, slingshot Va et Vient lifts, and Olympic summer training.',
  },

  // US East & Canada Rockies
  {
    id: 'stowe',
    lift_count: 12,
    run_count: 116,
    name: 'Stowe Mountain Resort',
    region: 'Vermont',
    country: 'USA',
    lat: 44.5303,
    lng: -72.7814,
    default_bearing: 270,
    base_elev_ft: 1280,
    summit_elev_ft: 4393,
    vertical_drop_ft: 2360,
    skiable_acres: 485,
    pass_networks: ['Epic'],
    infrastructure: 'Over Easy Gondola & FourRunner Quad',
    archetype: 'Steep Alpine',
    summary: 'The ski capital of the East on Mount Mansfield, featuring the fabled Front Four double-black trails and historic New England ski racing pedigree.',
  },
  {
    id: 'killington',
    lift_count: 22,
    run_count: 155,
    name: 'Killington',
    region: 'Vermont',
    country: 'USA',
    lat: 43.6264,
    lng: -72.7967,
    default_bearing: 250,
    base_elev_ft: 1165,
    summit_elev_ft: 4241,
    vertical_drop_ft: 3050,
    skiable_acres: 1509,
    pass_networks: ['Ikon'],
    infrastructure: 'K-1 Express Gondola & Skyeship',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Beast of the East sprawling across six peaks in Vermont\'s Green Mountains, famous for World Cup racing on Superstar and one of the longest ski seasons in the East.',
  },
  {
    id: 'lake-louise',
    lift_count: 11,
    run_count: 164,
    name: 'Lake Louise',
    region: 'Alberta',
    country: 'Canada',
    lat: 51.442,
    lng: -116.158,
    default_bearing: 30,
    base_elev_ft: 5400,
    summit_elev_ft: 8650,
    vertical_drop_ft: 3250,
    skiable_acres: 4200,
    pass_networks: ['Ikon', 'Mountain Collective'],
    infrastructure: 'Grizzly Gondola & Juniper Express',
    archetype: 'Steep Alpine',
    summary: 'Spectacular Canadian Rockies wilderness in Banff National Park, pairing historic World Cup downhill slopes with dramatic glaciated peaks and vast back bowls.',
  },

  // European Alps & Dolomites
  {
    id: 'cortina',
    lift_count: 27,
    run_count: 86,
    name: 'Cortina d’Ampezzo',
    region: 'Veneto',
    country: 'Italy',
    lat: 46.5405,
    lng: 12.1357,
    default_bearing: 190,
    base_elev_ft: 4016,
    summit_elev_ft: 10643,
    vertical_drop_ft: 6627,
    skiable_acres: 3000,
    pass_networks: ['Ikon', 'Independent'],
    infrastructure: 'Freccia nel Cielo Cable Car & Dolomiti Superski Network',
    archetype: 'Steep Alpine',
    summary: 'Glamorous Queen of the Dolomites framed by dramatic pink limestone peaks, combining 1956 and 2026 Winter Olympic heritage with chic Italian lifestyle.',
  },
  {
    id: 'val-gardena',
    lift_count: 79,
    run_count: 175,
    name: 'Val Gardena / Sellaronda',
    region: 'South Tyrol',
    country: 'Italy',
    lat: 46.557,
    lng: 11.758,
    default_bearing: 170,
    base_elev_ft: 4048,
    summit_elev_ft: 8255,
    vertical_drop_ft: 4207,
    skiable_acres: 4300,
    pass_networks: ['Ikon', 'Independent'],
    infrastructure: 'Saslong World Cup gondolas & interconnected circuit',
    archetype: 'Flagship Mega-Resort',
    summary: 'Ladin cultural heart of the Dolomites and gateway to the famous Sellaronda circuit, host to the thrilling Saslong World Cup downhill.',
  },
  {
    id: 'courchevel',
    lift_count: 55,
    run_count: 109,
    name: 'Courchevel (Les 3 Vallées)',
    region: 'Savoie',
    country: 'France',
    lat: 45.415,
    lng: 6.634,
    default_bearing: 210,
    base_elev_ft: 4265,
    summit_elev_ft: 8970,
    vertical_drop_ft: 4705,
    skiable_acres: 15000,
    pass_networks: ['Epic'],
    infrastructure: 'Saulire Cable Car & 160 interconnected lifts',
    archetype: 'Flagship Mega-Resort',
    summary: 'The most prestigious station of the French 3 Valleys, combining north-facing high-alpine snow preservation with Michelin-starred mountain luxury.',
  },
  {
    id: 'st-moritz',
    lift_count: 58,
    run_count: 88,
    name: 'St. Moritz (Corviglia & Diavolezza)',
    region: 'Graubünden',
    country: 'Switzerland',
    lat: 46.505,
    lng: 9.84,
    default_bearing: 160,
    base_elev_ft: 5971,
    summit_elev_ft: 10837,
    vertical_drop_ft: 4866,
    skiable_acres: 3800,
    pass_networks: ['Epic', 'Independent'],
    infrastructure: 'Signal Cable Car & Piz Nair Funicular',
    archetype: 'Steep Alpine',
    summary: 'The birthplace of winter tourism in 1864 in the Swiss Engadin valley, hosting two Winter Olympics and legendary Corviglia sun-drenched alpine pistes.',
  },
  {
    id: 'kitzbuehel',
    lift_count: 57,
    run_count: 96,
    name: 'Kitzbühel',
    region: 'Tyrol',
    country: 'Austria',
    lat: 47.446,
    lng: 12.391,
    default_bearing: 195,
    base_elev_ft: 2625,
    summit_elev_ft: 6560,
    vertical_drop_ft: 3935,
    skiable_acres: 4700,
    pass_networks: ['Ikon'],
    infrastructure: '3S-Bahn Gondola & Hahnenkammbahn',
    archetype: 'Steep Alpine',
    summary: 'Legendary Tyrolean ski town host to the harrowing Hahnenkamm downhill on the Streif, blending medieval town charm with 130 years of Austrian ski prestige.',
  },

  // Scandinavia & Spain
  {
    id: 'hemsedal',
    lift_count: 21,
    run_count: 51,
    name: 'Hemsedal',
    region: 'Viken',
    country: 'Norway',
    lat: 60.86,
    lng: 8.51,
    default_bearing: 200,
    base_elev_ft: 2034,
    summit_elev_ft: 4757,
    vertical_drop_ft: 2723,
    skiable_acres: 1100,
    pass_networks: ['Independent'],
    infrastructure: 'Hollvin Express 8-pack & T-bars',
    archetype: 'Steep Alpine',
    summary: 'The Scandinavian Alps of Norway, renowned for its dramatic pointed peaks, snow-sure season from November to May, and vibrant ski touring scene.',
  },
  {
    id: 'are-sweden',
    lift_count: 35,
    run_count: 89,
    name: 'Åre',
    region: 'Jämtland',
    country: 'Sweden',
    lat: 63.401,
    lng: 13.081,
    default_bearing: 180,
    base_elev_ft: 1247,
    summit_elev_ft: 4173,
    vertical_drop_ft: 2926,
    skiable_acres: 2200,
    pass_networks: ['Independent'],
    infrastructure: 'Åre Kabinbana & VM8 Express',
    archetype: 'Flagship Mega-Resort',
    summary: 'Northern Europe\'s premier alpine resort on Mount Åreskutan, host to multiple World Championships with sweeping lake views and Nordic mountain soul.',
  },
  {
    id: 'baqueira-beret',
    lift_count: 36,
    run_count: 114,
    name: 'Baqueira-Beret',
    region: 'Catalonia',
    country: 'Spain',
    lat: 42.698,
    lng: 0.932,
    default_bearing: 175,
    base_elev_ft: 4920,
    summit_elev_ft: 8563,
    vertical_drop_ft: 3643,
    skiable_acres: 5360,
    pass_networks: ['Independent'],
    infrastructure: '36 Lifts including Baqueira Gondola',
    archetype: 'Steep Alpine',
    summary: 'The crown jewel of the Spanish Pyrenees in the Val d\'Aran, loved by the Spanish royal family for expansive high-altitude bowls and exceptional tapas culture.',
  },

  // Oceania & South America
  {
    id: 'cardrona',
    lift_count: 7,
    run_count: 65,
    name: 'Cardrona Alpine Resort',
    region: 'Otago',
    country: 'New Zealand',
    lat: -44.87,
    lng: 169.01,
    default_bearing: 240,
    base_elev_ft: 4134,
    summit_elev_ft: 6102,
    vertical_drop_ft: 1968,
    skiable_acres: 1150,
    pass_networks: ['Independent'],
    infrastructure: 'McDougall’s Chondola & Soho Basin expansion',
    archetype: 'Steep Alpine',
    summary: 'New Zealand\'s premier alpine playground between Queenstown and Wanaka, famous for wide-open rolling basins and world-class terrain parks.',
  },
  {
    id: 'perisher',
    lift_count: 49,
    run_count: 133,
    name: 'Perisher',
    region: 'New South Wales',
    country: 'Australia',
    lat: -36.404,
    lng: 148.413,
    default_bearing: 150,
    base_elev_ft: 5262,
    summit_elev_ft: 6673,
    vertical_drop_ft: 1411,
    skiable_acres: 3076,
    pass_networks: ['Epic'],
    infrastructure: 'Skitube Alpine Railway & 47 Lifts',
    archetype: 'Flagship Mega-Resort',
    summary: 'The Southern Hemisphere\'s largest resort in Australia\'s Snowy Mountains, connecting four distinct villages across rolling sub-alpine snowgum glades.',
  },
  {
    id: 'cerro-catedral',
    lift_count: 29,
    run_count: 60,
    name: 'Cerro Catedral (Bariloche)',
    region: 'Río Negro',
    country: 'Argentina',
    lat: -41.17,
    lng: -71.44,
    default_bearing: 250,
    base_elev_ft: 3379,
    summit_elev_ft: 7152,
    vertical_drop_ft: 3773,
    skiable_acres: 2965,
    pass_networks: ['Ikon'],
    infrastructure: 'Amancay Gondola & 34 Lifts',
    archetype: 'Steep Alpine',
    summary: 'South America\'s premier resort towering above Lake Nahuel Huapi in Argentine Patagonia, famed for granite spires, beech forest tree runs, and vibrant Bariloche culture.',
  },
];

/* =========================================================================
   CAT SKI & HELI SKI OPERATIONS DATASET
   ========================================================================= */

export const HELI_CAT_OPERATIONS: SkiResort[] = [
  {
    id: 'heli-cmh-bugaboos',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-mike-wiegele',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'cat-baldface-lodge',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-selkirk-snowcat',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'heli-chugach-powder-guides',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-valdez-heli-ski-guides',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'cat-steamboat-powdercats',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-silverton-powdercats',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-island-lake',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'cat-chatter-creek',
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
    category: 'heli_cat',
    operation_type: 'cat_ski',
  },
  {
    id: 'heli-bella-coola',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-southern-lakes',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-air-zermatt',
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
    category: 'heli_cat',
    operation_type: 'heli_ski',
  },
  {
    id: 'heli-niseko-shiribetsu',
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

export function getResortWebsite(resort: SkiResort | null | undefined): { url: string; isDirect: boolean } | null {
  if (!resort) return null;
  const direct = resort.website || (resort as any).tags?.website || (resort as any).tags?.['contact:website'];
  if (direct) {
    const url = direct.startsWith('http://') || direct.startsWith('https://') ? direct : `https://${direct}`;
    return { url, isDirect: true };
  }
  if (resort.name) {
    const q = encodeURIComponent(`${resort.name} ski resort official website`);
    return { url: `https://www.google.com/search?q=${q}`, isDirect: false };
  }
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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [is3D, setIs3D] = useState(false);
  const [earthProjection, setEarthProjection] = useState<EarthProjectionMode>('globe');
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('satellite');
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
  const [showLifts, setShowLifts] = useState(true);
  const [showResortMarkers, setShowResortMarkers] = useState(true);
  const [show3DTerrain, setShow3DTerrain] = useState(true);
  const [showHillshade, setShowHillshade] = useState(true);
  const basemapMenuRef = useRef<HTMLDivElement | null>(null);
  const mapLegendRef = useRef<HTMLDivElement | null>(null);

  // Category Individual Toggles (Default: Downhill only)
  const [showDownhill, setShowDownhill] = useState(true);
  const [showNordic, setShowNordic] = useState(false);
  const [showHeliCat, setShowHeliCat] = useState(false);

  // Filter Sliders (Default: 500' vertical, 100 acres)
  const [minVertical, setMinVertical] = useState(500);
  const [minAcreage, setMinAcreage] = useState(100);

  // Piste trail toggles — alpine on by default, nordic off by default
  const [showAlpineTrails, setShowAlpineTrails] = useState(true);
  const [showNordicTrails, setShowNordicTrails] = useState(false);

  // Navigation Instrument (Compass/Gyro HUD)
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapScale, setMapScale] = useState({ distStr: '500 km', barWidth: 80 });
  const isDraggingCompassRef = useRef(false);
  const didDragCompassRef = useRef(false);
  const [isCompassDragging, setIsCompassDragging] = useState(false);
  const isDraggingTiltRef = useRef(false);
  const didDragTiltRef = useRef(false);
  const [isTiltDragging, setIsTiltDragging] = useState(false);

  // Mountain Directory Scope & Sorting
  const [directoryScope, setDirectoryScope] = useState<'in_frame' | 'all'>('in_frame');
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
    if (minVertical !== 500) count++;
    if (minAcreage !== 100) count++;
    if (!showDownhill || showNordic || showHeliCat) count++;
    return count;
  }, [selectedPasses, minVertical, minAcreage, showDownhill, showNordic, showHeliCat]);

  // Dynamic Category Counts Matching Sliders & Pass Network Filters
  const categoryFilterCounts = useMemo(() => {
    let downhill = 0;
    let nordic = 0;
    let heli_cat = 0;
    for (const r of resorts) {
      const vert = r.vertical_drop_ft || 0;
      if (minVertical > 0 && vert < minVertical) continue;
      const acres = r.skiable_acres || 0;
      if (minAcreage > 0 && acres < minAcreage) continue;
      const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
      if (!passMatch) continue;
      const cat = r.category || 'downhill';
      if (cat === 'downhill') downhill++;
      else if (cat === 'nordic') nordic++;
      else if (cat === 'heli_cat') heli_cat++;
    }
    return { downhill, nordic, heli_cat };
  }, [resorts, minVertical, minAcreage, selectedPasses]);

  const handleResetFilters = () => {
    setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent']);
    setMinVertical(500);
    setMinAcreage(100);
    setShowDownhill(true);
    setShowNordic(false);
    setShowHeliCat(false);
    setShowTrails(false);
  };

  // Filtered Resorts across entire world dataset
  const filteredResorts = useMemo(() => {
    const list = resorts.filter((r) => {
      const cat = r.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) return false;
      if (cat === 'nordic' && !showNordic) return false;
      if (cat === 'heli_cat' && !showHeliCat) return false;

      const passMatch = r.pass_networks ? r.pass_networks.some((p) => selectedPasses.includes(p)) : true;
      if (!passMatch) return false;

      if (minVertical > 0 && (r.vertical_drop_ft === null || r.vertical_drop_ft === undefined || r.vertical_drop_ft < minVertical)) return false;
      if (minAcreage > 0 && (r.skiable_acres === null || r.skiable_acres === undefined || r.skiable_acres < minAcreage)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesRegion = (r.region || '').toLowerCase().includes(q);
        const matchesCountry = (r.country || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRegion && !matchesCountry) return false;
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
        const diff = (a.skiable_acres || 0) - (b.skiable_acres || 0);
        return diff * multiplier;
      } else {
        return a.name.localeCompare(b.name) * multiplier;
      }
    });

    return list;
  }, [resorts, selectedPasses, minVertical, minAcreage, searchQuery, showDownhill, showNordic, showHeliCat, sortBy, sortOrder]);

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
    if (north - south > 1.2 || east - west > 1.5) return;
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

    const initialLeftPad = leftDockOpen ? (typeof window !== 'undefined' && window.innerWidth >= 768 ? 404 : 340) : 20;
    const initialRightPad = selectedResortId ? (typeof window !== 'undefined' && window.innerWidth >= 768 ? 384 : 336) : 0;

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
      center: [-98.5, 39.8], // Default to North America on globe
      zoom: 3.1,
      minZoom: 1.2,
      maxZoom: 16.5, // Prevent over-zooming past DEM resolution into the subterranean surface
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      dragRotate: true,
    });

    // Apply viewport padding synchronously before first render so globe never slides on start
    map.setPadding({ left: initialLeftPad, right: initialRightPad, top: 52, bottom: 0 });

    mapRef.current = map;

    // Enable native linear drag-to-rotate around center with ground-clamped terrain elevation
    try {
      (map as any).setCenterClampedToGround?.(true);
      map.dragRotate.enable({ around: 'center', movement: 'linear' });
    } catch (_) {}

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
          setIs3D(maxAllowedPitch > 10);
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
      const z = map.getZoom();
      // Ensure camera does not dip below terrain surface when pitched steeply at high zoom
      if (z > 16.0 && map.getPitch() > 65) {
        map.setPitch(65);
        setMapPitch(65);
      }
      if (z >= 9.5 && fetchOverpassBboxRef.current) {
        try {
          const center = map.getCenter();
          const b = map.getBounds();
          const rawHalfLng = Math.abs(b.getEast() - b.getWest()) / 2;
          const rawHalfLat = Math.abs(b.getNorth() - b.getSouth()) / 2;
          const halfLng = Math.min(0.35, Math.max(0.08, rawHalfLng));
          const halfLat = Math.min(0.28, Math.max(0.06, rawHalfLat));
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

      // Enable 3D Terrain mesh (0.7x natural mountain relief)
      try {
        if (show3DTerrain) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: 0.70 });
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
      map.addLayer({
        id: 'live-pistes-casing',
        type: 'line',
        source: 'live-pistes-vector',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#FAF8F3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.0, 14, 3.6, 17, 4.6],
          'line-opacity': 0.85,
        },
      });

      // Color lines (Off by default for speed; toggled via showTrails)
      map.addLayer({
        id: 'live-pistes-lines',
        type: 'line',
        source: 'live-pistes-vector',
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'novice', '#2E7D32',       // Alpine Green
            'intermediate', '#1565C0', // Cobalt Blue
            'advanced', '#1C1B18',     // Black Diamond
            'expert', '#B84A39',       // Double Black Vermilion
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
        filter: ['==', ['get', 'kind'], 'lift'],
        paint: {
          'line-color': '#B84A39',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });

      // Upright 3D Trail & Lift Names (Off by default for speed; toggled via showTrails)
      map.addLayer({
        id: 'live-pistes-labels',
        type: 'symbol',
        source: 'live-pistes-vector',
        minzoom: 12.5,
        layout: {
          'visibility': 'none',
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
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

      // Curated Outer Ring (Hidden when zoomed out so clusters cleanly represent regions)
      map.addLayer({
        id: 'resorts-outer-ring',
        type: 'circle',
        source: 'resorts-source',
        minzoom: 8.0,
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'pass_color'],
          'circle-opacity': 0.22,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'pass_color'],
        },
      });

      // Curated Inner Ring
      map.addLayer({
        id: 'resorts-inner-dot',
        type: 'circle',
        source: 'resorts-source',
        minzoom: 8.0,
        paint: {
          'circle-radius': 3.5,
          'circle-color': ['get', 'pass_color'],
        },
      });

      // Curated Single Label (Hidden until zoomed in to avoid map clutter & cluster collisions)
      map.addLayer({
        id: 'resorts-labels',
        type: 'symbol',
        source: 'resorts-source',
        minzoom: 8.5,
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
          'text-halo-width': 2,
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

      map.addLayer({
        id: 'global-unclustered-point',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#3B627E',
          'circle-radius': 4.5,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      map.addLayer({
        id: 'global-unclustered-label',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 8.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
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
      ['resorts-outer-ring', 'resorts-inner-dot', 'resorts-labels', 'global-clusters', 'global-unclustered-point', 'global-unclustered-label'].forEach((layerId) => {
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
      map.remove();
    };
  }, []);

  /* =========================================================================
     VIEWPORT CENTERING VIA PADDING (Ensures globe is always dead-center)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (isProgrammaticFlightActive) return;
    const leftPad = leftDockOpen ? (window.innerWidth >= 768 ? 404 : 340) : 20;
    const rightPad = selectedResortId ? (window.innerWidth >= 768 ? 384 : 336) : 0;
    const bottomPad = selectedResortId ? 140 : 0;
    const topPad = selectedResortId ? 60 : 52;

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
  }, [leftDockOpen, selectedResortId, mapLoaded]);

  /* =========================================================================
     TRAILS OVERLAY VISIBILITY TOGGLE (alpine/nordic individually controlled)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const anyTrails = showAlpineTrails || showNordicTrails;

    // Build a piste:type filter for the feature lines
    let pisteFilter: any;
    if (showAlpineTrails && showNordicTrails) {
      pisteFilter = ['!=', ['get', 'kind'], 'lift']; // all pistes
    } else if (showAlpineTrails) {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], ['!=', ['get', 'piste:type'], 'nordic']];
    } else if (showNordicTrails) {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], ['==', ['get', 'piste:type'], 'nordic']];
    } else {
      pisteFilter = ['==', '1', '0']; // match nothing
    }

    ['live-pistes-casing', 'live-pistes-lines', 'live-pistes-labels'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
        if (anyTrails) map.setFilter(id, pisteFilter);
      }
    });
  }, [showAlpineTrails, showNordicTrails, mapLoaded]);

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

    const filterExpr: any[] = [
      'all',
      ['in', ['get', 'category'], ['literal', allowedCats]],
    ];

    if (minVertical > 0) {
      filterExpr.push(['>=', ['coalesce', ['get', 'vertical_ft'], ['get', 'vertical_drop_ft'], 0], minVertical]);
    }
    if (minAcreage > 0) {
      filterExpr.push(['>=', ['coalesce', ['get', 'skiable_acres'], 0], minAcreage]);
    }

    // Curated layers
    ['resorts-outer-ring', 'resorts-inner-dot', 'resorts-labels'].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filterExpr as any);
      }
    });

    // Unclustered global points & labels (must retain ['!', ['has', 'point_count']])
    const unclusteredFilter: any = ['all', ['!', ['has', 'point_count']], filterExpr];
    if (map.getLayer('global-unclustered-point')) {
      map.setFilter('global-unclustered-point', unclusteredFilter);
    }
    if (map.getLayer('global-unclustered-label')) {
      map.setFilter('global-unclustered-label', unclusteredFilter);
    }
  }, [showDownhill, showNordic, showHeliCat, minVertical, minAcreage, mapLoaded]);

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
        const vert = p.vertical_ft || p.vertical_drop_ft || 0;
        if (minVertical > 0 && vert < minVertical) return false;
        const acres = p.skiable_acres || 0;
        if (minAcreage > 0 && acres < minAcreage) return false;
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
        const vert = r.vertical_drop_ft || 0;
        if (minVertical > 0 && vert < minVertical) return false;
        const acres = r.skiable_acres || 0;
        if (minAcreage > 0 && acres < minAcreage) return false;
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
        },
      }));

      curatedSrc.setData({ type: 'FeatureCollection', features: filteredCurated as any });
    }
  }, [showDownhill, showNordic, showHeliCat, minVertical, minAcreage, selectedPasses, searchQuery, mapLoaded, resorts]);

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
          setIs3D(false);
        }
      } else {
        map.setProjection({ type: 'mercator' });
      }
      if (show3DTerrain) {
        try { map.setTerrain({ source: 'terrain-dem', exaggeration: 0.70 }); } catch (_) {}
      } else {
        try { map.setTerrain(null); } catch (_) {}
      }
      map.setRenderWorldCopies(false);
    } catch (err) {
      console.warn('Projection transition error:', err);
    }
  }, [earthProjection, show3DTerrain, mapLoaded]);

  /* =========================================================================
     SINGLE PLANET ENFORCEMENT (ZERO REPEATING EARTHS IN 2D OR 3D)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.setRenderWorldCopies(false);
  }, [is3D, mapPitch, earthProjection, mapLoaded]);

  /* =========================================================================
     OUTSIDE-CLICK DISMISSAL FOR BASEMAP & MAP KEY FLOATING PANELS
     ========================================================================= */

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

  /* =========================================================================
     AERIALWAYS & LIFTS VISIBILITY TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer('live-pistes-lifts')) {
      map.setLayoutProperty('live-pistes-lifts', 'visibility', showLifts ? 'visible' : 'none');
    }
  }, [showLifts, mapLoaded]);

  /* =========================================================================
     RESORT PINS & LABELS VISIBILITY TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const markerLayers = [
      'resorts-outer-ring',
      'resorts-inner-dot',
      'resorts-labels',
      'global-clusters',
      'global-cluster-count',
      'global-unclustered-point',
      'global-unclustered-label',
    ];
    markerLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', showResortMarkers ? 'visible' : 'none');
      }
    });
  }, [showResortMarkers, mapLoaded]);

  /* =========================================================================
     3D TERRAIN ELEVATION MESH TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    try {
      if (show3DTerrain) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 0.70 });
      } else {
        map.setTerrain(null);
      }
      map.setRenderWorldCopies(false);
    } catch (err) {
      console.warn('SetTerrain toggle error:', err);
    }
  }, [show3DTerrain, mapLoaded]);

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
    let lockedElevation: number | null = null;

    const NAVIGATION_KEYS = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyQ',
      'KeyE',
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
      if (!mapRef.current || activeKeys.size === 0) {
        animationFrameId = null;
        lastTimestamp = null;
        return;
      }

      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
      lastTimestamp = timestamp;

      const isShift = activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight');

      let pitchDelta = 0;
      let rotateBearing = 0;
      let zoomDelta = 0;

      // W/S: Tilt (pitch)
      if (activeKeys.has('KeyW')) pitchDelta += 1;
      if (activeKeys.has('KeyS')) pitchDelta -= 1;

      // A/D: Rotate (yaw)
      if (activeKeys.has('KeyA')) rotateBearing += 1;
      if (activeKeys.has('KeyD')) rotateBearing -= 1;

      // Q/E: Zoom
      if (activeKeys.has('KeyQ')) zoomDelta -= 1;
      if (activeKeys.has('KeyE')) zoomDelta += 1;

      if (pitchDelta !== 0) {
        const curPitch = map.getPitch();
        const pitchSpeed = (isShift ? 2.0 : 1.0) * 36;
        const nextPitch = Math.max(0, Math.min(85, curPitch + pitchDelta * pitchSpeed * dt));
        map.setPitch(nextPitch);
        setMapPitch(Math.round(nextPitch));
        setIs3D(nextPitch > 10);
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
        lockedElevation = null;
        const curZoom = map.getZoom();
        const zoomSpeed = (isShift ? 2.0 : 1.0) * 1.35;
        const nextZoom = Math.max(1.0, Math.min(19.0, curZoom + zoomDelta * zoomSpeed * dt));
        map.setZoom(nextZoom);
      }

      // Arrow keys: Terrain panning with fixed altitude lock
      let moveForward = 0;
      let moveStrafe = 0;

      if (activeKeys.has('ArrowUp')) moveForward += 1;
      if (activeKeys.has('ArrowDown')) moveForward -= 1;
      if (activeKeys.has('ArrowRight')) moveStrafe += 1;
      if (activeKeys.has('ArrowLeft')) moveStrafe -= 1;

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

        if (lockedElevation === null) {
          try {
            map.setCenterClampedToGround(false);
            lockedElevation = map.getCenterElevation();
          } catch (_) {
            lockedElevation = 0;
          }
        }

        map.jumpTo({
          center: [nextLng, nextLat],
          elevation: lockedElevation,
        });
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

        if (animationFrameId === null) {
          try {
            map.setCenterClampedToGround(false);
            lockedElevation = map.getCenterElevation();
          } catch (_) {
            lockedElevation = 0;
          }
          lastTimestamp = performance.now();
          animationFrameId = requestAnimationFrame(flightStep);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);
      if (activeKeys.size === 0 && animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        lastTimestamp = null;
        lockedElevation = null;
        try {
          map.setCenterClampedToGround(true);
        } catch (_) {}
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
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

          // Check if already in curated seed list -> SKIP to prevent double label!
          const pName = p.name.toLowerCase().trim();
          const pLng = pt[0];
          const pLat = pt[1];

          let isDuplicate = false;
          for (const cr of curatedList) {
            const dLat = Math.abs(pLat - cr.lat);
            const dLng = Math.abs(pLng - cr.lng);
            const dist = Math.hypot(dLat, dLng);
            const nameMatch = pName.includes(cr.name) || cr.name.includes(pName);
            if (dist < 0.05 || (nameMatch && dist < 0.15)) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) continue;

          const place = p.places?.[0]?.localized?.en;
          const country = place?.country || p.country || '';
          const region = place?.region || p.region || '';
          const classified = classifySkiFeature(p, pt);

          const rVert = p.vertical_ft || classified.cleanedVertFt || 0;
          const rAcres = p.skiable_acres || 0;

          if (classified.category === 'downhill') dhTotal++;
          else if (classified.category === 'nordic') nordTotal++;

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
            skiable_acres: props.skiable_acres || 0,
            pass_networks: (props.pass_networks && props.pass_networks.length > 0 ? props.pass_networks : ['Independent']) as PassNetwork[],
            summary: props.summary || '',
            website: props.website || '',
            lift_count: props.lift_count || null,
            run_count: props.run_count || null,
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
      setIs3D(newPitch > 10);
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
      setIs3D(false);
      mapRef.current.setRenderWorldCopies(false);
    } else {
      safeEaseTo(mapRef.current, {
        pitch: 62,
        duration: 600,
      });
      setMapPitch(62);
      setIs3D(true);
      mapRef.current.setRenderWorldCopies(false);
    }
  }, []);

  /* =========================================================================
     SELECTION HANDLERS WITH HEMISPHERE-AWARE 65° 3D SUN ANGLE
     ========================================================================= */

  const handleSelectResort = async (id: string) => {
    setSelectedResortId(id);
    const resort = displayedResorts.find((r) => r.id === id) || resorts.find((r) => r.id === id);
    if (!resort || !mapRef.current) return;

    const leftPad = leftDockOpen ? (window.innerWidth >= 768 ? 404 : 340) : 20;
    const rightPad = window.innerWidth >= 768 ? 384 : 336;

    // Bearing: use resort's default_bearing (fall-line / valley-up direction)
    const bearing = resort.default_bearing ?? 0;

    // Zoom: scale with both vertical drop and skiable acreage so sprawling resorts (Vail, Zermatt)
    // pull back appropriately, while maintaining a clear, framed view of the ski network.
    // Alta (~11.5) | Snowbird (~11.4) | Jackson (~11.2) | Vail (~10.9) | Zermatt (~10.2) | Small hill (~13.3)
    const vert = Math.max(resort.vertical_drop_ft || 1500, 500);
    const acres = Math.max(resort.skiable_acres || 500, 200);
    const zoom = Math.max(9.8, Math.min(13.5, 12.6 - Math.log2(vert / 1000) * 0.45 - Math.log2(acres / 1000) * 0.35));

    // Midpoint calculation:
    // Coordinates in GLOBAL_SKI_ATLAS point to the mountain base/village.
    // The trails and summit rise forward in the direction of default_bearing (valley looking up to peak).
    // Advancing from the base into the mountain along bearing centers the physical mountain.
    const midpointKm = Math.min(1.8, Math.max(0.6, (vert * 0.3048) / (2 * Math.tan(22 * Math.PI / 180)) / 1000));
    const bearingRad = (bearing * Math.PI) / 180;
    const dLat = (midpointKm / 111.32) * Math.cos(bearingRad);
    const dLng = (midpointKm / (111.32 * Math.cos((resort.lat * Math.PI) / 180))) * Math.sin(bearingRad);
    const targetCenter: [number, number] = [resort.lng + dLng, resort.lat + dLat];

    const pitch = 38;

    // Compute dynamic duration based on flight distance across the globe so transcontinental jumps don't stall
    const curCenter = mapRef.current.getCenter();
    const distDeg = Math.hypot(resort.lng - curCenter.lng, resort.lat - curCenter.lat);
    const flightDuration = distDeg > 40 ? 2800 : (distDeg > 15 ? 2200 : 1600);

    safeFlyTo(mapRef.current, {
      center: targetCenter,
      zoom,
      pitch,
      bearing,
      padding: { left: leftPad, right: rightPad, top: 60, bottom: 140 },
      duration: flightDuration,
      essential: true,
    });

    // Stream trails for this mountain AND adjacent mountains in bounding box
    if (fetchOverpassBboxRef.current) {
      fetchOverpassBboxRef.current(
        resort.lat - 0.22,
        resort.lng - 0.25,
        resort.lat + 0.22,
        resort.lng + 0.25
      );
    }

    // Fetch deep weather for dossier
    const live = await fetchLiveWeather(resort);
    if (live) {
      setResorts((prev) => prev.map((r) => (r.id === id ? { ...r, weather: live } : r)));
    }
  };

  const handleSelectGlobalResort = async (p: any, coords: [number, number]) => {
    const id = p.id || `global-${Math.round(coords[0] * 1000)}-${Math.round(coords[1] * 1000)}`;
    setSelectedResortId(id);

    const isSouth = coords[1] < 0;
    const leftPad = leftDockOpen ? (window.innerWidth >= 768 ? 404 : 340) : 20;
    const rightPad = window.innerWidth >= 768 ? 384 : 336;

    safeFlyTo(mapRef.current, {
      center: [coords[0], coords[1]],
      zoom: 12.0,
      pitch: 38,
      bearing: 0,
      padding: { left: leftPad, right: rightPad, top: 60, bottom: 140 },
      duration: 1800,
      essential: true,
    });

    if (fetchOverpassBboxRef.current) {
      fetchOverpassBboxRef.current(
        coords[1] - 0.20,
        coords[0] - 0.22,
        coords[1] + 0.20,
        coords[0] + 0.22
      );
    }
  };

  const handleDeselectResort = () => {
    setSelectedResortId(null);
    if (mapRef.current) {
      const leftPad = leftDockOpen ? (window.innerWidth >= 768 ? 404 : 340) : 20;
      mapRef.current.easeTo({
        padding: { left: leftPad, right: 0, top: 52, bottom: 0 },
        duration: 300,
      });
    }
  };

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
      <header className="absolute top-0 inset-x-0 z-20 h-13 flex items-center justify-between px-4 bg-[#F7F4ED] border-b border-[#D6D0C2]">
        <div className="flex items-center gap-2.5">
          <Mountain className="w-5 h-5 text-[#2E5A44]" />
          <h1 className="text-lg font-bold tracking-tight text-[#1C1B18] font-serif">
            SkiAtlas
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setUnitsMetric(!unitsMetric)}
            className="px-2.5 py-1 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-[2px] transition-colors cursor-pointer"
            title="Toggle Metric / Imperial units"
          >
            {unitsMetric ? 'Metric (°C, m)' : 'Imperial (°F, ft)'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="h-[26px] w-[26px] bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-[2px] transition-colors cursor-pointer flex items-center justify-center"
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

      {/* SLIDING ARCHITECTURAL SKI DIRECTORY TRAY */}
      <div
        className={`absolute top-13 bottom-0 left-0 z-30 flex flex-col transition-transform duration-300 ease-in-out pointer-events-none ${
          leftDockOpen ? 'w-80 md:w-96 translate-x-0' : 'w-80 md:w-96 -translate-x-full'
        }`}
      >
        {/* CLEARLY FRAMED ARCHITECTURAL TRAY BODY */}
        <div className="relative flex flex-col h-full bg-[#F7F4ED] border-r border-[#D6D0C2] shadow-2xl overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#D6D0C2] bg-[#F7F4ED] shrink-0">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#2E5A44]" />
              <span className="font-serif text-sm font-bold text-[#1C1B18] tracking-tight">
                Ski Directory
              </span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#2E5A44] text-[#FAF8F3] font-mono text-[9px] px-1.5 py-0.2 rounded-[2px] font-bold">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
          </div>

          {/* CLEARLY DEFINED TERRAIN & INFRASTRUCTURE FILTERS CARD */}
          <div className="p-3 border-b border-[#D6D0C2] bg-[#FAF8F3] space-y-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#8A847C] pointer-events-none" />
              <input
                type="text"
                placeholder="Search alpine resorts, peaks, countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F7F4ED] border border-[#D6D0C2] rounded-[2px] pl-8 pr-7 py-1.5 text-xs text-[#1C1B18] placeholder-[#8A847C] font-mono focus:outline-none focus:border-[#2C2A27]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#8A847C] hover:text-[#1C1B18]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Framed Filter Box */}
            <div className="border border-[#D6D0C2] rounded-[2px] bg-[#F7F4ED] p-2.5 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono border-b border-[#D6D0C2] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#1C1B18] uppercase tracking-wider text-[9px]">
                    Terrain Filters
                  </span>
                  <span className="text-[9px] text-[#8A847C] font-normal">
                    ({filteredResorts.length.toLocaleString()} matching)
                  </span>
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[#B84A39] hover:underline cursor-pointer text-[9px]"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Categories (Downhill default ON, Nordic/Cat-Heli default OFF) */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setShowDownhill(!showDownhill)}
                  className={`py-1 px-1 rounded-[2px] text-[10px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    showDownhill
                      ? 'bg-[#3B627E]/10 border-[#3B627E] text-[#3B627E] font-bold shadow-xs'
                      : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-60'
                  }`}
                  title="Toggle Downhill Ski Areas"
                >
                  <span>⛷️ Downhill ({categoryFilterCounts.downhill.toLocaleString()})</span>
                </button>
                <button
                  onClick={() => setShowNordic(!showNordic)}
                  className={`py-1 px-1 rounded-[2px] text-[10px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    showNordic
                      ? 'bg-[#2E5A44]/10 border-[#2E5A44] text-[#2E5A44] font-bold shadow-xs'
                      : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-60'
                  }`}
                  title="Toggle Nordic / Cross-Country Ski Centers"
                >
                  <span>🎿 Nordic ({categoryFilterCounts.nordic.toLocaleString()})</span>
                </button>
                <button
                  onClick={() => setShowHeliCat(!showHeliCat)}
                  className={`py-1 px-1 rounded-[2px] text-[10px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    showHeliCat
                      ? 'bg-[#B84A39]/10 border-[#B84A39] text-[#B84A39] font-bold shadow-xs'
                      : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-60'
                  }`}
                  title="Toggle Guided Snowcat & Heli Ski Operations"
                >
                  <span>🚁 Heli/Cat ({categoryFilterCounts.heli_cat.toLocaleString()})</span>
                </button>
              </div>

              {/* Min Vertical Slider (Default 500') */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#5C5852]">Min Vertical Drop</span>
                  <span className="text-[#1C1B18] font-bold">{minVertical > 0 ? formatVert(minVertical) : 'Any'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4000"
                  step="100"
                  value={minVertical}
                  onChange={(e) => setMinVertical(Number(e.target.value))}
                  className="w-full tufte-slider cursor-pointer"
                />
              </div>

              {/* Min Acreage Slider (Default 100 ac) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#5C5852]">Min Skiable Acres</span>
                  <span className="text-[#2E5A44] font-bold">{minAcreage > 0 ? formatAcres(minAcreage) : 'Any'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="100"
                  value={minAcreage}
                  onChange={(e) => setMinAcreage(Number(e.target.value))}
                  className="w-full tufte-slider cursor-pointer"
                />
              </div>
            </div>

            {/* Sort Controls Row */}
            <div className="flex items-center justify-between gap-1 text-[10px] font-mono pt-0.5">
              <span className="text-[#8A847C] uppercase tracking-wider font-semibold text-[9px] shrink-0">Sort:</span>
              <div className="flex items-center gap-0.5 bg-[#FAF8F3] p-0.5 rounded-[2px] border border-[#D6D0C2]">
                <button
                  onClick={() => handleSortClick('vert')}
                  className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
                    sortBy === 'vert' ? 'bg-[#F7F4ED] text-[#1C1B18] font-bold border border-[#2C2A27]' : 'text-[#5C5852] hover:text-[#1C1B18]'
                  }`}
                >
                  <span>Vert</span>
                  {sortBy === 'vert' && <span className="text-[8px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                </button>
                <button
                  onClick={() => handleSortClick('acres')}
                  className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
                    sortBy === 'acres' ? 'bg-[#F7F4ED] text-[#2E5A44] font-bold border border-[#2C2A27]' : 'text-[#5C5852] hover:text-[#1C1B18]'
                  }`}
                >
                  <span>Acres</span>
                  {sortBy === 'acres' && <span className="text-[8px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                </button>
                <button
                  onClick={() => handleSortClick('name')}
                  className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
                    sortBy === 'name' ? 'bg-[#F7F4ED] text-[#1C1B18] font-bold border border-[#2C2A27]' : 'text-[#5C5852] hover:text-[#1C1B18]'
                  }`}
                >
                  <span>A-Z</span>
                  {sortBy === 'name' && <span className="text-[8px] ml-0.5">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                </button>
                <button
                  onClick={() => handleSortClick('snow')}
                  className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
                    sortBy === 'snow' ? 'bg-[#F7F4ED] text-[#3B627E] font-bold border border-[#2C2A27]' : 'text-[#5C5852] hover:text-[#1C1B18]'
                  }`}
                >
                  <span>7-Day ❄</span>
                  {sortBy === 'snow' && <span className="text-[8px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Directory Scope Category Tabs: In Frame vs All Matching Filters */}
          <div className="px-3 py-1.5 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center gap-1.5 text-[10.5px] font-mono shrink-0">
            <button
              onClick={() => setDirectoryScope('in_frame')}
              className={`flex-1 py-1 px-2 rounded-[2px] border text-center transition-all cursor-pointer font-bold tracking-tight ${
                directoryScope === 'in_frame'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2C2A27] shadow-2xs'
                  : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
              }`}
              title="Show only ski areas currently inside the map view frame"
            >
              <span>{inViewResorts.length.toLocaleString()} IN FRAME</span>
            </button>
            <button
              onClick={() => setDirectoryScope('all')}
              className={`flex-1 py-1 px-2 rounded-[2px] border text-center transition-all cursor-pointer font-bold tracking-tight ${
                directoryScope === 'all'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2E5A44] shadow-2xs ring-1 ring-[#2E5A44]/30'
                  : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
              }`}
              title="Show all ski areas matching current filters worldwide"
            >
              <span>{filteredResorts.length.toLocaleString()} ALL MATCHING</span>
            </button>
          </div>

          {/* Directory Cards List (Engraved Ledger Cards) */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#D6D0C2] bg-[#F7F4ED]">
            {displayedResorts.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-[#8A847C] space-y-2">
                <div>
                  {directoryScope === 'in_frame'
                    ? '0 ski areas in current map view frame.'
                    : 'No ski areas match current filters.'}
                </div>
                {directoryScope === 'in_frame' && filteredResorts.length > 0 && (
                  <button
                    onClick={() => setDirectoryScope('all')}
                    className="inline-block px-2.5 py-1 text-[11px] font-mono font-bold text-[#2E5A44] bg-[#FAF8F3] border border-[#2E5A44] rounded-[2px] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                  >
                    View all {filteredResorts.length.toLocaleString()} matching areas →
                  </button>
                )}
              </div>
            ) : (
              displayedResorts.map((r) => {
                const isSelected = r.id === selectedResortId;
                const snow72 = r.weather?.snowfall_72h_in ?? 0;
                const snow7d = r.weather?.snowfall_7d_in ?? 0;
                const badge = getCategoryBadge(r.category);
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectResort(r.id)}
                    className={`p-2.5 transition-colors cursor-pointer group ${
                      isSelected ? 'bg-[#FAF8F3] border-l-2 border-l-[#2E5A44]' : 'hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-serif font-bold text-sm text-[#1C1B18] tracking-tight truncate">
                            {r.name}
                          </h3>
                          <span className={`text-[8px] font-mono px-1 py-0.2 rounded-[2px] border ${badge.bg} ${badge.text} ${badge.border} shrink-0`}>
                            {badge.icon} {badge.label}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#5C5852] mt-0.5">
                          <span>{r.region ? `${r.region}, ` : ''}{r.country}</span>
                          {r.vertical_drop_ft && r.vertical_drop_ft > 0 && ` · ${formatVert(r.vertical_drop_ft)}`}
                          {r.skiable_acres > 0 && ` · ${formatAcres(r.skiable_acres)}`}
                        </div>
                      </div>

                      {/* Live Upcoming Snowfall Forecast Chip (NO TEMPERATURE) */}
                      {r.weather?.is_live && (
                        <div className="shrink-0 flex items-center font-mono text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded-[2px] border flex items-center gap-1 ${
                              snow7d > 0
                                ? 'bg-[#3B627E]/10 border-[#3B627E]/40 text-[#3B627E] font-bold'
                                : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C]'
                            }`}
                            title="Upcoming 7-day forecast snowfall"
                          >
                            <Snowflake className="w-2.5 h-2.5 text-[#3B627E]" />
                            <span>{formatSnow(snow7d)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TRAY EDGE PULL TAB (FULL-HEIGHT SEAM RAIL ON THE EDGE OF THE TRAY) */}
        <button
          onClick={() => setLeftDockOpen(!leftDockOpen)}
          className="absolute top-0 bottom-0 left-full pointer-events-auto z-40 flex items-center justify-center w-5 bg-[#FAF8F3] hover:bg-[#EFECE4] border-r border-[#D6D0C2] hover:border-[#2C2A27] shadow-[2px_0_6px_rgba(0,0,0,0.06)] transition-colors cursor-pointer group"
          title={leftDockOpen ? "Collapse directory tray" : "Open directory tray"}
          aria-label={leftDockOpen ? "Collapse directory tray" : "Open directory tray"}
        >
          <div className="flex items-center justify-center w-4 h-8 rounded-[2px] group-hover:bg-[#E5E0D5] transition-colors">
            <svg
              className="w-2.5 h-3 text-[#5A554E] group-hover:text-[#1C1B18] transition-colors"
              viewBox="0 0 8 10"
              fill="currentColor"
            >
              {leftDockOpen ? (
                <polygon points="7,1 1,5 7,9" />
              ) : (
                <polygon points="1,1 7,5 1,9" />
              )}
            </svg>
          </div>
        </button>
      </div>

      {/* FLOATING TOP-LEFT MAP VIEWPORT CONTROLS: NORTH ARROW & ZOOM */}
      <div
        className={`absolute top-16 ${
          leftDockOpen ? 'left-[356px] md:left-[420px]' : 'left-8'
        } z-20 flex flex-col bg-[#FAF8F3] border border-[#2C2A27] rounded-[2px] shadow-sm divide-y divide-[#D6D0C2] overflow-hidden transition-all duration-300 ease-in-out`}
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

        {/* Reorient North Button (Clean Minimal Cartographic Style, Below +/-) */}
        <button
          onClick={handleResetNorth}
          className="w-8 h-8 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer group"
          title="Reorient to True North (0°)"
          aria-label="Reorient to True North"
        >
          <svg
            className="w-4 h-4 pointer-events-none transition-transform duration-150 ease-out"
            viewBox="0 0 24 24"
            style={{ transform: `rotate(${-mapBearing}deg)` }}
          >
            {/* North needle tip (clean filled triangular needle in dark ink #1C1B18) */}
            <polygon points="12,3 16,13 12,11.2" fill="#1C1B18" />
            <polygon points="12,3 8,13 12,11.2" fill="#5A554E" />
            {/* South needle tip (clean outline/subtle tint) */}
            <polygon points="12,21 16,13 12,14.8" fill="#D6D0C2" />
            <polygon points="12,21 8,13 12,14.8" fill="#E5E0D5" />
            {/* Minimal center pivot */}
            <circle cx="12" cy="13" r="1.5" fill="#1C1B18" />
          </svg>
        </button>
      </div>

      {/* FLOATING TOP-RIGHT CARTO CONTROLS: BASEMAP POPOVER */}
      <div
        ref={basemapMenuRef}
        className={`absolute top-16 ${
          selectedResort ? 'right-88 md:right-100' : 'right-4'
        } z-20 flex items-center gap-2 transition-all duration-300`}
      >
        {/* Basemap & Layers Dropdown Anchor */}
        <div className="relative">
          <button
            onClick={() => setMapMenuOpen(!mapMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border text-xs font-mono transition-all cursor-pointer shadow-xs ${
              mapMenuOpen
                ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2E5A44] ring-1 ring-[#2E5A44]/30 font-semibold'
                : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
            }`}
            title="Basemap Styles & Layer Overlays"
          >
            <Layers className="w-3.5 h-3.5 text-[#2E5A44]" />
            <span className="font-mono text-[11px] font-semibold">Basemap & Layers</span>
          </button>

          {mapMenuOpen && (
            <div className="absolute right-0 top-10 w-80 bg-[#FAF8F3] border border-[#2C2A27] rounded-[2px] p-3 space-y-3 z-30 text-xs font-mono shadow-2xl animate-in fade-in duration-150 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#2E5A44]" />
                  <span className="font-serif text-xs font-bold text-[#1C1B18] tracking-tight">
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

              {/* EARTH PROJECTION SELECTION */}
              <div>
                <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Earth Projection</span>
                  <span className="text-[9px] text-[#5C5852] font-normal">Geometry</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setEarthProjection('globe');
                      if (mapRef.current && mapRef.current.getZoom() < 5) {
                        safeEaseTo(mapRef.current, { pitch: 0, duration: 400 });
                        setMapPitch(0);
                        setIs3D(false);
                      }
                    }}
                    className={`p-2 rounded-[2px] border text-left transition-all cursor-pointer ${
                      earthProjection === 'globe'
                        ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2E5A44] ring-1 ring-[#2E5A44]/30 font-bold'
                        : 'bg-[#F7F4ED] text-[#5C5852] border-[#D6D0C2] hover:bg-[#EFECE4]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#2E5A44]" />
                      <span className="text-[11px]">3D Globe</span>
                    </div>
                    <div className="text-[9px] text-[#5C5852] mt-0.5 font-normal leading-tight">
                      Spherical Earth
                    </div>
                  </button>
                  <button
                    onClick={() => setEarthProjection('mercator')}
                    className={`p-2 rounded-[2px] border text-left transition-all cursor-pointer ${
                      earthProjection === 'mercator'
                        ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2E5A44] ring-1 ring-[#2E5A44]/30 font-bold'
                        : 'bg-[#F7F4ED] text-[#5C5852] border-[#D6D0C2] hover:bg-[#EFECE4]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#3B627E]" />
                      <span className="text-[11px]">Flat Map</span>
                    </div>
                    <div className="text-[9px] text-[#5C5852] mt-0.5 font-normal leading-tight">
                      Planar Mercator
                    </div>
                  </button>
                </div>
              </div>

              {/* BASEMAP STYLE SELECTION */}
              <div>
                <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Cartographic Base</span>
                  <span className="text-[9px] text-[#5C5852] font-normal">Select style</span>
                </div>
              <div className="space-y-1">
                {[
                  { id: 'satellite', label: 'Satellite 3D', desc: 'High-resolution aerial satellite imagery' },
                  { id: 'osm', label: 'OpenStreetMap', desc: 'Detailed vector roads, towns & trails' },
                  { id: 'topo', label: 'Alpine Topo', desc: 'Painted relief zooming to detailed topo contours' },
                ].map((item) => {
                  const isSelected = basemapMode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setBasemapMode(item.id as BasemapMode)}
                      className={`w-full text-left p-2 rounded-[2px] border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#2E5A44] ring-1 ring-[#2E5A44]/30'
                          : 'bg-[#F7F4ED] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#1C1B18]">{item.label}</span>
                        {isSelected && (
                          <span className="text-[8.5px] font-mono uppercase font-bold px-1.5 py-0.2 rounded-[2px] bg-[#2E5A44] text-[#FAF8F3]">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] text-[#5C5852] mt-0.5 leading-tight">
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MAP OVERLAYS & FEATURE TOGGLES */}
            <div className="pt-2 border-t border-[#D6D0C2]">
              <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider mb-1.5 flex items-center justify-between">
                <span>Map Overlays</span>
                <span className="text-[9px] text-[#5C5852] font-normal">Toggle visibility</span>
              </div>
              <div className="space-y-1">
                {/* 1. Alpine Ski Trails */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">Alpine Ski Trails</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      Colored downhill piste runs &amp; difficulty grades
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${showAlpineTrails ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {showAlpineTrails ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showAlpineTrails}
                      onChange={(e) => setShowAlpineTrails(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>

                {/* 1b. Nordic / XC Trails */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">Nordic / XC Trails</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      Groomed cross-country &amp; skate ski tracks
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${showNordicTrails ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {showNordicTrails ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showNordicTrails}
                      onChange={(e) => setShowNordicTrails(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>

                {/* 2. Ski Lifts */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">Aerialway Lifts</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      Trams, chairlifts, gondolas & tows
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${showLifts ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {showLifts ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showLifts}
                      onChange={(e) => setShowLifts(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>

                {/* 3. Resort Markers & Labels */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">Resort Pins & Labels</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      Worldwide ski areas, cluster pins & titles
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${showResortMarkers ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {showResortMarkers ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showResortMarkers}
                      onChange={(e) => setShowResortMarkers(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>

                {/* 4. 3D Terrain Elevation */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">3D Topographic Terrain</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      DEM elevation mesh (0.7x vertical relief)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${show3DTerrain ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {show3DTerrain ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={show3DTerrain}
                      onChange={(e) => setShow3DTerrain(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>

                {/* 5. Hillshade Relief */}
                <label className="flex items-start justify-between p-2 rounded-[2px] bg-[#F7F4ED] border border-[#D6D0C2] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none">
                  <div className="pr-2">
                    <div className="text-[11px] font-bold text-[#1C1B18]">Hillshade Relief</div>
                    <div className="text-[9px] text-[#5C5852] leading-tight">
                      Sun-angled slope shadows (Topo & OSM)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className={`text-[8.5px] font-mono font-bold ${showHillshade ? 'text-[#2E5A44]' : 'text-[#8A847C]'}`}>
                      {showHillshade ? 'ON' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showHillshade}
                      onChange={(e) => setShowHillshade(e.target.checked)}
                      className="accent-[#2E5A44] w-3.5 h-3.5 cursor-pointer rounded-[2px]"
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* CARTOGRAPHIC MAP FURNITURE: ALTERNATING BAR SCALE & LEGEND */}
      <div ref={mapLegendRef} className={`absolute bottom-5 ${leftDockOpen ? 'left-88 md:left-106' : 'left-8'} z-20 transition-all duration-300 select-none`}>
        {mapLegendOpen && (
          <div className="absolute bottom-11 left-0 w-72 bg-[#FAF8F3] border border-[#2C2A27] rounded-[2px] p-3.5 space-y-3 z-30 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-2">
              <span className="font-serif text-sm font-bold text-[#1C1B18]">Cartographic Key</span>
              <button onClick={() => setMapLegendOpen(false)} className="text-[#8A847C] hover:text-[#1C1B18]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Piste Key */}
            <div className="space-y-1 font-mono text-[9px]">
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
            {/* Keyboard Guide */}
            <div className="pt-2 border-t border-[#D6D0C2] font-mono text-[9px] text-[#5C5852] space-y-1">
              <div><strong className="text-[#1C1B18]">W / S:</strong> Tilt horizon / nadir</div>
              <div><strong className="text-[#1C1B18]">A / D:</strong> Rotate camera heading</div>
              <div><strong className="text-[#1C1B18]">Q / E:</strong> Zoom Out / In</div>
              <div><strong className="text-[#1C1B18]">Arrows:</strong> Pan terrain (fixed altitude)</div>
            </div>
          </div>
        )}

        {/* Alternating Scale Bar */}
        <div className="flex items-center gap-2 bg-[#FAF8F3] border border-[#2C2A27] rounded-[2px] px-2.5 py-1.5 font-mono text-[10px] text-[#1C1B18] shadow-xs">
          <button
            onClick={() => setMapLegendOpen(!mapLegendOpen)}
            className="flex items-center gap-1 hover:text-[#2E5A44] transition-colors cursor-pointer mr-1"
            title="Toggle Map Key & Controls"
          >
            <Layers className="w-3.5 h-3.5 text-[#2E5A44]" />
            <span className="font-bold underline">Key</span>
          </button>
          <div className="h-3 w-px bg-[#D6D0C2]" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold">{mapScale.distStr}</span>
            <div className="flex h-1.5 border border-[#2C2A27] overflow-hidden" style={{ width: `${mapScale.barWidth}px` }}>
              <div className="h-full bg-[#1C1B18] flex-1" />
              <div className="h-full bg-[#FAF8F3] flex-1" />
              <div className="h-full bg-[#1C1B18] flex-1" />
              <div className="h-full bg-[#FAF8F3] flex-1" />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          UNIFIED CARTOGRAPHIC NAVIGATION GIMBAL & COMPASS INSTRUMENT
          Integrated concentric dual-action dial:
          - Outer Ring (Ø 72px): Rotary Compass heading & True North snap
          - Inner Core (Ø 42px): 3D Horizon gimbal & 2D/3D perspective tilt
          ===================================================================== */}
      <div
        className={`absolute bottom-6 ${
          selectedResort ? 'right-92 md:right-104' : 'right-6'
        } z-20 select-none transition-all duration-300`}
      >
        <div
          className="relative w-[72px] h-[72px] rounded-full bg-[#FAF8F3] border border-[#2C2A27] shadow-sm flex items-center justify-center p-0"
          title="Navigation Instrument: Outer ring controls heading (click to reset North) · Inner disc controls 3D tilt & perspective"
        >
          {/* 1. OUTER ROTARY COMPASS BEZEL (HEADING / BEARING) */}
          <div
            onMouseDown={handleCompassMouseDown}
            onClick={handleResetNorth}
            className={`absolute inset-0 rounded-full flex items-center justify-center cursor-pointer transition-all ${
              isCompassDragging ? 'cursor-grabbing scale-[1.02] ring-1 ring-[#2C2A27]' : 'cursor-grab hover:bg-[#EFECE4]'
            }`}
          >
            {/* Dynamic Rotating SVG Bezel */}
            <svg
              className="w-full h-full pointer-events-none transition-transform ease-out"
              viewBox="0 0 72 72"
              style={{
                transform: `rotate(${-mapBearing}deg)`,
                transitionDuration: isCompassDragging ? '0ms' : '150ms',
              }}
            >
              {/* Outer Calibration Rings */}
              <circle cx="36" cy="36" r="34" fill="none" stroke="#2C2A27" strokeWidth="0.8" strokeOpacity="0.75" />
              <circle cx="36" cy="36" r="32" fill="none" stroke="#2C2A27" strokeWidth="0.4" strokeDasharray="1.5 1.5" strokeOpacity="0.5" />
              <circle cx="36" cy="36" r="23.5" fill="none" stroke="#2C2A27" strokeWidth="0.6" strokeOpacity="0.4" />

              {/* Degree Tick Marks on Rim */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={`tick-${deg}`}
                  x1="36"
                  y1="2"
                  x2="36"
                  y2={deg % 90 === 0 ? "6" : "4"}
                  stroke={deg === 0 ? "#B84A39" : "#2C2A27"}
                  strokeWidth={deg % 90 === 0 ? "1" : "0.5"}
                  strokeOpacity={deg === 0 ? "1" : "0.75"}
                  transform={`rotate(${deg} 36 36)`}
                />
              ))}

              {/* Secondary Faceted Points (NE, NW, SE, SW) */}
              <g opacity="0.45">
                <polygon points="36,36 36,24 38,36" fill="#2C2A27" transform="rotate(45 36 36)" />
                <polygon points="36,36 36,24 34,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.4" transform="rotate(45 36 36)" />
                <polygon points="36,36 36,24 38,36" fill="#2C2A27" transform="rotate(135 36 36)" />
                <polygon points="36,36 36,24 34,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.4" transform="rotate(135 36 36)" />
                <polygon points="36,36 36,24 38,36" fill="#2C2A27" transform="rotate(225 36 36)" />
                <polygon points="36,36 36,24 34,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.4" transform="rotate(225 36 36)" />
                <polygon points="36,36 36,24 38,36" fill="#2C2A27" transform="rotate(315 36 36)" />
                <polygon points="36,36 36,24 34,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.4" transform="rotate(315 36 36)" />
              </g>

              {/* Cardinal East, South, West Points */}
              <polygon points="36,36 36,54 39,36" fill="#2C2A27" opacity="0.75" />
              <polygon points="36,36 36,54 33,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.5" opacity="0.75" />
              <polygon points="36,36 54,36 36,39" fill="#2C2A27" opacity="0.75" />
              <polygon points="36,36 54,36 36,33" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.5" opacity="0.75" />
              <polygon points="36,36 18,36 36,33" fill="#2C2A27" opacity="0.75" />
              <polygon points="36,36 18,36 36,39" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.5" opacity="0.75" />

              {/* North Arrow Point (Terracotta Vermilion #B84A39 / Deep Charcoal) */}
              <polygon points="36,36 36,11 40,36" fill="#B84A39" />
              <polygon points="36,36 36,11 32,36" fill="#FAF8F3" stroke="#2C2A27" strokeWidth="0.6" />

              {/* Cardinal Letters in Tabular/Serif */}
              <text x="36" y="9" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="Newsreader, serif" fill="#B84A39">N</text>
              <text x="64" y="38.5" textAnchor="middle" fontSize="6" fontFamily="JetBrains Mono, monospace" fill="#5C5852">E</text>
              <text x="36" y="65" textAnchor="middle" fontSize="6" fontFamily="JetBrains Mono, monospace" fill="#5C5852">S</text>
              <text x="8" y="38.5" textAnchor="middle" fontSize="6" fontFamily="JetBrains Mono, monospace" fill="#5C5852">W</text>
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
              setIs3D(false);
              mapRef.current.setRenderWorldCopies(false);
            }}
            className={`relative z-10 w-[42px] h-[42px] rounded-full bg-[#FAF8F3] border border-[#2C2A27]/40 shadow-inner flex items-center justify-center transition-all ${
              isTiltDragging
                ? 'cursor-grabbing scale-105 ring-1 ring-[#2C2A27]'
                : 'cursor-grab hover:bg-[#EFECE4]'
            }`}
            title="Navigation Gimbal: Drag horizontally to rotate heading · Drag vertically to tilt pitch · Click to toggle 2D/3D · Double-click to flatten"
          >
            {/* SVG Perimeter Ring & Dynamic Pitch Arc Meter */}
            <svg className="w-[34px] h-[34px] pointer-events-none" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r="14.5" fill="none" stroke="#2C2A27" strokeWidth="0.6" strokeOpacity="0.25" />
              {/* Pitch Arc Angle Meter */}
              <circle
                cx="17"
                cy="17"
                r="14.5"
                fill="none"
                stroke="#2E5A44"
                strokeWidth="1.6"
                strokeDasharray={`${(mapPitch / 85) * 36} 100`}
                strokeLinecap="round"
                transform="rotate(-90 17 17)"
                opacity={is3D ? 0.95 : 0.15}
              />
            </svg>

            {/* Viewing Angle Display - Strictly Centered (No up/down translation) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-[11.5px] font-mono font-bold text-[#1C1B18] tracking-tight leading-none">
                {is3D ? `${mapPitch}°` : '2D'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ATTRIBUTION (CLEAN ARCHIVAL PAPER AT BOTTOM CENTER) */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
        <div className="flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-0.5 rounded-[2px] bg-[#FAF8F3]/90 backdrop-blur-xs border border-[#D6D0C2] text-[#8A847C] select-none">
          <span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">OpenStreetMap</a></span>
          <span>·</span>
          <span><a href="https://openskidata.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">OpenSkiData</a></span>
          <span>·</span>
          <span><a href="https://www.esri.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1B18]">Esri</a></span>
        </div>
      </div>

      {/* RIGHT MOUNTAIN DOSSIER (WARM ARCHIVAL COTTON RAG PAPER) */}
      {selectedResort && (
        <div className="absolute top-13 bottom-0 right-0 z-20 w-84 md:w-96 flex flex-col bg-[#F7F4ED] border-l border-[#D6D0C2] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-[#D6D0C2] bg-[#F7F4ED]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-[#5C5852]">
                  {selectedResort.region ? `${selectedResort.region}, ` : ''}{selectedResort.country}
                </div>
                <h2 className="text-base font-serif font-bold text-[#1C1B18] tracking-tight mt-0.5 truncate">
                  {selectedResort.name}
                </h2>
              </div>
              <button
                onClick={handleDeselectResort}
                className="p-1 hover:bg-[#EFECE4] text-[#8A847C] hover:text-[#1C1B18] rounded-[2px] transition-colors cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Official Website Link */}
            {(() => {
              const site = getResortWebsite(selectedResort);
              if (!site) return null;
              return (
                <div className="mt-1.5">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#2E5A44] hover:text-[#1C1B18] hover:underline transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{site.isDirect ? 'Official Website' : 'Search Official Site'}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                </div>
              );
            })()}
          </div>

          {/* Dossier Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F7F4ED]">
            {/* Mountain Overview / Summary */}
            {selectedResort.summary && (
              <div className="bg-[#FAF8F3] p-3 rounded-[2px] border border-[#D6D0C2] text-xs font-serif text-[#1C1B18] leading-relaxed">
                <p>{selectedResort.summary}</p>
              </div>
            )}

            {/* Metric Tables */}
            {(() => {
              const stats = getResortStats(selectedResort);
              return (
                <div className="bg-[#FAF8F3] border border-[#D6D0C2] rounded-[2px] overflow-hidden font-mono text-center">
                  {/* Row 1: Infrastructure */}
                  <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] border-b border-[#D6D0C2] p-2">
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Lifts</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.lifts ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Pistes</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.pistes ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Acres</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">
                        {stats.acres && stats.acres > 0 ? formatAcres(stats.acres) : '—'}
                      </div>
                    </div>
                  </div>
                  {/* Row 2: Elevations */}
                  <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] p-2 bg-[#F7F4ED]">
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Vertical</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(selectedResort.vertical_drop_ft)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Summit</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(selectedResort.summit_elev_ft)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#5C5852] uppercase">Base</div>
                      <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(selectedResort.base_elev_ft)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Summit Weather Forecast */}
            <div className="bg-[#FAF8F3] p-3 rounded-[2px] border border-[#D6D0C2] space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-[#1C1B18]">
                  <Snowflake className="w-3.5 h-3.5 text-[#3B627E]" />
                  <span>Summit Meteorology</span>
                </div>
                {selectedResort.weather?.is_live && (
                  <span className="text-[9px] text-[#8A847C]">{selectedResort.weather.last_updated}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#F7F4ED] p-2 border border-[#D6D0C2] rounded-[2px]">
                  <div className="text-[9px] text-[#5C5852] uppercase">72h Snow</div>
                  <div className="text-base font-bold text-[#3B627E] mt-0.5">
                    {formatSnow(selectedResort.weather?.snowfall_72h_in ?? 0)}
                  </div>
                </div>
                <div className="bg-[#F7F4ED] p-2 border border-[#D6D0C2] rounded-[2px]">
                  <div className="text-[9px] text-[#5C5852] uppercase">7-Day Snow</div>
                  <div className="text-base font-bold text-[#3B627E] mt-0.5">
                    {selectedResort.weather?.daily_forecast
                      ? formatSnow(
                          Math.round(
                            selectedResort.weather.daily_forecast.reduce(
                              (sum, d) => sum + (unitsMetric ? d.snowfall_cm / 2.54 : d.snowfall_in),
                              0
                            ) * 10
                          ) / 10
                        )
                      : '—'}
                  </div>
                </div>
              </div>

              {/* 7-Day Snowfall Bars */}
              {selectedResort.weather?.daily_forecast && selectedResort.weather.daily_forecast.length > 0 && (
                <div className="grid grid-cols-7 gap-1 h-16 items-end bg-[#F7F4ED] p-1.5 border border-[#D6D0C2] rounded-[2px]">
                  {selectedResort.weather.daily_forecast.map((day, idx) => {
                    const val = unitsMetric ? day.snowfall_cm : day.snowfall_in;
                    const maxVal = Math.max(1, ...selectedResort.weather!.daily_forecast.map((d) => (unitsMetric ? d.snowfall_cm : d.snowfall_in)));
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
                        <span className="text-[8px] text-[#8A847C] mt-1">
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
      )}
    </div>
  );
}

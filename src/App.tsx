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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RefreshCw,
  MapPin,
  ExternalLink,
  Navigation,
  Sun,
  Maximize,
  Globe,
  Menu,
  X,
  Filter,
} from 'lucide-react';

/* =========================================================================
   TYPES
   ========================================================================= */

export type PassNetwork = 'Ikon' | 'Epic' | 'Indy' | 'Mountain Collective' | 'Independent';

export type SkiActivityCategory = 'downhill' | 'nordic' | 'heli_cat' | 'backcountry' | 'informal';

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
  activities?: ('downhill' | 'nordic' | 'heli_cat' | 'backcountry')[];
  operation_type?: 'resort' | 'nordic_center' | 'cat_ski' | 'heli_ski' | 'backcountry_zone';
  tenure_acres?: number;
}

export type BasemapMode = 'topo' | 'osm' | 'satellite';

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
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const poly of coordinates) {
      if (Array.isArray(poly) && Array.isArray(poly[0])) {
        for (const pt of poly[0]) {
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
      }
    }
    if (count > 0) return [sumLng / count, sumLat / count];
  }
  let flat = coordinates;
  while (Array.isArray(flat) && Array.isArray(flat[0])) {
    flat = flat[0];
  }
  if (
    Array.isArray(flat) &&
    typeof flat[0] === 'number' &&
    typeof flat[1] === 'number' &&
    !isNaN(flat[0]) &&
    !isNaN(flat[1])
  ) {
    return [flat[0], flat[1]];
  }
  return null;
}

/* =========================================================================
   SAFE MAP CAMERA CONTROLS (GUARDS AGAINST INVALID/NaN COORDINATES)
   ========================================================================= */

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
    map.flyTo(options);
  } catch (err) {
    console.warn('safeFlyTo caught exception:', err);
  }
}

export function safeEaseTo(map: MapLibreMap | null, options: any) {
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
      console.warn('safeEaseTo rejected invalid coordinates:', c);
      return;
    }
    options.center = [lng, lat];
  }
  try {
    map.easeTo(options);
  } catch (err) {
    console.warn('safeEaseTo caught exception:', err);
  }
}

/* =========================================================================
   PASS COLOR SCHEMES
   ========================================================================= */

export const PASS_COLORS: Record<PassNetwork, string> = {
  Ikon: '#E05216', // Orange
  Epic: '#059669', // Emerald
  Indy: '#D97706', // Ochre
  'Mountain Collective': '#0284C7', // Sky
  Independent: '#64748B', // Slate
};

/* =========================================================================
   PASS NETWORK RESORT RECOGNITION CATALOGS
   ========================================================================= */

export const IKON_KEYWORDS = [
  'jackson hole', 'snowbird', 'alta', 'aspen', 'snowmass', 'steamboat', 'arapahoe basin', 'a-basin',
  'winter park', 'copper mountain', 'eldora', 'big sky', 'sun valley', 'palisades tahoe',
  'squaw valley', 'alpine meadows', 'mammoth', 'june mountain', 'big bear', 'snow summit',
  'snow valley', 'deer valley', 'solitude', 'brighton', 'bachelor', 'schweitzer',
  'crystal mountain', 'snoqualmie', 'killington', 'pico mountain', 'pico peak', 'sugarbush',
  'stratton', 'sunday river', 'sugarloaf', 'loon mountain', 'windham', 'revelstoke',
  'lake louise', 'sunshine village', 'norquay', 'tremblant', 'blue mountain', 'red mountain',
  'cypress mountain', 'panorama', 'sun peaks', 'zermatt', 'matterhorn', 'st. moritz',
  'st moritz', 'dolomiti superski', 'cortina', 'val gardena', 'kitzbühel', 'kitzbuhel',
  'chamonix', 'megeve', 'mégève', 'grandvalira', 'niseko', 'lotte arai', 'arai snow',
  'valle nevado', 'cerro catedral', 'coronet peak', 'the remarkables', 'remarkables',
  'mt hutt', 'thredbo', 'mt buller',
];

export const EPIC_KEYWORDS = [
  'vail', 'beaver creek', 'breckenridge', 'keystone', 'crested butte', 'park city',
  'telluride', 'heavenly', 'northstar', 'kirkwood', 'stevens pass', 'stowe', 'okemo',
  'mount snow', 'hunter mountain', 'attitash', 'wildcat', 'crotched', 'sunapee',
  'liberty mountain', 'roundtop', 'whitetail', 'jack frost', 'big boulder', 'seven springs',
  'hidden valley pa', 'laurel mountain', 'boston mills', 'brandywine', 'alpine valley',
  'mad river mountain', 'snow creek', 'paoli peaks', 'wilmot', 'afton alps', 'mt brighton',
  'whistler', 'blackcomb', 'les 3 vallées', '3 vallées', 'courchevel', 'méribel', 'meribel',
  'val thorens', "val d'isère", "val d'isere", 'tignes', 'verbier', 'st. anton',
  'sankt anton', 'lech', 'zürs', 'zuers', 'andermatt', 'sedrun', 'disentis', 'crans-montana',
  'madonna di campiglio', 'skirama', 'hakuba', 'happo-one', 'happo one', 'rusutsu', 'perisher', 'falls creek', 'hotham',
];

export const INDY_KEYWORDS = [
  'jay peak', 'bolton valley', 'magic mountain', 'saskadena six', 'cannon mountain',
  'waterville valley', 'black mountain', 'saddleback', 'big rock', 'berkshire east',
  'catamount', 'bousquet', 'titus mountain', 'greek peak', 'swain', 'snow ridge',
  'west mountain', 'montage mountain', 'shawnee mountain', 'blue knob', 'massanutten',
  'bryce resort', 'winterplace', 'canaan valley', 'timberline mountain', 'caberfae peaks',
  'shanty creek', 'marquette mountain', 'big powderhorn', 'pine mountain',
  'granite peak', 'lutsen', 'giants ridge', 'spirit mountain', 'trollhaugen',
  'powder ridge', 'terry peak', 'red lodge', 'lost trail', 'blacktail', 'brundage',
  'tamarack', 'soldier mountain', 'pomerelle', 'kelly canyon', 'beaver mountain',
  'eaglecrest', 'mt ashland', 'hoodoo', 'white pass', 'mission ridge', '49 degrees north',
  'hurricane ridge', 'apex mountain', 'manning park', 'mt timothy', 'sasquatch',
  'castle mountain', 'pass powderkeg', 'powder mountain', 'monarch mountain', 'nozawa onsen', 'myoko kogen', 'geto kogen',
];

export const MOUNTAIN_COLLECTIVE_KEYWORDS = [
  'alta', 'aspen', 'snowmass', 'big sky', 'chamonix', 'coronet peak', 'remarkables',
  'grand targhee', 'jackson hole', 'lake louise', 'megeve', 'mégève', 'mt buller',
  'niseko', 'panorama', 'revelstoke', 'snowbasin', 'snowbird', 'sugarbush', 'sugarloaf',
  'sun peaks', 'sun valley', 'sunshine village', 'taos', 'valle nevado',
];

export function getPassNetworksForSkiArea(name: string, region: string = '', country: string = '', id: string = ''): PassNetwork[] {
  const n = (name || '').toLowerCase();
  const passes: PassNetwork[] = [];

  if (IKON_KEYWORDS.some((k) => n.includes(k))) passes.push('Ikon');
  if (EPIC_KEYWORDS.some((k) => n.includes(k))) passes.push('Epic');
  if (MOUNTAIN_COLLECTIVE_KEYWORDS.some((k) => n.includes(k))) {
    if (!passes.includes('Mountain Collective')) passes.push('Mountain Collective');
  }
  if (INDY_KEYWORDS.some((k) => n.includes(k))) {
    if (!passes.includes('Indy')) passes.push('Indy');
  }

  if (passes.length === 0) {
    passes.push('Independent');
  }
  return passes;
}

/* =========================================================================
   REAL SKI TRAILS, LIFTS & SKIABLE BOUNDARIES
   ========================================================================= */

// Boundary polygon of the ski slopes extent
export const RESORT_BOUNDARIES: Record<string, [number, number][]> = {
  'jackson-hole': [
    [-110.826, 43.585], // Teton Village base south
    [-110.835, 43.609], // Après Vous base north
    [-110.849, 43.611], // Après Vous ridge top
    [-110.865, 43.606], // Casper Bowl / Moran Face
    [-110.875, 43.599], // Rendezvous Peak summit (10,450')
    [-110.871, 43.590], // Cody Bowl boundary
    [-110.861, 43.586], // Sublette / Cheyenne Bowl south
    [-110.838, 43.582], // Granite Canyon boundary
    [-110.826, 43.585], // Loop back to base
  ],
};

export const REAL_RESORT_TRAILS: Record<string, PisteFeature[]> = {
  'jackson-hole': [
    // Lifts
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.828, 43.587], // Teton Village base (6,311')
          [-110.846, 43.593], // Tower 3
          [-110.871, 43.597], // Rendezvous Peak summit (10,450')
        ],
      },
      properties: {
        id: 'jh-tram',
        kind: 'lift',
        name: 'Aerial Tram ("Big Red")',
        difficulty: 'unknown',
        lift_type: '100-Passenger Tram (4,139 ft vertical)',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.828, 43.587],
          [-110.844, 43.603],
        ],
      },
      properties: {
        id: 'jh-bridger',
        kind: 'lift',
        name: 'Bridger Gondola',
        difficulty: 'unknown',
        lift_type: '8-Passenger Gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.829, 43.589],
          [-110.842, 43.595],
        ],
      },
      properties: {
        id: 'jh-sweetwater',
        kind: 'lift',
        name: 'Sweetwater Gondola',
        difficulty: 'unknown',
        lift_type: 'Gondola with mid-station',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.852, 43.588],
          [-110.865, 43.591],
        ],
      },
      properties: {
        id: 'jh-sublette',
        kind: 'lift',
        name: 'Sublette Quad Chair',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.847, 43.593],
          [-110.856, 43.595],
        ],
      },
      properties: {
        id: 'jh-thunder',
        kind: 'lift',
        name: 'Thunder Quad Chair',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.843, 43.599],
          [-110.851, 43.601],
        ],
      },
      properties: {
        id: 'jh-casper',
        kind: 'lift',
        name: 'Casper Quad Chair',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.830, 43.592],
          [-110.841, 43.606],
        ],
      },
      properties: {
        id: 'jh-apres-vous',
        kind: 'lift',
        name: 'Après Vous Quad Chair',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
      },
    },

    // Iconic Real Pistes
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.870, 43.597],
          [-110.868, 43.596],
          [-110.865, 43.595],
        ],
      },
      properties: {
        id: 'jh-corbets',
        kind: 'piste',
        name: "Corbet's Couloir",
        difficulty: 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.871, 43.597],
          [-110.867, 43.597],
          [-110.861, 43.596],
          [-110.856, 43.595],
        ],
      },
      properties: {
        id: 'jh-rendezvous-bowl',
        kind: 'piste',
        name: 'Rendezvous Bowl',
        difficulty: 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.866, 43.592],
          [-110.863, 43.590],
          [-110.858, 43.589],
        ],
      },
      properties: {
        id: 'jh-alta-chutes',
        kind: 'piste',
        name: 'Alta Chutes 1, 2 & 3',
        difficulty: 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.856, 43.595],
          [-110.851, 43.594],
          [-110.847, 43.592],
        ],
      },
      properties: {
        id: 'jh-tower-three',
        kind: 'piste',
        name: 'Tower Three Chute',
        difficulty: 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.861, 43.595],
          [-110.857, 43.592],
          [-110.852, 43.588],
        ],
      },
      properties: {
        id: 'jh-cheyenne-bowl',
        kind: 'piste',
        name: 'Cheyenne Bowl',
        difficulty: 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.858, 43.594],
          [-110.854, 43.590],
          [-110.851, 43.587],
        ],
      },
      properties: {
        id: 'jh-laramie-bowl',
        kind: 'piste',
        name: 'Laramie Bowl',
        difficulty: 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.844, 43.603],
          [-110.840, 43.599],
          [-110.835, 43.594],
          [-110.828, 43.588],
        ],
      },
      properties: {
        id: 'jh-gros-ventre',
        kind: 'piste',
        name: 'Gros Ventre',
        difficulty: 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.842, 43.599],
          [-110.838, 43.596],
          [-110.833, 43.592],
          [-110.828, 43.587],
        ],
      },
      properties: {
        id: 'jh-werner',
        kind: 'piste',
        name: 'Werner',
        difficulty: 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-110.835, 43.590],
          [-110.831, 43.588],
          [-110.828, 43.587],
        ],
      },
      properties: {
        id: 'jh-teewinot',
        kind: 'piste',
        name: 'Teewinot Run',
        difficulty: 'novice',
      },
    },
  ],
};

/* =========================================================================
   CURATED SEED RESORTS (ACCURATE REAL GEOGRAPHY)
   ========================================================================= */

export const GLOBAL_SKI_ATLAS: SkiResort[] = [
  // US Rockies & Intermountain
  {
    id: 'jackson-hole',
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
    summary: '4,139 ft of continuous fall-line vertical across Rendezvous and Après Vous mountains.',
  },
  {
    id: 'grand-targhee',
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
    summary: 'Western slope of Tetons with reliable deep snow and open bowls.',
  },
  {
    id: 'snowbird',
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
    summary: 'Little Cottonwood Canyon destination with Peruvian Gulch, Mineral Basin, and the ski tunnel.',
  },
  {
    id: 'alta',
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
    summary: 'Skier-exclusive mountain renowned for high seasonal snowfall and natural terrain traverses.',
  },
  {
    id: 'powder-mountain',
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
    summary: 'Massive acreage with capped daily ticket sales to preserve untracked snow.',
  },
  {
    id: 'vail',
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
    summary: 'Extensive front side cruising connected to 7 expansive Back Bowls and Blue Sky Basin.',
  },
  {
    id: 'aspen-snowmass',
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
    summary: 'Highest continuous vertical drop in the USA, topped by the hike-to Highland Bowl.',
  },
  {
    id: 'steamboat',
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
    summary: 'Known for dry Champagne Powder and extensive Aspen tree glades.',
  },
  {
    id: 'arapahoe-basin',
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
    summary: 'Base elevation over 10,700 ft with one of the longest ski seasons in North America.',
  },
  {
    id: 'monarch-mountain',
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
    summary: '100% natural snow at the Continental Divide without snowmaking.',
  },
  {
    id: 'silverton',
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
    summary: 'Guided-only expert terrain with mandatory beacon, probe, and shovel.',
  },
  {
    id: 'big-sky',
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
    summary: 'Extensive high-alpine acreage around Lone Peak with wide expanses and technical couloirs.',
  },
  {
    id: 'bridger-bowl',
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
    summary: 'Bozeman community hill with steep ridge chutes requiring avalanche transceivers.',
  },
  {
    id: 'sun-valley',
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
    summary: 'Bald Mountain features constant pitch from top to bottom with extensive snowmaking backup.',
  },
  {
    id: 'brundage',
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
    summary: 'Overlooks Payette Lake with wide powder glades and consistent Central Idaho storms.',
  },

  // US Pacific & Canada
  {
    id: 'mt-baker',
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
    summary: 'Pacific storm magnet with world-record seasonal snowfall averages and steep backcountry boundaries.',
  },
  {
    id: 'whistler-blackcomb',
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
    summary: 'Two interconnected mountains with over 5,000 ft of vertical and vast alpine bowls.',
  },
  {
    id: 'revelstoke',
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
    summary: 'Longest continuous lift-served vertical descent in North America at 5,620 ft.',
  },
  {
    id: 'mammoth',
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
    summary: 'Eastern Sierra volcano receiving large atmospheric river snow totals with open summit ridges.',
  },
  {
    id: 'palisades-tahoe',
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
    summary: 'Former Winter Olympic venue famous for KT-22, Granite Chief, and alpine cliff bands.',
  },
  {
    id: 'telluride',
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
    summary: 'San Juan box canyon setting with hike-to terrain on Palmyra Peak and Revelation Bowl.',
  },

  // European Alps
  {
    id: 'chamonix',
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
    summary: 'Historical capital of mountaineering beneath Mont Blanc with glacial off-piste descents.',
  },
  {
    id: 'val-disere',
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
    summary: 'High-altitude French Alps domain linking glaciers with dependable winter snowpack.',
  },
  {
    id: 'verbier',
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
    summary: 'Swiss freeride center featuring steep itineraries off Mont Gelé and Bec des Rosses.',
  },
  {
    id: 'zermatt',
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
    summary: 'Highest lift-served resort in Europe, crossing the international border into Cervinia, Italy.',
  },
  {
    id: 'st-anton',
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
    summary: 'Birthplace of modern alpine ski technique with steep off-piste bowls in the Arlberg region.',
  },

  // Japan
  {
    id: 'niseko-united',
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
    summary: 'Hokkaido powder hub receiving Siberian sea-effect snow with 11 backcountry access gates.',
  },
  {
    id: 'rusutsu',
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
    summary: 'Lift-accessed deciduous birch glades and natural terrain rollers spanning 3 peaks.',
  },
  {
    id: 'furano',
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
    summary: 'Inland Hokkaido location providing cold, low-moisture powder with views of Daisetsuzan.',
  },
  {
    id: 'hakuba-happo-one',
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
    summary: '1998 Winter Olympic downhill venue situated in the Japanese Northern Alps.',
  },
  {
    id: 'nozawa-onsen',
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
    summary: 'Traditional hot spring village with steep beech forest glades and high seasonal snow volume.',
  },
  {
    id: 'myoko-kogen',
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
    summary: 'Located in Niigata’s "Snow Country" receiving heavy lake/sea-effect storms from Sea of Japan.',
  },

  // Southern Hemisphere
  {
    id: 'treble-cone',
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
    summary: 'South Island mountain with Motatapu chutes and views over Lake Wanaka.',
  },
  {
    id: 'valle-nevado',
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
    summary: 'High-altitude Andes skiing located 9,400–12,000 ft above Santiago.',
  },
  {
    id: 'portillo',
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
    summary: 'Historic hotel resort next to Laguna del Inca known for high-angle chutes and off-piste bowls.',
  },

  // US East & Canada Rockies
  {
    id: 'stowe',
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
    summary: 'Mount Mansfield’s legendary "Front Four" steep fall-line trails in Northern Vermont.',
  },
  {
    id: 'killington',
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
    summary: 'The "Beast of the East" spanning six peaks with the largest vertical drop in New England.',
  },
  {
    id: 'lake-louise',
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
    summary: 'Banff National Park alpine expanse with West Bowl chutes and Rocky Mountain vistas.',
  },

  // European Alps & Dolomites
  {
    id: 'cortina',
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
    summary: 'UNESCO Dolomites jewel featuring the Tofana schuss and 2026 Winter Olympic alpine courses.',
  },
  {
    id: 'val-gardena',
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
    summary: 'Heart of the Sellaronda carousel encircling the Sella massif in the Italian Dolomites.',
  },
  {
    id: 'courchevel',
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
    summary: 'Part of the largest interconnected ski area on Earth with 600km of linked pistes.',
  },
  {
    id: 'st-moritz',
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
    summary: 'Engadin valley high-altitude skiing with dry "champagne climate" and Morteratsch glacier run.',
  },
  {
    id: 'kitzbuehel',
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
    summary: 'Home of the Streif downhill on the Hahnenkamm, the most renowned course in ski racing.',
  },

  // Scandinavia & Spain
  {
    id: 'hemsedal',
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
    summary: 'Known as the "Scandinavian Alps" with rugged peaks and dependable long Nordic winters.',
  },
  {
    id: 'are-sweden',
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
    summary: 'Northern Europe’s premier ski destination, hosting multiple FIS Alpine World Ski Championships.',
  },
  {
    id: 'baqueira-beret',
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
    summary: 'Atlantic-facing Pyrenean valley (Val d’Aran) providing deep natural snow and extensive freeride bowls.',
  },

  // Oceania & South America
  {
    id: 'cardrona',
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
    summary: 'Wide alpine terrain and high-elevation dry snow overlooking Queenstown and Wanaka.',
  },
  {
    id: 'perisher',
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
    summary: 'Largest ski resort in the Southern Hemisphere, combining Perisher Valley, Blue Cow, Smiggin Holes, and Guthega.',
  },
  {
    id: 'cerro-catedral',
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
    summary: 'Patagonian Andes flagship overlooking Lake Nahuel Huapi with granite spires and off-piste couloirs.',
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
   BACKCOUNTRY & SKI TOURING ZONES DATASET
   ========================================================================= */

export const BACKCOUNTRY_ZONES: SkiResort[] = [
  {
    id: 'bc-tuckerman-ravine',
    name: 'Tuckerman Ravine (Mt Washington)',
    region: 'New Hampshire',
    country: 'United States',
    lat: 44.2625,
    lng: -71.2989,
    default_bearing: 100,
    base_elev_ft: 2000,
    summit_elev_ft: 6288,
    vertical_drop_ft: 4288,
    skiable_acres: 3000,
    tenure_acres: 3000,
    pass_networks: ['Independent'],
    infrastructure: 'Hermit Lake backcountry shelters · USFS Snow Rangers · 100% human-powered uphill skinning',
    archetype: 'Backcountry Headwall',
    summary: 'The legendary birthplace of American extreme backcountry skiing with 40 to 55-degree glacial headwalls.',
    category: 'backcountry',
    operation_type: 'backcountry_zone',
  },
  {
    id: 'bc-berthoud-pass',
    name: 'Berthoud Pass Backcountry',
    region: 'Colorado',
    country: 'United States',
    lat: 39.7981,
    lng: -105.7778,
    default_bearing: 180,
    base_elev_ft: 11307,
    summit_elev_ft: 12500,
    vertical_drop_ft: 1500,
    skiable_acres: 8000,
    tenure_acres: 8000,
    pass_networks: ['Independent'],
    infrastructure: 'Continental Divide pass trailhead · Warming hut · Historic ski terrain reclaimed by nature',
    archetype: 'Backcountry Pass',
    summary: 'Colorado’s premier highway-accessible backcountry ski playground with high alpine bowls, chutes, and tree glades.',
    category: 'backcountry',
    operation_type: 'backcountry_zone',
  },
  {
    id: 'bc-rogers-pass',
    name: 'Rogers Pass (Glacier National Park)',
    region: 'British Columbia',
    country: 'Canada',
    lat: 51.3006,
    lng: -117.5217,
    default_bearing: 190,
    base_elev_ft: 4360,
    summit_elev_ft: 10500,
    vertical_drop_ft: 6140,
    skiable_acres: 350000,
    tenure_acres: 350000,
    pass_networks: ['Independent'],
    infrastructure: 'Parks Canada winter permit system · Asulkan and Hermit cabin networks · Transceivers mandatory',
    archetype: 'Ski Mountaineering',
    summary: 'The holy grail of North American ski mountaineering with enormous 6,000-ft continuous alpine descents in the Selkirks.',
    category: 'backcountry',
    operation_type: 'backcountry_zone',
  },
  {
    id: 'bc-teton-pass',
    name: 'Teton Pass Backcountry',
    region: 'Wyoming',
    country: 'United States',
    lat: 43.4984,
    lng: -110.9547,
    default_bearing: 175,
    base_elev_ft: 6400,
    summit_elev_ft: 10098,
    vertical_drop_ft: 3698,
    skiable_acres: 12000,
    tenure_acres: 12000,
    pass_networks: ['Independent'],
    infrastructure: 'Highway 22 summit parking · Bootpack trails & skintracks · Avalanche hazard forecast center',
    archetype: 'Backcountry Pass',
    summary: 'The epicenter of Jackson Hole community backcountry culture with classic descents including Mount Glory and Edelweiss.',
    category: 'backcountry',
    operation_type: 'backcountry_zone',
  },
  {
    id: 'bc-loveland-pass',
    name: 'Loveland Pass Backcountry',
    region: 'Colorado',
    country: 'United States',
    lat: 39.6636,
    lng: -105.8789,
    default_bearing: 180,
    base_elev_ft: 10800,
    summit_elev_ft: 12995,
    vertical_drop_ft: 2195,
    skiable_acres: 6000,
    tenure_acres: 6000,
    pass_networks: ['Independent'],
    infrastructure: 'Continental Divide Highway 6 shuttle route · Free parking · Human-powered alpine skinning',
    archetype: 'Backcountry Ridges',
    summary: 'Classic high-altitude hitch-and-ski ridgelines above timberline on the Continental Divide.',
    category: 'backcountry',
    operation_type: 'backcountry_zone',
  },
];

/* =========================================================================
   CATEGORY BADGES HELPER
   ========================================================================= */

export function getCategoryBadge(category?: SkiActivityCategory) {
  switch (category) {
    case 'nordic':
      return {
        label: 'Nordic XC',
        icon: '🎿',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: '#059669',
      };
    case 'heli_cat':
      return {
        label: 'Cat & Heli',
        icon: '🚁',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        dot: '#7C3AED',
      };
    case 'backcountry':
      return {
        label: 'Backcountry',
        icon: '🏔️',
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: '#0284C7',
      };
    case 'downhill':
    default:
      return {
        label: 'Downhill',
        icon: '⛷️',
        bg: 'bg-orange-50',
        text: 'text-[#E05216]',
        border: 'border-orange-200',
        dot: '#E05216',
      };
  }
}

/* =========================================================================
   REAL WEATHER ENGINE (OPEN-METEO)
   ========================================================================= */

function getNeutralWeather(resort: SkiResort): ResortWeatherData {
  const baseElev = resort.base_elev_ft || 2000;
  return {
    snowfall_72h_in: 0,
    snowfall_7d_in: 0,
    snowfall_72h_cm: 0,
    snowfall_7d_cm: 0,
    current_temp_f: 32,
    current_temp_c: 0,
    summit_wind_gust_mph: 15,
    freezing_level_ft: baseElev + 1500,
    rain_to_base_risk: true,
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
    const freezingLevels: number[] = data?.hourly?.freezing_level_height || [];
    const windGusts: number[] = data?.hourly?.wind_gusts_10m || [];
    const temps: number[] = data?.hourly?.temperature_2m || [];

    // Next 72 hours sum
    const snow72cm = hourlySnow.slice(0, 72).reduce((a, b) => a + (b || 0), 0);
    const snow72in = Math.round((snow72cm / 2.54) * 10) / 10;

    // Next 7 days daily sum
    const dailySnow: number[] = data?.daily?.snowfall_sum || [];
    const snow7dCm = dailySnow.slice(0, 7).reduce((a, b) => a + (b || 0), 0);
    const snow7dIn = Math.round((snow7dCm / 2.54) * 10) / 10;

    // Average freezing level in next 24h
    const avgFreezingM = freezingLevels.slice(0, 24).reduce((a, b) => a + (b || 0), 0) / 24 || 0;
    const freezingFt = Math.round(avgFreezingM * 3.28084);
    const rainRisk = freezingFt > (resort.base_elev_ft || 0);

    const maxWindKmh = Math.max(...windGusts.slice(0, 24), 10);
    const currentTempC = Math.round(temps[0] ?? 0);
    const currentTempF = Math.round((currentTempC * 9) / 5 + 32);

    const dailyForecast: DailyForecast[] = (data?.daily?.time || []).slice(0, 7).map((dStr: string, idx: number) => {
      const d = new Date(dStr + 'T12:00:00');
      const cm = Math.round((data.daily.snowfall_sum?.[idx] || 0) * 10) / 10;
      const inches = Math.round((cm / 2.54) * 10) / 10;
      const maxC = Math.round(data.daily.temperature_2m_max?.[idx] || 0);
      const minC = Math.round(data.daily.temperature_2m_min?.[idx] || 0);
      return {
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
        snowfall_in: inches,
        snowfall_cm: cm,
        temp_max_f: Math.round((maxC * 9) / 5 + 32),
        temp_min_f: Math.round((minC * 9) / 5 + 32),
        temp_max_c: maxC,
        temp_min_c: minC,
      };
    });

    return {
      snowfall_72h_in: snow72in,
      snowfall_7d_in: snow7dIn,
      snowfall_72h_cm: Math.round(snow72cm * 10) / 10,
      snowfall_7d_cm: Math.round(snow7dCm * 10) / 10,
      current_temp_f: currentTempF,
      current_temp_c: currentTempC,
      summit_wind_gust_mph: Math.round(maxWindKmh * 0.621371),
      freezing_level_ft: freezingFt,
      rain_to_base_risk: rainRisk,
      daily_forecast: dailyForecast,
      is_live: true,
      last_updated: 'Live Open-Meteo',
    };
  } catch (err) {
    return null;
  }
}

/* =========================================================================
   FEATURE CLASSIFICATION & ELEVATION SANITIZATION ENGINE
   ========================================================================= */

export function classifySkiFeature(p: any, coords: [number, number]): {
  category: SkiActivityCategory;
  archetype: string;
  cleanedSummitFt: number | null;
  cleanedBaseFt: number | null;
  cleanedVertFt: number | null;
  infrastructure: string;
} {
  const name = (p?.name || '').trim();
  const lowerName = name.toLowerCase();
  const acts: string[] = Array.isArray(p?.activities) ? p.activities : [];
  const hasDownhill = acts.includes('downhill');
  const hasNordic = acts.includes('nordic');

  // Count lifts and runs
  let liftCount = 0;
  if (p?.statistics?.lifts?.byType) {
    Object.values(p.statistics.lifts.byType).forEach((l: any) => {
      liftCount += (l as any).count || 0;
    });
  }
  let runCount = 0;
  if (p?.statistics?.runs?.byActivity?.downhill?.byDifficulty) {
    Object.values(p.statistics.runs.byActivity.downhill.byDifficulty).forEach((r: any) => {
      runCount += (r as any).count || 0;
    });
  }

  // 1. Specific Known Anomalies: Mauna Kea Volcano (Hawaii)
  // Mauna Kea is a 13,803 ft volcano, not a commercial ski resort with lifts/runs
  if (lowerName.includes('mauna kea') || (coords && coords[0] < -155 && coords[0] > -156 && coords[1] > 19.5 && coords[1] < 20.0)) {
    return {
      category: 'informal',
      archetype: 'Volcano Snowfield (Wild / Non-Resort)',
      cleanedSummitFt: 13803,
      cleanedBaseFt: 9200,
      cleanedVertFt: 4603,
      infrastructure: 'No Lifts · 4WD Summit Observatory Road · Seasonal Wild Snow',
    };
  }

  // 2. Heli & Cat Ski Operations
  if (/heli|cat\s*ski|snowcat|powdercat|catski/i.test(lowerName)) {
    return {
      category: 'heli_cat',
      archetype: 'Cat & Heli Skiing',
      cleanedSummitFt: null,
      cleanedBaseFt: null,
      cleanedVertFt: null,
      infrastructure: 'Guided Deep Powder Snowcat / Helicopter',
    };
  }

  // 3. Backcountry & Ski Touring Zones
  if (/backcountry|touring\s*zone|skin\s*track|mountaineering|pass\s*trailhead|hut\s*system/i.test(lowerName)) {
    return {
      category: 'backcountry',
      archetype: 'Backcountry Touring Zone',
      cleanedSummitFt: null,
      cleanedBaseFt: null,
      cleanedVertFt: null,
      infrastructure: 'Uphill Skinning & Trailheads (No Lifts)',
    };
  }

  // 4. Raw elevation calculation and sanitization
  const maxE = p?.statistics?.maxElevation || p?.statistics?.runs?.maxElevation || 0;
  const minE = p?.statistics?.minElevation || p?.statistics?.runs?.minElevation || 0;
  const vertM = maxE > minE ? maxE - minE : 0;
  const vertFt = vertM > 0 ? Math.round(vertM * 3.28084) : 0;
  const summitFt = maxE > 0 ? Math.round(maxE * 3.28084) : 0;
  const baseFt = minE > 0 ? Math.round(minE * 3.28084) : 0;

  // Detect fake / suspicious numbers (e.g. 4,000' summit, 2,000' base, 2,000' vertical placeholder or missing stats)
  const isSuspicious =
    (summitFt >= 3950 && summitFt <= 4050 && baseFt >= 1950 && baseFt <= 2050 && vertFt >= 1950 && vertFt <= 2050) ||
    !maxE || !minE || maxE <= 0 || minE <= 0 || maxE === minE ||
    (hasNordic && !hasDownhill && vertFt > 1200 && liftCount === 0);

  const cleanedSummitFt: number | null = isSuspicious ? null : summitFt;
  const cleanedBaseFt: number | null = isSuspicious ? null : baseFt;
  const cleanedVertFt: number | null = isSuspicious ? null : vertFt;

  // 5. Categorization:
  // If no lifts and no downhill runs, and not Nordic: Wild / Informal Area
  if (liftCount === 0 && runCount === 0 && !hasNordic) {
    return {
      category: 'informal',
      archetype: 'Wild / Non-Resort Area',
      cleanedSummitFt,
      cleanedBaseFt,
      cleanedVertFt,
      infrastructure: 'No Recorded Lifts · Primitive / Informal Snow Area',
    };
  }

  // If Nordic (XC trails)
  if (hasNordic && (!hasDownhill || liftCount === 0)) {
    return {
      category: 'nordic',
      archetype: 'Nordic XC Center',
      cleanedSummitFt,
      cleanedBaseFt,
      cleanedVertFt: null, // Cross-country trails roll over terrain; don't claim fake downhill drop
      infrastructure: 'Groomed Skate & Classic Cross-Country Trails',
    };
  }

  // Standard Downhill Resort
  return {
    category: 'downhill',
    archetype: (cleanedVertFt || 0) > 3000 ? 'Steep Alpine' : (liftCount > 0 ? 'Resort Trails' : 'Downhill Area'),
    cleanedSummitFt,
    cleanedBaseFt,
    cleanedVertFt,
    infrastructure: liftCount > 0 ? `${liftCount} Lifts, ${runCount} Marked Pistes` : 'Downhill Pistes Mapped',
  };
}

/* =========================================================================
   MAIN APP COMPONENT
   ========================================================================= */

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Resorts state: Combined Atlas, Cat/Heli, and Backcountry premier datasets
  const [resorts, setResorts] = useState<SkiResort[]>(() => [
    ...GLOBAL_SKI_ATLAS.map((r) => ({
      ...r,
      category: 'downhill' as SkiActivityCategory,
      weather: getNeutralWeather(r),
    })),
    ...HELI_CAT_OPERATIONS.map((r) => ({
      ...r,
      category: 'heli_cat' as SkiActivityCategory,
      weather: getNeutralWeather(r),
    })),
    ...BACKCOUNTRY_ZONES.map((r) => ({
      ...r,
      category: 'backcountry' as SkiActivityCategory,
      weather: getNeutralWeather(r),
    })),
  ]);

  const [selectedResortId, setSelectedResortId] = useState<string | null>('jackson-hole');
  const selectedResort = useMemo(
    () => resorts.find((r) => r.id === selectedResortId) || null,
    [resorts, selectedResortId]
  );

  // Real Trails layer toggle & state
  const [showRealTrailsLayer, setShowRealTrailsLayer] = useState(true);
  const [activeTrailFilter, setActiveTrailFilter] = useState<string>('all');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);

  // Terrain natural exaggeration state (defaulting to 0.5x as requested)
  const [exaggeration, setExaggeration] = useState<number>(0.5);

  // Visual settings
  const [is3D, setIs3D] = useState(true);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('topo');
  const [unitsMetric, setUnitsMetric] = useState(false);
  const [leftDockOpen, setLeftDockOpen] = useState(true);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [onlySnowIncoming, setOnlySnowIncoming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Category Individual Toggles
  const [showDownhill, setShowDownhill] = useState(true);
  const [showNordic, setShowNordic] = useState(true);
  const [showHeliCat, setShowHeliCat] = useState(true);
  const [showBackcountry, setShowBackcountry] = useState(true);
  const [showInformal, setShowInformal] = useState(true);

  // Worldwide Ski Areas (OpenSkiData & OSM - 12,000+ ski areas worldwide)
  const [showGlobalPoints, setShowGlobalPoints] = useState(true);
  const [globalSkiAreasCount, setGlobalSkiAreasCount] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<{
    downhill: number;
    nordic: number;
    heli_cat: number;
    backcountry: number;
    informal: number;
  }>({
    downhill: 6955,
    nordic: 5276,
    heli_cat: 15,
    backcountry: 5,
    informal: 160,
  });
  const [isFetchingGlobal, setIsFetchingGlobal] = useState(false);
  const allGlobalFeaturesRef = useRef<any[]>([]);
  const globalFeaturesRef = useRef<any[]>([]);
  const handleSelectGlobalResortRef = useRef<((props: any, coords: [number, number]) => void) | null>(null);
  const handleSelectResortRef = useRef<((id: string) => void) | null>(null);

  // Map Orientation, Pitch & Viewport State
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [mapPitch, setMapPitch] = useState<number>(45);
  const [viewportBounds, setViewportBounds] = useState<[number, number, number, number] | null>(null);

  // Google Earth style Gyroscope & Map Menu Refs
  const mapMenuTimeoutRef = useRef<any>(null);
  const isDraggingGyroRef = useRef(false);
  const [isGyroDragging, setIsGyroDragging] = useState(false);

  // Mountain Directory Tab & Sorting
  const [mountainListTab, setMountainListTab] = useState<'featured' | 'in_view' | 'global'>('featured');
  const [sortBy, setSortBy] = useState<'snow' | 'vert' | 'acres' | 'name'>('snow');

  // Filters
  const [selectedPasses, setSelectedPasses] = useState<PassNetwork[]>([
    'Ikon',
    'Epic',
    'Indy',
    'Mountain Collective',
    'Independent',
  ]);
  const [minVertical, setMinVertical] = useState(0);
  const [minAcreage, setMinAcreage] = useState(0);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('All');
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedPasses.length < 5) count++;
    if (selectedRegionFilter !== 'All') count++;
    if (minVertical > 0) count++;
    if (minAcreage > 0) count++;
    if (onlySnowIncoming) count++;
    if (!showDownhill || !showNordic || !showHeliCat || !showBackcountry || !showInformal) count++;
    return count;
  }, [selectedPasses, selectedRegionFilter, minVertical, minAcreage, onlySnowIncoming, showDownhill, showNordic, showHeliCat, showBackcountry, showInformal]);

  const handleResetFilters = () => {
    setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent']);
    setSelectedRegionFilter('All');
    setMinVertical(0);
    setMinAcreage(0);
    setOnlySnowIncoming(false);
    setShowDownhill(true);
    setShowNordic(true);
    setShowHeliCat(true);
    setShowBackcountry(true);
    setShowInformal(true);
  };

  // Filtered list
  const filteredResorts = useMemo(() => {
    return resorts.filter((r) => {
      const cat = r.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) return false;
      if (cat === 'nordic' && !showNordic) return false;
      if (cat === 'heli_cat' && !showHeliCat) return false;
      if (cat === 'backcountry' && !showBackcountry) return false;
      if (cat === 'informal' && !showInformal) return false;

      const passMatch = r.pass_networks.some((p) => selectedPasses.includes(p));
      if (!passMatch) return false;

      if (minVertical > 0 && (r.vertical_drop_ft === null || r.vertical_drop_ft < minVertical)) return false;
      if (minAcreage > 0 && r.skiable_acres < minAcreage) return false;
      if (onlySnowIncoming && (r.weather?.snowfall_72h_in ?? 0) <= 0) return false;

      if (selectedRegionFilter !== 'All') {
        if (selectedRegionFilter === 'Rockies' && !['Wyoming', 'Utah', 'Colorado', 'Montana', 'Idaho'].includes(r.region)) return false;
        if (selectedRegionFilter === 'Pacific NW' && !['Washington', 'California', 'British Columbia'].includes(r.region)) return false;
        if (selectedRegionFilter === 'US East' && !['Vermont', 'New York', 'Maine', 'New Hampshire'].includes(r.region)) return false;
        if (selectedRegionFilter === 'Alps' && !['France', 'Switzerland', 'Austria', 'Germany'].includes(r.country)) return false;
        if (selectedRegionFilter === 'Dolomites' && r.country !== 'Italy') return false;
        if (selectedRegionFilter === 'Scandinavia' && !['Norway', 'Sweden', 'Finland'].includes(r.country)) return false;
        if (selectedRegionFilter === 'Japan' && r.country !== 'Japan') return false;
        if (selectedRegionFilter === 'South America' && !['Chile', 'Argentina', 'New Zealand', 'Australia'].includes(r.country)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.region.toLowerCase().includes(q) && !r.country.toLowerCase().includes(q)) {
          return false;
        }
      }

    return true;
    });
  }, [resorts, selectedPasses, minVertical, minAcreage, onlySnowIncoming, selectedRegionFilter, searchQuery, showDownhill, showNordic, showHeliCat, showBackcountry, showInformal]);

  // Sorted Featured Resorts
  const sortedFeaturedResorts = useMemo(() => {
    const list = [...filteredResorts];
    if (sortBy === 'snow') {
      list.sort((a, b) => (b.weather?.snowfall_72h_in ?? 0) - (a.weather?.snowfall_72h_in ?? 0));
    } else if (sortBy === 'vert') {
      list.sort((a, b) => (b.vertical_drop_ft || 0) - (a.vertical_drop_ft || 0));
    } else if (sortBy === 'acres') {
      list.sort((a, b) => b.skiable_acres - a.skiable_acres);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [filteredResorts, sortBy]);

  // Resorts in current map viewport
  const visibleResorts = useMemo(() => {
    if (!viewportBounds) return sortedFeaturedResorts;
    const [west, south, east, north] = viewportBounds;
    const inBounds = sortedFeaturedResorts.filter((r) => {
      const inLng = west <= east ? r.lng >= west && r.lng <= east : r.lng >= west || r.lng <= east;
      const inLat = r.lat >= south && r.lat <= north;
      return inLng && inLat;
    });
    return inBounds;
  }, [sortedFeaturedResorts, viewportBounds]);

  // Global OSM ski areas in current viewport or matching search
  const visibleGlobalAreas = useMemo(() => {
    if (!globalFeaturesRef.current || globalFeaturesRef.current.length === 0) return [];
    let list = globalFeaturesRef.current;

    list = list.filter((f) => {
      const cat = f.properties.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) return false;
      if (cat === 'nordic' && !showNordic) return false;
      if (cat === 'heli_cat' && !showHeliCat) return false;
      if (cat === 'backcountry' && !showBackcountry) return false;
      if (cat === 'informal' && !showInformal) return false;

      // Pass network filter
      const passes: PassNetwork[] = f.properties.pass_networks || ['Independent'];
      const passMatch = passes.some((p) => selectedPasses.includes(p));
      if (!passMatch) return false;

      return true;
    });

    if (searchQuery.trim().length >= 1) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => {
        const p = f.properties;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q) ||
          p.country?.toLowerCase().includes(q)
        );
      });
    }

    if (minVertical > 0) {
      list = list.filter((f) => (f.properties.vertical_ft || 0) >= minVertical);
    }
    if (minAcreage > 0) {
      list = list.filter((f) => (f.properties.skiable_acres || 0) >= minAcreage);
    }

    if (selectedRegionFilter !== 'All') {
      list = list.filter((f) => {
        const p = f.properties;
        const c = p.country || '';
        const reg = p.region || '';
        if (selectedRegionFilter === 'Rockies') return ['United States', 'USA', 'Canada'].includes(c) && ['Wyoming', 'Utah', 'Colorado', 'Montana', 'Idaho', 'Alberta', 'BC'].some(r => reg.includes(r));
        if (selectedRegionFilter === 'Pacific NW') return ['Washington', 'California', 'Oregon', 'British Columbia'].some(r => reg.includes(r));
        if (selectedRegionFilter === 'US East') return ['Vermont', 'New York', 'Maine', 'New Hampshire', 'Pennsylvania'].some(r => reg.includes(r));
        if (selectedRegionFilter === 'Alps') return ['France', 'Switzerland', 'Austria', 'Germany'].includes(c);
        if (selectedRegionFilter === 'Dolomites') return c === 'Italy';
        if (selectedRegionFilter === 'Scandinavia') return ['Norway', 'Sweden', 'Finland'].includes(c);
        if (selectedRegionFilter === 'Japan') return c === 'Japan';
        if (selectedRegionFilter === 'South America') return ['Chile', 'Argentina', 'New Zealand', 'Australia'].includes(c);
        return true;
      });
    }

    if (mountainListTab === 'in_view' && viewportBounds) {
      const [west, south, east, north] = viewportBounds;
      list = list.filter((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) return false;
        const [lng, lat] = coords;
        const inLng = west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
        const inLat = lat >= south && lat <= north;
        return inLng && inLat;
      });
    }

    if (sortBy === 'vert') {
      return [...list].sort((a, b) => (b.properties.vertical_ft || 0) - (a.properties.vertical_ft || 0)).slice(0, 100);
    } else if (sortBy === 'acres') {
      return [...list].sort((a, b) => (b.properties.skiable_acres || 0) - (a.properties.skiable_acres || 0)).slice(0, 100);
    } else if (sortBy === 'name') {
      return [...list].sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || '')).slice(0, 100);
    }
    return list.slice(0, 100);
  }, [viewportBounds, mountainListTab, searchQuery, globalSkiAreasCount, sortBy, minVertical, minAcreage, selectedRegionFilter, selectedPasses, showDownhill, showNordic, showHeliCat, showBackcountry, showInformal]);

  // LIVE SEARCH MATCHES ACROSS ALL CATEGORIES WITH INSTANT ZOOM
  const allSearchMatches = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: Array<{
      id: string;
      name: string;
      country: string;
      region: string;
      category: SkiActivityCategory;
      lat: number;
      lng: number;
      vertical_ft: number | null;
      skiable_acres: number;
      isFeatured: boolean;
      rawProps?: any;
    }> = [];

    // 1. Check loaded resorts (Featured, Heli/Cat, Backcountry)
    for (const r of resorts) {
      const cat = r.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) continue;
      if (cat === 'nordic' && !showNordic) continue;
      if (cat === 'heli_cat' && !showHeliCat) continue;
      if (cat === 'backcountry' && !showBackcountry) continue;
      if (cat === 'informal' && !showInformal) continue;

      if (selectedPasses.length < 5) {
        const passes: PassNetwork[] = r.pass_networks || ['Independent'];
        if (!passes.some((p) => selectedPasses.includes(p))) continue;
      }

      if (
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q)
      ) {
        results.push({
          id: r.id,
          name: r.name,
          country: r.country,
          region: r.region,
          category: cat,
          lat: r.lat,
          lng: r.lng,
          vertical_ft: r.vertical_drop_ft,
          skiable_acres: r.skiable_acres,
          isFeatured: true,
        });
      }
    }

    // 2. Check all global OSM features
    if (allGlobalFeaturesRef.current && allGlobalFeaturesRef.current.length > 0) {
      for (const f of allGlobalFeaturesRef.current) {
        const p = f.properties;
        const cat = p.category || 'downhill';
        if (cat === 'downhill' && !showDownhill) continue;
        if (cat === 'nordic' && !showNordic) continue;
        if (cat === 'heli_cat' && !showHeliCat) continue;
        if (cat === 'backcountry' && !showBackcountry) continue;
        if (cat === 'informal' && !showInformal) continue;

        if (selectedPasses.length < 5) {
          const passes: PassNetwork[] = p.pass_networks || ['Independent'];
          if (!passes.some((pass) => selectedPasses.includes(pass))) continue;
        }

        const name = p.name || '';
        const reg = p.region || '';
        const c = p.country || '';

        if (
          name.toLowerCase().includes(q) ||
          reg.toLowerCase().includes(q) ||
          c.toLowerCase().includes(q)
        ) {
          if (!results.some((m) => m.id === String(p.id) || m.name.toLowerCase() === name.toLowerCase())) {
            results.push({
              id: String(p.id),
              name,
              country: c,
              region: reg,
              category: cat,
              lat: p.lat,
              lng: p.lng,
              vertical_ft: p.vertical_ft,
              skiable_acres: p.skiable_acres || 0,
              isFeatured: false,
              rawProps: p,
            });
          }
        }
        if (results.length >= 25) break;
      }
    }

    return results;
  }, [searchQuery, resorts, selectedPasses, showDownhill, showNordic, showHeliCat, showBackcountry, showInformal]);

  // Current resort's real trails
  const currentResortTrails = useMemo(() => {
    if (!selectedResort) return [];
    return REAL_RESORT_TRAILS[selectedResort.id] || [];
  }, [selectedResort]);

  const filteredTrails = useMemo(() => {
    if (activeTrailFilter === 'all') return currentResortTrails;
    if (activeTrailFilter === 'lifts') return currentResortTrails.filter((t) => t.properties.kind === 'lift');
    return currentResortTrails.filter((t) => t.properties.difficulty === activeTrailFilter);
  }, [currentResortTrails, activeTrailFilter]);

  /* =========================================================================
     MAP MOUNT & SETUP (HIGH-RESOLUTION BRIGHT TOPO + NATURAL 1.0X 3D TERRAIN)
     ========================================================================= */

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          // Clean, high-resolution, vibrant topographic basemap
          'topo-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri Topo',
          },
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: 'OpenStreetMap',
          },
          'satellite-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri Satellite',
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          // REAL OPENSTREETMAP WORLDWIDE SKI PISTES & LIFTS LAYER
          'opensnowmap-pistes': {
            type: 'raster',
            tiles: ['https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'OpenSnowMap.org / OpenStreetMap',
          },
        },
        layers: [
          // Crisp, high-contrast, fully saturated bright topo layer (no grayed-out filters)
          {
            id: 'basemap-topo',
            type: 'raster',
            source: 'topo-tiles',
            layout: { visibility: 'visible' },
            paint: {
              'raster-contrast': 0.12,
              'raster-saturation': 0.15,
              'raster-brightness-min': 0.05,
            },
          },
          {
            id: 'basemap-osm',
            type: 'raster',
            source: 'osm-tiles',
            layout: { visibility: 'none' },
            paint: {
              'raster-contrast': 0.1,
            },
          },
          {
            id: 'basemap-satellite',
            type: 'raster',
            source: 'satellite-tiles',
            layout: { visibility: 'none' },
            paint: {
              'raster-contrast': 0.1,
            },
          },
          // Soft, natural hillshade (subtle shadows, transparent ambient, no mud)
          {
            id: 'hillshade-relief',
            type: 'hillshade',
            source: 'terrain-dem',
            layout: { visibility: 'visible' },
            paint: {
              'hillshade-exaggeration': 0.38,
              'hillshade-shadow-color': 'rgba(51, 65, 85, 0.45)',
              'hillshade-highlight-color': 'rgba(255, 255, 255, 0.95)',
              'hillshade-accent-color': 'rgba(148, 163, 184, 0.35)',
            },
          },
          // Real OpenStreetMap Ski Trails Raster Overlay
          {
            id: 'opensnowmap-layer',
            type: 'raster',
            source: 'opensnowmap-pistes',
            layout: { visibility: 'visible' },
            paint: {
              'raster-opacity': 0.92,
            },
          },
        ],
      },
      // Default to North Up (bearing: 0) so all text, town labels, and contour lines are right-side up
      center: [-110.849, 43.593],
      zoom: 12.6,
      pitch: 45,
      bearing: 0,
      maxPitch: 85,
    });

    mapRef.current = map;

    // Listen to camera rotation and pitch to track orientation and gyroscope HUD
    map.on('rotate', () => {
      setMapBearing(Math.round(map.getBearing()));
    });
    map.on('pitch', () => {
      setMapPitch(Math.round(map.getPitch()));
    });

    // Update viewport bounds when map moves to power the "In Viewport" mountain list
    const updateBounds = () => {
      try {
        const b = map.getBounds();
        setViewportBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      } catch (err) {
        // map not ready
      }
    };
    map.on('moveend', updateBounds);

    map.on('load', () => {
      updateBounds();
      // 1. Natural 0.5x 3D Terrain relief (subtle, clean, and stable)
      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 0.5 });
      } catch (e) {
        console.warn('SetTerrain error:', e);
      }

      // 2. Ski slopes footprint / boundary source
      map.addSource('resort-boundary-geojson', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [RESORT_BOUNDARIES['jackson-hole'] || []],
              },
              properties: { id: 'jackson-hole' },
            },
          ],
        },
      });

      // Shaded ski area footprint extent
      map.addLayer({
        id: 'ski-boundary-fill',
        type: 'fill',
        source: 'resort-boundary-geojson',
        paint: {
          'fill-color': '#0284C7',
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'ski-boundary-line',
        type: 'line',
        source: 'resort-boundary-geojson',
        paint: {
          'line-color': '#0284C7',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      });

      // 3. Resorts GeoJSON source
      map.addSource('resorts-geojson', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // 4. Real named vector trails source
      map.addSource('pistes-lifts-geojson', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: REAL_RESORT_TRAILS['jackson-hole'] as any,
        },
      });

      // Halo for resorts with incoming snow
      map.addLayer({
        id: 'resorts-snow-halo',
        type: 'circle',
        source: 'resorts-geojson',
        filter: ['>', ['get', 'snow_72h'], 0],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 16, 12, 28],
          'circle-color': '#0284C7',
          'circle-opacity': 0.25,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0284C7',
        },
      });

      // Resort node markers
      map.addLayer({
        id: 'resort-nodes',
        type: 'circle',
        source: 'resorts-geojson',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'vertical_drop_ft'],
            1000,
            5,
            3000,
            8.5,
            5000,
            13,
            9000,
            17,
          ],
          'circle-color': ['get', 'pass_color'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Monospace label
      map.addLayer({
        id: 'resort-labels',
        type: 'symbol',
        source: 'resorts-geojson',
        minzoom: 5.5,
        layout: {
          'text-field': ['get', 'label_text'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold'],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 3,
        },
      });

      // REAL VECTOR TRAIL LAYERS (High contrast on bright terrain)
      map.addLayer({
        id: 'vector-piste-casing',
        type: 'line',
        source: 'pistes-lifts-geojson',
        filter: ['==', ['get', 'kind'], 'piste'],
        paint: {
          'line-color': '#ffffff',
          'line-width': 5.5,
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'vector-piste-lines',
        type: 'line',
        source: 'pistes-lifts-geojson',
        filter: ['==', ['get', 'kind'], 'piste'],
        paint: {
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'novice',
            '#16a34a',
            'intermediate',
            '#2563eb',
            'advanced',
            '#0f172a',
            'expert',
            '#dc2626',
            '#64748b',
          ],
          'line-width': 3.5,
        },
      });

      map.addLayer({
        id: 'vector-lift-lines',
        type: 'line',
        source: 'pistes-lifts-geojson',
        filter: ['==', ['get', 'kind'], 'lift'],
        paint: {
          'line-color': '#E05216',
          'line-width': 3.5,
          'line-dasharray': [2, 2],
        },
      });

      // Interactive trail names draped on mountain
      map.addLayer({
        id: 'vector-trail-labels',
        type: 'symbol',
        source: 'pistes-lifts-geojson',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-font': ['Open Sans Semibold'],
          'text-offset': [0, 0.8],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 3,
        },
      });

      // 5. WORLDWIDE SKI AREAS (OpenSkiData & OSM - 5,900+ active operating downhill resorts)
      map.addSource('global-ski-areas-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 45,
      });

      // Cluster circle markers
      map.addLayer({
        id: 'global-clusters',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#0284C7',
            20,
            '#059669',
            50,
            '#D97706',
            150,
            '#E05216',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            20,
            19,
            100,
            25,
            500,
            32,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      // Cluster count number
      map.addLayer({
        id: 'global-cluster-count',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Individual unclustered ski area node
      map.addLayer({
        id: 'global-unclustered-point',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'category'],
            'nordic',
            '#059669', // Emerald for Nordic XC
            'heli_cat',
            '#7C3AED', // Purple for Cat & Heli Ski
            'backcountry',
            '#0284C7', // Sky Blue for Backcountry / Touring
            'informal',
            '#D97706', // Amber Gold for Wild / Non-Resort (Mauna Kea)
            '#E05216', // Orange default for Alpine Downhill
          ],
          'circle-radius': 5.5,
          'circle-stroke-width': 1.8,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Individual unclustered resort label
      map.addLayer({
        id: 'global-unclustered-label',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 8.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10.5,
          'text-font': ['Open Sans Semibold'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });

      // Cluster click: zoom in
      map.on('click', 'global-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['global-clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource('global-ski-areas-source') as any;
        if (source && clusterId !== undefined) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            const geom = features[0]?.geometry;
            const pt = extractPointCoordinates(geom) || (e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
            if (!pt) return;
            safeEaseTo(map, {
              center: pt,
              zoom: Math.min(zoom, 14),
              duration: 800,
            });
          });
        }
      });

      // Global Point click: pan to point & live weather
      map.on('click', 'global-unclustered-point', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        const pt = extractPointCoordinates(e.features[0].geometry) || [e.lngLat.lng, e.lngLat.lat];
        handleSelectGlobalResortRef.current?.(props, pt);
      });

      // Global Label click: pan to point & live weather
      map.on('click', 'global-unclustered-label', (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties;
        const pt = extractPointCoordinates(e.features[0].geometry) || [e.lngLat.lng, e.lngLat.lat];
        handleSelectGlobalResortRef.current?.(props, pt);
      });

      map.on('mouseenter', 'global-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'global-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'global-unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'global-unclustered-point', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'global-unclustered-label', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'global-unclustered-label', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'resort-nodes', (e) => {
        if (!e.features || !e.features[0]) return;
        const id = e.features[0].properties?.id;
        if (id) handleSelectResortRef.current?.(id);
      });

      map.on('mouseenter', 'resort-nodes', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'resort-nodes', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapLoaded(true);
    });

    return () => {
      map.remove();
    };
  }, []);

  /* =========================================================================
     MAP DATA SYNC
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource('resorts-geojson') as GeoJSONSource;
    if (!source) return;

    const features = filteredResorts.map((r) => {
      const primaryPass = r.pass_networks[0] || 'Independent';
      const passColor = PASS_COLORS[primaryPass];
      const snow72 = r.weather?.snowfall_72h_in ?? 0;
      const labelText = `${r.name.toUpperCase()}${
        r.vertical_drop_ft ? ` · ${r.vertical_drop_ft.toLocaleString()}'` : ''
      }${snow72 > 0 ? ` · ${snow72}"` : ''}`;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.lng, r.lat],
        },
        properties: {
          id: r.id,
          name: r.name,
          region: r.region,
          vertical_drop_ft: r.vertical_drop_ft,
          pass_network: primaryPass,
          pass_color: passColor,
          snow_72h: snow72,
          label_text: labelText,
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [filteredResorts, mapLoaded]);

  /* =========================================================================
     OPENSTREETMAP REAL TRAILS LAYER VISIBILITY
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer('opensnowmap-layer')) {
      map.setLayoutProperty('opensnowmap-layer', 'visibility', showRealTrailsLayer ? 'visible' : 'none');
    }
  }, [showRealTrailsLayer, mapLoaded]);

  /* =========================================================================
     BASEMAP STYLE TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const layers: BasemapMode[] = ['topo', 'osm', 'satellite'];
    layers.forEach((mode) => {
      const id = `basemap-${mode}`;
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', mode === basemapMode ? 'visible' : 'none');
      }
    });
  }, [basemapMode, mapLoaded]);

  /* =========================================================================
     TERRAIN EXAGGERATION CONTROL
     ========================================================================= */

  const handleExaggerationChange = (val: number) => {
    setExaggeration(val);
    if (!mapRef.current) return;
    try {
      mapRef.current.setTerrain({ source: 'terrain-dem', exaggeration: val });
    } catch (e) {
      console.warn('SetTerrain error:', e);
    }
  };

  /* =========================================================================
     GOOGLE EARTH-STYLE GYROSCOPE NAVIGATION HANDLERS
     Left-click drag changes bearing & pitch; double-click resets to 2D North
     ========================================================================= */

  const handleGyroMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only standard left-click
    e.preventDefault();
    if (!mapRef.current) return;

    isDraggingGyroRef.current = true;
    setIsGyroDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startBearing = mapRef.current.getBearing();
    const startPitch = mapRef.current.getPitch();

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingGyroRef.current || !mapRef.current) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      // Horizontal drag rotates bearing
      let newBearing = (startBearing - dx * 0.75) % 360;
      if (newBearing < 0) newBearing += 360;

      // Vertical drag tilts pitch: dragging up tilts to 3D perspective, dragging down flattens to 2D
      let newPitch = Math.max(0, Math.min(85, startPitch - dy * 0.65));

      mapRef.current.setBearing(newBearing);
      mapRef.current.setPitch(newPitch);
      setMapBearing(Math.round(newBearing));
      setMapPitch(Math.round(newPitch));
      setIs3D(newPitch > 10);
    };

    const onMouseUp = () => {
      isDraggingGyroRef.current = false;
      setIsGyroDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleGyroDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;
    safeEaseTo(mapRef.current, {
      pitch: 0,
      bearing: 0,
      duration: 650,
    });
    setMapBearing(0);
    setMapPitch(0);
    setIs3D(false);
  }, []);

  const handleNudge = useCallback((dBearing: number, dPitch: number) => {
    if (!mapRef.current) return;
    const curBearing = mapRef.current.getBearing();
    const curPitch = mapRef.current.getPitch();
    let newBearing = (curBearing + dBearing) % 360;
    if (newBearing < 0) newBearing += 360;
    const newPitch = Math.max(0, Math.min(85, curPitch + dPitch));

    safeEaseTo(mapRef.current, {
      bearing: newBearing,
      pitch: newPitch,
      duration: 300,
    });
    setMapBearing(Math.round(newBearing));
    setMapPitch(Math.round(newPitch));
    setIs3D(newPitch > 10);
  }, []);

  /* =========================================================================
     CLICK-TO-ZOOM: 3D BIRD'S-EYE PERSPECTIVE FRAMING SKI SLOPES EXTENT
     ========================================================================= */

  const handleSelectResort = useCallback(
    (resortId: string) => {
      setSelectedResortId(resortId);
      const resort = resorts.find((r) => r.id === resortId);
      if (!resort || !mapRef.current) return;

      if (
        typeof resort.lng !== 'number' ||
        typeof resort.lat !== 'number' ||
        isNaN(resort.lng) ||
        isNaN(resort.lat) ||
        !isFinite(resort.lng) ||
        !isFinite(resort.lat)
      ) {
        console.warn('Skipping flyTo due to invalid resort coordinates:', resort);
        return;
      }

      setIs3D(true);

      // Pan directly to resort point, keeping North Up (bearing: 0) so text is never upside down
      safeFlyTo(mapRef.current, {
        center: [resort.lng, resort.lat],
        zoom: 12.8,
        pitch: is3D ? 45 : 0,
        bearing: 0,
        duration: 1800,
        essential: true,
      });

      // Update vector trails for selected mountain
      const trails = REAL_RESORT_TRAILS[resort.id] || [];
      const source = mapRef.current.getSource('pistes-lifts-geojson') as GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: trails as any,
        });
      }

      // Update boundary polygon footprint
      const boundaryCoords = RESORT_BOUNDARIES[resort.id];
      const boundarySource = mapRef.current.getSource('resort-boundary-geojson') as GeoJSONSource;
      if (boundarySource) {
        if (boundaryCoords && boundaryCoords.length > 0) {
          boundarySource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [boundaryCoords],
                },
                properties: { id: resort.id },
              },
            ],
          });
        } else {
          boundarySource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      }
    },
    [resorts, is3D]
  );

  // Focus a specific trail or chute
  const handleFocusTrail = (trail: PisteFeature) => {
    if (!mapRef.current) return;
    setSelectedTrailId(trail.properties.id);
    const coords = trail.geometry.coordinates;
    const midIndex = Math.floor(coords.length / 2);
    const targetPt = coords[midIndex] || coords[0];

    if (
      !targetPt ||
      typeof targetPt[0] !== 'number' ||
      typeof targetPt[1] !== 'number' ||
      isNaN(targetPt[0]) ||
      isNaN(targetPt[1]) ||
      !isFinite(targetPt[0]) ||
      !isFinite(targetPt[1])
    ) {
      return;
    }

    safeFlyTo(mapRef.current, {
      center: targetPt,
      zoom: 14.8,
      pitch: is3D ? 48 : 0,
      bearing: 0,
      duration: 1600,
      essential: true,
    });
  };

  /* =========================================================================
     GLOBAL SKI AREA SELECTION & PAN TO POINT (NORTH UP)
     ========================================================================= */

  handleSelectResortRef.current = handleSelectResort;

  const handleSelectGlobalResort = useCallback(
    async (props: any, rawCoords: any) => {
      let lng: number | undefined;
      let lat: number | undefined;

      if (Array.isArray(rawCoords) && typeof rawCoords[0] === 'number' && typeof rawCoords[1] === 'number') {
        lng = rawCoords[0];
        lat = rawCoords[1];
      } else if (rawCoords && typeof rawCoords === 'object') {
        const pt = extractPointCoordinates(rawCoords.coordinates ? rawCoords : { type: 'Point', coordinates: rawCoords });
        if (pt) [lng, lat] = pt;
      }

      if ((lng === undefined || lat === undefined || isNaN(lng) || isNaN(lat)) && props) {
        if (props.lng !== undefined && props.lat !== undefined) {
          const pLng = Number(props.lng);
          const pLat = Number(props.lat);
          if (isFinite(pLng) && isFinite(pLat) && !isNaN(pLng) && !isNaN(pLat)) {
            lng = pLng;
            lat = pLat;
          }
        }
      }

      if (lng === undefined || lat === undefined || isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
        console.warn('Invalid coordinates for global resort:', props, rawCoords);
        return;
      }

      const id = props.id ? String(props.id) : `global-${Math.round(lng * 1000)}-${Math.round(lat * 1000)}`;
      const classified = classifySkiFeature(props, [lng, lat]);
      const name = props.name || 'Ski Area';
      const country = props.country || 'Global';
      const region = props.region || '';
      const summitElevFt = classified.cleanedSummitFt;
      const baseElevFt = classified.cleanedBaseFt;
      const vertFt = classified.cleanedVertFt;
      const bearing = Number(props.bearing) || 0;
      const skiableAcres = Number(props.skiable_acres) || 0;

      const pass_networks: PassNetwork[] =
        props.pass_networks && Array.isArray(props.pass_networks) && props.pass_networks.length > 0
          ? props.pass_networks
          : getPassNetworksForSkiArea(name, region, country, id);

      const dynamicResort: SkiResort = {
        id,
        name,
        country,
        region,
        lat,
        lng,
        default_bearing: bearing,
        base_elev_ft: baseElevFt,
        summit_elev_ft: summitElevFt,
        vertical_drop_ft: vertFt,
        skiable_acres: skiableAcres,
        pass_networks,
        infrastructure: classified.infrastructure,
        archetype: classified.archetype,
        summary: props.summary || `${name} in ${region ? region + ', ' : ''}${country}. ${classified.infrastructure}`,
        weather: getNeutralWeather({ base_elev_ft: baseElevFt, summit_elev_ft: summitElevFt } as any),
        category: classified.category,
      };

      setResorts((prev) => {
        const exists = prev.find((r) => r.id === id);
        if (exists) return prev;
        return [dynamicResort, ...prev];
      });
      setSelectedResortId(id);

      // Pan directly to ski area point, North Up (bearing: 0)
      safeFlyTo(mapRef.current, {
        center: [lng, lat],
        zoom: 13.0,
        pitch: is3D ? 45 : 0,
        bearing: 0,
        duration: 1800,
        essential: true,
      });

      // Fetch live weather immediately for this summit
      const live = await fetchLiveWeather(dynamicResort);
      if (live) {
        setResorts((prev) =>
          prev.map((r) => (r.id === id ? { ...r, weather: live } : r))
        );
      }
    },
    [is3D]
  );

  handleSelectGlobalResortRef.current = handleSelectGlobalResort;

  /* =========================================================================
     OPENSKIDATA WORLDWIDE DATASET INGESTION (12,000+ SKI AREAS WITH CATEGORIES)
     ========================================================================= */

  useEffect(() => {
    let cancelled = false;
    const fetchGlobalSkiAreas = async () => {
      setIsFetchingGlobal(true);
      try {
        const res = await fetch('https://tiles.openskimap.org/geojson/ski_areas.geojson');
        if (!res.ok) throw new Error('Failed to fetch OpenSkiData');
        const data = await res.json();
        if (cancelled) return;

        const formattedFeatures: any[] = [];
        let downhillTotal = 0;
        let nordicTotal = 0;
        let heliCatTotal = HELI_CAT_OPERATIONS.length;
        let backcountryTotal = BACKCOUNTRY_ZONES.length;
        let informalTotal = 0;

        for (const f of (data.features || [])) {
          const pt = extractPointCoordinates(f.geometry);
          if (!pt) continue;
          const p = f.properties;
          if (!p || !p.name) continue;

          const place = p.places?.[0]?.localized?.en;
          const country = place?.country || '';
          const region = place?.region || '';
          const classified = classifySkiFeature(p, pt);

          if (classified.category === 'downhill') downhillTotal++;
          else if (classified.category === 'nordic') nordicTotal++;
          else if (classified.category === 'heli_cat') heliCatTotal++;
          else if (classified.category === 'backcountry') backcountryTotal++;
          else if (classified.category === 'informal') informalTotal++;

          // Match with featured atlas resort or known pass networks
          const matchedAtlas = GLOBAL_SKI_ATLAS.find((a) => {
            if (a.id === p.id) return true;
            const aName = a.name.toLowerCase();
            const pName = (p.name || '').toLowerCase();
            return aName === pName || (aName.length > 5 && pName.includes(aName));
          });

          const pass_networks: PassNetwork[] = matchedAtlas
            ? matchedAtlas.pass_networks
            : getPassNetworksForSkiArea(p.name, region, country, p.id);

          const primaryPass = pass_networks[0] || 'Independent';
          const passColor = PASS_COLORS[primaryPass];

          formattedFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: pt,
            },
            properties: {
              id: p.id,
              name: p.name,
              country,
              region,
              lng: pt[0],
              lat: pt[1],
              category: classified.category,
              archetype: classified.archetype,
              infrastructure: classified.infrastructure,
              vertical_ft: matchedAtlas ? matchedAtlas.vertical_drop_ft : classified.cleanedVertFt,
              summit_elev_ft: matchedAtlas ? matchedAtlas.summit_elev_ft : classified.cleanedSummitFt,
              base_elev_ft: matchedAtlas ? matchedAtlas.base_elev_ft : classified.cleanedBaseFt,
              skiable_acres: matchedAtlas ? matchedAtlas.skiable_acres : 0,
              pass_networks,
              primary_pass: primaryPass,
              pass_color: passColor,
              bearing: Math.round(p.viewportHint?.bearing || 180),
              website: p.websites?.[0] || '',
            },
          });
        }

        // Append curated Cat/Heli operations
        HELI_CAT_OPERATIONS.forEach((h) => {
          const passNetworks = h.pass_networks || ['Independent'];
          const primaryPass = passNetworks[0] || 'Independent';
          formattedFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
            properties: {
              id: h.id,
              name: h.name,
              country: h.country,
              region: h.region,
              lng: h.lng,
              lat: h.lat,
              category: 'heli_cat',
              archetype: h.archetype,
              infrastructure: h.infrastructure,
              vertical_ft: h.vertical_drop_ft,
              summit_elev_ft: h.summit_elev_ft,
              base_elev_ft: h.base_elev_ft,
              skiable_acres: h.skiable_acres,
              tenure_acres: h.tenure_acres,
              pass_networks: passNetworks,
              primary_pass: primaryPass,
              pass_color: PASS_COLORS[primaryPass],
              bearing: h.default_bearing,
            },
          });
        });

        // Append curated Backcountry zones
        BACKCOUNTRY_ZONES.forEach((b) => {
          const passNetworks = b.pass_networks || ['Independent'];
          const primaryPass = passNetworks[0] || 'Independent';
          formattedFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
            properties: {
              id: b.id,
              name: b.name,
              country: b.country,
              region: b.region,
              lng: b.lng,
              lat: b.lat,
              category: 'backcountry',
              archetype: b.archetype,
              infrastructure: b.infrastructure,
              vertical_ft: b.vertical_drop_ft,
              summit_elev_ft: b.summit_elev_ft,
              base_elev_ft: b.base_elev_ft,
              skiable_acres: b.skiable_acres,
              pass_networks: passNetworks,
              primary_pass: primaryPass,
              pass_color: PASS_COLORS[primaryPass],
              bearing: b.default_bearing,
            },
          });
        });

        allGlobalFeaturesRef.current = formattedFeatures;
        globalFeaturesRef.current = formattedFeatures;
        setCategoryCounts({
          downhill: downhillTotal,
          nordic: nordicTotal,
          heli_cat: heliCatTotal,
          backcountry: backcountryTotal,
          informal: informalTotal,
        });
        setGlobalSkiAreasCount(formattedFeatures.length);
      } catch (err) {
        console.warn('Could not load OpenSkiData, using expanded built-in atlas:', err);
      } finally {
        if (!cancelled) setIsFetchingGlobal(false);
      }
    };

    fetchGlobalSkiAreas();
    return () => {
      cancelled = true;
    };
  }, []);

  // SYNC GEOJSON MAP SOURCE WHENEVER FILTERS OR CATEGORY TOGGLES CHANGE (FILTERS THE DOTS ON THE MAP!)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !allGlobalFeaturesRef.current.length) return;
    const src = mapRef.current.getSource('global-ski-areas-source') as GeoJSONSource;
    if (!src) return;

    const filtered = allGlobalFeaturesRef.current.filter((f) => {
      // 1. Category filter
      const cat = f.properties.category || 'downhill';
      if (cat === 'downhill' && !showDownhill) return false;
      if (cat === 'nordic' && !showNordic) return false;
      if (cat === 'heli_cat' && !showHeliCat) return false;
      if (cat === 'backcountry' && !showBackcountry) return false;
      if (cat === 'informal' && !showInformal) return false;

      // 2. Pass network filter (Crucial for filtering map dots to Ikon, Epic, Indy, etc.!)
      const passes: PassNetwork[] = f.properties.pass_networks || ['Independent'];
      const passMatch = passes.some((p) => selectedPasses.includes(p));
      if (!passMatch) return false;

      // 3. Min Vertical filter
      if (minVertical > 0 && ((f.properties.vertical_ft || 0) < minVertical)) return false;

      // 4. Min Acreage filter
      if (minAcreage > 0 && ((f.properties.skiable_acres || 0) < minAcreage)) return false;

      // 5. Region filter
      if (selectedRegionFilter !== 'All') {
        const reg = f.properties.region || '';
        const ctry = f.properties.country || '';
        if (selectedRegionFilter === 'Rockies') {
          if (!['Wyoming', 'Utah', 'Colorado', 'Montana', 'Idaho', 'Alberta', 'BC'].some(r => reg.includes(r))) return false;
        } else if (selectedRegionFilter === 'Pacific NW') {
          if (!['Washington', 'California', 'British Columbia', 'Oregon', 'Alaska'].some(r => reg.includes(r))) return false;
        } else if (selectedRegionFilter === 'US East') {
          if (!['Vermont', 'New York', 'Maine', 'New Hampshire', 'Pennsylvania', 'Massachusetts', 'West Virginia'].some(r => reg.includes(r))) return false;
        } else if (selectedRegionFilter === 'Alps') {
          if (!['France', 'Switzerland', 'Austria', 'Germany'].includes(ctry)) return false;
        } else if (selectedRegionFilter === 'Dolomites') {
          if (ctry !== 'Italy') return false;
        } else if (selectedRegionFilter === 'Scandinavia') {
          if (!['Norway', 'Sweden', 'Finland'].includes(ctry)) return false;
        } else if (selectedRegionFilter === 'Japan') {
          if (ctry !== 'Japan') return false;
        } else if (selectedRegionFilter === 'South America') {
          if (!['Chile', 'Argentina', 'New Zealand', 'Australia'].includes(ctry)) return false;
        }
      }

      // 6. Snow incoming filter
      if (onlySnowIncoming && (f.properties.snow_72h || 0) <= 0) return false;

      // 7. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (f.properties.name || '').toLowerCase();
        const reg = (f.properties.region || '').toLowerCase();
        const ctry = (f.properties.country || '').toLowerCase();
        if (!name.includes(q) && !reg.includes(q) && !ctry.includes(q)) return false;
      }

      return true;
    });

    globalFeaturesRef.current = filtered;
    src.setData({
      type: 'FeatureCollection',
      features: filtered,
    });
  }, [
    showDownhill,
    showNordic,
    showHeliCat,
    showBackcountry,
    showInformal,
    selectedPasses,
    minVertical,
    minAcreage,
    selectedRegionFilter,
    onlySnowIncoming,
    searchQuery,
    globalSkiAreasCount,
    mapLoaded,
  ]);

  /* =========================================================================
     GLOBAL POINTS VISIBILITY TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const layers = [
      'global-clusters',
      'global-cluster-count',
      'global-unclustered-point',
      'global-unclustered-label',
    ];
    layers.forEach((lyr) => {
      if (map.getLayer(lyr)) {
        map.setLayoutProperty(lyr, 'visibility', showGlobalPoints ? 'visible' : 'none');
      }
    });
  }, [showGlobalPoints, mapLoaded]);

  /* =========================================================================
     GLOBAL SKI AREA SEARCH MATCHES
     ========================================================================= */

  const globalSearchMatches = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase();
    return globalFeaturesRef.current
      .filter((f) => {
        const p = f.properties;
        return (
          p.name.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q) ||
          p.region.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [searchQuery, globalSkiAreasCount]);

  /* =========================================================================
     LIVE METEOROLOGICAL FETCH (REAL OPEN-METEO DATA)
     ========================================================================= */

  const updateResortWeather = async (resort: SkiResort) => {
    const live = await fetchLiveWeather(resort);
    if (live) {
      setResorts((prev) =>
        prev.map((r) => (r.id === resort.id ? { ...r, weather: live } : r))
      );
    }
  };

  useEffect(() => {
    if (selectedResort && !selectedResort.weather?.is_live) {
      updateResortWeather(selectedResort);
    }
  }, [selectedResortId]);

  useEffect(() => {
    const fetchInitial = async () => {
      const targets = resorts.slice(0, 8);
      for (const t of targets) {
        const live = await fetchLiveWeather(t);
        if (live) {
          setResorts((prev) =>
            prev.map((r) => (r.id === t.id ? { ...r, weather: live } : r))
          );
        }
      }
    };
    fetchInitial();
  }, []);

  /* =========================================================================
     FORMATTING HELPERS
     ========================================================================= */

  const formatVert = (ft: number | null | undefined) => {
    if (!ft || ft <= 0) return '—';
    if (unitsMetric) return `${Math.round(ft * 0.3048).toLocaleString()} m`;
    return `${ft.toLocaleString()}'`;
  };

  const formatAcres = (ac: number | null | undefined) => {
    if (!ac || ac <= 0) return '—';
    if (unitsMetric) return `${Math.round(ac * 0.404686).toLocaleString()} ha`;
    return `${ac.toLocaleString()} ac`;
  };

  const formatSnow = (inches: number) => {
    if (unitsMetric) return `${Math.round(inches * 2.54)} cm`;
    return `${inches}"`;
  };

  const formatTemp = (f: number) => {
    if (unitsMetric) return `${Math.round(((f - 32) * 5) / 9)}°C`;
    return `${f}°F`;
  };

  const formatWind = (mph: number) => {
    if (unitsMetric) return `${Math.round(mph * 1.60934)} km/h`;
    return `${mph} mph`;
  };

  /* =========================================================================
     RENDER: BRIGHT, CLEAN ALPINE GIS INTERFACE
     ========================================================================= */

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 text-slate-800 font-sans select-none">
      {/* 3D MAP CANVAS */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* CLEAN BRIGHT TOP BAR */}
      <header className="absolute top-0 inset-x-0 z-20 h-13 flex items-center justify-between px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-[#E05216]" />
            <h1 className="text-sm font-bold tracking-tight text-slate-900 font-mono">
              3D Ski Atlas
            </h1>
          </div>
          <span className="hidden sm:inline-block text-xs text-slate-500 font-mono border-l border-slate-200 pl-3">
            Global Topography & Trails
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="text-[11px] text-slate-500 hidden md:block">
            {globalSkiAreasCount > 0 ? `${globalSkiAreasCount.toLocaleString()} ski areas loaded` : '5,900+ ski areas loaded'}
          </div>

          {/* Units */}
          <button
            onClick={() => setUnitsMetric(!unitsMetric)}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-slate-700 shadow-xs transition-colors"
            title="Toggle Metric / Imperial units"
          >
            {unitsMetric ? 'Metric (°C, m)' : 'Imperial (°F, ft)'}
          </button>
        </div>
      </header>

      {/* DOCKED EXPAND BUTTON WHEN LEFT PANEL IS COLLAPSED (CLEAN, 100% VISIBLE, NEVER HALF-HIDDEN) */}
      {!leftDockOpen && (
        <button
          onClick={() => setLeftDockOpen(true)}
          className="absolute top-16 left-0 z-20 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-md border border-l-0 border-slate-200 rounded-r-xl shadow-md text-xs font-semibold text-slate-800 hover:text-slate-900 hover:bg-white transition-all cursor-pointer group"
          title="Open Filters & Mountains"
        >
          <Sliders className="w-4 h-4 text-[#E05216] group-hover:scale-110 transition-transform" />
          <span className="font-mono text-[11px]">Filters & Mountains</span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
        </button>
      )}

      {/* LEFT FILTER PANEL (FLUSH TO THE LEFT SIDE - NO FLOATING GAPS) */}
      <div
        className={`absolute top-13 bottom-0 left-0 z-20 flex flex-col transition-transform duration-300 ease-in-out ${
          leftDockOpen ? 'w-80 md:w-96 translate-x-0' : 'w-80 md:w-96 -translate-x-full pointer-events-none'
        }`}
      >
        <div className="relative flex flex-col h-full bg-white/98 backdrop-blur-md border-r border-slate-200/90 shadow-xl overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#E05216]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                Ski Directory
              </span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#E05216]/10 text-[#E05216] border border-[#E05216]/30 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
            <button
              onClick={() => setLeftDockOpen(false)}
              className="p-1.5 hover:bg-slate-200/80 rounded-md text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Collapse left panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Top Search, Category Toggles, Collapsible Filter Bar & Mode Tabs (Sticky) */}
          <div className="p-3 border-b border-slate-100 bg-white space-y-2.5 shrink-0 relative">
            {/* Integrated Search Bar with Instant Floating Zoom Results */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search 12,000+ downhill, nordic, cat/heli & wild areas..."
                value={searchQuery}
                onFocus={() => setSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#E05216] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchDropdownOpen(false);
                  }}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Instant Floating Search Results Dropdown - Direct Click to Zoom! */}
              {searchDropdownOpen && searchQuery.trim().length >= 1 && (
                <div className="absolute top-9 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-72 flex flex-col animate-in fade-in duration-150">
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{allSearchMatches.length} matching areas</span>
                    <span className="text-[#E05216] font-semibold">Click to Zoom ↗</span>
                  </div>
                  <div className="overflow-y-auto p-1.5 space-y-1">
                    {allSearchMatches.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs italic">
                        No ski areas matching "{searchQuery}" in active categories.
                      </div>
                    ) : (
                      allSearchMatches.map((match) => {
                        const badge = getCategoryBadge(match.category);
                        return (
                          <div
                            key={`search-pop-${match.id}`}
                            onClick={() => {
                              if (match.isFeatured || resorts.some((r) => r.id === match.id)) {
                                handleSelectResort(match.id);
                              } else {
                                handleSelectGlobalResort(match.rawProps || match, [match.lng, match.lat]);
                              }
                              if (mapRef.current && isFinite(match.lng) && isFinite(match.lat)) {
                                safeFlyTo(mapRef.current, {
                                  center: [match.lng, match.lat],
                                  zoom: 12.8,
                                  pitch: 45,
                                  bearing: 0,
                                  duration: 1600,
                                  essential: true,
                                });
                              }
                              setSearchDropdownOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100/90 cursor-pointer transition-colors group border border-transparent hover:border-slate-200"
                          >
                            <div className="truncate mr-2">
                              <div className="font-semibold text-xs text-slate-900 truncate flex items-center gap-1.5">
                                <span>{match.name}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {badge.icon} {badge.label}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <span>{match.region ? `${match.region}, ` : ''}{match.country}</span>
                                {match.vertical_ft && match.vertical_ft > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{formatVert(match.vertical_ft)}</span>
                                  </>
                                )}
                                {match.skiable_acres > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{formatAcres(match.skiable_acres)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-[#E05216] opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                              Zoom ↗
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Individual Category Toggles Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-semibold uppercase">
                <span>Categories (Individual Toggles)</span>
                <button
                  onClick={() => {
                    setShowDownhill(true);
                    setShowNordic(true);
                    setShowHeliCat(true);
                    setShowBackcountry(true);
                    setShowInformal(true);
                  }}
                  className="text-[9px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  All On
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {/* 1. Downhill */}
                <button
                  onClick={() => setShowDownhill(!showDownhill)}
                  className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                    showDownhill
                      ? 'bg-orange-50 border-orange-300 text-[#E05216] font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                  }`}
                  title="Toggle Downhill / Alpine Ski Resorts"
                >
                  <span>⛷️ Downhill</span>
                </button>

                {/* 2. Nordic XC */}
                <button
                  onClick={() => setShowNordic(!showNordic)}
                  className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                    showNordic
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                  }`}
                  title="Toggle Nordic / Cross-Country Trail Networks"
                >
                  <span>🎿 Nordic</span>
                </button>

                {/* 3. Cat & Heli */}
                <button
                  onClick={() => setShowHeliCat(!showHeliCat)}
                  className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                    showHeliCat
                      ? 'bg-purple-50 border-purple-300 text-purple-800 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                  }`}
                  title="Toggle Guided Snowcat & Helicopter Ski Operations"
                >
                  <span>🚁 Cat/Heli</span>
                </button>

                {/* 4. Backcountry */}
                <button
                  onClick={() => setShowBackcountry(!showBackcountry)}
                  className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                    showBackcountry
                      ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                  }`}
                  title="Toggle Backcountry & Ski Touring Zones"
                >
                  <span>🏔️ Touring</span>
                </button>

                {/* 5. Wild & Non-Resort (Mauna Kea) */}
                <button
                  onClick={() => setShowInformal(!showInformal)}
                  className={`col-span-2 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                    showInformal
                      ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                  }`}
                  title="Toggle Informal / Wild Snowfields & Non-Resorts (e.g. Mauna Kea)"
                >
                  <span>🌋 Wild / Non-Resort</span>
                </button>
              </div>
            </div>

            {/* Filter Toggle & Sorting Row */}
            <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-all cursor-pointer ${
                    filtersExpanded || activeFiltersCount > 0
                      ? 'bg-[#E05216]/10 border-[#E05216] text-[#E05216] font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title="Toggle region, pass networks, and elevation/acreage sliders"
                >
                  <Sliders className="w-3 h-3 text-[#E05216]" />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="bg-[#E05216] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] text-slate-500 hover:text-[#E05216] underline transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Quick Sort Selector */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[10px]">
                <button
                  onClick={() => setSortBy('snow')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    sortBy === 'snow' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sort by 72h Snowfall"
                >
                  Snow
                </button>
                <button
                  onClick={() => setSortBy('vert')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    sortBy === 'vert' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sort by Vertical Drop"
                >
                  Vert
                </button>
                <button
                  onClick={() => setSortBy('acres')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    sortBy === 'acres' ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sort by Skiable Acreage"
                >
                  Acres
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    sortBy === 'name' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sort Alphabetically (A-Z)"
                >
                  A-Z
                </button>
              </div>
            </div>

            {/* Active Pass Filter Indicator Chips */}
            {selectedPasses.length < 5 && (
              <div className="flex items-center flex-wrap gap-1 bg-amber-50/70 p-1.5 rounded-md border border-amber-200/70 text-[10px] font-mono">
                <span className="text-amber-800 text-[9px] uppercase font-bold">Map Dots Filter:</span>
                {selectedPasses.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 font-bold shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PASS_COLORS[p] }} />
                    <span>{p} Only</span>
                  </span>
                ))}
                <button
                  onClick={() => setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'])}
                  className="ml-auto text-[9px] text-[#E05216] hover:text-slate-900 underline cursor-pointer font-bold"
                >
                  Show All Dots
                </button>
              </div>
            )}

            {/* Collapsible Filter Drawer (Compact & Collapsed by Default) */}
            {filtersExpanded && (
              <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-200">
                {/* Sliders: Acreage & Vertical Drop */}
                <div className="space-y-2">
                  {/* Min Skiable Acreage Slider */}
                  <div className="space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-600 font-semibold">Min Skiable Acreage</span>
                      <span className="text-emerald-700 font-bold">{minAcreage > 0 ? formatAcres(minAcreage) : 'Any'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6000"
                      step="250"
                      value={minAcreage}
                      onChange={(e) => setMinAcreage(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Min Vertical Drop Slider */}
                  <div className="space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-600 font-semibold">Min Vertical Drop</span>
                      <span className="text-slate-900 font-bold">{minVertical > 0 ? formatVert(minVertical) : 'Any'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="250"
                      value={minVertical}
                      onChange={(e) => setMinVertical(Number(e.target.value))}
                      className="w-full accent-[#E05216] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Region Jump Pills */}
                <div>
                  <div className="text-[10px] font-mono text-slate-400 font-semibold uppercase mb-1">
                    Region Jump
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: 'All', value: 'All' },
                      { label: 'Rockies', value: 'Rockies' },
                      { label: 'Pacific NW', value: 'Pacific NW' },
                      { label: 'US East', value: 'US East' },
                      { label: 'Alps', value: 'Alps' },
                      { label: 'Dolomites', value: 'Dolomites' },
                      { label: 'Scandinavia', value: 'Scandinavia' },
                      { label: 'Japan', value: 'Japan' },
                      { label: 'S. America', value: 'South America' },
                    ].map((reg) => (
                      <button
                        key={reg.value}
                        onClick={() => {
                          setSelectedRegionFilter(reg.value);
                          if (mapRef.current) {
                            if (reg.value === 'Rockies') safeFlyTo(mapRef.current, { center: [-110.84, 43.59], zoom: 7, bearing: 0 });
                            if (reg.value === 'Pacific NW') safeFlyTo(mapRef.current, { center: [-122.9, 50.1], zoom: 7, bearing: 0 });
                            if (reg.value === 'US East') safeFlyTo(mapRef.current, { center: [-72.8, 44.1], zoom: 7.5, bearing: 0 });
                            if (reg.value === 'Alps') safeFlyTo(mapRef.current, { center: [7.5, 46.0], zoom: 7, bearing: 0 });
                            if (reg.value === 'Dolomites') safeFlyTo(mapRef.current, { center: [11.9, 46.5], zoom: 8, bearing: 0 });
                            if (reg.value === 'Scandinavia') safeFlyTo(mapRef.current, { center: [10.5, 61.5], zoom: 6.5, bearing: 0 });
                            if (reg.value === 'Japan') safeFlyTo(mapRef.current, { center: [140.7, 42.8], zoom: 7, bearing: 0 });
                            if (reg.value === 'South America') safeFlyTo(mapRef.current, { center: [-70.2, -33.3], zoom: 7, bearing: 0 });
                          }
                        }}
                        className={`px-1 py-1 rounded text-[10px] font-mono border transition-colors text-center cursor-pointer ${
                          selectedRegionFilter === reg.value
                            ? 'bg-[#E05216] text-white border-[#E05216] font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {reg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pass Type Pills */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase mb-1">
                    <span>Pass Networks (Filters Map Dots)</span>
                    <button
                      onClick={() =>
                        setSelectedPasses(
                          selectedPasses.length === 5
                            ? ['Ikon']
                            : ['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent']
                        )
                      }
                      className="text-[9px] text-[#E05216] hover:text-slate-900 underline cursor-pointer font-bold"
                    >
                      {selectedPasses.length === 5 ? 'Solo Ikon' : 'Select All'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'] as PassNetwork[]).map((pass) => {
                      const active = selectedPasses.includes(pass);
                      const color = PASS_COLORS[pass];
                      return (
                        <button
                          key={pass}
                          onClick={() => {
                            if (selectedPasses.length === 5) {
                              // If all are selected, clicking one isolates that pass (e.g. click Ikon -> only Ikon dots on map!)
                              setSelectedPasses([pass]);
                            } else if (selectedPasses.length === 1 && selectedPasses[0] === pass) {
                              // If this pass is the only one selected, reset to all
                              setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent']);
                            } else {
                              if (active) {
                                setSelectedPasses(selectedPasses.filter((p) => p !== pass));
                              } else {
                                setSelectedPasses([...selectedPasses, pass]);
                              }
                            }
                          }}
                          title={`Click to filter map dots and directory to ${pass} Pass`}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer ${
                            active
                              ? 'bg-white border-slate-300 text-slate-900 shadow-2xs font-bold ring-1 ring-slate-300'
                              : 'bg-slate-50/70 border-slate-200/60 text-slate-400 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span>{pass}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Directory Mode Tabs: Featured | In Viewport | Global */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-[10px] font-mono">
              <button
                onClick={() => setMountainListTab('featured')}
                className={`py-1 rounded text-center transition-all cursor-pointer ${
                  mountainListTab === 'featured'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Featured ({sortedFeaturedResorts.length})
              </button>
              <button
                onClick={() => setMountainListTab('in_view')}
                className={`py-1 rounded text-center transition-all cursor-pointer ${
                  mountainListTab === 'in_view'
                    ? 'bg-white text-[#E05216] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ski areas currently visible inside your map extent"
              >
                In View ({visibleResorts.length + (mountainListTab === 'in_view' ? visibleGlobalAreas.length : 0)})
              </button>
              <button
                onClick={() => setMountainListTab('global')}
                className={`py-1 rounded text-center transition-all cursor-pointer ${
                  mountainListTab === 'global'
                    ? 'bg-white text-sky-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="All worldwide ski areas"
              >
                All Areas ({globalSkiAreasCount > 0 ? `${globalSkiAreasCount.toLocaleString()}` : '12k+'})
              </button>
            </div>
          </div>

          {/* Directory Mountain List: Placed at Top & Fills Full Remaining Height! */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
            {/* TAB 1: FEATURED PREMIER RESORTS & OPERATIONS */}
            {mountainListTab === 'featured' && (
              <>
                {sortedFeaturedResorts.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic space-y-2">
                    <div>No mountains match your search or filters.</div>
                    {searchQuery && (
                      <button
                        onClick={() => setMountainListTab('global')}
                        className="text-sky-600 hover:text-sky-800 text-[11px] font-mono underline block mx-auto cursor-pointer"
                      >
                        Search all 12,000+ worldwide ski areas ↗
                      </button>
                    )}
                  </div>
                ) : (
                  sortedFeaturedResorts.map((r) => {
                    const isSelected = r.id === selectedResortId;
                    const snow72 = r.weather?.snowfall_72h_in ?? 0;
                    const badge = getCategoryBadge(r.category);
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectResort(r.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border group ${
                          isSelected
                            ? 'bg-[#E05216]/10 border-[#E05216] text-[#E05216] ring-1 ring-[#E05216]'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-xs truncate text-slate-900 flex items-center gap-1.5">
                            <span>{r.name}</span>
                            <span className={`text-[8px] font-mono px-1 py-0.2 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <span>{r.region ? `${r.region}, ` : ''}{r.country}</span>
                            {r.vertical_drop_ft && r.vertical_drop_ft > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatVert(r.vertical_drop_ft)}</span>
                              </>
                            )}
                            {r.skiable_acres > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatAcres(r.skiable_acres)}</span>
                              </>
                            )}
                            {r.tenure_acres && r.tenure_acres > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatAcres(r.tenure_acres)} tenure</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {snow72 > 0 ? (
                            <span className="text-sky-600 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 font-mono text-[10px]">
                              {formatSnow(snow72)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">0"</span>
                          )}
                          <span className="opacity-0 group-hover:opacity-100 text-slate-400 group-hover:text-[#E05216] text-[10px] font-mono transition-opacity">
                            Pan ↗
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* TAB 2: IN VIEWPORT (MAP EXTENT) */}
            {mountainListTab === 'in_view' && (
              <>
                {visibleResorts.length === 0 && visibleGlobalAreas.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic space-y-1">
                    <MapPin className="w-5 h-5 mx-auto text-slate-300" />
                    <div>No ski areas in current map view.</div>
                    <div className="text-[10px] text-slate-400">Pan or zoom towards mountain ranges.</div>
                  </div>
                ) : (
                  <>
                    {/* Visible Featured */}
                    {visibleResorts.map((r) => {
                      const isSelected = r.id === selectedResortId;
                      const snow72 = r.weather?.snowfall_72h_in ?? 0;
                      const badge = getCategoryBadge(r.category);
                      return (
                        <div
                          key={`view-featured-${r.id}`}
                          onClick={() => handleSelectResort(r.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border group ${
                            isSelected
                              ? 'bg-[#E05216]/10 border-[#E05216] text-[#E05216] ring-1 ring-[#E05216]'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs hover:border-slate-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-semibold text-xs truncate text-slate-900 flex items-center gap-1.5">
                              <span>{r.name}</span>
                              <span className={`text-[8px] font-mono px-1 py-0.2 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {badge.icon} {badge.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {r.region ? `${r.region}, ` : ''}{r.country}
                              {r.vertical_drop_ft && r.vertical_drop_ft > 0 && ` · ${formatVert(r.vertical_drop_ft)}`}
                              {r.skiable_acres > 0 && ` · ${formatAcres(r.skiable_acres)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {snow72 > 0 && (
                              <span className="text-sky-600 font-bold bg-sky-50 px-1 py-0.5 rounded text-[10px] font-mono">
                                {formatSnow(snow72)}
                              </span>
                            )}
                            <span className="opacity-0 group-hover:opacity-100 text-[#E05216] text-[10px] font-mono">
                              Pan ↗
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Visible Global OSM Ski Areas */}
                    {visibleGlobalAreas.map((f: any) => {
                      const p = f.properties;
                      const coords = f.geometry?.coordinates;
                      const badge = getCategoryBadge(p.category);
                      const isSelected =
                        selectedResortId === p.id ||
                        (Array.isArray(coords) &&
                          typeof coords[0] === 'number' &&
                          typeof coords[1] === 'number' &&
                          !isNaN(coords[0]) &&
                          !isNaN(coords[1]) &&
                          selectedResortId === `global-${Math.round(coords[0] * 1000)}-${Math.round(coords[1] * 1000)}`);
                      return (
                        <div
                          key={`view-global-${p.id}`}
                          onClick={() => handleSelectGlobalResort(p, coords)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border group ${
                            isSelected
                              ? 'bg-sky-50 border-sky-400 text-sky-800 ring-1 ring-sky-300'
                              : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200 shadow-2xs hover:border-sky-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-semibold text-xs truncate text-slate-900 flex items-center gap-1.5">
                              <span>{p.name}</span>
                              <span className={`text-[8px] font-mono px-1 py-0.2 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {badge.icon} {badge.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {p.region ? `${p.region}, ` : ''}{p.country}
                              {p.vertical_ft && p.vertical_ft > 0 && ` · ${formatVert(p.vertical_ft)}`}
                            </div>
                          </div>
                          <span className="opacity-0 group-hover:opacity-100 text-sky-600 text-[10px] font-mono shrink-0">
                            Pan ↗
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* TAB 3: ALL WORLDWIDE SKI AREAS (OPENSKIDATA) */}
            {mountainListTab === 'global' && (
              <>
                {visibleGlobalAreas.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic">
                    {isFetchingGlobal ? 'Loading 12,000+ worldwide ski areas...' : 'No ski areas match your search or filters.'}
                  </div>
                ) : (
                  visibleGlobalAreas.map((f: any) => {
                    const p = f.properties;
                    const coords = f.geometry?.coordinates;
                    const badge = getCategoryBadge(p.category);
                    const isSelected =
                      selectedResortId === p.id ||
                      (Array.isArray(coords) &&
                        typeof coords[0] === 'number' &&
                        typeof coords[1] === 'number' &&
                        !isNaN(coords[0]) &&
                        !isNaN(coords[1]) &&
                        selectedResortId === `global-${Math.round(coords[0] * 1000)}-${Math.round(coords[1] * 1000)}`);
                    return (
                      <div
                        key={`all-global-${p.id}`}
                        onClick={() => handleSelectGlobalResort(p, coords)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border group ${
                          isSelected
                            ? 'bg-sky-50 border-sky-400 text-sky-800 ring-1 ring-sky-300'
                            : 'bg-white hover:bg-sky-50/50 text-slate-700 border-slate-200 shadow-2xs hover:border-sky-300'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-xs truncate text-slate-900 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            <span className={`text-[8px] font-mono px-1 py-0.2 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {p.region ? `${p.region}, ` : ''}{p.country}
                            {p.vertical_ft && p.vertical_ft > 0 && ` · ${formatVert(p.vertical_ft)}`}
                          </div>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-sky-600 text-[10px] font-mono shrink-0">
                          Pan ↗
                        </span>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* BASEMAP & OVERLAYS HAMBURGER TOGGLE ON MAP (DISAPPEARS ON HOVER OFF) */}
      <div
        className={`absolute top-16 ${selectedResort ? 'right-88 md:right-100' : 'right-4'} z-20 transition-all duration-300`}
        onMouseEnter={() => {
          if (mapMenuTimeoutRef.current) clearTimeout(mapMenuTimeoutRef.current);
          setMapMenuOpen(true);
        }}
        onMouseLeave={() => {
          if (mapMenuTimeoutRef.current) clearTimeout(mapMenuTimeoutRef.current);
          mapMenuTimeoutRef.current = setTimeout(() => {
            setMapMenuOpen(false);
          }, 180);
        }}
      >
        <button
          onClick={() => setMapMenuOpen(!mapMenuOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-md backdrop-blur-md text-xs font-medium transition-all ${
            mapMenuOpen
              ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
              : 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-white hover:text-slate-900'
          }`}
          title="Map Layers & Basemap"
        >
          <Menu className="w-4 h-4 text-[#E05216]" />
          <span className="font-mono text-[11px] font-semibold">Basemap & Layers</span>
        </button>

        {mapMenuOpen && (
          <div className="absolute right-0 top-11 w-68 bg-white/98 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl p-3 space-y-3 z-30 text-xs">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1.5">
                Base Map Style
              </div>
              <div className="space-y-1">
                {[
                  { id: 'topo', label: 'High-Res Topo (Terrain)', desc: 'Elevation contours & hillshade relief' },
                  { id: 'satellite', label: 'Satellite 3D', desc: 'High-resolution aerial satellite imagery' },
                  { id: 'osm', label: 'OpenStreetMap', desc: 'Detailed vector roads, towns & trails' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setBasemapMode(item.id as BasemapMode);
                    }}
                    className={`w-full text-left p-2 rounded-lg border transition-all ${
                      basemapMode === item.id
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{item.label}</div>
                    <div className={`text-[10px] ${basemapMode === item.id ? 'text-slate-300' : 'text-slate-400'}`}>
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1.5">
                Map Overlays
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-medium text-slate-700">OSM Ski Trails</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showRealTrailsLayer}
                    onChange={(e) => setShowRealTrailsLayer(e.target.checked)}
                    className="rounded text-[#E05216] focus:ring-[#E05216]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[11px] font-medium text-slate-700">5,900+ Global Points</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showGlobalPoints}
                    onChange={(e) => setShowGlobalPoints(e.target.checked)}
                    className="rounded text-[#E05216] focus:ring-[#E05216]"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIGHT-THEMED COMPACT COMPASS & GYROSCOPE */}
      <div
        className={`absolute bottom-5 ${
          selectedResort ? 'right-88 md:right-100' : 'right-4'
        } z-20 flex flex-col items-center transition-all duration-300 select-none`}
      >
        <div
          onMouseDown={handleGyroMouseDown}
          onDoubleClick={handleGyroDoubleClick}
          className={`relative w-16 h-16 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md flex items-center justify-center transition-all ${
            isGyroDragging
              ? 'cursor-grabbing scale-105 ring-2 ring-[#E05216] shadow-lg'
              : 'cursor-grab hover:border-slate-300 hover:shadow-lg'
          }`}
          title="Compass & Gyroscope: Left-click drag to rotate/tilt · Double-click to reset 2D North"
        >
          {/* Rotating Compass Bezel (Rotates with Map Bearing) */}
          <div
            className="absolute inset-0 w-full h-full rounded-full pointer-events-none transition-transform ease-out"
            style={{
              transform: `rotate(${-mapBearing}deg)`,
              transitionDuration: isGyroDragging ? '0ms' : '150ms',
            }}
          >
            {/* North Indicator: Red Pointer Arrow & Bold 'N' (Clickable) */}
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                safeEaseTo(mapRef.current, { bearing: 0, duration: 500 });
                setMapBearing(0);
              }}
              title="Click to face North (0°)"
            >
              <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-rose-500" />
              <span className="text-[9px] font-black text-rose-500 leading-none tracking-tight mt-0.5">N</span>
            </div>

            {/* East Cardinal */}
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">
              E
            </div>

            {/* South Cardinal */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400">
              S
            </div>

            {/* West Cardinal */}
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">
              W
            </div>

            {/* Subtle Dial Ring */}
            <div className="absolute inset-1 rounded-full border border-slate-200/80" />
          </div>

          {/* Clean Center Navigation Disc (No ellipses, dual-tone compass needle) */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200 shadow-inner flex items-center justify-center pointer-events-none">
            <div
              className="w-full h-full relative flex items-center justify-center transition-transform ease-out"
              style={{
                transform: `rotate(${-mapBearing}deg)`,
                transitionDuration: isGyroDragging ? '0ms' : '150ms',
              }}
            >
              {/* North Needle (Red) */}
              <div className="absolute top-1 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[9px] border-b-rose-500" />
              {/* South Needle (Slate) */}
              <div className="absolute bottom-1 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[9px] border-t-slate-300" />
              {/* Center Pivot Pip */}
              <div className="w-2 h-2 rounded-full bg-white border border-slate-300 shadow-2xs z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT MOUNTAIN DOSSIER (FLUSH TO RIGHT SIDE) */}
      {selectedResort && (
        <div className="absolute top-13 bottom-0 right-0 z-20 w-84 md:w-96 flex flex-col bg-white/98 backdrop-blur-md border-l border-slate-200/90 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-500">
                  {selectedResort.region}, {selectedResort.country}
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                  {selectedResort.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedResortId(null)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded"
              >
                ✕
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(() => {
                const badge = getCategoryBadge(selectedResort.category);
                return (
                  <span className={`px-2 py-0.5 text-[10px] font-mono rounded-md font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {badge.icon} {badge.label}
                  </span>
                );
              })()}
              {selectedResort.pass_networks.map((pass) => (
                <span
                  key={pass}
                  className="px-2 py-0.5 text-[10px] font-mono rounded-md font-semibold border"
                  style={{
                    backgroundColor: `${PASS_COLORS[pass]}15`,
                    borderColor: `${PASS_COLORS[pass]}50`,
                    color: PASS_COLORS[pass],
                  }}
                >
                  {pass}
                </span>
              ))}
              <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-200 text-slate-700 rounded-md">
                {selectedResort.archetype}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            {/* View Actions */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <button
                onClick={() => handleSelectResort(selectedResort.id)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-[#E05216]" />
                <span>Pan to Mountain</span>
              </button>
              <button
                onClick={() => {
                  if (
                    typeof selectedResort.lng !== 'number' ||
                    typeof selectedResort.lat !== 'number' ||
                    isNaN(selectedResort.lng) ||
                    isNaN(selectedResort.lat)
                  ) {
                    return;
                  }
                  safeEaseTo(mapRef.current, {
                    center: [selectedResort.lng, selectedResort.lat],
                    pitch: 62,
                    bearing: 0,
                    zoom: 14.2,
                    duration: 1200,
                  });
                }}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg"
              >
                <Mountain className="w-3.5 h-3.5 text-sky-600" />
                <span>Summit Pitch</span>
              </button>
            </div>

            {/* Core Mountain Stats */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-center">
              <div>
                <div className="text-[10px] text-slate-500">Vertical</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {formatVert(selectedResort.vertical_drop_ft)}
                </div>
              </div>
              <div className="border-x border-slate-200">
                <div className="text-[10px] text-slate-500">Summit</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {formatVert(selectedResort.summit_elev_ft)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Base</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {formatVert(selectedResort.base_elev_ft)}
                </div>
              </div>
            </div>

            {/* Terrain Footprint Stats */}
            {(selectedResort.skiable_acres > 0 || (selectedResort.tenure_acres && selectedResort.tenure_acres > 0)) && (
              <div className="flex items-center justify-around bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-center text-xs">
                {selectedResort.skiable_acres > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Skiable Terrain</span>
                    <span className="font-bold text-emerald-700">{formatAcres(selectedResort.skiable_acres)}</span>
                  </div>
                )}
                {selectedResort.tenure_acres && selectedResort.tenure_acres > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Permitted Tenure</span>
                    <span className="font-bold text-purple-700">{formatAcres(selectedResort.tenure_acres)}</span>
                  </div>
                )}
              </div>
            )}

            {/* REAL TRAILS & LIFTS DIRECTORY */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#E05216]" />
                  <span className="text-slate-900 font-semibold uppercase">Real Pistes & Lifts</span>
                </div>
                <span className="text-[10px] text-sky-700 font-mono font-semibold">
                  {filteredTrails.length > 0 ? `${filteredTrails.length} Named Tracks` : 'OSM Draped'}
                </span>
              </div>

              {/* Difficulty filter buttons */}
              {currentResortTrails.length > 0 && (
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'expert', label: 'Dbl Black' },
                    { id: 'advanced', label: 'Black' },
                    { id: 'intermediate', label: 'Blue' },
                    { id: 'novice', label: 'Green' },
                    { id: 'lifts', label: 'Lifts' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setActiveTrailFilter(btn.id)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        activeTrailFilter === btn.id
                          ? 'bg-slate-800 text-white border-slate-800 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Named Trail List */}
              {currentResortTrails.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono">
                  {filteredTrails.map((trail) => {
                    const isSelected = selectedTrailId === trail.properties.id;
                    const isLift = trail.properties.kind === 'lift';

                    let badgeColor = '#64748b';
                    if (isLift) badgeColor = '#E05216';
                    else if (trail.properties.difficulty === 'novice') badgeColor = '#16a34a';
                    else if (trail.properties.difficulty === 'intermediate') badgeColor = '#2563eb';
                    else if (trail.properties.difficulty === 'advanced') badgeColor = '#0f172a';
                    else if (trail.properties.difficulty === 'expert') badgeColor = '#dc2626';

                    return (
                      <div
                        key={trail.properties.id}
                        onClick={() => handleFocusTrail(trail)}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-[#E05216]/10 border-[#E05216] text-[#E05216]'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: badgeColor }}
                          />
                          <div className="truncate">
                            <span className="font-semibold text-xs text-slate-900">
                              {trail.properties.name}
                            </span>
                            {trail.properties.lift_type && (
                              <div className="text-[9px] text-slate-500 truncate">
                                {trail.properties.lift_type}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-500 uppercase shrink-0 pl-1">
                          Zoom ↗
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 p-2 bg-white rounded-lg border border-slate-200 leading-relaxed">
                  Real OpenStreetMap downhill ski pistes and aerialways are active and draped directly across this 3D mountain via the green/blue/red/black overlay.
                </div>
              )}

              {/* Legend */}
              <div className="grid grid-cols-2 gap-1 font-mono text-[9px] bg-white p-2 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1.5 rounded bg-[#16a34a]" />
                  <span className="text-slate-700">Green Novice</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1.5 rounded bg-[#2563eb]" />
                  <span className="text-slate-700">Blue Intermediate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1.5 rounded bg-[#0f172a]" />
                  <span className="text-slate-700">Black Advanced</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1.5 rounded bg-[#dc2626]" />
                  <span className="text-slate-700">Double Black</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2 pt-1 border-t border-slate-100">
                  <span className="w-3 border-t-2 border-dashed border-[#E05216]" />
                  <span className="text-slate-700">Aerialway Lifts (Tram / Gondola / Quad)</span>
                </div>
              </div>
            </div>

            {/* Snow & Weather Forecast */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-[#E05216]" />
                  <span className="text-slate-900 font-semibold uppercase">Summit Forecast</span>
                </div>
                <button
                  onClick={() => updateResortWeather(selectedResort)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900"
                >
                  <RefreshCw className="w-3 h-3 text-[#E05216]" />
                  <span>Update</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2 bg-white rounded-lg border border-slate-200 font-mono text-center">
                <div>
                  <div className="text-[9px] text-slate-500">72h Snow</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatSnow(selectedResort.weather?.snowfall_72h_in ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">7-Day Snow</div>
                  <div className="text-sm font-bold text-sky-700 mt-0.5">
                    {formatSnow(selectedResort.weather?.snowfall_7d_in ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">Summit Gusts</div>
                  <div className="text-sm font-bold text-amber-700 mt-0.5">
                    {formatWind(selectedResort.weather?.summit_wind_gust_mph ?? 0)}
                  </div>
                </div>
              </div>

              {/* 7-day bars */}
              {selectedResort.weather?.daily_forecast && selectedResort.weather.daily_forecast.length > 0 && (
                <div className="grid grid-cols-7 gap-1 h-16 items-end bg-white p-1.5 rounded-lg border border-slate-200">
                  {selectedResort.weather.daily_forecast.map((day, idx) => {
                    const val = unitsMetric ? day.snowfall_cm : day.snowfall_in;
                    const maxVal = unitsMetric ? 20 : 8;
                    const barH = Math.min(100, Math.max(10, (val / maxVal) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center h-full justify-end">
                        <span className="text-[8px] font-mono text-slate-600">
                          {val > 0 ? (unitsMetric ? Math.round(val) : val) : '-'}
                        </span>
                        <div
                          className={`w-full rounded-t ${val > 2 ? 'bg-[#E05216]' : 'bg-sky-500'}`}
                          style={{ height: `${barH}%` }}
                        />
                        <span className="text-[8px] font-mono text-slate-400 mt-1 truncate w-full text-center">
                          {day.date.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description & Infrastructure */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-700">
              <p className="leading-relaxed">{selectedResort.summary}</p>
              <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                Lifts: <span className="text-slate-900">{selectedResort.infrastructure}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   SKIATLAS CORE TYPES & INTERFACES
   ========================================================================= */

export type PassNetwork = 'Ikon' | 'Epic' | 'Indy' | 'Mountain Collective' | 'Independent';

// Only genuine ski categories: Downhill, Nordic, Cat/Heli (No novelty / wild / touring clutter)
export type SkiActivityCategory = 'downhill' | 'nordic' | 'heli_cat';

export type EarthProjectionMode = 'globe' | 'mercator';

export type BasemapMode = 'satellite' | 'osm' | 'topo';

export type SortBy = 'snow' | 'vert' | 'acres' | 'name';

export type SortOrder = 'asc' | 'desc';

export type DirectoryScope = 'all' | 'in_frame';

export type PanelView = 'directory' | 'profile';

export type MobileSheetState = 'peek' | 'half' | 'full';

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

export type Resort = SkiResort;

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

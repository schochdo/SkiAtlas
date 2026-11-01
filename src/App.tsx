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
  TopNavBar,
} from './components/header/TopNavBar';
import { FilterModal } from './components/header/FilterModal';
import { LeftDock } from './components/sidebar/LeftDock';
import { DirectoryList } from './components/sidebar/DirectoryList';
import { MobileSheet } from './components/sidebar/MobileSheet';
import { MountainProfile } from './components/profile/MountainProfile';
import { NavigationControls } from './components/map/NavigationControls';
import { RegionalLocator } from './components/map/RegionalLocator';
import { BasemapMenu } from './components/map/BasemapMenu';
import { CartographicLegend } from './components/map/CartographicLegend';
import { CompassGimbal } from './components/map/CompassGimbal';
import { AttributionBadge } from './components/map/AttributionBadge';
import { TrailProfileCard } from './components/map/TrailProfileCard';
import { analyzeTrailFeature } from './utils/trailAnalysis';
import { createMapStyle } from './utils/mapStyles';
import { registerTerrainAnalysisProtocols } from './utils/terrainAnalysis';
import type {
  PassNetwork,
  SkiActivityCategory,
  EarthProjectionMode,
  BasemapMode,
  TerrainOverlayMode,
  SortBy,
  SortOrder,
  DirectoryScope,
  PanelView,
  MobileSheetState,
  DailyForecast,
  ResortWeatherData,
  SkiResort,
  Resort,
  PisteFeature,
  TrailInspectionData,
} from './types';
export type {
  PassNetwork,
  SkiActivityCategory,
  EarthProjectionMode,
  BasemapMode,
  SortBy,
  SortOrder,
  DirectoryScope,
  PanelView,
  MobileSheetState,
  DailyForecast,
  ResortWeatherData,
  SkiResort,
  Resort,
  PisteFeature,
  TrailInspectionData,
};
import { formatSnow, formatVert, formatAcres, formatDistance, formatCoords } from './utils/formatters';
import { safeFlyTo, safeEaseTo, isProgrammaticFlightActive, setIsProgrammaticFlightActive } from './utils/camera';
import { extractPointCoordinates, haversineDistanceKm } from './utils/geometry';
import {
  PASS_COLORS,
  PASS_DISPLAY_NAMES,
  PASS_SHORT_LABELS,
  classifySkiFeature,
  getPassNetworksForSkiArea,
  getResortStats,
  getResortWebsite,
  getCategoryBadge,
} from './utils/classification';
import {
  getNeutralWeather,
  getInitialWeather,
  fetchLiveWeather,
  isWeatherCircuitTripped,
} from './services/weather';
import { GLOBAL_SKI_ATLAS } from './data/resorts';
import { HELI_CAT_OPERATIONS } from './data/heliCat';
import { GEOGRAPHIC_REFERENCE_GEOJSON } from './data/geographicReference';

export {
  formatSnow,
  formatVert,
  formatAcres,
  formatDistance,
  formatCoords,
  safeFlyTo,
  safeEaseTo,
  extractPointCoordinates,
  haversineDistanceKm,
  PASS_COLORS,
  PASS_DISPLAY_NAMES,
  PASS_SHORT_LABELS,
  classifySkiFeature,
  getPassNetworksForSkiArea,
  getResortStats,
  getResortWebsite,
  getCategoryBadge,
  GLOBAL_SKI_ATLAS,
  HELI_CAT_OPERATIONS,
};

/* =========================================================================
   APP COMPONENT
   ========================================================================= */

export const getStaticDataUrl = (relPath: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${cleanBase}${cleanPath}`;
};

export default function App() {
  const [resorts, setResorts] = useState<SkiResort[]>(() => [
    ...GLOBAL_SKI_ATLAS.map((r) => ({
      ...r,
      weather: getInitialWeather(r),
    })),
    ...HELI_CAT_OPERATIONS.map((r) => ({
      ...r,
      weather: getInitialWeather(r),
    })),
  ]);

  const [selectedResortId, setSelectedResortId] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<'directory' | 'profile'>('directory');
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full'>('peek');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);

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
  const [terrainOverlay, setTerrainOverlay] = useState<TerrainOverlayMode>('none');
  const [terrainOverlayOpacity, setTerrainOverlayOpacity] = useState<number>(0.65);
  const [unitsMetric, setUnitsMetric] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNative = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isNative);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const doc = document as any;
    const docEl = document.documentElement as any;

    const isNativeFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (isFullscreen || isNativeFull) {
      if (isNativeFull) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.webkitCancelFullScreen) {
          doc.webkitCancelFullScreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
      setIsFullscreen(false);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 100);
    } else {
      const enterNative = () => {
        if (docEl.requestFullscreen) {
          return docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
          return Promise.resolve();
        } else if (docEl.webkitRequestFullScreen) {
          docEl.webkitRequestFullScreen();
          return Promise.resolve();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
          return Promise.resolve();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
          return Promise.resolve();
        }
        return Promise.reject(new Error('Fullscreen API not supported'));
      };

      enterNative()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch(() => {
          // Fallback for tablets / iPadOS Safari where native Element.requestFullscreen is restricted:
          // Toggle full-viewport edge-to-edge mode
          setIsFullscreen(true);
          try { window.scrollTo(0, 1); } catch (_) {}
        })
        .finally(() => {
          setTimeout(() => {
            if (mapRef.current) mapRef.current.resize();
          }, 150);
        });
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
  const [showPeaks, setShowPeaks] = useState<boolean>(true);
  const [showCountryOutlines, setShowCountryOutlines] = useState<boolean>(false);
  const [attributionOpen, setAttributionOpen] = useState(false);

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
  const [cameraAltitudeMeters, setCameraAltitudeMeters] = useState<number | null>(null);
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

  // Collapsible Cartographic Regional Locator Inset Map (starts collapsed by default)
  const [locatorOpen, setLocatorOpen] = useState<boolean>(false);
  const [locatorZoomPreset, setLocatorZoomPreset] = useState<'regional' | 'continental' | 'global'>('regional');
  const locatorMenuRef = useRef<HTMLDivElement | null>(null);
  const locatorContainerRef = useRef<HTMLDivElement | null>(null);
  const locatorMapRef = useRef<maplibregl.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([12, 28]);
  const [mapZoom, setMapZoom] = useState<number>(1.8);

  // Global Points Ref & Features
  const [showGlobalPoints, setShowGlobalPoints] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({ downhill: 6955, nordic: 5276, heli_cat: HELI_CAT_OPERATIONS.length });
  const allGlobalFeaturesRef = useRef<any[]>([]);
  const globalFeaturesRef = useRef<any[]>([]);

  // Localhost SQLite Trails Cache & Refs
  const liveFeaturesMapRef = useRef<Map<string, any>>(new Map());
  const activeOverpassAbortRef = useRef<AbortController | null>(null);
  const lastFetchedBboxKeyRef = useRef<string>('');
  const handleDeselectResortRef = useRef<() => void>(() => {});

  // Clicked Trail / Slope Inspection State
  const [selectedTrail, setSelectedTrail] = useState<TrailInspectionData | null>(null);
  const [selectedTrailScreenPos, setSelectedTrailScreenPos] = useState<{ x: number; y: number } | null>(null);
  const selectedTrailRef = useRef<TrailInspectionData | null>(null);
  selectedTrailRef.current = selectedTrail;

  const handleDeselectTrail = useCallback(() => {
    setSelectedTrail(null);
    setSelectedTrailScreenPos(null);
    if (mapRef.current) {
      const src = mapRef.current.getSource('selected-trail-source') as GeoJSONSource;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, []);
  const handleDeselectTrailRef = useRef<() => void>(handleDeselectTrail);
  handleDeselectTrailRef.current = handleDeselectTrail;

  const handleSelectTrail = useCallback(
    (feature: any, clickedLngLat: [number, number], screenPoint: { x: number; y: number }) => {
      if (!mapRef.current) return;
      const analysis = analyzeTrailFeature(feature, mapRef.current, clickedLngLat);
      setSelectedTrail(analysis);
      setSelectedTrailScreenPos(screenPoint);

      const src = mapRef.current.getSource('selected-trail-source') as GeoJSONSource;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: feature.geometry,
              properties: feature.properties || {},
            },
          ],
        });
      }
    },
    []
  );
  const handleSelectTrailRef = useRef<
    (feature: any, clickedLngLat: [number, number], screenPoint: { x: number; y: number }) => void
  >(handleSelectTrail);
  handleSelectTrailRef.current = handleSelectTrail;

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
     TRAILS STREAMING & STATIC PRE-BAKED ENGINE
     ========================================================================= */

  const ingestTrailFeatures = useCallback((features: any[]) => {
    if (!features || !features.length || !mapRef.current) return;

    for (const f of features) {
      const p = f.properties;
      if (p?.kind === 'lift') {
        if (p.status && p.status !== 'operating') continue;
        const n = (p.name || '').toLowerCase();
        if (n.includes('proposed') || n.includes('planned') || n.includes('abandoned') || n.includes('disused') || n.includes('in project')) {
          continue;
        }
      } else if (p?.kind === 'piste') {
        const ptype = p['piste:type'];
        const uses = Array.isArray(p.uses) ? p.uses : [];
        if (
          (ptype && ['skitour', 'backcountry', 'fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other'].includes(ptype)) ||
          uses.includes('skitour') ||
          uses.includes('backcountry')
        ) {
          continue;
        }
      }
      if (!f.id && p?.id) {
        f.id = p.id;
      }
      liveFeaturesMapRef.current.set(String(f.id || p?.id), f);
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
  }, []);

  const loadedResortTrailsRef = useRef<Set<string>>(new Set());
  const fetchedBboxKeysSetRef = useRef<Set<string>>(new Set());

  const fetchResortStaticTrails = useCallback(async (resortId: string) => {
    if (loadedResortTrailsRef.current.has(resortId)) return;
    try {
      // 1. Try local SQLite API first (instant query from trails.db)
      const apiRes = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/trails?resort=${resortId}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.features && data.features.length) {
          ingestTrailFeatures(data.features);
          loadedResortTrailsRef.current.add(resortId);
          return;
        }
      }
    } catch (_) {}
    try {
      // 2. Try static pre-exported file in public/data/trails/
      const res = await fetch(getStaticDataUrl(`data/trails/${resortId}.json`));
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length) {
          ingestTrailFeatures(data.features);
          loadedResortTrailsRef.current.add(resortId);
        }
      }
    } catch (_) {}
  }, [ingestTrailFeatures]);

  const fetchOverpassBbox = useCallback(async (south: number, west: number, north: number, east: number) => {
    if (north - south > 0.35 || east - west > 0.45) return;
    const bboxKey = `${south.toFixed(2)},${west.toFixed(2)},${north.toFixed(2)},${east.toFixed(2)}`;
    if (fetchedBboxKeysSetRef.current.has(bboxKey)) return;

    if (activeOverpassAbortRef.current) {
      activeOverpassAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeOverpassAbortRef.current = controller;

    let apiSuccess = false;
    try {
      const apiUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/trails?bbox=${west},${south},${east},${north}`;
      const res = await fetch(apiUrl, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length) {
          ingestTrailFeatures(data.features);
          fetchedBboxKeysSetRef.current.add(bboxKey);
          apiSuccess = true;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
    }

    // Static fallback: find any curated resorts in this bounding box area (±0.04° margin)
    if (!apiSuccess) {
      for (const r of GLOBAL_SKI_ATLAS) {
        if (r.lat >= south - 0.04 && r.lat <= north + 0.04 && r.lng >= west - 0.04 && r.lng <= east + 0.04) {
          fetchResortStaticTrails(r.id);
        }
      }

      // Live Overpass fallback for arbitrary mountain terrain worldwide when no local backend server is present
      try {
        const q = `[out:json][timeout:15];(way["piste:type"](${south},${west},${north},${east});way["aerialway"](${south},${west},${north},${east}););out geom tags;`;
        const overpassRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (overpassRes.ok) {
          const opData = await overpassRes.json();
          if (opData.elements && opData.elements.length) {
            const feats = opData.elements
              .filter((el: any) => el.geometry && el.geometry.length > 1)
              .map((el: any) => ({
                type: 'Feature',
                id: String(el.id),
                geometry: {
                  type: 'LineString',
                  coordinates: el.geometry.map((g: any) => [g.lon, g.lat]),
                },
                properties: {
                  id: String(el.id),
                  name: el.tags?.name || 'Trail',
                  kind: el.tags?.aerialway ? 'lift' : 'piste',
                  'piste:type': el.tags?.['piste:type'] || (el.tags?.aerialway ? undefined : 'downhill'),
                  'piste:difficulty': el.tags?.['piste:difficulty'] || 'intermediate',
                  aerialway: el.tags?.aerialway,
                },
              }));
            if (feats.length) {
              ingestTrailFeatures(feats);
              fetchedBboxKeysSetRef.current.add(bboxKey);
            }
          }
        }
      } catch (_) {}
    }
  }, [fetchResortStaticTrails, ingestTrailFeatures]);

  const fetchOverpassBboxRef = useRef(fetchOverpassBbox);
  useEffect(() => {
    fetchOverpassBboxRef.current = fetchOverpassBbox;
  }, [fetchOverpassBbox]);

  /* =========================================================================
     BACKGROUND WEATHER PREFETCH — load 7-day snow for all resorts on mount
     Batched (5 concurrent) to avoid hammering the API.
     Protected by 24-hour cache TTL and 24-hour circuit breaker.
     ========================================================================= */

  useEffect(() => {
    let cancelled = false;
    const allResorts = [...GLOBAL_SKI_ATLAS];
    const BATCH = 5;

    async function prefetchAll() {
      // If the circuit breaker is active, skip all network queries immediately
      if (isWeatherCircuitTripped()) return;

      for (let i = 0; i < allResorts.length; i += BATCH) {
        if (cancelled) break;
        if (isWeatherCircuitTripped()) break; // Halt immediately if breaker trips mid-run

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

    registerTerrainAnalysisProtocols();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      attributionControl: false,
      renderWorldCopies: false,
      style: createMapStyle(earthProjection, basemapMode, terrainOverlay, terrainOverlayOpacity, showCountryOutlines, showHillshade),
      center: [12, 28], // Global scope flat map (Mercator)
      zoom: 1.8,
      minZoom: 1.2,
      maxZoom: 20.5, // Allow zooming in close to ground level (down to ~100-150ft elevation)
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      dragRotate: true,
      boxZoom: false, // Prevents Shift-key from hijacking left-click panning into a box-zoom box
      maxTileCacheSize: initialIsMobile ? 60 : 120, // Lightweight mobile-friendly tile cache (prevents iPad/browser VRAM exhaustion)
      zoomLevelsToOverscale: 6, // Overscale DEM tiles seamlessly past source maxzoom (z15 -> z21) so terrain mesh remains continuous
      centerClampedToGround: false, // Decouple camera altitude from terrain elevation spikes at high altitudes and during pans
    });

    // Calibrate TileManager in-memory retention for smooth panning without memory exhaustion
    const calibrateTileCaches = () => {
      try {
        const tm = (map as any).style?.tileManagers;
        if (!tm) return;
        const cacheLimit = initialIsMobile ? 60 : 120;
        for (const id in tm) {
          const manager = tm[id];
          manager._maxTileCacheSize = cacheLimit;
          manager._maxTileCacheZoomLevels = 5;
          manager._outOfViewCache?.setMaxSize(cacheLimit);
        }
      } catch (_) {}
    };

    map.on('style.load', calibrateTileCaches);
    map.on('styledata', calibrateTileCaches);

    // Disable boxZoom explicitly to prevent Shift-key conflicts
    try { map.boxZoom.disable(); } catch (_) {}

    // Apply viewport padding synchronously before first render so globe never slides on start
    map.setPadding({ left: initialLeftPad, right: initialRightPad, top: 44, bottom: initialIsMobile ? 80 : 0 });

    mapRef.current = map;
    (window as any)._skiMap = map;
    (window as any).__skiAtlasMap = map;

    // Enable native linear drag-to-rotate around center without center ground clamping
    try {
      (map as any).setCenterClampedToGround?.(false);
      map.dragRotate.enable({ around: 'center', movement: 'linear' });
    } catch (_) {}

    // Tablet & Touchscreen Controls (two-finger pitch tilt, rotate & pinch-zoom)
    try {
      map.touchZoomRotate.enable({ around: 'center' });
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();

      // Fix 1: Invert two-finger twist rotation to match natural physical object rotation
      // By default MapLibre rotates the camera clockwise on clockwise twist, which causes the terrain
      // underneath to rotate counter-clockwise (backwards). Inverting bearingDelta makes the terrain rotate with the fingers.
      const touchRotate = (map as any).touchZoomRotate?._touchRotate;
      if (touchRotate && typeof touchRotate._move === 'function') {
        const origMove = touchRotate._move.bind(touchRotate);
        touchRotate._move = function (points: any, center: any, event: any) {
          const res = origMove(points, center, event);
          if (res && typeof res.bearingDelta === 'number') {
            res.bearingDelta = -res.bearingDelta;
          }
          return res;
        };
      }

      // Fix 2: Remove artificial vertical alignment block in MapLibre touchPitch
      // MapLibre's default _start invalidates touchPitch whenever the two fingers are placed vertically (FP check).
      // Relaxing this allows two-finger vertical swipe to elevate/pitch reliably in any initial finger orientation.
      const touchPitch = (map as any).touchPitch;
      if (touchPitch) {
        touchPitch._start = function (points: any) {
          this._lastPoints = points;
          this._valid = undefined;
        };
        touchPitch.gestureBeginsVertically = function (r: any, i: any) {
          if (Math.abs(r.y) >= 2 && Math.abs(i.y) >= 2) {
            const sameDirection = (r.y > 0) === (i.y > 0);
            const verticalDominant = Math.abs(r.y) > Math.abs(r.x) * 0.7 && Math.abs(i.y) > Math.abs(i.x) * 0.7;
            if (sameDirection && verticalDominant) {
              return true;
            }
          }
          return false;
        };
      }
    } catch (_) {}

    // MapLibre GL JS fix: MapLibre's HandlerManager listens to 'mouseup' on document and dispatches 'mouseupWindow'.
    // However, assignEvents in mouse.ts only assigned handler.mouseup, omitting handler.mouseupWindow.
    // When the mouse was released outside the map canvas (over the header, left drawer, or window edge),
    // mousePan was never notified, leaving _lastPoint orphaned and locking dragPan until page refresh.
    const bindWindowMouseUp = (handler: any) => {
      if (handler && typeof handler.dragEnd === 'function') {
        handler.mouseupWindow = handler.dragEnd;
      }
    };
    bindWindowMouseUp(map.dragPan?._mousePan);
    bindWindowMouseUp(map.dragRotate?._mouseRotate);
    bindWindowMouseUp(map.dragRotate?._mousePitch);
    bindWindowMouseUp((map.dragRotate as any)?._mouseRoll);

    // Failsafe Watchdog: Cleans up any orphaned drag state if mouseup was swallowed outside browser window
    const resetOrphanedDragHandlers = () => {
      const handlers = [
        map.dragPan?._mousePan,
        map.dragPan?._touchPan,
        map.dragRotate?._mouseRotate,
        map.dragRotate?._mousePitch,
      ];
      handlers.forEach((h: any) => {
        if (h && (h._lastPoint || h._active)) {
          try { h.reset(); } catch (_) {}
        }
      });
    };

    // Mac Trackpad Gestures (Twist to rotate, Pinch to zoom, Shift + Scroll to tilt)
    const container = map.getContainer();
    let gestureStartBearing = 0;
    let gestureStartZoom = 0;
    let isGestureActive = false;
    let gestureWatchdogTimeout: any = null;

    const onGestureStart = (e: any) => {
      e.preventDefault();
      gestureStartBearing = map.getBearing();
      gestureStartZoom = map.getZoom();
      isGestureActive = true;
    };

    const onGestureChange = (e: any) => {
      e.preventDefault();
      if (!isGestureActive) return;

      if (gestureWatchdogTimeout) clearTimeout(gestureWatchdogTimeout);
      gestureWatchdogTimeout = setTimeout(() => {
        if (isGestureActive) {
          isGestureActive = false;
          resetOrphanedDragHandlers();
        }
      }, 400);

      // 1. Twist to rotate heading (in degrees)
      if (typeof e.rotation === 'number') {
        const nextBearing = Math.round(gestureStartBearing + e.rotation);
        map.setBearing(nextBearing);
        setMapBearing(nextBearing);
      }

      // 2. Continuous pinch to zoom
      if (typeof e.scale === 'number' && e.scale > 0) {
        const nextZoom = gestureStartZoom + Math.log2(e.scale);
        const clampedZoom = Math.max(1.2, Math.min(20.5, nextZoom));
        map.setZoom(clampedZoom);
      }
    };

    const onGestureEnd = (e: any) => {
      e.preventDefault();
      if (gestureWatchdogTimeout) clearTimeout(gestureWatchdogTimeout);
      isGestureActive = false;
      setMapBearing(Math.round(map.getBearing()));
      resetOrphanedDragHandlers();
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
        const nextZoom = Math.max(1.2, Math.min(20.5, curZoom + zoomDelta));
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

    // 4. Tablet Touch Gestures: Three-finger vertical swipe to elevate/pitch up & down
    let touch3Active = false;
    let touch3LastY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 3) {
        touch3Active = true;
        touch3LastY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
      } else {
        touch3Active = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 3 && touch3Active) {
        const curY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
        const dy = curY - touch3LastY;
        touch3LastY = curY;

        // Swiping up (dy < 0): increase pitch towards 3D oblique perspective (elevate terrain/tilt down)
        // Swiping down (dy > 0): decrease pitch towards top-down 2D map (elevate camera up)
        const pitchDelta = -dy * 0.45;
        const curPitch = map.getPitch();
        const nextPitch = Math.max(0, Math.min(85, curPitch + pitchDelta));
        map.setPitch(nextPitch);
        setMapPitch(Math.round(nextPitch));

        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 3 && touch3Active) {
        touch3Active = false;
        setMapPitch(Math.round(map.getPitch()));
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const canvas = map.getCanvas();
    const canvasContainer = map.getCanvasContainer();

    // 1. Intercept mousedown at capture phase on canvasContainer:
    // If a new click begins (left, middle, right), ensure dragRotate is properly calibrated
    // and any orphaned drag is cleared.
    const onCanvasMouseDown = (e: MouseEvent) => {
      if (map.dragRotate && (map.dragRotate.around !== 'center' || map.dragRotate.movement !== 'linear')) {
        map.dragRotate.enable({ around: 'center', movement: 'linear' });
      }
      resetOrphanedDragHandlers();
    };

    canvasContainer.addEventListener('mousedown', onCanvasMouseDown, { capture: true });

    // 2. Window-level cleanup when mouse button is released outside canvas or window
    const onGlobalPointerUp = (e: PointerEvent | MouseEvent) => {
      const noButtons = e.buttons === 0 || (e.buttons === undefined && (e.button === 0 || e.button === 1 || e.button === 2));
      if (noButtons) {
        setTimeout(() => {
          resetOrphanedDragHandlers();
        }, 16);
      }
    };

    window.addEventListener('mouseup', onGlobalPointerUp, { capture: true });
    window.addEventListener('pointerup', onGlobalPointerUp, { capture: true });

    // 3. Window blur / visibility change: reset stuck drag state on Alt-Tab or switching windows
    const onWindowBlur = () => {
      resetOrphanedDragHandlers();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        resetOrphanedDragHandlers();
      }
    };
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 4. Mouse re-enters window with no buttons pressed: heal orphaned drag
    const onWindowMouseEnter = (e: MouseEvent) => {
      if (e.buttons === 0) {
        resetOrphanedDragHandlers();
      }
    };
    window.addEventListener('mouseenter', onWindowMouseEnter);

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('contextmenu', onContextMenu);
    canvasContainer.addEventListener('contextmenu', onContextMenu);

    map.on('rotate', () => setMapBearing(Math.round(map.getBearing())));
    map.on('pitch', () => {
      setMapPitch(Math.round(map.getPitch()));
      map.setRenderWorldCopies(false);
    });

    const handleMapZoom = () => {
      // Do not fight programmatic flights across continents
      if (isProgrammaticFlightActive) return;
      const z = map.getZoom();
      // Ensure camera does not dip below terrain surface when pitched steeply at high zoom close to ground
      if (z > 16.0) {
        const maxPitchAtZoom = z <= 17.0 ? 75 : (z <= 19.0 ? 65 : 55);
        if (map.getPitch() > maxPitchAtZoom) {
          map.setPitch(maxPitchAtZoom);
          setMapPitch(maxPitchAtZoom);
        }
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
        const c = map.getCenter();
        setMapCenter([c.lng, c.lat]);
        setMapZoom(map.getZoom());
      } catch (_) {}
    };

    const getCamAltitude = (): number | null => {
      try {
        const tr = (map as any)._camera?.transform;
        const alt = tr?.getCameraAltitude?.();
        if (alt !== null && alt !== undefined && isFinite(alt)) return alt;
        return map.getCenterElevation?.() || null;
      } catch (_) {
        return null;
      }
    };

    let lastMoveThrottleTime = 0;
    const handleMapMove = () => {
      const now = performance.now();
      if (now - lastMoveThrottleTime > 50) {
        lastMoveThrottleTime = now;
        updateBounds();
        setMapBearing(Math.round(map.getBearing()));
        setMapPitch(Math.round(map.getPitch()));
        const alt = getCamAltitude();
        if (alt !== null) setCameraAltitudeMeters(alt);
        if (selectedTrailRef.current) {
          try {
            const pt = map.project(selectedTrailRef.current.anchorLngLat);
            setSelectedTrailScreenPos({ x: pt.x, y: pt.y });
          } catch (_) {}
        }
      }
    };

    const handleMapMoveEnd = () => {
      updateBounds();
      updateScale();
      setMapBearing(Math.round(map.getBearing()));
      setMapPitch(Math.round(map.getPitch()));
      const alt = getCamAltitude();
      if (alt !== null) setCameraAltitudeMeters(alt);
      if (selectedTrailRef.current) {
        try {
          const pt = map.project(selectedTrailRef.current.anchorLngLat);
          setSelectedTrailScreenPos({ x: pt.x, y: pt.y });
        } catch (_) {}
      }
      const z = map.getZoom();
      // Ensure camera does not dip below terrain surface when pitched steeply at high zoom close to ground
      if (z > 16.0) {
        const maxPitchAtZoom = z <= 17.0 ? 75 : (z <= 19.0 ? 65 : 55);
        if (map.getPitch() > maxPitchAtZoom) {
          map.setPitch(maxPitchAtZoom);
          setMapPitch(maxPitchAtZoom);
        }
      }
      if (z >= 9.2 && fetchOverpassBboxRef.current) {
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

    map.on('move', handleMapMove);
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
      const initialAlt = getCamAltitude();
      if (initialAlt !== null) setCameraAltitudeMeters(initialAlt);

      // Enable 3D Terrain mesh (calibrated mountain relief)
      try {
        if (show3DTerrain) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration });
        }
      } catch (e) {
        console.warn('SetTerrain error:', e);
      }

      // Calibrate unified Level-of-Detail (LOD) across all active raster sources
      // Applying identical LOD parameters ensures the draped basemap imagery and the 3D elevation mesh
      // decay towards the horizon at the exact same rate, eliminating tile-level mismatches.
      // A balanced horizon decay (6.0 maxZoomLevels, 2.5 maxMinRatio) prevents requesting heavy high-zoom
      // tiles in the far distance while keeping immediate mountain terrain crisp and performant.
      try {
        map.setSourceTileLodParams(6.0, 2.5);
      } catch (e) {
        console.warn('setSourceTileLodParams error:', e);
      }

      // 1. Localhost SQLite Real Vector Ski Trails Source & Layers
      map.addSource('live-pistes-vector', {
        type: 'geojson',
        promoteId: 'id',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Translucent difficulty fill for freeride bowls, glades, and alpine areas
      map.addLayer({
        id: 'live-pistes-polygons-fill',
        type: 'fill',
        source: 'live-pistes-vector',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'match',
            ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
            'novice', '#2E7D32',       // Alpine Green
            'easy', '#2E7D32',         // Alpine Green
            'intermediate', '#1565C0', // Cobalt Blue
            'advanced', '#1C1B18',     // Black Diamond
            'expert', '#B84A39',       // Double Black Vermilion
            'extreme', '#B84A39',      // Double Black Vermilion
            'freeride', '#B84A39',     // Double Black / Freeride Vermilion
            '#8A847C',
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 0.08,
            13, 0.14,
            15, 0.20,
            17, 0.24,
          ],
        },
      });

      // Subtle dashed boundary outline for glades, bowls, and freeride terrain
      map.addLayer({
        id: 'live-pistes-polygons-outline',
        type: 'line',
        source: 'live-pistes-vector',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'match',
            ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
            'novice', '#2E7D32',
            'easy', '#2E7D32',
            'intermediate', '#1565C0',
            'advanced', '#1C1B18',
            'expert', '#B84A39',
            'extreme', '#B84A39',
            'freeride', '#B84A39',
            '#8A847C',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.4, 17, 2.0],
          'line-dasharray': [2, 2],
          'line-opacity': 0.75,
        },
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
            ['coalesce', ['get', 'difficulty'], ['get', 'piste:difficulty'], ''],
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

      // Wide invisible hit-target layer for piste lines — makes trails easy to click/tap
      // without changing any visible widths. Must sit above the visible lines in draw order
      // so it intercepts pointer events, but opacity=0 keeps it fully transparent.
      map.addLayer({
        id: 'live-pistes-hit-target',
        type: 'line',
        source: 'live-pistes-vector',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: {
          'line-color': 'transparent',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 28, 14, 40, 17, 52],
          'line-opacity': 0,
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

      // Wide invisible hit-target layer for lifts / aerialways — makes chairlifts and gondolas easy to tap
      map.addLayer({
        id: 'live-pistes-lifts-hit-target',
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
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: {
          'line-color': 'transparent',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 28, 14, 40, 17, 52],
          'line-opacity': 0,
        },
      });

      // Centroid Labels for Glades, Bowls, and Freeride Areas
      map.addLayer({
        id: 'live-pistes-polygons-labels',
        type: 'symbol',
        source: 'live-pistes-vector',
        minzoom: 12.0,
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        layout: {
          'visibility': 'none',
          'symbol-placement': 'point',
          'text-padding': 12,
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
            ['get', 'name'],
          ],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12.0, 9.5, 14, 11, 16, 12.5],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-letter-spacing': 0.05,
          'text-keep-upright': true,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport',
          'text-optional': true,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2.2,
        },
      });

      // Upright 3D Trail & Lift Names (Off by default for speed; suppresses Unnamed/Unknown labels)
      map.addLayer({
        id: 'live-pistes-labels',
        type: 'symbol',
        source: 'live-pistes-vector',
        minzoom: 12.5,
        filter: [
          'all',
          ['!=', ['get', 'kind'], 'lift'],
          ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        ],
        layout: {
          'visibility': 'none',
          'symbol-placement': 'line',
          'symbol-spacing': 600,
          'text-padding': 12,
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
          'text-max-angle': 38,
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
          'symbol-placement': 'line',
          'symbol-spacing': 700,
          'text-padding': 14,
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

      // Clicked Trail / Slope Selected Highlight Source & Layers
      map.addSource('selected-trail-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'selected-trail-casing',
        type: 'line',
        source: 'selected-trail-source',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        paint: {
          'line-color': '#FAF8F3',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4.0, 14, 6.0, 17, 8.0],
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'selected-trail-line',
        type: 'line',
        source: 'selected-trail-source',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        paint: {
          'line-color': '#D97706',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 14, 3.6, 17, 5.0],
          'line-opacity': 1.0,
        },
      });

      map.addLayer({
        id: 'selected-trail-polygon-fill',
        type: 'fill',
        source: 'selected-trail-source',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'fill-color': '#D97706',
          'fill-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'selected-trail-polygon-outline',
        type: 'line',
        source: 'selected-trail-source',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'line-color': '#D97706',
          'line-width': 2.8,
          'line-dasharray': [2, 1.5],
        },
      });

      // Geographic Reference: Rotation-Invariant Viewport Billboarding (Always upright during 3D orbits)
      map.addSource('geo-reference-source', {
        type: 'geojson',
        data: GEOGRAPHIC_REFERENCE_GEOJSON as any,
      });

      map.addLayer({
        id: 'geo-reference-countries',
        type: 'symbol',
        source: 'geo-reference-source',
        filter: ['==', ['get', 'kind'], 'country'],
        minzoom: 1.2,
        maxzoom: 5.5,
        layout: {
          visibility: showCountryOutlines ? 'visible' : 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            1.5, 12,
            3.5, 14.5,
            5.0, 17,
          ],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.22,
          'text-rotation-alignment': 'viewport',
          'text-pitch-alignment': 'viewport',
          'text-keep-upright': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': basemapMode === 'satellite' ? '#FAF8F3' : '#1C1B18',
          'text-halo-color': basemapMode === 'satellite' ? '#1C1B18' : '#FAF8F3',
          'text-halo-width': 2.2,
          'text-halo-blur': 0.5,
        },
      });

      map.addLayer({
        id: 'geo-reference-cities',
        type: 'symbol',
        source: 'geo-reference-source',
        filter: ['!=', ['get', 'kind'], 'country'],
        minzoom: 3.8,
        maxzoom: 13.5,
        layout: {
          visibility: showCountryOutlines ? 'visible' : 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, 12,
            7, 14,
            10, 16.5,
          ],
          'text-offset': [0, 0.4],
          'text-anchor': 'top',
          'text-rotation-alignment': 'viewport',
          'text-pitch-alignment': 'viewport',
          'text-keep-upright': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': basemapMode === 'satellite' ? '#FAF8F3' : '#1C1B18',
          'text-halo-color': basemapMode === 'satellite' ? '#1C1B18' : '#FAF8F3',
          'text-halo-width': 2.0,
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

      // Curated Outer Ring (fades out at z12 when trail lines take over)
      map.addLayer({
        id: 'resorts-outer-ring',
        type: 'circle',
        source: 'resorts-source',
        maxzoom: 12,
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

      // Curated Inner Ring (fades out at z12 when trail lines take over)
      map.addLayer({
        id: 'resorts-inner-dot',
        type: 'circle',
        source: 'resorts-source',
        maxzoom: 12,
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

      // Curated Single Label (minzoom 5.5, maxzoom 12 — yields to trail detail above z12)
      map.addLayer({
        id: 'resorts-labels',
        type: 'symbol',
        source: 'resorts-source',
        minzoom: 5.5,
        maxzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            6, 12,
            9, 13.5,
            12, 15,
            15, 17
          ],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-letter-spacing': 0.02,
          'text-max-width': 18,
          'symbol-sort-key': 1,
          'text-optional': false,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2.8,
          'text-halo-blur': 0.5,
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

      // Global Ski Areas Outer Concentric Ring (fades at z12 when trails take over)
      map.addLayer({
        id: 'global-unclustered-outer-ring',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 6.0,
        maxzoom: 12,
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

      // Global Ski Areas Core Point (fades at z12 when trails take over)
      map.addLayer({
        id: 'global-unclustered-point',
        type: 'circle',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        maxzoom: 12,
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

      // Global Ski Areas Name Label (minzoom 6.5, maxzoom 12 — yields to trail detail above z12)
      map.addLayer({
        id: 'global-unclustered-label',
        type: 'symbol',
        source: 'global-ski-areas-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 6.5,
        maxzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            6.5, 11,
            9, 12.5,
            12, 14,
            15, 15.5
          ],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'symbol-sort-key': 2,
          'text-max-width': 16,
          'text-optional': true,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2.4,
          'text-halo-blur': 0.5,
        },
      });

      // 4. Global Major Mountain Summits (Peakfinder Horizon Mode)
      map.addSource('major-peaks-source', {
        type: 'geojson',
        promoteId: 'id',
        data: getStaticDataUrl('data/major_peaks.geojson'),
      });

      map.addLayer({
        id: 'major-peaks-marker',
        type: 'circle',
        source: 'major-peaks-source',
        minzoom: 10.0,
        layout: {
          visibility: showPeaks ? 'visible' : 'none',
        },
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10.0, 2.0,
            12.0, 3.0,
            14.0, 4.0,
          ],
          'circle-color': '#B84A39',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      map.addLayer({
        id: 'major-peaks-label',
        type: 'symbol',
        source: 'major-peaks-source',
        minzoom: 10.0,
        layout: {
          'visibility': showPeaks ? 'visible' : 'none',
          'symbol-sort-key': ['coalesce', ['get', 'sort_key'], 1000],
          'text-field': ['get', unitsMetric ? 'label_m' : 'label_ft'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            10.0, 9.0,
            12.0, 10.5,
            14.0, 12.0,
          ],
          'text-max-width': 26,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-letter-spacing': 0.03,
          'text-keep-upright': true,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport',
          'text-padding': 12,
          'text-optional': true,
        },
        paint: {
          'text-color': '#1C1B18',
          'text-halo-color': '#FAF8F3',
          'text-halo-width': 2.2,
          'text-halo-blur': 0.5,
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

      // Click on empty map canvas deselects active resort or inspects clicked trail / lift
      map.on('click', (e) => {
        const resortLayers = [
          'resorts-outer-ring',
          'resorts-inner-dot',
          'resorts-labels',
          'global-unclustered-outer-ring',
          'global-unclustered-point',
          'global-unclustered-label',
          'global-clusters',
        ].filter((id) => map.getLayer(id));
        const resortFeats = map.queryRenderedFeatures(e.point, { layers: resortLayers });
        if (resortFeats && resortFeats.length > 0) {
          // Marker or cluster clicked; close any open trail profile card
          handleDeselectTrailRef.current();
          return;
        }

        const trailLayers = [
          'live-pistes-hit-target',
          'live-pistes-lifts-hit-target',
          'live-pistes-lines',
          'live-pistes-casing',
          'live-pistes-lifts',
          'live-pistes-labels',
          'live-pistes-lifts-labels',
          'live-pistes-polygons-fill',
          'live-pistes-polygons-outline',
          'live-pistes-polygons-labels',
        ].filter((id) => map.getLayer(id));

        if (trailLayers.length > 0) {
          // Generous touch & click target buffer (40px on touch/mobile/iPad, 28px on desktop)
          // Eliminates the need for pixel-level precision when inspecting ski runs and chairlifts
          const isTouch =
            typeof window !== 'undefined' &&
            (window.innerWidth < 768 || 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
          const hitRadius = isTouch ? 40 : 28;
          const clickBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - hitRadius, e.point.y - hitRadius],
            [e.point.x + hitRadius, e.point.y + hitRadius],
          ];
          const trailFeats = map.queryRenderedFeatures(clickBbox, { layers: trailLayers });

          if (trailFeats && trailFeats.length > 0) {
            // Helper to compute exact screen pixel distance from click/tap point to candidate feature
            const getDistanceToFeaturePx = (feat: any, clickPt: { x: number; y: number }): number => {
              const geom = feat.geometry;
              if (!geom) return Infinity;

              const distToSegmentSq = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
                const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
                const projX = a.x + t * dx;
                const projY = a.y + t * dy;
                return (p.x - projX) ** 2 + (p.y - projY) ** 2;
              };

              let minSq = Infinity;

              const testLine = (coords: any[]) => {
                if (!coords || coords.length < 2) return;
                let prev = map.project([coords[0][0], coords[0][1]]);
                for (let i = 1; i < coords.length; i++) {
                  const cur = map.project([coords[i][0], coords[i][1]]);
                  const dSq = distToSegmentSq(clickPt, prev, cur);
                  if (dSq < minSq) minSq = dSq;
                  prev = cur;
                }
              };

              if (geom.type === 'LineString') {
                testLine(geom.coordinates);
              } else if (geom.type === 'MultiLineString') {
                for (const line of geom.coordinates || []) {
                  testLine(line);
                }
              } else if (geom.type === 'Polygon') {
                for (const ring of geom.coordinates || []) {
                  testLine(ring);
                }
              } else if (geom.type === 'MultiPolygon') {
                for (const poly of geom.coordinates || []) {
                  for (const ring of poly || []) {
                    testLine(ring);
                  }
                }
              }

              return Math.sqrt(minSq);
            };

            // Rank candidate features by proximity to the tap/click point
            let bestLineFeat: any = null;
            let bestLineDist = Infinity;
            let bestPolyFeat: any = null;
            let bestPolyDist = Infinity;

            for (const f of trailFeats) {
              const geom = f.geometry;
              if (!geom) continue;
              const isLine = geom.type === 'LineString' || geom.type === 'MultiLineString';
              const dist = getDistanceToFeaturePx(f, e.point);

              if (isLine) {
                if (dist < bestLineDist) {
                  bestLineDist = dist;
                  bestLineFeat = f;
                }
              } else {
                if (dist < bestPolyDist) {
                  bestPolyDist = dist;
                  bestPolyFeat = f;
                }
              }
            }

            // Prioritize linear downhill pistes or lifts if within search radius;
            // fall back to enclosing freeride bowl / polygon if clicked directly in an open bowl
            const selectedFeat = (bestLineFeat && bestLineDist <= hitRadius + 8)
              ? bestLineFeat
              : (bestLineFeat || bestPolyFeat || trailFeats[0]);

            if (selectedFeat) {
              handleSelectTrailRef.current(selectedFeat, [e.lngLat.lng, e.lngLat.lat], e.point);
              return;
            }
          }
        }

        // Empty canvas click
        handleDeselectResortRef.current();
        handleDeselectTrailRef.current();
      });

      // Pointer cursor
      [
        'resorts-outer-ring',
        'resorts-inner-dot',
        'resorts-labels',
        'global-clusters',
        'global-unclustered-outer-ring',
        'global-unclustered-point',
        'global-unclustered-label',
        'live-pistes-hit-target',
        'live-pistes-lifts-hit-target',
        'live-pistes-lines',
        'live-pistes-lifts',
        'live-pistes-labels',
        'live-pistes-lifts-labels',
        'live-pistes-polygons-labels',
      ].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          });
        }
      });

      setMapLoaded(true);
    });

    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvasContainer.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('gesturestart', onGestureStart as any);
      container.removeEventListener('gesturechange', onGestureChange as any);
      container.removeEventListener('gestureend', onGestureEnd as any);
      container.removeEventListener('wheel', onWheel as any, { capture: true } as any);
      container.removeEventListener('touchstart', onTouchStart as any);
      container.removeEventListener('touchmove', onTouchMove as any);
      container.removeEventListener('touchend', onTouchEnd as any);
      container.removeEventListener('touchcancel', onTouchEnd as any);
      canvasContainer.removeEventListener('mousedown', onCanvasMouseDown as any, { capture: true } as any);
      window.removeEventListener('mouseup', onGlobalPointerUp, { capture: true } as any);
      window.removeEventListener('pointerup', onGlobalPointerUp, { capture: true } as any);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('mouseenter', onWindowMouseEnter);
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

    // Exclude cat/heli-only trails unless the Cat/Heli toggle is on
    // is_heli_cat=true is stamped server-side on trails that sit exclusively inside a
    // cat/heli tenure with no adjacent lift-served resort boundary.
    const heliCatExclusion: any = showHeliCat
      ? null // allow everything when toggle is on
      : ['!=', ['coalesce', ['get', 'is_heli_cat'], false], true];

    if (showDownhill) {
      // Strictly match downhill alpine pistes and connector trails; exclude nordic and municipal paths.
      // When showHeliCat is off, also exclude trails tagged is_heli_cat=true.
      const dlCond: any[] = [
        'any',
        ['==', ['get', 'piste:type'], 'downhill'],
        ['==', ['get', 'piste:type'], 'connection'],
        ['all', ['!', ['has', 'piste:type']], ['!=', ['get', 'piste:type'], 'nordic']],
      ];
      if (heliCatExclusion) {
        allowedConditions.push(['all', dlCond, heliCatExclusion]);
      } else {
        allowedConditions.push(dlCond);
      }
    }

    if (showNordic) {
      // Match dedicated cross-country nordic trails
      allowedConditions.push(['==', ['get', 'piste:type'], 'nordic']);
    }

    if (showHeliCat && !showDownhill) {
      allowedConditions.push([
        'any',
        ['==', ['get', 'piste:type'], 'downhill'],
        ['==', ['get', 'piste:type'], 'connection'],
      ]);
    }
    // Note: if showHeliCat && showDownhill, the downhill condition above already runs
    // without the heliCatExclusion (since heliCatExclusion is null when showHeliCat=true),
    // so is_heli_cat trails are already included.

    // Explicitly exclude non-ski municipal features (roads, rec paths, walking loops, playgrounds, sledding) and backcountry skitours
    const nonSkiExclusion = [
      '!',
      [
        'in',
        ['coalesce', ['get', 'piste:type'], ''],
        ['literal', ['fatbike', 'hike', 'sled', 'sleigh', 'ice_skate', 'playground', 'other', 'skitour', 'backcountry']],
      ],
    ];

    // Separate line vectors from freeride polygon area vectors
    const isLineGeom = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']];
    const isPolyGeom = ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']];

    let pisteFilter: any;
    if (allowedConditions.length === 0) {
      pisteFilter = ['==', '1', '0']; // match nothing
    } else if (allowedConditions.length === 1) {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, nonSkiExclusion, allowedConditions[0]];
    } else {
      pisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isLineGeom, nonSkiExclusion, ['any', ...allowedConditions]];
    }

    let polyPisteFilter: any;
    if (allowedConditions.length === 0) {
      polyPisteFilter = ['==', '1', '0']; // match nothing
    } else if (allowedConditions.length === 1) {
      polyPisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isPolyGeom, nonSkiExclusion, allowedConditions[0]];
    } else {
      polyPisteFilter = ['all', ['!=', ['get', 'kind'], 'lift'], isPolyGeom, nonSkiExclusion, ['any', ...allowedConditions]];
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

    const polyLabelFilter: any = [
      'all',
      polyPisteFilter,
      ['has', 'name'],
      ['!=', ['coalesce', ['get', 'name'], ''], ''],
      ['!', ['in', 'unnamed', ['downcase', ['coalesce', ['get', 'name'], '']]]],
      ['!', ['in', 'unknown', ['downcase', ['coalesce', ['get', 'name'], '']]]],
    ];

    ['live-pistes-casing', 'live-pistes-lines', 'live-pistes-hit-target'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
        if (anyTrails) map.setFilter(id, pisteFilter);
      }
    });

    ['live-pistes-polygons-fill', 'live-pistes-polygons-outline'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', anyTrails ? 'visible' : 'none');
        if (anyTrails) map.setFilter(id, polyPisteFilter);
      }
    });

    if (map.getLayer('live-pistes-labels')) {
      map.setLayoutProperty('live-pistes-labels', 'visibility', anyTrails ? 'visible' : 'none');
      if (anyTrails) map.setFilter('live-pistes-labels', labelFilter);
    }

    if (map.getLayer('live-pistes-polygons-labels')) {
      map.setLayoutProperty('live-pistes-polygons-labels', 'visibility', anyTrails ? 'visible' : 'none');
      if (anyTrails) map.setFilter('live-pistes-polygons-labels', polyLabelFilter);
    }

    // Aerialway Lifts & Cable-Aligned Labels are tied directly to Downhill ski infrastructure.
    // Also apply is_heli_cat exclusion to lifts so cat-ski area lifts hide correctly.
    const liftVisible = showDownhill || showHeliCat;
    const liftFilter: any = heliCatExclusion
      ? ['all', ['==', ['get', 'kind'], 'lift'], heliCatExclusion]
      : null;
    ['live-pistes-lifts', 'live-pistes-lifts-hit-target'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', liftVisible ? 'visible' : 'none');
        if (liftVisible && liftFilter) map.setFilter(id, liftFilter);
      }
    });
    if (map.getLayer('live-pistes-lifts-labels')) {
      map.setLayoutProperty('live-pistes-lifts-labels', 'visibility', liftVisible ? 'visible' : 'none');
      if (liftVisible && liftFilter) map.setFilter('live-pistes-lifts-labels', liftFilter);
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
      map.setLayoutProperty(
        'hillshade-relief',
        'visibility',
        basemapMode === 'osm' && showHillshade ? 'visible' : 'none'
      );
    }
    // Alpine Topo
    if (map.getLayer('basemap-topo')) {
      map.setLayoutProperty('basemap-topo', 'visibility', basemapMode === 'topo' ? 'visible' : 'none');
    }
    if (map.getLayer('alpine-painted-hillshade')) {
      map.setLayoutProperty(
        'alpine-painted-hillshade',
        'visibility',
        basemapMode === 'topo' && showHillshade ? 'visible' : 'none'
      );
    }
  }, [basemapMode, showHillshade, mapLoaded]);

  /* =========================================================================
     TERRAIN ANALYSIS OVERLAYS (DYNAMIC SLOPE ANGLE & ASPECT LAYERS)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Slope Angle (CalTopo avalanche gradient 0° - 90°)
    if (map.getLayer('overlay-slope')) {
      map.setLayoutProperty('overlay-slope', 'visibility', terrainOverlay === 'slope' ? 'visible' : 'none');
      map.setPaintProperty('overlay-slope', 'raster-opacity', terrainOverlayOpacity);
    }
    // Compass Aspect (Solar radiation / fall-line)
    if (map.getLayer('overlay-aspect')) {
      map.setLayoutProperty('overlay-aspect', 'visibility', terrainOverlay === 'aspect' ? 'visible' : 'none');
      map.setPaintProperty('overlay-aspect', 'raster-opacity', terrainOverlayOpacity);
    }
  }, [terrainOverlay, terrainOverlayOpacity, mapLoaded]);

  /* =========================================================================
     MAJOR MOUNTAIN SUMMITS (PEAKFINDER HORIZON MODE)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const visibility = showPeaks ? 'visible' : 'none';
    if (map.getLayer('major-peaks-marker')) {
      map.setLayoutProperty('major-peaks-marker', 'visibility', visibility);
    }
    if (map.getLayer('major-peaks-label')) {
      map.setLayoutProperty('major-peaks-label', 'visibility', visibility);
      map.setLayoutProperty('major-peaks-label', 'text-field', ['get', unitsMetric ? 'label_m' : 'label_ft']);
    }
  }, [showPeaks, unitsMetric, mapLoaded]);

  /* =========================================================================
     GEOGRAPHIC REFERENCE: BORDERS & PLACES (AUTO-CONTRAST BY BASEMAP)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const isDark = basemapMode === 'satellite';
    const refVisibility = showCountryOutlines ? 'visible' : 'none';

    if (map.getLayer('basemap-boundaries-dark')) {
      map.setLayoutProperty('basemap-boundaries-dark', 'visibility', showCountryOutlines && isDark ? 'visible' : 'none');
    }
    if (map.getLayer('basemap-boundaries-light')) {
      map.setLayoutProperty('basemap-boundaries-light', 'visibility', showCountryOutlines && !isDark ? 'visible' : 'none');
    }
    if (map.getLayer('geo-reference-countries')) {
      map.setLayoutProperty('geo-reference-countries', 'visibility', refVisibility);
      map.setPaintProperty('geo-reference-countries', 'text-color', isDark ? '#FAF8F3' : '#1C1B18');
      map.setPaintProperty('geo-reference-countries', 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
    }
    if (map.getLayer('geo-reference-cities')) {
      map.setLayoutProperty('geo-reference-cities', 'visibility', refVisibility);
      map.setPaintProperty('geo-reference-cities', 'text-color', isDark ? '#FAF8F3' : '#1C1B18');
      map.setPaintProperty('geo-reference-cities', 'text-halo-color', isDark ? '#1C1B18' : '#FAF8F3');
    }
  }, [showCountryOutlines, basemapMode, mapLoaded]);

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
      'KeyQ',
      'KeyE',
      'PageUp',
      'PageDown',
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

    let flightElevation: number | null = null;

    const stopFlight = (_immediate = false) => {
      activeKeys.clear();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      flightElevation = null;
      lastTimestamp = null;
    };

    const flightStep = (timestamp: number) => {
      if (!mapRef.current) {
        stopFlight(true);
        return;
      }

      if (isProgrammaticFlightActive) {
        stopFlight(true);
        return;
      }

      const map = mapRef.current;

      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
      lastTimestamp = timestamp;

      const hasNavKey = Array.from(activeKeys).some((k) => NAVIGATION_KEYS.has(k));
      if (!hasNavKey) {
        stopFlight(false);
        return;
      }

      // Initialize flightElevation once and ensure ground clamping doesn't bounce the camera
      if (flightElevation === null) {
        try { (map as any).setCenterClampedToGround?.(false); } catch (_) {}
        const curElev = map.getCenterElevation();
        const ground = map.queryTerrainElevation(map.getCenter());
        flightElevation = (curElev !== null && curElev !== undefined && isFinite(curElev))
          ? curElev
          : ((ground !== null && ground !== undefined && isFinite(ground)) ? ground : 0);
      }

      const isShift = activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight');

      let pitchDelta = 0;
      let rotateBearing = 0;
      let zoomDelta = 0;
      let moveForward = 0;
      let moveStrafe = 0;
      let altitudeDelta = 0;

      // WASD: Direct Camera Orientation Controls (No Shift required!)
      // W/S: Tilt pitch (up towards 3D horizon / down towards 2D nadir)
      if (activeKeys.has('KeyW')) pitchDelta += 1;
      if (activeKeys.has('KeyS')) pitchDelta -= 1;

      // A/D: Rotate bearing (spin camera heading left / right)
      // KeyA turns LEFT (counter-clockwise / decreases bearing)
      // KeyD turns RIGHT (clockwise / increases bearing)
      if (activeKeys.has('KeyA')) rotateBearing -= 1;
      if (activeKeys.has('KeyD')) rotateBearing += 1;

      // Q/E or PageDown/PageUp: Manual Altitude Adjustment (Descend / Ascend)
      if (activeKeys.has('KeyE') || activeKeys.has('PageUp')) altitudeDelta += 1;
      if (activeKeys.has('KeyQ') || activeKeys.has('PageDown')) altitudeDelta -= 1;

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
        const nextZoom = Math.max(1.0, Math.min(20.5, curZoom + zoomDelta * zoomSpeed * dt));
        map.setZoom(nextZoom);
      }

      const curZoom = map.getZoom();
      const speedMps = 720 * Math.pow(2, 14 - curZoom) * (isShift ? 2.5 : 1.0);

      // Manual altitude control (Q/E or PageUp/PageDown)
      if (altitudeDelta !== 0) {
        const altSpeed = Math.max(250, speedMps * 0.75) * (isShift ? 2.0 : 1.0);
        let deltaAlt = altitudeDelta * altSpeed * dt;

        // Ground clearance protection for the camera eye:
        if (deltaAlt < 0) {
          const tr = (map as any)._camera?.transform;
          const camLngLat = tr?.getCameraLngLat?.() || map.getCenter();
          const camAlt = tr?.getCameraAltitude?.();
          const groundUnderCam = map.queryTerrainElevation(camLngLat);
          const MIN_CLEARANCE = 15.0; // meters

          if (camAlt !== null && camAlt !== undefined && isFinite(camAlt) &&
              groundUnderCam !== null && groundUnderCam !== undefined && isFinite(groundUnderCam)) {
            const maxDescent = camAlt - (groundUnderCam + MIN_CLEARANCE);
            if (maxDescent <= 0) {
              deltaAlt = 0;
            } else if (-deltaAlt > maxDescent) {
              deltaAlt = -maxDescent;
            }
          }
        }

        flightElevation += deltaAlt;
      }

      // Smooth horizontal flight with level, steady-altitude cruising
      if (moveForward !== 0 || moveStrafe !== 0) {
        const len = Math.hypot(moveForward, moveStrafe);
        moveForward /= len;
        moveStrafe /= len;

        const curCenter = map.getCenter();
        const curBearing = map.getBearing();
        const bearingRad = (curBearing * Math.PI) / 180;
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

        // Ground clearance protection: lift smoothly only if terrain rises above current altitude
        const tr = (map as any)._camera?.transform;
        const camLngLat = tr?.getCameraLngLat?.() || curCenter;
        const camAlt = tr?.getCameraAltitude?.();
        const nextCamLat = Math.max(-85, Math.min(85, camLngLat.lat + deltaLat));
        const nextCamLng = camLngLat.lng + deltaLng;
        const groundUnderCam = map.queryTerrainElevation([nextCamLng, nextCamLat]);

        let didClimb = false;
        if (groundUnderCam !== null && groundUnderCam !== undefined && isFinite(groundUnderCam) &&
            camAlt !== null && camAlt !== undefined && isFinite(camAlt)) {
          const MIN_CLEARANCE = 15.0; // meters minimum ground clearance buffer
          const minAllowedElevation = groundUnderCam + MIN_CLEARANCE;

          if (minAllowedElevation > camAlt) {
            const climbDiff = minAllowedElevation - camAlt;
            const climbFactor = 1 - Math.exp(-dt * 6.0);
            const maxClimbSpeed = Math.max(speedMps * 1.5, 450); // m/s
            const climbDelta = Math.min(climbDiff, Math.max(climbDiff * climbFactor, maxClimbSpeed * dt));
            if (flightElevation !== null) {
              flightElevation += climbDelta;
              didClimb = true;
            }
          }
        }

        // When cruising horizontally without altitude modifications, omit elevation so MapLibre
        // doesn't force terrain raycast recalculations or vertical camera jumps.
        if (didClimb || altitudeDelta !== 0) {
          map.jumpTo({
            center: [nextLng, nextLat],
            elevation: flightElevation ?? undefined,
          });
        } else {
          map.jumpTo({
            center: [nextLng, nextLat],
          });
        }
      } else if (altitudeDelta !== 0) {
        map.jumpTo({
          elevation: flightElevation ?? undefined,
        });
      }

      // Live update camera altitude metric during flight
      try {
        const alt = (map as any)._camera?.transform?.getCameraAltitude?.() ?? map.getCenterElevation?.();
        if (alt !== null && alt !== undefined && isFinite(alt)) {
          setCameraAltitudeMeters(alt);
        }
      } catch (_) {}

      animationFrameId = requestAnimationFrame(flightStep);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Only true navigation keys trigger flight (Shift is purely a speed multiplier)
      if (NAVIGATION_KEYS.has(e.code)) {
        e.preventDefault();
        activeKeys.add(e.code);
        if (e.shiftKey) activeKeys.add('ShiftLeft');
        setIsProgrammaticFlightActive(false);

        if (animationFrameId === null) {
          lastTimestamp = performance.now();
          animationFrameId = requestAnimationFrame(flightStep);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        activeKeys.delete('ShiftLeft');
        activeKeys.delete('ShiftRight');
      }
      const hasNavKey = Array.from(activeKeys).some((k) => NAVIGATION_KEYS.has(k));
      if (!hasNavKey && animationFrameId !== null) {
        stopFlight(false);
      }
    };

    const stopFlightOnBlur = () => stopFlight(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopFlightOnBlur);
    window.addEventListener('focus', stopFlightOnBlur);
    document.addEventListener('visibilitychange', stopFlightOnBlur);

    // Yield flight engine immediately when user uses mouse to pan or rotate
    const canvasContainer = map.getCanvasContainer();
    const onCanvasMouseInteraction = () => {
      if (animationFrameId !== null || activeKeys.size > 0) {
        stopFlight(true);
      }
      flightElevation = null;
      try {
        (mapRef.current as any)?.setCenterClampedToGround?.(false);
      } catch (_) {}
    };
    canvasContainer.addEventListener('mousedown', onCanvasMouseInteraction, { capture: true });
    canvasContainer.addEventListener('pointerdown', onCanvasMouseInteraction, { capture: true });
    canvasContainer.addEventListener('wheel', onCanvasMouseInteraction, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopFlightOnBlur);
      window.removeEventListener('focus', stopFlightOnBlur);
      document.removeEventListener('visibilitychange', stopFlightOnBlur);
      canvasContainer.removeEventListener('mousedown', onCanvasMouseInteraction, { capture: true } as any);
      canvasContainer.removeEventListener('pointerdown', onCanvasMouseInteraction, { capture: true } as any);
      canvasContainer.removeEventListener('wheel', onCanvasMouseInteraction, { capture: true } as any);
      stopFlight(true);
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
          const localRes = await fetch(getStaticDataUrl('data/global_ski_areas.json'));
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

          // Quality filter: Exclude permanently closed, defunct, abandoned, or placeholder ski areas
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
            pNameLower.includes('(defunct)') ||
            pNameLower.includes('(fermé)') ||
            pNameLower === 'a venir' ||
            pNameLower === 'à venir' ||
            pNameLower === 'unknown' ||
            pNameLower.startsWith('former ') ||
            pNameLower.startsWith('touring -') ||
            pNameLower.startsWith('hors-piste -')
          ) {
            continue;
          }

          // Quality filter: Exclude zero-infrastructure downhill ghost entries and lone backcountry trail traces
          const lifts = p.lift_count || 0;
          const runs = p.run_count || 0;
          const vert = p.vertical_ft || 0;
          const acres = p.skiable_acres || 0;
          const hasSite = !!p.website && typeof p.website === 'string' && p.website.trim().length > 0;
          if (p.category === 'downhill') {
            if (lifts === 0 && runs <= 1 && !hasSite) {
              continue;
            }
            if (lifts === 0 && runs === 0 && vert <= 50 && acres <= 5 && !hasSite) {
              continue;
            }
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

          const rawPassNets = (p.pass_networks && p.pass_networks.length > 0 ? p.pass_networks : ['Independent']) as PassNetwork[];
          const passNets = rawPassNets.length > 1 && rawPassNets.includes('Independent')
            ? rawPassNets.filter((net) => net !== 'Independent')
            : rawPassNets;
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

        setResorts((prev) => {
          const weatherMap = new Map<string, ResortWeatherData>();
          prev.forEach((r) => {
            if (r.weather) weatherMap.set(r.id, r.weather);
          });

          return [
            ...GLOBAL_SKI_ATLAS.map((r) => ({
              ...r,
              weather: weatherMap.get(r.id) || getInitialWeather(r),
            })),
            ...HELI_CAT_OPERATIONS.map((r) => ({
              ...r,
              weather: weatherMap.get(r.id) || getInitialWeather(r),
            })),
            ...globalResortItems.map((r) => ({
              ...r,
              weather: weatherMap.get(r.id) || getNeutralWeather(r),
            })),
          ];
        });

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
    handleDeselectTrail();
    setSelectedResortId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('half');
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
    fetchResortStaticTrails(resort.id);
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
    handleDeselectTrail();
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

    if (p.id) {
      fetchResortStaticTrails(p.id);
    }
    if (fetchOverpassBboxRef.current) {
      fetchOverpassBboxRef.current(
        coords[1] - 0.05,
        coords[0] - 0.06,
        coords[1] + 0.05,
        coords[0] + 0.06
      );
    }
  };

  const handleResetToGlobalExtent = useCallback(() => {
    handleDeselectTrail();
    setSelectedResortId(null);
    setPanelView('directory');
    setSearchQuery('');
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('peek');
    }
    try {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (_) {}
    if (mapRef.current) {
      safeFlyTo(mapRef.current, {
        center: [12, 28],
        zoom: 1.8,
        pitch: 0,
        bearing: 0,
        duration: 1400,
        essential: true,
      });
      setMapPitch(0);
      setMapBearing(0);
    }
  }, [handleDeselectTrail]);

  const handleDeselectResort = () => {
    handleDeselectTrail();
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
  handleDeselectResortRef.current = handleDeselectResort;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTrailRef.current) {
          handleDeselectTrail();
        } else if (selectedResortId) {
          handleDeselectResort();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResortId, handleDeselectTrail]);

  // On page load/refresh, ensure all existing selections are cleared and URL is clean
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (_) {}
  }, []);

  const handleSortClick = (type: 'vert' | 'acres' | 'name' | 'snow') => {
    if (sortBy === type) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(type);
      setSortOrder(type === 'name' ? 'asc' : 'desc');
    }
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

  /* =========================================================================
     RENDER: EDWARD TUFTE × BERANN DAYLIGHT CARTOGRAPHY
     ========================================================================= */

  return (
    <div
      className={`relative w-screen h-screen ${
        isFullscreen ? 'fixed inset-0 z-50 h-[100dvh] w-[100dvw]' : ''
      } overflow-hidden bg-[#F7F4ED] text-[#1C1B18] font-sans select-none`}
    >
      {/* 3D MAP CANVAS (ALWAYS 100% INSET-0, NEVER BLANK ON START) */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full z-0 bg-[#E8EFF2]"
      />

      {/* EDITORIAL TOP BAR */}
      <TopNavBar
        onResetToGlobal={handleResetToGlobalExtent}
        filtersMenuOpen={filtersMenuOpen}
        onToggleFilters={() => setFiltersMenuOpen((prev) => !prev)}
        onCloseFilters={() => setFiltersMenuOpen(false)}
        activeFiltersCount={activeFiltersCount}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      >
        <FilterModal
          isOpen={filtersMenuOpen}
          onClose={() => setFiltersMenuOpen(false)}
          activeFiltersCount={activeFiltersCount}
          onResetFilters={handleResetFilters}
          earthProjection={earthProjection}
          onSelectProjection={(mode) => {
            setEarthProjection(mode);
            if (mode === 'globe' && mapRef.current && mapRef.current.getZoom() < 5) {
              safeEaseTo(mapRef.current, { pitch: 0, duration: 400 });
              setMapPitch(0);
            }
          }}
          unitsMetric={unitsMetric}
          onSetUnitsMetric={handleSetUnitsMetric}
          filteredCount={filteredResorts.length}
          showDownhill={showDownhill}
          onToggleDownhill={() => setShowDownhill(!showDownhill)}
          showNordic={showNordic}
          onToggleNordic={() => setShowNordic(!showNordic)}
          showHeliCat={showHeliCat}
          onToggleHeliCat={() => setShowHeliCat(!showHeliCat)}
          categoryFilterCounts={categoryFilterCounts}
          selectedPasses={selectedPasses}
          onTogglePass={(pass) => {
            setSelectedPasses((prev) =>
              prev.includes(pass) ? prev.filter((p) => p !== pass) : [...prev, pass]
            );
          }}
          onSetAllPasses={() =>
            setSelectedPasses(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'])
          }
          onClearPasses={() => setSelectedPasses([])}
          minVerticalM={minVerticalM}
          onChangeMinVerticalM={setMinVerticalM}
          minVerticalFt={minVerticalFt}
          onChangeMinVerticalFt={setMinVerticalFt}
          minAreaHa={minAreaHa}
          onChangeMinAreaHa={setMinAreaHa}
          minAreaAcres={minAreaAcres}
          onChangeMinAreaAcres={setMinAreaAcres}
          minNordicKm={minNordicKm}
          onChangeMinNordicKm={setMinNordicKm}
          minNordicMi={minNordicMi}
          onChangeMinNordicMi={setMinNordicMi}
        />
      </TopNavBar>

      {/* DESKTOP DIRECTORY DOCK */}
      <LeftDock isOpen={leftDockOpen} onToggle={() => setLeftDockOpen(!leftDockOpen)}>
        {panelView === 'profile' && selectedResort ? (
          <MountainProfile
            resort={selectedResort}
            unitsMetric={unitsMetric}
            mobileSheetState={mobileSheetState}
            onSetMobileSheetState={setMobileSheetState}
            onDeselect={handleDeselectResort}
          />
        ) : (
          <DirectoryList
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortClick={handleSortClick}
            showNordic={showNordic}
            showDownhill={showDownhill}
            showHeliCat={showHeliCat}
            directoryScope={directoryScope}
            onScopeChange={setDirectoryScope}
            filteredResortsCount={filteredResorts.length}
            inViewResortsCount={inViewResorts.length}
            displayedResorts={displayedResorts}
            selectedResort={selectedResort}
            selectedResortId={selectedResortId}
            unitsMetric={unitsMetric}
            onSelectResort={handleSelectResort}
            onDeselectResort={handleDeselectResort}
            onViewProfile={() => setPanelView('profile')}
          />
        )}
      </LeftDock>

      {/* MOBILE UNIFIED MOUNTAIN GUIDE (BOTTOM SHEET) */}
      <MobileSheet
        mobileSheetState={mobileSheetState}
        onSetMobileSheetState={setMobileSheetState}
        selectedResort={selectedResort}
        panelView={panelView}
        filteredResortsCount={filteredResorts.length}
        activeFiltersCount={activeFiltersCount}
        unitsMetric={unitsMetric}
      >
        {panelView === 'profile' && selectedResort ? (
          <MountainProfile
            resort={selectedResort}
            unitsMetric={unitsMetric}
            mobileSheetState={mobileSheetState}
            onSetMobileSheetState={setMobileSheetState}
            onDeselect={handleDeselectResort}
          />
        ) : (
          <DirectoryList
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortClick={handleSortClick}
            showNordic={showNordic}
            showDownhill={showDownhill}
            showHeliCat={showHeliCat}
            directoryScope={directoryScope}
            onScopeChange={setDirectoryScope}
            filteredResortsCount={filteredResorts.length}
            inViewResortsCount={inViewResorts.length}
            displayedResorts={displayedResorts}
            selectedResort={selectedResort}
            selectedResortId={selectedResortId}
            unitsMetric={unitsMetric}
            onSelectResort={handleSelectResort}
            onDeselectResort={handleDeselectResort}
            onViewProfile={() => setPanelView('profile')}
          />
        )}
      </MobileSheet>

      {/* FLOATING TOP-LEFT MAP VIEWPORT CONTROLS */}
      <div
        className={`absolute top-14 left-3 md:left-8 ${
          leftDockOpen ? 'md:left-[420px]' : 'md:left-8'
        } z-20 flex items-start gap-2 transition-all duration-300 ease-in-out select-none`}
      >
        <NavigationControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetNorth={handleResetNorth}
          mapBearing={mapBearing}
        />
        <RegionalLocator
          locatorOpen={locatorOpen}
          onToggleLocator={() => {
            setLocatorOpen(!locatorOpen);
            if (!locatorOpen) setMapMenuOpen(false);
          }}
          onCloseLocator={() => setLocatorOpen(false)}
          selectedResort={selectedResort}
          mapCenter={mapCenter}
          mapZoom={mapZoom}
          viewportBounds={viewportBounds}
          resorts={resorts}
          onFlyTo={(center) => {
            if (!mapRef.current) return;
            safeFlyTo(mapRef.current, {
              center,
              duration: 1000,
              essential: true,
            });
          }}
          onResetToGlobal={(e) => {
            e.stopPropagation();
            handleResetToGlobalExtent();
          }}
        />
      </div>

      {/* FLOATING TOP-RIGHT CARTO CONTROLS: BASEMAP POPOVER */}
      <BasemapMenu
        mapMenuOpen={mapMenuOpen}
        onToggleMenu={() => {
          setMapMenuOpen(!mapMenuOpen);
          if (!mapMenuOpen) setLocatorOpen(false);
        }}
        onCloseMenu={() => setMapMenuOpen(false)}
        basemapMode={basemapMode}
        onSelectBasemap={setBasemapMode}
        showPeaks={showPeaks}
        onTogglePeaks={() => setShowPeaks((prev) => !prev)}
        showCountryOutlines={showCountryOutlines}
        onToggleCountryOutlines={() => setShowCountryOutlines((prev) => !prev)}
        terrainExaggeration={terrainExaggeration}
        onChangeTerrainExaggeration={handleTerrainExaggerationChange}
        terrainOverlay={terrainOverlay}
        onSelectTerrainOverlay={setTerrainOverlay}
        terrainOverlayOpacity={terrainOverlayOpacity}
        onChangeTerrainOverlayOpacity={setTerrainOverlayOpacity}
      />

      {/* CARTOGRAPHIC MAP FURNITURE: ALTERNATING BAR SCALE & LEGEND */}
      <CartographicLegend
        mapLegendOpen={mapLegendOpen}
        onToggleLegend={() => setMapLegendOpen(!mapLegendOpen)}
        onCloseLegend={() => setMapLegendOpen(false)}
        leftDockOpen={leftDockOpen}
        mapScale={mapScale}
        cameraAltitudeMeters={cameraAltitudeMeters}
        unitsMetric={unitsMetric}
      />

      {/* UNIFIED CARTOGRAPHIC NAVIGATION GIMBAL & COMPASS INSTRUMENT */}
      <CompassGimbal
        mapBearing={mapBearing}
        mapPitch={mapPitch}
        is3D={is3D}
        isCompassDragging={isCompassDragging}
        isTiltDragging={isTiltDragging}
        onCompassMouseDown={handleCompassMouseDown}
        onResetNorth={handleResetNorth}
        onTiltMouseDown={handleTiltMouseDown}
        onToggle3D={handleToggle3D}
        onFlattenMap={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!mapRef.current) return;
          safeEaseTo(mapRef.current, { bearing: 0, pitch: 0, duration: 400 });
          setMapBearing(0);
          setMapPitch(0);
          mapRef.current.setRenderWorldCopies(false);
        }}
      />

      {/* MAP DATA ATTRIBUTION */}
      <AttributionBadge
        isOpen={attributionOpen}
        onToggle={() => setAttributionOpen(!attributionOpen)}
        onClose={() => setAttributionOpen(false)}
      />

      {/* CLICK-ACTIVATED RUN & LIFT INSPECTION CARD */}
      {selectedTrail && (
        <TrailProfileCard
          trail={selectedTrail}
          unitsMetric={unitsMetric}
          onClose={handleDeselectTrail}
          screenPos={selectedTrailScreenPos}
          leftDockOpen={leftDockOpen}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

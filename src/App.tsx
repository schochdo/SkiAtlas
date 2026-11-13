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
  MajorPeak,
  FireLookout,
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
import {
  safeFlyTo,
  safeEaseTo,
  isProgrammaticFlightActive,
  setIsProgrammaticFlightActive,
  computeGlobeFitZoom,
  DEFAULT_NORTH_AMERICA_CENTER,
  useKeyboardFlight,
} from './camera';
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
  buildInitialResorts,
  fetchGlobalSkiAreas,
  mergeResortsWithWeather,
  filterResortCatalog,
  filterResortsInBounds,
  syncDynamicMapSources,
  updateSelectedResortPin,
} from './services/resorts';
import {
  getNeutralWeather,
  getInitialWeather,
  fetchLiveWeather,
  isWeatherCircuitTripped,
} from './services/weather';
import { GLOBAL_SKI_ATLAS } from './data/resorts';
import { HELI_CAT_OPERATIONS } from './data/heliCat';

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

import { getStaticDataUrl } from './utils/url';
export { getStaticDataUrl };
import {
  registerAllVectorLayers,
  syncGeoReferenceTheme,
  syncPeakLayers,
  syncLookoutLayers,
  syncTrailFilterAndVisibility,
  syncResortPointFilters,
} from './layers';

/**
 * Deterministic OSM piste classification.
 * Returns 'downhill' | 'touring' | 'nordic' | 'ignore'.
 * isInsideResortOrNearLift = true means the feature comes from a known resort bbox
 * or is confirmed near a lift/winter_sports boundary.
 */
function classifyOsmPiste(
  tags: Record<string, any> = {},
  isLiftServed: boolean = false
): 'downhill' | 'touring' | 'nordic' | 'ignore' {
  const rawType = (tags['piste:type'] || '').toLowerCase();
  const types = rawType.split(/[;+]/).map((s: string) => s.trim()).filter(Boolean);
  const patrolled = (tags['patrolled'] || '').toLowerCase();

  // 1. Ignore winter walking, snowshoeing, sledding, fatbiking
  if (!types.some((t: string) => ['downhill', 'freeride', 'connection', 'nordic', 'skitour'].includes(t))) {
    return 'ignore';
  }

  // 2. DOWNHILL vs. DOWNHILL TOURING (Separated by Lift/Resort Proximity)
  // Note: `piste:grooming=backcountry` in OSM just means "ungroomed" (like Highland Bowl or Third Bowl).
  // If it's lift-served and not explicitly `patrolled=no`, it is a Resort Downhill run.
  // If it's NOT lift-served (or is `patrolled=no`), it is a Backcountry Downhill Touring line.
  if (types.includes('downhill') || types.includes('freeride') || types.includes('connection')) {
    if (patrolled === 'no' || !isLiftServed) {
      return 'touring';
    }
    return 'downhill';
  }

  // 3. SKI TOURING (Uphill skin tracks & alpine touring routes)
  if (types.includes('skitour')) {
    return 'touring';
  }

  // 4. NORDIC (All cross-country skiing, kept completely separate from AT ski touring)
  if (types.includes('nordic')) {
    return 'nordic';
  }

  return 'ignore';
}

export default function App() {
  const [resorts, setResorts] = useState<SkiResort[]>(buildInitialResorts);

  const [selectedResortId, setSelectedResortId] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<'directory' | 'profile'>('directory');
  const [mobileSheetState, setMobileSheetState] = useState<'peek' | 'half' | 'full'>('peek');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

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

  const [earthProjection, setEarthProjection] = useState<EarthProjectionMode>('globe');
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('satellite');
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
  const [showLookouts, setShowLookouts] = useState<boolean>(false);
  const [showCountryOutlines, setShowCountryOutlines] = useState<boolean>(true);
  const [attributionOpen, setAttributionOpen] = useState(false);

  const handleTerrainExaggerationChange = (val: number) => {
    const num = Number(val);
    setTerrainExaggeration(num);
    if (mapRef.current && mapLoaded && show3DTerrain) {
      try {
        if (num <= 0) {
          mapRef.current.setTerrain(null);
        } else {
          mapRef.current.setTerrain({ source: 'terrain-dem', exaggeration: num });
        }
      } catch (_) {}
    }
  };

  // Category Individual Toggles (Default: Downhill only)
  // Controls all associated points, clusters, trails, and infrastructure
  const [showDownhill, setShowDownhill] = useState(true);
  const [showNordic, setShowNordic] = useState(false);
  const [showHeliCat, setShowHeliCat] = useState(false);
  const [showTouring, setShowTouring] = useState(false);

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
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_NORTH_AMERICA_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(2.2);

  // Global Points Ref & Features
  const [showGlobalPoints, setShowGlobalPoints] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({ downhill: 6955, nordic: 5276, heli_cat: HELI_CAT_OPERATIONS.length, touring: 1 });
  const allGlobalFeaturesRef = useRef<any[]>([]);
  const globalFeaturesRef = useRef<any[]>([]);

  // Localhost SQLite Trails Cache & Refs
  const liveFeaturesMapRef = useRef<Map<string, any>>(new Map());
  const activeOverpassAbortRef = useRef<AbortController | null>(null);
  const lastFetchedBboxKeyRef = useRef<string>('');
  const handleDeselectResortRef = useRef<() => void>(() => {});
  const lookoutPopupRef = useRef<maplibregl.Popup | null>(null);

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
    if (!showDownhill || showNordic || showHeliCat || !showTouring) count++;
    return count;
  }, [selectedPasses, unitsMetric, minVerticalFt, minVerticalM, minAreaAcres, minAreaHa, minNordicMi, minNordicKm, showDownhill, showNordic, showHeliCat, showTouring]);

  // Dynamic Category Counts Matching Sliders & Pass Network Filters
  const categoryFilterCounts = useMemo(() => {
    let downhill = 0;
    let nordic = 0;
    let heli_cat = 0;
    let touring = 0;
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
      } else if (cat === 'touring') {
        touring++;
      }
    }
    return { downhill, nordic, heli_cat, touring: Math.max(touring, 1) };
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
    setShowTouring(true);
  };

  // Filtered Resorts across entire world dataset
  const filteredResorts = useMemo(() => {
    return filterResortCatalog(
      resorts,
      {
        showDownhill,
        showNordic,
        showHeliCat,
        showTouring,
        selectedPasses,
        effectiveMinVerticalFt,
        effectiveMinAcreage,
        effectiveMinNordicKm,
        searchQuery,
      },
      {
        sortBy,
        sortOrder,
      }
    );
  }, [resorts, selectedPasses, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, searchQuery, showDownhill, showNordic, showHeliCat, showTouring, sortBy, sortOrder]);

  // Resorts in current map viewport bounds
  const inViewResorts = useMemo(() => {
    return filterResortsInBounds(filteredResorts, viewportBounds);
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
     MAJOR MOUNTAIN SUMMITS (PEAKFINDER HORIZON ENGINE & SEARCH FLIGHT)
     ========================================================================= */

  const [peaks, setPeaks] = useState<MajorPeak[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(getStaticDataUrl('data/major_peaks.geojson?v=20261108_dem_apex_reconciled'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && data.features) {
          const loaded: MajorPeak[] = data.features.map((f: any) => ({
            id: f.id || f.properties?.id,
            name: f.properties?.name || '',
            elevation_ft: f.properties?.elevation_ft || 0,
            elevation_m: f.properties?.elevation_m || 0,
            coordinates: f.geometry?.coordinates as [number, number],
            continent: f.properties?.continent,
            tier: f.properties?.tier,
          }));
          setPeaks(loaded);
        }
      })
      .catch((err) => {
        console.warn('Could not load major peaks for search:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchingPeaks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return peaks
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [peaks, searchQuery]);

  const handleSelectPeak = useCallback((peak: MajorPeak) => {
    if (!mapRef.current) return;
    setShowPeaks(true);
    handleDeselectTrail();
    setSelectedResortId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('peek');
    }

    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const bottomPad = isMob ? 220 : 0;

    safeFlyTo(mapRef.current, {
      center: peak.coordinates,
      zoom: 12.8,
      pitch: 56,
      bearing: -15,
      padding: { top: 60, bottom: bottomPad, left: leftPad, right: 0 },
      duration: 2200,
      essential: true,
    });
  }, [leftDockOpen, handleDeselectTrail]);

  /* =========================================================================
     FIRE LOOKOUTS & WATCHTOWERS (SEARCH & CARTOGRAPHIC INSPECTION)
     ========================================================================= */

  const [lookouts, setLookouts] = useState<FireLookout[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(getStaticDataUrl('data/fire_lookouts.geojson?v=20261108_v4'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && data.features) {
          const loaded: FireLookout[] = data.features.map((f: any) => ({
            id: f.id || f.properties?.id,
            name: f.properties?.name || '',
            elevation_ft: f.properties?.elevation_ft || 0,
            elevation_m: f.properties?.elevation_m || 0,
            coordinates: f.geometry?.coordinates as [number, number],
            agency: f.properties?.agency,
            state: f.properties?.state,
            status: f.properties?.status,
            tier: f.properties?.tier,
          }));
          setLookouts(loaded);
        }
      })
      .catch((err) => {
        console.warn('Could not load fire lookouts for search:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchingLookouts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return lookouts
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [lookouts, searchQuery]);

  const buildLookoutPopupHTML = useCallback((
    name: string,
    elevFt: number | null | undefined,
    rawAgency: string | undefined,
    state: string | undefined,
    rawStatus: string | undefined
  ) => {
    const elev = elevFt && elevFt > 0 ? formatVert(elevFt, unitsMetric) : '—';

    // Format agency cleanly, eliminating long scrape placeholders
    let displayAgency = (rawAgency || 'USFS').trim();
    if (displayAgency.includes('USFS / NPS / State') || displayAgency === 'NHLR') {
      displayAgency = 'Historic Registry (NHLR)';
    } else if (displayAgency.includes('State of NH')) {
      displayAgency = 'NH State Parks';
    } else if (displayAgency.includes('NYS DEC')) {
      displayAgency = 'NY DEC';
    }
    const stateSuffix = state ? ` · ${state.trim()}` : '';

    // Only render status badges for genuinely distinctive operational states (omit redundant "Standing")
    const status = (rawStatus || '').trim().toLowerCase();
    let statusBadge = '';
    if (status === 'active' || status === 'active watch' || status === 'active watchtower') {
      statusBadge = `
        <div style="margin-top: 4px; margin-bottom: 2px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #166534; background: #DCFCE7; border: 1px solid #BBF7D0; padding: 1.5px 6px; border-radius: 3px;">
            <span style="font-size: 7.5px;">●</span> Active Watchtower
          </span>
        </div>`;
    } else if (status === 'rental' || status === 'cabin rental' || status === 'recreation rental') {
      statusBadge = `
        <div style="margin-top: 4px; margin-bottom: 2px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9A3412; background: #FFEDD5; border: 1px solid #FED7AA; padding: 1.5px 6px; border-radius: 3px;">
            <span style="font-size: 8px;">⌂</span> Cabin Rental
          </span>
        </div>`;
    } else if (status.includes('ruin') || status.includes('foundation') || status.includes('remnant')) {
      statusBadge = `
        <div style="margin-top: 4px; margin-bottom: 2px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #57534E; background: #F5F5F4; border: 1px solid #D6D3D1; padding: 1.5px 6px; border-radius: 3px;">
            Historic Ruins
          </span>
        </div>`;
    } else if (status === 'historic' || status === 'historical' || status === 'retired') {
      statusBadge = `
        <div style="margin-top: 4px; margin-bottom: 2px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #78350F; background: #FEF3C7; border: 1px solid #FDE68A; padding: 1.5px 6px; border-radius: 3px;">
            Historic Site
          </span>
        </div>`;
    } else if (status === 'abandoned' || status === 'unstaffed') {
      statusBadge = `
        <div style="margin-top: 4px; margin-bottom: 2px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #713F12; background: #FEF9C3; border: 1px solid #FEF08A; padding: 1.5px 6px; border-radius: 3px;">
            Abandoned Tower
          </span>
        </div>`;
    }

    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 11px 14px 10px; min-width: 220px; max-width: 320px; background: #FAF8F3; color: #1C1B18; border-radius: 6px; position: relative; box-sizing: border-box;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #D96B27; margin-bottom: 4px; padding-right: 28px; display: flex; align-items: center; gap: 5px;">
          <span style="font-size: 12px; line-height: 1;">⌂</span>
          <span>Fire Lookout</span>
        </div>
        <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 700; line-height: 1.25; color: #1C1B18; padding-right: 20px; margin-bottom: 4px; word-break: break-word;">
          ${name}
        </div>
        ${statusBadge}
        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 11px; padding-top: 7px; margin-top: 6px; border-top: 1px solid #EAE5D9;">
          <span style="font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #1C1B18; white-space: nowrap; flex-shrink: 0;">${elev}</span>
          <span style="font-size: 10.5px; color: #736E67; text-align: right; line-height: 1.35; white-space: normal; flex-grow: 1;">
            ${displayAgency}${stateSuffix}
          </span>
        </div>
      </div>
    `;
  }, [unitsMetric]);

  const handleSelectLookout = useCallback((lookout: FireLookout) => {
    if (!mapRef.current) return;
    setShowLookouts(true);
    handleDeselectTrail();
    setSelectedResortId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetState('peek');
    }

    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const bottomPad = isMob ? 220 : 0;

    safeFlyTo(mapRef.current, {
      center: lookout.coordinates,
      zoom: 13.5,
      pitch: 58,
      bearing: -20,
      padding: { top: 60, bottom: bottomPad, left: leftPad, right: 0 },
      duration: 2200,
      essential: true,
    });

    if (lookoutPopupRef.current) {
      lookoutPopupRef.current.remove();
      lookoutPopupRef.current = null;
    }

    let elevVal = lookout.elevation_ft;
    if (!elevVal || elevVal === 0) {
      try {
        const liveM = mapRef.current.queryTerrainElevation(lookout.coordinates);
        if (liveM !== null && liveM !== undefined && isFinite(liveM)) {
          elevVal = Math.round(liveM * 3.28084);
        }
      } catch (_) {}
    }
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: [0, -12],
      maxWidth: '340px',
      className: 'lookout-editorial-popup',
    })
      .setLngLat(lookout.coordinates)
      .setHTML(buildLookoutPopupHTML(lookout.name, elevVal, lookout.agency, lookout.state, lookout.status))
      .addTo(mapRef.current);

    lookoutPopupRef.current = popup;
  }, [leftDockOpen, unitsMetric, handleDeselectTrail]);

  /* =========================================================================
     TRAILS STREAMING & STATIC PRE-BAKED ENGINE
     ========================================================================= */

  const loadedResortTrailsRef = useRef<Set<string>>(new Set());
  const permanentTrailIdsRef = useRef<Set<string>>(new Set());
  const fetchedBboxKeysSetRef = useRef<Set<string>>(new Set());
  const hasLocalServerRef = useRef(true);

  const ingestTrailFeatures = useCallback((features: any[], isPermanent: boolean = false, resortCategory?: string) => {
    if (!features || !features.length || !mapRef.current) return;

    for (const f of features) {
      const p = f.properties;
      if (resortCategory) {
        p.resort_category = resortCategory;
        if (resortCategory === 'nordic') {
          p['piste:type'] = 'nordic';
        }
      }
      if (p?.kind === 'lift') {
        if (p.status && p.status !== 'operating') continue;
        const n = (p.name || '').toLowerCase();
        if (n.includes('proposed') || n.includes('planned') || n.includes('abandoned') || n.includes('disused') || n.includes('in project')) {
          continue;
        }
      } else if (p?.kind === 'piste') {
        const category = classifyOsmPiste(p, true); // static = always inbounds
        if (category === 'ignore') continue;
        p.atlas_category = category;
        // Also set piste:type for backward compat with any remaining filters
        if (category === 'touring' && (!p['piste:type'] || p['piste:type'] === 'backcountry')) {
          p['piste:type'] = 'skitour';
        }
      }
      const fid = String(f.id || p?.id);
      if (!f.id && p?.id) {
        f.id = p.id;
      }
      liveFeaturesMapRef.current.set(fid, f);
      if (isPermanent) {
        permanentTrailIdsRef.current.add(fid);
      }
    }

    // Limit transient bbox features while strictly preserving all loaded resort trails
    if (liveFeaturesMapRef.current.size > 5000) {
      const keys = Array.from(liveFeaturesMapRef.current.keys());
      const toDelete: string[] = [];
      for (const k of keys) {
        if (!permanentTrailIdsRef.current.has(k)) {
          toDelete.push(k);
          if (liveFeaturesMapRef.current.size - toDelete.length <= 4000) break;
        }
      }
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

  const fetchResortStaticTrails = useCallback(async (resortId: string, knownCategory?: string) => {
    if (loadedResortTrailsRef.current.has(resortId)) return;
    let category = knownCategory;
    if (!category) {
      const gFeat = allGlobalFeaturesRef.current?.find((f) => f.properties?.id === resortId);
      if (gFeat) {
        category = gFeat.properties?.category;
      } else {
        const atlasResort = GLOBAL_SKI_ATLAS.find((r) => r.id === resortId);
        if (atlasResort) category = atlasResort.category;
      }
    }
    category = category || 'downhill';

    if (hasLocalServerRef.current) {
      try {
        // 1. Try local SQLite API first (instant query from trails.db)
        const apiRes = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/trails?resort=${resortId}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.features && data.features.length) {
            ingestTrailFeatures(data.features, true, category);
            loadedResortTrailsRef.current.add(resortId);
            return;
          }
        } else if (apiRes.status === 404) {
          hasLocalServerRef.current = false;
        }
      } catch (_) {
        hasLocalServerRef.current = false;
      }
    }
    try {
      // 2. Try static pre-exported file in public/data/trails/
      const res = await fetch(getStaticDataUrl(`data/trails/${resortId}.json`));
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length) {
          ingestTrailFeatures(data.features, true, category);
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
    if (hasLocalServerRef.current) {
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
        } else if (res.status === 404) {
          hasLocalServerRef.current = false;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        hasLocalServerRef.current = false;
      }
    }

    // Static local loading: find ANY ski area in this bounding box area (±0.04° margin)
    if (!apiSuccess) {
      let matchedAny = false;

      // 1. Curated flagships
      for (const r of GLOBAL_SKI_ATLAS) {
        if (r.lat >= south - 0.04 && r.lat <= north + 0.04 && r.lng >= west - 0.04 && r.lng <= east + 0.04) {
          const cat = r.category || 'downhill';
          if (cat === 'nordic' && !showNordic) continue;
          if (cat === 'downhill' && !showDownhill) continue;
          if (cat === 'heli_cat' && !showHeliCat) continue;
          if (cat === 'touring' && !showTouring) continue;
          fetchResortStaticTrails(r.id, cat);
          matchedAny = true;
        }
      }

      // 2. All 6,592 global ski areas worldwide
      if (allGlobalFeaturesRef.current && allGlobalFeaturesRef.current.length > 0) {
        for (const f of allGlobalFeaturesRef.current) {
          const pt = f.geometry?.coordinates;
          if (pt && pt[1] >= south - 0.04 && pt[1] <= north + 0.04 && pt[0] >= west - 0.04 && pt[0] <= east + 0.04) {
            if (f.properties?.id) {
              const cat = f.properties?.category || 'downhill';
              if (cat === 'nordic' && !showNordic) continue;
              if (cat === 'downhill' && !showDownhill) continue;
              if (cat === 'heli_cat' && !showHeliCat) continue;
              if (cat === 'touring' && !showTouring) continue;
              fetchResortStaticTrails(f.properties.id, cat);
              matchedAny = true;
            }
          }
        }
      }

      if (matchedAny) {
        fetchedBboxKeysSetRef.current.add(bboxKey);
        return;
      }

      // 3. Fallback for wild backcountry terrain outside any known ski area
      try {
        const q = `[out:json][timeout:20];(way["piste:type"](${south},${west},${north},${east});relation["piste:type"](${south},${west},${north},${east});way["landuse"="winter_sports"](${south},${west},${north},${east});relation["landuse"="winter_sports"](${south},${west},${north},${east});way["aerialway"](${south},${west},${north},${east}););out body;>;out skel qt;`;
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(q)}`,
          signal: controller.signal,
        });
        if (overpassRes.ok) {
          const opData = await overpassRes.json();
          if (opData.elements && opData.elements.length) {
            // Build node coordinate map
            const nodeMap = new Map<number, { lat: number; lon: number }>();
            for (const el of opData.elements) {
              if (el.type === 'node') {
                nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
              }
            }

            // Build resort & lift bounding boxes (expanded 0.005°)
            const EXPAND = 0.005;
            const resortAndLiftBoxes: [number, number, number, number][] = [];
            for (const el of opData.elements) {
              const isResort = el.type === 'way' && el.tags?.landuse === 'winter_sports';
              const isResortRel = el.type === 'relation' && el.tags?.landuse === 'winter_sports';
              const isLift = el.type === 'way' && el.tags?.aerialway;
              if ((isResort || isResortRel || isLift) && el.nodes && el.nodes.length > 0) {
                let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
                for (const nid of el.nodes) {
                  const nd = nodeMap.get(nid);
                  if (nd) {
                    if (nd.lon < minLng) minLng = nd.lon;
                    if (nd.lon > maxLng) maxLng = nd.lon;
                    if (nd.lat < minLat) minLat = nd.lat;
                    if (nd.lat > maxLat) maxLat = nd.lat;
                  }
                }
                if (minLng !== Infinity) {
                  resortAndLiftBoxes.push([minLng - EXPAND, minLat - EXPAND, maxLng + EXPAND, maxLat + EXPAND]);
                }
              }
            }

            function isPointNearResortOrLift(lng: number, lat: number, boxes: [number, number, number, number][]): boolean {
              for (let i = 0; i < boxes.length; i++) {
                const [mnLng, mnLat, mxLng, mxLat] = boxes[i];
                if (lng >= mnLng && lng <= mxLng && lat >= mnLat && lat <= mxLat) return true;
              }
              return false;
            }

            // Propagate parent relation tags to member ways
            const wayTagOverrides = new Map<number, Record<string, string>>();
            for (const el of opData.elements) {
              if (el.type === 'relation' && (el.tags?.route === 'piste' || el.tags?.['piste:type'])) {
                if (!el.members) continue;
                const relTags = el.tags || {};
                for (const member of el.members) {
                  if (member.type !== 'way') continue;
                  const existing = wayTagOverrides.get(member.ref) || {};
                  for (const key of ['piste:type', 'piste:grooming', 'piste:difficulty', 'patrolled', 'name']) {
                    if (!existing[key] && relTags[key]) {
                      existing[key] = relTags[key];
                    }
                  }
                  wayTagOverrides.set(member.ref, existing);
                }
              }
            }

            const feats: any[] = [];
            for (const el of opData.elements) {
              if (el.type !== 'way') continue;
              if (!el.nodes || el.nodes.length < 2) continue;

              const tags: Record<string, string> = { ...(el.tags || {}) };
              // Apply relation tag propagation
              const overrides = wayTagOverrides.get(el.id);
              if (overrides) {
                for (const [k, v] of Object.entries(overrides)) {
                  if (!tags[k]) tags[k] = v;
                }
              }

              const isAerialway = !!tags.aerialway;
              const isPiste = !!tags['piste:type'];

              if (!isAerialway && !isPiste) continue;

              // Resolve coordinates
              const coords: [number, number][] = [];
              for (const nid of el.nodes) {
                const nd = nodeMap.get(nid);
                if (nd) coords.push([nd.lon, nd.lat]);
              }
              if (coords.length < 2) continue;

              const isClosed = coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];

              // For pistes, determine proximity and classify
              let atlas_category: string | undefined;
              if (isPiste && !isAerialway) {
                const midIdx = Math.floor(coords.length / 2);
                const inResort = isPointNearResortOrLift(coords[0][0], coords[0][1], resortAndLiftBoxes)
                  || isPointNearResortOrLift(coords[midIdx][0], coords[midIdx][1], resortAndLiftBoxes)
                  || isPointNearResortOrLift(coords[coords.length - 1][0], coords[coords.length - 1][1], resortAndLiftBoxes);
                atlas_category = classifyOsmPiste(tags, inResort);
                if (atlas_category === 'ignore') continue;
              }

              const feat: any = {
                type: 'Feature',
                id: String(el.id),
                geometry: isClosed && isPiste
                  ? { type: 'Polygon', coordinates: [coords] }
                  : { type: 'LineString', coordinates: coords },
                properties: {
                  id: String(el.id),
                  name: tags['name:en'] || tags['piste:name:en'] || tags.name || tags['piste:name'] || '',
                  'name:en': tags['name:en'] || '',
                  kind: isAerialway ? 'lift' : 'piste',
                  'piste:type': tags['piste:type'] || (isAerialway ? undefined : 'downhill'),
                  'piste:difficulty': tags['piste:difficulty'] || 'intermediate',
                  'piste:grooming': tags['piste:grooming'] || '',
                  patrolled: tags.patrolled || '',
                  aerialway: tags.aerialway || undefined,
                  atlas_category: atlas_category,
                },
              };
              feats.push(feat);
            }

            if (feats.length) {
              ingestTrailFeatures(feats);
              fetchedBboxKeysSetRef.current.add(bboxKey);
            }
          }
        }
      } catch (_) {}
    }
  }, [fetchResortStaticTrails, ingestTrailFeatures, showDownhill, showNordic, showHeliCat, showTouring]);

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
    const allResorts = [...GLOBAL_SKI_ATLAS, ...HELI_CAT_OPERATIONS];
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
    const initialTopPad = 44;
    const initialBottomPad = initialIsMobile ? 80 : 0;

    const initialZoom = computeGlobeFitZoom(
      typeof window !== 'undefined' ? window.innerWidth : 1440,
      typeof window !== 'undefined' ? window.innerHeight : 900,
      initialIsMobile,
      leftDockOpen,
      DEFAULT_NORTH_AMERICA_CENTER[1],
      0.84
    );

    registerTerrainAnalysisProtocols();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      attributionControl: false,
      renderWorldCopies: false,
      style: createMapStyle(earthProjection, basemapMode, terrainOverlay, terrainOverlayOpacity, showCountryOutlines, showHillshade),
      center: DEFAULT_NORTH_AMERICA_CENTER, // North America alpine focus
      zoom: initialZoom,
      minZoom: 1.0,
      maxZoom: 20.5, // Allow zooming in close to ground level (down to ~100-150ft elevation)
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      dragRotate: true,
      boxZoom: false, // Prevents Shift-key from hijacking left-click panning into a box-zoom box
      maxTileCacheSize: initialIsMobile ? 60 : 120, // Lightweight mobile-friendly tile cache (prevents iPad/browser VRAM exhaustion)
      zoomLevelsToOverscale: 6, // Overscale DEM tiles seamlessly past source maxzoom (z15 -> z21) so terrain mesh remains continuous
      centerClampedToGround: true, // Anchor focal center to 3D ground so zooming and terrain inspection operate smoothly at all altitudes
    });

    // Calibrate TileManager in-memory retention for smooth panning without memory exhaustion
    const calibrateTileCaches = () => {
      try {
        const tm = (map as any).style?.tileManagers;
        if (!tm) return;
        const cacheLimit = initialIsMobile ? 60 : 120;
        for (const id in tm) {
          if (id === 'live-pistes-vector' || id === 'selected-trail-source') continue;
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
    map.setPadding({ left: initialLeftPad, right: initialRightPad, top: initialTopPad, bottom: initialBottomPad });

    mapRef.current = map;
    (window as any)._skiMap = map;
    (window as any).__skiAtlasMap = map;

    // Enable native linear drag-to-rotate around center with ground clamping
    try {
      (map as any).setCenterClampedToGround?.(true);
      map.dragRotate.enable({ around: 'center', movement: 'linear' });
    } catch (_) {}

    // Enable smooth scroll wheel zoom anchored around center (prevents cursor raycast terrain kick)
    try {
      map.scrollZoom.enable({ around: 'center' });
    } catch (_) {}

    // Neutralize MapLibre moveCenterOntoTerrain oscillation during zoom over sloped 3D relief
    const neutralizeCameraBounce = () => {
      try {
        const cam = (map as any)._camera;
        if (cam) {
          cam.moveCenterOntoTerrain = () => {};
        }
      } catch (_) {}
    };
    neutralizeCameraBounce();
    map.on('style.load', neutralizeCameraBounce);

    // Tablet & Touchscreen Controls (two-finger pitch tilt, rotate & pinch-zoom)
    try {
      // Natural pinch-zoom anchors around the midpoint between fingers (not screen center)
      map.touchZoomRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
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

    // Prevent iOS Safari page-level scaling while allowing MapLibre touchZoomRotate
    const onDocGesture = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('gesturestart', onDocGesture, { passive: false });
    document.addEventListener('gesturechange', onDocGesture, { passive: false });

    const isIosDevice = typeof navigator !== 'undefined' && (
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    const onGestureStart = (e: any) => {
      e.preventDefault();
      // On iOS devices, MapLibre's built-in touchZoomRotate handles touch pinch/rotate natively
      if (isIosDevice) return;
      gestureStartBearing = map.getBearing();
      gestureStartZoom = map.getZoom();
      isGestureActive = true;
    };

    const onGestureChange = (e: any) => {
      e.preventDefault();
      if (!isGestureActive || isIosDevice) return;

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
      if (!isIosDevice) {
        setMapBearing(Math.round(map.getBearing()));
        resetOrphanedDragHandlers();
      }
    };

    // Trackpad & Mouse Wheel Controller (Pinch Zoom, Shift-Tilt, Option-Rotate)
    // Works across Brave, Chrome, Safari, and Firefox
    const onWheel = (e: WheelEvent) => {
      // 1. Pinch-to-Zoom (Brave & Chrome on Mac dispatch wheel with e.ctrlKey = true)
      if (e.ctrlKey) {
        // Prevent Chromium browser tab zoom, while letting MapLibre's scrollZoom handle smooth centered zoom
        e.preventDefault();
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
      // Continuous progressive pitch constraint: smoothly tapers from 75° at z=16 down to 55° at z=20.5 with zero discrete jumps
      if (z > 16.0) {
        const maxPitchAtZoom = Math.max(55, Math.round(75 - ((z - 16.0) / 4.5) * 20));
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
      // Continuous progressive pitch constraint: smoothly tapers from 75° at z=16 down to 55° at z=20.5 with zero discrete jumps
      if (z > 16.0) {
        const maxPitchAtZoom = Math.max(55, Math.round(75 - ((z - 16.0) / 4.5) * 20));
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
        if (show3DTerrain && Number(terrainExaggeration) > 0) {
          map.setTerrain({ source: 'terrain-dem', exaggeration: Number(terrainExaggeration) });
        } else {
          map.setTerrain(null);
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

      // Vector Layers Subsystem: Trails, Boundaries, Curated & Global Resorts, Summits & Lookouts
      const curatedFeatures = [...GLOBAL_SKI_ATLAS, ...HELI_CAT_OPERATIONS].map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          name: r.name,
          category: r.category || 'downhill',
          primary_pass: r.pass_networks?.[0] || 'Independent',
          pass_color: r.category === 'heli_cat' ? '#C85A32' : r.category === 'touring' ? '#D97706' : (PASS_COLORS[r.pass_networks?.[0] || 'Independent'] || '#8A847C'),
          vertical_ft: r.vertical_drop_ft || 0,
          vertical_drop_ft: r.vertical_drop_ft || 0,
          skiable_acres: r.skiable_acres || 0,
        },
      }));

      registerAllVectorLayers(map, {
        showDownhill,
        showCountryOutlines,
        showPeaks,
        showLookouts,
        unitsMetric,
        basemapMode,
        curatedFeatures,
        globalFeatures: allGlobalFeaturesRef.current,
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
      map.on('click', 'resorts-heli-cat-ring', onResortClick);
      map.on('click', 'resorts-heli-cat-dot', onResortClick);
      map.on('click', 'resorts-heli-cat-labels', onResortClick);
      map.on('click', 'selected-resort-pulse', onResortClick);
      map.on('click', 'selected-resort-dot', onResortClick);
      map.on('click', 'selected-resort-label', onResortClick);

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

      // Click on mountain peak marker / label to pan and zoom
      const onPeakClick = (e: any) => {
        if (!e.features || !e.features[0]) return;
        const coords = (e.features[0].geometry as any).coordinates as [number, number];
        if (!coords) return;
        const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
        const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
        const bottomPad = isMob ? 220 : 0;
        safeFlyTo(map, {
          center: coords,
          zoom: Math.max(map.getZoom(), 12.8),
          pitch: 56,
          bearing: -15,
          padding: { top: 60, bottom: bottomPad, left: leftPad, right: 0 },
          duration: 1800,
          essential: true,
        });
      };

      const peakLayers = [
        'major-peaks-marker-tier1',
        'major-peaks-marker-tier2',
        'major-peaks-marker-tier3',
        'major-peaks-label',
      ];
      peakLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.on('click', layerId, onPeakClick);
        }
      });

      // Click on fire lookout marker / label to pan and zoom
      const onLookoutClick = (e: any) => {
        if (!e.features || !e.features[0]) return;
        const feat = e.features[0];
        const coords = (feat.geometry as any).coordinates as [number, number];
        if (!coords) return;
        const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
        const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
        const bottomPad = isMob ? 220 : 0;
        safeFlyTo(map, {
          center: coords,
          zoom: Math.max(map.getZoom(), 13.5),
          pitch: 58,
          bearing: -20,
          padding: { top: 60, bottom: bottomPad, left: leftPad, right: 0 },
          duration: 1800,
          essential: true,
        });

        if (lookoutPopupRef.current) {
          lookoutPopupRef.current.remove();
          lookoutPopupRef.current = null;
        }

        const p = feat.properties || {};
        const name = p.name || 'Fire Lookout';
        let elevVal = p.elevation_ft;
        if (!elevVal || elevVal === 0) {
          try {
            const liveM = map.queryTerrainElevation(coords);
            if (liveM !== null && liveM !== undefined && isFinite(liveM)) {
              elevVal = Math.round(liveM * 3.28084);
            }
          } catch (_) {}
        }
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: [0, -12],
          maxWidth: '340px',
          className: 'lookout-editorial-popup',
        })
          .setLngLat(coords)
          .setHTML(buildLookoutPopupHTML(name, elevVal, p.agency, p.state, p.status))
          .addTo(map);

        lookoutPopupRef.current = popup;
      };

      const lookoutLayers = [
        'fire-lookouts-marker-tier1',
        'fire-lookouts-marker-tier2',
        'fire-lookouts-marker-tier3',
        'fire-lookouts-label',
      ];
      lookoutLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.on('click', layerId, onLookoutClick);
        }
      });

      // Click on empty map canvas deselects active resort or inspects clicked trail / lift
      map.on('click', (e) => {
        const resortLayers = [
          'resorts-outer-ring',
          'resorts-inner-dot',
          'resorts-labels',
          'resorts-heli-cat-ring',
          'resorts-heli-cat-dot',
          'resorts-heli-cat-labels',
          'selected-resort-pulse',
          'selected-resort-dot',
          'selected-resort-label',
          'global-unclustered-outer-ring',
          'global-unclustered-point',
          'global-unclustered-label',
          'global-clusters',
          ...peakLayers,
          ...lookoutLayers,
        ].filter((id) => map.getLayer(id));
        const resortFeats = map.queryRenderedFeatures(e.point, { layers: resortLayers });
        if (resortFeats && resortFeats.length > 0) {
          // Marker or cluster clicked; close any open trail profile card
          handleDeselectTrailRef.current();
          return;
        }

        if (lookoutPopupRef.current) {
          lookoutPopupRef.current.remove();
          lookoutPopupRef.current = null;
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
          // Calibrated touch & click target buffer (22px on touch/mobile, 12px on desktop)
          // Tight and accurate so clicks on open mountain terrain or between parallel trails
          // don't trigger distant trail popups, while remaining natural to click.
          const isTouch =
            typeof window !== 'undefined' &&
            (window.innerWidth < 768 || 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
          const hitRadius = isTouch ? 22 : 12;
          const clickBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - hitRadius, e.point.y - hitRadius],
            [e.point.x + hitRadius, e.point.y + hitRadius],
          ];
          const trailFeats = map.queryRenderedFeatures(clickBbox, { layers: trailLayers });

          if (trailFeats && trailFeats.length > 0) {
            // Resolve candidate features against liveFeaturesMapRef so features clicked via labels
            // or tile clips have their full canonical geometry and properties
            const resolvedFeats = trailFeats.map((f: any) => {
              const fid = String(f.id || f.properties?.id);
              const canonical = liveFeaturesMapRef.current.get(fid);
              return canonical || f;
            });

            // Ground-truth geodesic distance on the 3D mountain surface (in meters).
            // Uses e.lngLat directly (which MapLibre raycasts precisely onto the 3D terrain mesh),
            // completely avoiding 2D screen projection errors caused by sea-level datum assumptions.
            const clickLng = e.lngLat.lng;
            const clickLat = e.lngLat.lat;
            const cosLat = Math.cos((clickLat * Math.PI) / 180);

            const distToFeatureMeters = (feat: any): number => {
              const geom = feat.geometry;
              if (!geom) return Infinity;

              const distToSegMeters = (pLng: number, pLat: number, aLng: number, aLat: number, bLng: number, bLat: number) => {
                const px = pLng * cosLat * 111320;
                const py = pLat * 110540;
                const ax = aLng * cosLat * 111320;
                const ay = aLat * 110540;
                const bx = bLng * cosLat * 111320;
                const by = bLat * 110540;
                const dx = bx - ax;
                const dy = by - ay;
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) return Math.hypot(px - ax, py - ay);
                const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
              };

              let minM = Infinity;

              const testCoords = (coords: any[]) => {
                if (!coords || coords.length < 2) return;
                for (let i = 0; i < coords.length - 1; i++) {
                  const d = distToSegMeters(clickLng, clickLat, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
                  if (d < minM) minM = d;
                }
              };

              if (geom.type === 'LineString') {
                testCoords(geom.coordinates);
              } else if (geom.type === 'MultiLineString') {
                for (const line of geom.coordinates || []) testCoords(line);
              } else if (geom.type === 'Polygon') {
                for (const ring of geom.coordinates || []) testCoords(ring);
              } else if (geom.type === 'MultiPolygon') {
                for (const poly of geom.coordinates || []) {
                  for (const ring of poly || []) testCoords(ring);
                }
              } else if (geom.type === 'Point') {
                const px = (clickLng - geom.coordinates[0]) * cosLat * 111320;
                const py = (clickLat - geom.coordinates[1]) * 110540;
                minM = Math.hypot(px, py);
              }

              return minM;
            };

            let bestLineFeat: any = null;
            let bestLineDist = Infinity;
            let bestLiftFeat: any = null;
            let bestLiftDist = Infinity;
            let bestPolyFeat: any = null;
            let bestPolyDist = Infinity;

            for (const f of resolvedFeats) {
              const geom = f.geometry;
              if (!geom) continue;
              const isLine = geom.type === 'LineString' || geom.type === 'MultiLineString' || geom.type === 'Point';
              const isLift = f.properties?.kind === 'lift' || !!f.properties?.aerialway;
              const dist = distToFeatureMeters(f);

              if (isLift) {
                if (dist < bestLiftDist) {
                  bestLiftDist = dist;
                  bestLiftFeat = f;
                }
              } else if (isLine) {
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

            // Prioritize linear tracks (lifts or runs) over broad freeride terrain polygons
            let selectedFeat: any = null;
            if (bestLiftFeat && bestLineFeat) {
              selectedFeat = bestLiftDist <= bestLineDist ? bestLiftFeat : bestLineFeat;
            } else if (bestLiftFeat) {
              selectedFeat = bestLiftFeat;
            } else if (bestLineFeat) {
              selectedFeat = bestLineFeat;
            } else {
              selectedFeat = bestPolyFeat || resolvedFeats[0];
            }

            if (selectedFeat) {
              handleSelectTrailRef.current(selectedFeat, [clickLng, clickLat], e.point);
              return;
            }
          }
        }

        // Empty canvas click
        handleDeselectResortRef.current();
        handleDeselectTrailRef.current();
      });

      // Unified High-Precision Interactive Pointer Cursor
      // Uses a generous 20px bounding box around the cursor to smoothly and reliably
      // indicate clickable ski trails, chairlifts, labels, and peaks without edge jitter.
      let lastCursorThrottle = 0;
      const onMapMouseMove = (e: maplibregl.MapMouseEvent) => {
        const now = performance.now();
        if (now - lastCursorThrottle < 40) return;
        lastCursorThrottle = now;

        const cRadius = 10;
        const cursorBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - cRadius, e.point.y - cRadius],
          [e.point.x + cRadius, e.point.y + cRadius],
        ];

        const interactiveHoverLayers = [
          'resorts-outer-ring',
          'resorts-inner-dot',
          'resorts-labels',
          'resorts-heli-cat-ring',
          'resorts-heli-cat-dot',
          'resorts-heli-cat-labels',
          'selected-resort-pulse',
          'selected-resort-dot',
          'selected-resort-label',
          'global-clusters',
          'global-unclustered-outer-ring',
          'global-unclustered-point',
          'global-unclustered-label',
          'major-peaks-marker-tier1',
          'major-peaks-marker-tier2',
          'major-peaks-marker-tier3',
          'major-peaks-label',
          'fire-lookouts-marker-tier1',
          'fire-lookouts-marker-tier2',
          'fire-lookouts-marker-tier3',
          'fire-lookouts-label',
          'live-pistes-hit-target',
          'live-pistes-lifts-hit-target',
          'live-pistes-lines',
          'live-pistes-casing',
          'live-pistes-lifts',
          'live-pistes-labels',
          'live-pistes-lifts-labels',
          'live-pistes-polygons-labels',
        ].filter((id) => map.getLayer(id));

        const feats = map.queryRenderedFeatures(cursorBbox, { layers: interactiveHoverLayers });
        map.getCanvas().style.cursor = feats && feats.length > 0 ? 'pointer' : '';
      };

      map.on('mousemove', onMapMouseMove);
      map.on('mouseout', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapLoaded(true);
    });

    return () => {
      document.removeEventListener('gesturestart', onDocGesture as any);
      document.removeEventListener('gesturechange', onDocGesture as any);
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
    syncTrailFilterAndVisibility(mapRef.current, showDownhill, showNordic, showHeliCat, showTouring);
  }, [showDownhill, showNordic, showHeliCat, showTouring, mapLoaded]);

  /* =========================================================================
     MAP POINTS GPU FILTERING (Keeps map markers strictly in sync with filters)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    syncResortPointFilters(mapRef.current, {
      showDownhill,
      showNordic,
      showHeliCat,
      showTouring,
      effectiveMinVerticalFt,
      effectiveMinAcreage,
      effectiveMinNordicKm,
      selectedResort,
    });
  }, [showDownhill, showNordic, showHeliCat, showTouring, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, selectedResort, mapLoaded]);

  /* =========================================================================
     DYNAMIC MAP GEOJSON SOURCES FILTER SYNC
     Ensures clusters and map markers dynamically re-calculate counts on filter changes!
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    syncDynamicMapSources(mapRef.current, {
      allGlobalFeatures: allGlobalFeaturesRef.current,
      showDownhill,
      showNordic,
      showHeliCat,
      showTouring,
      effectiveMinVerticalFt,
      effectiveMinAcreage,
      effectiveMinNordicKm,
      selectedPasses,
      searchQuery,
    });
  }, [showDownhill, showNordic, showHeliCat, showTouring, effectiveMinVerticalFt, effectiveMinAcreage, effectiveMinNordicKm, selectedPasses, searchQuery, mapLoaded, resorts]);

  /* =========================================================================
     SELECTED RESORT PIN & TARGET RING
     Guarantees the selected resort/lodge location is always distinctly highlighted
     at every zoom level without disappearing.
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    updateSelectedResortPin(mapRef.current, selectedResort);
  }, [selectedResort, mapLoaded]);

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
      if (show3DTerrain && Number(terrainExaggeration) > 0) {
        try { map.setTerrain({ source: 'terrain-dem', exaggeration: Number(terrainExaggeration) }); } catch (_) {}
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
      if (show3DTerrain && Number(terrainExaggeration) > 0) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: Number(terrainExaggeration) });
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
        (basemapMode === 'osm' || basemapMode === 'carto') && showHillshade ? 'visible' : 'none'
      );
    }
  }, [showHillshade, basemapMode, mapLoaded]);

  /* =========================================================================
     BASEMAP STYLE TOGGLE
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Satellite (Standard)
    if (map.getLayer('basemap-satellite')) {
      map.setLayoutProperty('basemap-satellite', 'visibility', basemapMode === 'satellite' ? 'visible' : 'none');
    }
    // Satellite (Cloudless EOX)
    if (map.getLayer('basemap-cloudless')) {
      map.setLayoutProperty('basemap-cloudless', 'visibility', basemapMode === 'cloudless' ? 'visible' : 'none');
    }
    // OpenStreetMap Standard
    if (map.getLayer('basemap-osm')) {
      map.setLayoutProperty('basemap-osm', 'visibility', basemapMode === 'osm' ? 'visible' : 'none');
    }
    // Clean OSM (CARTO Voyager No-Labels)
    if (map.getLayer('basemap-carto')) {
      map.setLayoutProperty('basemap-carto', 'visibility', basemapMode === 'carto' ? 'visible' : 'none');
    }
    if (map.getLayer('hillshade-relief')) {
      map.setLayoutProperty(
        'hillshade-relief',
        'visibility',
        (basemapMode === 'osm' || basemapMode === 'carto') && showHillshade ? 'visible' : 'none'
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
    // Berann tint wash — only on satellite/cloudless
    if (map.getLayer('berann-tint-wash')) {
      map.setLayoutProperty(
        'berann-tint-wash',
        'visibility',
        (basemapMode === 'satellite' || basemapMode === 'cloudless') ? 'visible' : 'none'
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
    syncPeakLayers(mapRef.current, showPeaks, unitsMetric);
  }, [showPeaks, unitsMetric, mapLoaded]);

  /* =========================================================================
     FIRE LOOKOUTS & TOWERS
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    syncLookoutLayers(mapRef.current, showLookouts, unitsMetric, lookoutPopupRef);
  }, [showLookouts, unitsMetric, mapLoaded]);

  /* =========================================================================
     GEOGRAPHIC REFERENCE: BORDERS & PLACES (AUTO-CONTRAST BY BASEMAP)
     ========================================================================= */

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    syncGeoReferenceTheme(mapRef.current, showCountryOutlines, basemapMode);
  }, [showCountryOutlines, basemapMode, mapLoaded]);

  /* =========================================================================
     MODULAR 60 FPS KEYBOARD CAMERA FLIGHT SUBSYSTEM (WASD + QE + ARROW KEYS)
     ========================================================================= */

  useKeyboardFlight({
    map: mapRef.current,
    isLoaded: mapLoaded,
    onAltitudeChange: setCameraAltitudeMeters,
    onBearingChange: setMapBearing,
    onPitchChange: setMapPitch,
  });

  /* =========================================================================
     INGEST OPENSKIDATA & DEDUPLICATE AGAINST CURATED SEED RESORTS
     (Guarantees ZERO double names on the map!)
     ========================================================================= */

  useEffect(() => {
    let cancelled = false;
    const fetchGlobal = async () => {
      try {
        const { features, resorts: globalResorts, counts } = await fetchGlobalSkiAreas();
        if (cancelled) return;

        allGlobalFeaturesRef.current = features;
        globalFeaturesRef.current = features;
        setCategoryCounts(counts);

        setResorts((prev) => mergeResortsWithWeather(prev, globalResorts));

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
    const cur = mapRef.current.getZoom();
    (mapRef.current as any).easeTo({ zoom: Math.min(20.5, cur + 1), duration: 250, freezeElevation: true });
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;
    const cur = mapRef.current.getZoom();
    (mapRef.current as any).easeTo({ zoom: Math.max(1.0, cur - 1), duration: 250, freezeElevation: true });
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
      setMobileSheetState((prev) => (prev === 'full' ? 'full' : 'half'));
    }
    const resort = displayedResorts.find((r) => r.id === id) || resorts.find((r) => r.id === id);
    if (!resort || !mapRef.current) return;

    const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
    const leftPad = isMob ? 0 : (leftDockOpen ? 404 : 20);
    const rightPad = 0;
    const bottomPad = isMob ? 220 : 0;
    const topPad = 60;

    const isNordic = resort.category === 'nordic';
    const isHeliCat = resort.category === 'heli_cat';
    // Bearing: use resort's calibrated default_bearing (fall-line looking up from valley to peak)
    const bearing = isNordic ? 0 : (resort.default_bearing ?? (resort.lat < 0 ? 0 : 180));

    // Zoom: scale with both vertical drop and skiable acreage so sprawling resorts (Vail, Zermatt)
    // pull back appropriately, while maintaining an intimate, framed view of the ski network.
    let zoom: number;
    if (isNordic) {
      const km = Math.max(resort.trail_km || 20, 5);
      zoom = Math.max(11.0, Math.min(14.0, 13.8 - Math.log2(km / 10) * 0.65));
    } else if (isHeliCat) {
      // Heli/Cat operations have vast tenures centered on a remote lodge
      // Zoom 12.2 frames the lodge clearing/lake and surrounding alpine peaks perfectly
      zoom = 12.2;
    } else {
      const vert = Math.max(resort.vertical_drop_ft || 1500, 500);
      const acres = Math.max(resort.skiable_acres || 500, 200);
      zoom = Math.max(10.8, Math.min(14.5, 13.6 - Math.log2(vert / 1000) * 0.45 - Math.log2(acres / 1000) * 0.35));
    }

    // Midpoint calculation:
    // Curated flagships in GLOBAL_SKI_ATLAS have base lodge / village coordinates.
    // Advancing along default_bearing centers the physical mountain between base and summit.
    // Global ski areas & heli/cat operations are already centered on the lodge or mountain polygon centroid.
    let targetCenter: [number, number] = [resort.lng, resort.lat];
    if (!isNordic && !isHeliCat) {
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
    const pitch = isNordic ? 28 : (isHeliCat ? 42 : 46);

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
      setMobileSheetState((prev) => (prev === 'full' ? 'full' : 'half'));
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
    const isHeliCat = p.category === 'heli_cat';
    const bearing = isNordic ? 0 : (Number(p.default_bearing) || (coords[1] < 0 ? 0 : 180));

    let gZoom: number;
    if (isNordic) {
      const km = Math.max(p.trail_km || 20, 5);
      gZoom = Math.max(11.0, Math.min(14.0, 13.8 - Math.log2(km / 10) * 0.65));
    } else if (isHeliCat) {
      gZoom = 12.2;
    } else {
      const gVert = Math.max(p.vertical_ft || 1500, 500);
      const gAcres = Math.max(p.skiable_acres || 500, 200);
      gZoom = Math.max(10.8, Math.min(14.5, 13.6 - Math.log2(gVert / 1000) * 0.45 - Math.log2(gAcres / 1000) * 0.35));
    }

    const pitch = isNordic ? 28 : (isHeliCat ? 42 : 46);

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
      const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 900;
      const targetZoom = earthProjection === 'globe'
        ? computeGlobeFitZoom(winW, winH, isMob, leftDockOpen, DEFAULT_NORTH_AMERICA_CENTER[1], 0.84)
        : 1.8;
      const targetCenter: [number, number] = earthProjection === 'globe'
        ? DEFAULT_NORTH_AMERICA_CENTER
        : [12, 28];

      safeFlyTo(mapRef.current, {
        center: targetCenter,
        zoom: targetZoom,
        pitch: 0,
        bearing: 0,
        duration: 1400,
        essential: true,
      });
      setMapPitch(0);
      setMapBearing(0);
    }
  }, [handleDeselectTrail, earthProjection, leftDockOpen]);

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

  const handleToggleProjection = useCallback(() => {
    setEarthProjection((prev) => {
      const next = prev === 'globe' ? 'mercator' : 'globe';
      if (next === 'globe' && mapRef.current && mapRef.current.getZoom() < 5) {
        safeEaseTo(mapRef.current, { pitch: 0, duration: 400 });
        setMapPitch(0);
      }
      return next;
    });
  }, []);

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
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        unitsMetric={unitsMetric}
        onSetUnitsMetric={handleSetUnitsMetric}
        earthProjection={earthProjection}
        onToggleProjection={handleToggleProjection}
      />

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
            showTouring={showTouring}
            directoryScope={directoryScope}
            onScopeChange={setDirectoryScope}
            filteredResortsCount={filteredResorts.length}
            inViewResortsCount={inViewResorts.length}
            displayedResorts={displayedResorts}
            selectedResort={selectedResort}
            selectedResortId={selectedResortId}
            unitsMetric={unitsMetric}
            matchingPeaks={matchingPeaks}
            onSelectPeak={handleSelectPeak}
            matchingLookouts={matchingLookouts}
            onSelectLookout={handleSelectLookout}
            onSelectResort={handleSelectResort}
            onDeselectResort={handleDeselectResort}
            onViewProfile={() => setPanelView('profile')}
            activeFiltersCount={activeFiltersCount}
            onResetFilters={handleResetFilters}
            onToggleDownhill={() => setShowDownhill(!showDownhill)}
            onToggleNordic={() => setShowNordic(!showNordic)}
            onToggleHeliCat={() => setShowHeliCat(!showHeliCat)}
            onToggleTouring={() => setShowTouring(!showTouring)}
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
            showTouring={showTouring}
            directoryScope={directoryScope}
            onScopeChange={setDirectoryScope}
            filteredResortsCount={filteredResorts.length}
            inViewResortsCount={inViewResorts.length}
            displayedResorts={displayedResorts}
            selectedResort={selectedResort}
            selectedResortId={selectedResortId}
            unitsMetric={unitsMetric}
            matchingPeaks={matchingPeaks}
            onSelectPeak={handleSelectPeak}
            matchingLookouts={matchingLookouts}
            onSelectLookout={handleSelectLookout}
            onSelectResort={handleSelectResort}
            onDeselectResort={handleDeselectResort}
            onViewProfile={() => setPanelView('profile')}
            activeFiltersCount={activeFiltersCount}
            onResetFilters={handleResetFilters}
            onToggleDownhill={() => setShowDownhill(!showDownhill)}
            onToggleNordic={() => setShowNordic(!showNordic)}
            onToggleHeliCat={() => setShowHeliCat(!showHeliCat)}
            onToggleTouring={() => setShowTouring(!showTouring)}
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
          onFlyTo={(center, zoom, pitch, bearing) => {
            if (!mapRef.current) return;
            safeFlyTo(mapRef.current, {
              center,
              ...(zoom !== undefined ? { zoom } : {}),
              ...(pitch !== undefined ? { pitch } : {}),
              ...(bearing !== undefined ? { bearing } : {}),
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

      {/* FLOATING TOP-RIGHT CARTO & MAP SETTINGS */}
      <BasemapMenu
        mapMenuOpen={mapMenuOpen}
        onToggleMenu={() => {
          setMapMenuOpen(!mapMenuOpen);
          if (!mapMenuOpen) setLocatorOpen(false);
        }}
        onCloseMenu={() => setMapMenuOpen(false)}
        basemapMode={basemapMode}
        onSelectBasemap={setBasemapMode}
        earthProjection={earthProjection}
        onSelectProjection={(mode) => {
          setEarthProjection(mode);
          if (mode === 'globe' && mapRef.current && mapRef.current.getZoom() < 5) {
            safeEaseTo(mapRef.current, { pitch: 0, duration: 400 });
            setMapPitch(0);
          }
        }}
        showPeaks={showPeaks}
        onTogglePeaks={() => setShowPeaks((prev) => !prev)}
        showLookouts={showLookouts}
        onToggleLookouts={() => setShowLookouts((prev) => !prev)}
        showCountryOutlines={showCountryOutlines}
        onToggleCountryOutlines={() => setShowCountryOutlines((prev) => !prev)}
        showTouring={showTouring}
        onToggleTouring={() => setShowTouring((prev) => !prev)}
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

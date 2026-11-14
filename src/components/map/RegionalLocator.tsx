import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Compass, X } from 'lucide-react';
import type { SkiResort } from '../../types';
import { formatCoords } from '../../utils/formatters';

interface RegionalLocatorProps {
  locatorOpen: boolean;
  onToggleLocator: () => void;
  onCloseLocator: () => void;
  selectedResort: SkiResort | null;
  mapCenter: [number, number];
  mapZoom: number;
  mapBearing: number;
  viewportBounds: [number, number, number, number] | null;
  resorts: SkiResort[];
}

export const RegionalLocator: React.FC<RegionalLocatorProps> = ({
  locatorOpen,
  onToggleLocator,
  onCloseLocator,
  selectedResort,
  mapCenter,
  mapZoom,
  mapBearing,
  viewportBounds,
  resorts,
}) => {
  const [locatorZoomPreset, setLocatorZoomPreset] = useState<'regional' | 'continental' | 'global'>(() =>
    selectedResort || mapZoom >= 6.0 ? 'regional' : mapZoom < 3.0 ? 'global' : 'continental'
  );
  const locatorMenuRef = useRef<HTMLDivElement | null>(null);
  const locatorContainerRef = useRef<HTMLDivElement | null>(null);
  const locatorMapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const savedZoomRef = useRef<number | null>(null);
  const lastResortIdRef = useRef<string | null>(selectedResort?.id ?? null);

  // Inset zoom level mapping strictly decoupled from main 3D map
  // Region: 5.8 (surrounding cities & state/international borders)
  // Continent: 3.0 (continental context)
  // World: 0.5 (true global continental context)
  const getOverviewTargetZoom = useCallback((preset: 'regional' | 'continental' | 'global'): number => {
    return preset === 'regional' ? 5.8 : preset === 'continental' ? 3.0 : 0.5;
  }, []);

  // When selecting a new resort in the main application, auto-focus preset to regional
  useEffect(() => {
    const currentId = selectedResort?.id ?? null;
    if (currentId && currentId !== lastResortIdRef.current) {
      lastResortIdRef.current = currentId;
      setLocatorZoomPreset('regional');
      const targetZoom = 5.8;
      savedZoomRef.current = targetZoom;
      if (locatorMapRef.current) {
        locatorMapRef.current.easeTo({
          center: [selectedResort!.lng, selectedResort!.lat],
          zoom: targetZoom,
          bearing: 0,
          pitch: 0,
          duration: 350,
        });
      }
    } else {
      lastResortIdRef.current = currentId;
    }
  }, [selectedResort]);

  // When main map resets to global extent with no selection, auto-focus preset to global
  useEffect(() => {
    if (mapZoom < 2.5 && !selectedResort) {
      setLocatorZoomPreset('global');
      savedZoomRef.current = 0.5;
      if (locatorMapRef.current && locatorMapRef.current.getZoom() > 1.0) {
        locatorMapRef.current.easeTo({
          center: mapCenter,
          zoom: 0.5,
          bearing: 0,
          pitch: 0,
          duration: 350,
        });
      }
    }
  }, [mapZoom, selectedResort, mapCenter]);

  // Geographic context dynamically derived from live camera center
  const activeRegionContext = useMemo(() => {
    if (resorts && resorts.length > 0) {
      const [lng, lat] = mapCenter;
      let closest: SkiResort | null = null;
      let minDist = Infinity;
      for (const r of resorts) {
        const dLat = ((lat - r.lat) * Math.PI) / 180;
        const dLon = ((lng - r.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((r.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distKm < minDist) {
          minDist = distKm;
          closest = r;
        }
      }
      if (closest && minDist < 600) {
        return {
          region: closest.region || '',
          country: closest.country || '',
          name: minDist < 35 ? closest.name : `Near ${closest.name}`,
        };
      }
    }
    return {
      region: '',
      country: '',
      name: '',
    };
  }, [mapCenter, resorts]);

  const triggerLabel = useMemo(() => {
    if (selectedResort?.region) return selectedResort.region;
    if (activeRegionContext.region) return activeRegionContext.region;
    if (selectedResort?.country) return selectedResort.country;
    if (activeRegionContext.country) return activeRegionContext.country;
    return 'World Overview';
  }, [selectedResort, activeRegionContext]);

  const telemetryLocationString = useMemo(() => {
    if (selectedResort) {
      const parts = [selectedResort.name, selectedResort.region, selectedResort.country].filter(Boolean);
      return parts.slice(0, 2).join(', ');
    }
    if (activeRegionContext.name) {
      const parts = [activeRegionContext.name, activeRegionContext.region].filter(Boolean);
      return parts.join(', ');
    }
    if (activeRegionContext.region || activeRegionContext.country) {
      return [activeRegionContext.region, activeRegionContext.country].filter(Boolean).join(', ');
    }
    return 'World Overview';
  }, [selectedResort, activeRegionContext]);

  // Subtle 1px dashed outline visible ONLY in Region mode; hidden in Continent and World modes
  const getViewportGeoJson = useCallback((): any => {
    if (locatorZoomPreset !== 'regional' || !viewportBounds) {
      return { type: 'FeatureCollection', features: [] };
    }
    const [w, s, e, n] = viewportBounds;
    const south = Math.max(-85, Math.min(85, s));
    const north = Math.max(-85, Math.min(85, n));
    const west = Math.max(-180, Math.min(180, w));
    const east = Math.max(-180, Math.min(180, e));

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
          properties: {},
        },
      ],
    };
  }, [viewportBounds, locatorZoomPreset]);

  // Handle outside click and Escape key to close locator
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (locatorMenuRef.current && !locatorMenuRef.current.contains(event.target as Node)) {
        onCloseLocator();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseLocator();
      }
    };
    if (locatorOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [locatorOpen, onCloseLocator]);

  // Initialize and manage secondary 100% read-only 2D MapLibre instance
  useEffect(() => {
    if (!locatorOpen) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (locatorMapRef.current) {
        locatorMapRef.current.remove();
        locatorMapRef.current = null;
      }
      return;
    }

    if (!locatorContainerRef.current) return;

    const initialZoom = savedZoomRef.current ?? getOverviewTargetZoom(locatorZoomPreset);

    // Clean inline raster MapLibre style using Esri World_Topo_Map
    const esriTopoStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'esri-topo': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Esri',
        },
      },
      layers: [
        {
          id: 'esri-topo-layer',
          type: 'raster',
          source: 'esri-topo',
        },
      ],
    };

    // Strictly read-only MapLibre instance: interactive: false, locked North-Up at bearing: 0, pitch: 0
    const lmap = new maplibregl.Map({
      container: locatorContainerRef.current,
      style: esriTopoStyle,
      center: mapCenter,
      zoom: initialZoom,
      minZoom: 0,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: true,
      fadeDuration: 0,
    });

    lmap.on('error', (e) => {
      console.warn('RegionalLocator style notice:', e);
    });

    lmap.on('load', () => {
      // 1. Viewport bounds hollow frame: subtle 1px dashed outline visible only in Region mode
      lmap.addSource('locator-viewport', {
        type: 'geojson',
        data: getViewportGeoJson(),
      });
      lmap.addLayer({
        id: 'locator-viewport-line',
        type: 'line',
        source: 'locator-viewport',
        layout: {
          visibility: locatorZoomPreset === 'regional' ? 'visible' : 'none',
        },
        paint: {
          'line-color': '#2C2A27',
          'line-width': 1,
          'line-opacity': 0.45,
          'line-dasharray': [3, 2],
        },
      });

      // 2. Center Camera Position Target: 8px vermilion dot (#B84A39), 20px outer ring, 6px directional tick mark
      const markerEl = document.createElement('div');
      markerEl.className = 'locator-camera-marker';
      markerEl.style.width = '32px';
      markerEl.style.height = '32px';
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.pointerEvents = 'none';

      markerEl.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 32 32" style="overflow: visible; display: block;" xmlns="http://www.w3.org/2000/svg">
          <!-- 6px Directional Tick Mark pointing along camera bearing -->
          <g id="locator-direction-tick" transform="rotate(${mapBearing}, 16, 16)">
            <line x1="16" y1="6" x2="16" y2="0" stroke="#B84A39" stroke-width="2" stroke-linecap="round" />
          </g>
          <!-- 20px Outer Ring -->
          <circle cx="16" cy="16" r="10" fill="#B84A39" fill-opacity="0.10" stroke="#B84A39" stroke-width="1.5" />
          <!-- 8px Center Vermilion Dot with crisp white halo -->
          <circle cx="16" cy="16" r="4" fill="#B84A39" stroke="#FAF8F3" stroke-width="1.5" />
        </svg>
      `;

      const marker = new maplibregl.Marker({
        element: markerEl,
        anchor: 'center',
      })
        .setLngLat(mapCenter)
        .addTo(lmap);

      markerRef.current = marker;
      markerElRef.current = markerEl;
      locatorMapRef.current = lmap;

      setTimeout(() => {
        lmap.resize();
      }, 50);
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (locatorMapRef.current) {
        locatorMapRef.current.remove();
        locatorMapRef.current = null;
      }
    };
  }, [locatorOpen]);

  // Sync GeoJSON features in locator map (viewport dashed box)
  useEffect(() => {
    const lmap = locatorMapRef.current;
    if (!lmap || !locatorOpen || !lmap.isStyleLoaded()) return;

    const vpSource = lmap.getSource('locator-viewport') as maplibregl.GeoJSONSource | undefined;
    if (vpSource) {
      vpSource.setData(getViewportGeoJson());
    }
  }, [viewportBounds, locatorZoomPreset, locatorOpen, getViewportGeoJson]);

  // Sync camera position dot with live main map center
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat(mapCenter);
    }
  }, [mapCenter]);

  // Sync camera direction tick rotation with live main map bearing
  useEffect(() => {
    if (!markerElRef.current) return;
    const tickGroup = markerElRef.current.querySelector('#locator-direction-tick');
    if (tickGroup) {
      tickGroup.setAttribute('transform', `rotate(${mapBearing}, 16, 16)`);
    }
  }, [mapBearing]);

  // Sync locator map center with live camera center (locked North-Up at bearing: 0, pitch: 0)
  useEffect(() => {
    const lmap = locatorMapRef.current;
    if (!lmap || !locatorOpen) return;

    lmap.jumpTo({
      center: mapCenter,
      bearing: 0,
      pitch: 0,
    });
  }, [mapCenter, locatorOpen]);

  // User preset selection controls ONLY inset zoom, NEVER modifying main map camera
  const handleSetLocatorPreset = (preset: 'regional' | 'continental' | 'global') => {
    setLocatorZoomPreset(preset);
    const targetZoom = getOverviewTargetZoom(preset);
    savedZoomRef.current = targetZoom;

    if (locatorMapRef.current) {
      locatorMapRef.current.easeTo({
        center: mapCenter,
        zoom: targetZoom,
        bearing: 0,
        pitch: 0,
        duration: 300,
      });

      if (locatorMapRef.current.getLayer('locator-viewport-line')) {
        locatorMapRef.current.setLayoutProperty(
          'locator-viewport-line',
          'visibility',
          preset === 'regional' ? 'visible' : 'none'
        );
      }
    }
  };

  return (
    <div className="relative" ref={locatorMenuRef}>
      <button
        onClick={onToggleLocator}
        aria-expanded={locatorOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-0 ${
          locatorOpen
            ? 'invisible pointer-events-none'
            : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
        }`}
        title="Regional Overview & State/Country Context"
      >
        <Compass className="w-3.5 h-3.5 text-[#5C5852]" />
        <span className="text-xs font-semibold max-w-[140px] truncate">{triggerLabel}</span>
      </button>

      {locatorOpen && (
        <div className="absolute left-0 top-0 w-80 sm:w-88 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md shadow-xl overflow-hidden z-30 origin-top-left transition-all duration-200 animate-in fade-in-0 zoom-in-95">
          {/* Header: Title + Region | Continent | World pills + Close button */}
          <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <Compass className="w-3.5 h-3.5 text-[#5C5852] shrink-0" />
              <span className="text-xs font-bold text-[#1C1B18] tracking-tight truncate">
                {triggerLabel}
              </span>
            </div>

            {/* Quick Zoom Presets */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleSetLocatorPreset('regional')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer focus:outline-none focus:ring-0 ${
                  locatorZoomPreset === 'regional'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Region (5.8)"
              >
                Region
              </button>
              <button
                type="button"
                onClick={() => handleSetLocatorPreset('continental')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer focus:outline-none focus:ring-0 ${
                  locatorZoomPreset === 'continental'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Continent (3.0)"
              >
                Continent
              </button>
              <button
                type="button"
                onClick={() => handleSetLocatorPreset('global')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer focus:outline-none focus:ring-0 ${
                  locatorZoomPreset === 'global'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to World (0.5)"
              >
                World
              </button>
              <button
                type="button"
                onClick={onCloseLocator}
                className="p-1 rounded text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer ml-1 focus:outline-none focus:ring-0"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Telemetry Sub-Header: CAMERA VIEW · Location · Lat/Lng */}
          <div className="px-3 py-1.5 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between text-[10px] text-[#5C5852] font-medium tracking-tight">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2C2A27] shrink-0" />
              <span className="font-bold text-[#1C1B18] uppercase tracking-wider text-[9px] shrink-0">
                CAMERA VIEW
              </span>
              <span className="text-[#8A847C] shrink-0">·</span>
              <span className="truncate text-[#1C1B18] font-semibold">
                {telemetryLocationString}
              </span>
            </div>
            <div className="font-mono text-[9px] text-[#736E67] shrink-0 ml-2">
              {formatCoords(mapCenter[1], mapCenter[0])}
            </div>
          </div>

          {/* Read-Only MapLibre Inset Map Canvas */}
          <div className="relative w-full h-52 bg-[#FAF8F3] overflow-hidden select-none">
            <div ref={locatorContainerRef} className="w-full h-full pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
};

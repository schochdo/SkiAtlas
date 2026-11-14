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
  // Region: 6.5 (surrounding cities & state/international borders)
  // Continent: 3.4 (continental context)
  // World: 1.2 (global context)
  const getOverviewTargetZoom = useCallback((preset: 'regional' | 'continental' | 'global'): number => {
    return preset === 'regional' ? 6.5 : preset === 'continental' ? 3.4 : 1.2;
  }, []);

  // When selecting a new resort in the main application, auto-focus preset to regional
  useEffect(() => {
    const currentId = selectedResort?.id ?? null;
    if (currentId && currentId !== lastResortIdRef.current) {
      lastResortIdRef.current = currentId;
      setLocatorZoomPreset('regional');
      const targetZoom = 6.5;
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
      savedZoomRef.current = 1.2;
      if (locatorMapRef.current && locatorMapRef.current.getZoom() > 2.0) {
        locatorMapRef.current.easeTo({
          center: mapCenter,
          zoom: 1.2,
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

    const cartoApiKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CARTO_API_KEY) ||
      'cb1_27pq_1_05391dca080d5ca53cb5c122';
    const cartoStyleUrl = cartoApiKey
      ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?api_key=${cartoApiKey}`
      : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

    const initialZoom = savedZoomRef.current ?? getOverviewTargetZoom(locatorZoomPreset);

    // Strictly read-only MapLibre instance: interactive: false, locked North-Up at bearing: 0, pitch: 0
    const lmap = new maplibregl.Map({
      container: locatorContainerRef.current,
      style: cartoStyleUrl,
      center: mapCenter,
      zoom: initialZoom,
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
      // 1. Strip park clutter, enlarge city/state/country labels, and emphasize borders
      try {
        const layers = lmap.getStyle().layers || [];
        for (const layer of layers) {
          const id = layer.id;
          const type = layer.type;

          // Strip clutter: parks, nature reserves, POIs, minor roads, waterway labels
          const isClutter =
            id.includes('park') ||
            id.includes('poi') ||
            id.includes('waterway_label') ||
            id.includes('watername') ||
            id.includes('roadname') ||
            id.includes('road_') ||
            id.includes('tunnel_') ||
            id.includes('bridge_') ||
            id.includes('aeroway');

          if (isClutter) {
            try {
              lmap.setLayoutProperty(id, 'visibility', 'none');
            } catch (_) {}
            continue;
          }

          // Enlarge city, state, and country labels:
          const isPlaceSymbol =
            type === 'symbol' &&
            (id.includes('place_city') ||
              id.includes('place_town') ||
              id.includes('place_state') ||
              id.includes('place_country') ||
              id.includes('place_capital') ||
              id.includes('place_continent'));

          if (isPlaceSymbol) {
            try {
              const isCountry = id.includes('place_country') || id.includes('place_continent');
              const minSize = isCountry ? 13 : 12;
              const currentSize = lmap.getLayoutProperty(id, 'text-size');
              let newSize: any = minSize;

              if (currentSize && typeof currentSize === 'object' && 'stops' in (currentSize as any)) {
                const scaledStops = (currentSize as any).stops.map(([z, s]: [number, number]) => [
                  z,
                  Math.max(minSize, Math.round(s * 1.35)),
                ]);
                newSize = { stops: scaledStops };
              } else if (typeof currentSize === 'number') {
                newSize = Math.max(minSize, Math.round(currentSize * 1.35));
              }

              lmap.setLayoutProperty(id, 'text-size', newSize);
              lmap.setPaintProperty(id, 'text-color', '#1C1B18');
              lmap.setPaintProperty(id, 'text-halo-color', '#FAF8F3');
              lmap.setPaintProperty(id, 'text-halo-width', 2.2);

              if (isCountry) {
                lmap.setLayoutProperty(id, 'text-font', ['Montserrat Bold', 'Open Sans Bold', 'Noto Sans Regular']);
              }

              // Enable secondary cities and towns to be visible in regional scale (zoom 6.5)
              if (id.includes('place_town') || id.includes('place_city_r5') || id.includes('place_city_r6')) {
                try {
                  lmap.setLayerZoomRange(id, 5.5, 16);
                } catch (_) {}
              }
            } catch (_) {}
          }

          // Emphasize international and state borders:
          const isBoundary = type === 'line' && (id.includes('boundary') || id.includes('admin'));
          if (isBoundary) {
            try {
              const isCountryBorder = id.includes('country');
              if (isCountryBorder) {
                lmap.setPaintProperty(id, 'line-color', '#2C2A27');
                lmap.setPaintProperty(id, 'line-width', 1.8);
              } else {
                lmap.setPaintProperty(id, 'line-color', '#5C5852');
                lmap.setPaintProperty(id, 'line-width', 1.2);
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('Error styling locator layers:', err);
      }

      // 2. Viewport bounds hollow frame: subtle 1px dashed outline visible only in Region mode
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

      // 3. Center Camera Position Dot + 45° Directional View Cone
      const markerEl = document.createElement('div');
      markerEl.className = 'locator-camera-marker';
      markerEl.style.width = '48px';
      markerEl.style.height = '48px';
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.pointerEvents = 'none';

      markerEl.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" style="overflow: visible; display: block;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="locViewConeGrad" cx="24" cy="24" r="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#2C2A27" stop-opacity="0.38" />
              <stop offset="70%" stop-color="#2C2A27" stop-opacity="0.18" />
              <stop offset="100%" stop-color="#2C2A27" stop-opacity="0.04" />
            </radialGradient>
          </defs>
          <!-- 45° Directional View Cone (Rotated by camera bearing) -->
          <g id="locator-view-cone" transform="rotate(${mapBearing}, 24, 24)">
            <path
              d="M 24 24 L 14.82 1.83 A 24 24 0 0 1 33.18 1.83 Z"
              fill="url(#locViewConeGrad)"
              stroke="#2C2A27"
              stroke-width="1.2"
              stroke-opacity="0.75"
              stroke-linejoin="round"
            />
          </g>
          <!-- Center Camera Position Dot -->
          <circle cx="24" cy="24" r="6" fill="#2C2A27" fill-opacity="0.15" />
          <circle cx="24" cy="24" r="3.5" fill="#2C2A27" stroke="#FAF8F3" stroke-width="1.5" />
          <circle cx="24" cy="24" r="1" fill="#FAF8F3" />
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

  // Sync camera heading cone rotation with live main map bearing
  useEffect(() => {
    if (!markerElRef.current) return;
    const coneGroup = markerElRef.current.querySelector('#locator-view-cone');
    if (coneGroup) {
      coneGroup.setAttribute('transform', `rotate(${mapBearing}, 24, 24)`);
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
        className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
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
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'regional'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Region (6.5)"
              >
                Region
              </button>
              <button
                type="button"
                onClick={() => handleSetLocatorPreset('continental')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'continental'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Continent (3.4)"
              >
                Continent
              </button>
              <button
                type="button"
                onClick={() => handleSetLocatorPreset('global')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'global'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to World (1.2)"
              >
                World
              </button>
              <button
                type="button"
                onClick={onCloseLocator}
                className="p-1 rounded text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer ml-1"
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

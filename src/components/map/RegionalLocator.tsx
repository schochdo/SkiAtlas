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
      // 1. Add subtle AWS Terrarium hillshade relief underneath label layers
      try {
        if (!lmap.getSource('inset-dem')) {
          lmap.addSource('inset-dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          });
        }

        const layers = lmap.getStyle().layers || [];
        const firstWaterId = layers.find((l) => l.id.includes('water') && l.type === 'fill')?.id;

        if (!lmap.getLayer('inset-hillshade')) {
          lmap.addLayer(
            {
              id: 'inset-hillshade',
              type: 'hillshade',
              source: 'inset-dem',
              paint: {
                'hillshade-exaggeration': 0.45,
                'hillshade-shadow-color': '#6E7F8D',
                'hillshade-highlight-color': '#FFFFFF',
                'hillshade-illumination-direction': 315,
              },
            },
            firstWaterId
          );
        }

        // Set water fill to clean, flat muted slate (#DCE5EC) covering underwater bathymetry
        if (lmap.getLayer('water')) {
          lmap.setPaintProperty('water', 'fill-color', '#DCE5EC');
          lmap.setPaintProperty('water', 'fill-opacity', 1.0);
        }
        if (lmap.getLayer('water_shadow')) {
          lmap.setLayoutProperty('water_shadow', 'visibility', 'none');
        }
        if (lmap.getLayer('bathymetry')) {
          lmap.setLayoutProperty('bathymetry', 'visibility', 'none');
        }

        // 2. Hide minor local street lines and POI icons; keep highways, water bodies, and borders
        for (const layer of layers) {
          const id = layer.id;
          const isMinorClutter =
            id.includes('poi') ||
            id.includes('road_minor') ||
            id.includes('road_service') ||
            id.includes('road_path') ||
            id.includes('tunnel_minor') ||
            id.includes('tunnel_service') ||
            id.includes('tunnel_path') ||
            id.includes('bridge_minor') ||
            id.includes('bridge_service') ||
            id.includes('bridge_path') ||
            id.includes('roadname_minor') ||
            id.includes('housenumber') ||
            id.includes('water_shadow') ||
            id.includes('bathymetry');

          if (isMinorClutter) {
            try {
              lmap.setLayoutProperty(id, 'visibility', 'none');
            } catch (_) {}
            continue;
          }

          // Restore and cartographically style place labels so cities, towns, and states remain legible
          if (layer.type === 'symbol') {
            try {
              lmap.setLayoutProperty(id, 'visibility', 'visible');
            } catch (_) {}

            // Towns / villages (like Mammoth Lakes, Bishop, Crested Butte)
            if (id.includes('town') || id.includes('village') || id.includes('hamlet') || id.includes('suburbs')) {
              try {
                lmap.setPaintProperty(id, 'text-color', '#1C1B18');
                lmap.setPaintProperty(id, 'text-halo-color', '#FAF8F3');
                lmap.setPaintProperty(id, 'text-halo-width', 2);
                lmap.setLayoutProperty(id, 'text-size', 11);
                lmap.setLayerZoomRange(id, 4.5, 16);
              } catch (_) {}
            }
            // Major cities (like Reno, Fresno, Bakersfield, Denver, Salt Lake City)
            else if (id.includes('city') || id.includes('capital')) {
              try {
                lmap.setPaintProperty(id, 'text-color', '#1C1B18');
                lmap.setPaintProperty(id, 'text-halo-color', '#FAF8F3');
                lmap.setPaintProperty(id, 'text-halo-width', 2);
                lmap.setLayoutProperty(id, 'text-size', 13);
                lmap.setLayerZoomRange(id, 4.0, 16);
              } catch (_) {}
            }
            // States / countries (California, Nevada, Colorado)
            else if (id.includes('country') || id.includes('state') || id.includes('continent')) {
              try {
                lmap.setPaintProperty(id, 'text-color', '#1C1B18');
                lmap.setPaintProperty(id, 'text-halo-color', '#FAF8F3');
                lmap.setPaintProperty(id, 'text-halo-width', 2);
                lmap.setLayoutProperty(id, 'text-size', 12);
                lmap.setLayoutProperty(id, 'text-transform', 'uppercase');
              } catch (_) {}
            }
          }
        }

        // 3. Fix thick border & coastline strokes
        const maritimeFilter = ['!=', ['get', 'maritime'], 1];

        // Country borders: filter maritime lines, zoom-interpolated line-width, soft ink #6E6A63
        if (lmap.getLayer('boundary_country_inner')) {
          try {
            const curFilter = lmap.getFilter('boundary_country_inner');
            const hasMaritime = curFilter && JSON.stringify(curFilter).includes('maritime');
            if (!hasMaritime) {
              const newFilter = curFilter ? ['all', curFilter, maritimeFilter] : maritimeFilter;
              lmap.setFilter('boundary_country_inner', newFilter);
            }
          } catch (_) {}
          lmap.setPaintProperty('boundary_country_inner', 'line-color', '#6E6A63');
          lmap.setPaintProperty('boundary_country_inner', 'line-opacity', 0.85);
          lmap.setPaintProperty('boundary_country_inner', 'line-width', [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 0.5,
            4, 0.9,
            7, 1.3,
          ]);
        }

        if (lmap.getLayer('boundary_country_outline')) {
          try {
            const curFilter = lmap.getFilter('boundary_country_outline');
            const hasMaritime = curFilter && JSON.stringify(curFilter).includes('maritime');
            if (!hasMaritime) {
              const newFilter = curFilter ? ['all', curFilter, maritimeFilter] : maritimeFilter;
              lmap.setFilter('boundary_country_outline', newFilter);
            }
          } catch (_) {}
          lmap.setPaintProperty('boundary_country_outline', 'line-color', '#FAF8F3');
          lmap.setPaintProperty('boundary_country_outline', 'line-opacity', 0.35);
          lmap.setPaintProperty('boundary_country_outline', 'line-width', [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 0.8,
            4, 1.4,
            7, 2.0,
          ]);
        }

        // Internal state/province boundaries: hide when zoom < 4.5
        if (lmap.getLayer('boundary_state')) {
          try {
            lmap.setLayerZoomRange('boundary_state', 4.5, 24);
            const curFilter = lmap.getFilter('boundary_state');
            const hasMaritime = curFilter && JSON.stringify(curFilter).includes('maritime');
            if (!hasMaritime) {
              const newFilter = curFilter ? ['all', curFilter, maritimeFilter] : maritimeFilter;
              lmap.setFilter('boundary_state', newFilter);
            }
          } catch (_) {}
          lmap.setPaintProperty('boundary_state', 'line-color', '#8C857B');
          lmap.setPaintProperty('boundary_state', 'line-opacity', 0.45);
          lmap.setPaintProperty('boundary_state', 'line-width', [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.5, 0.5,
            7, 0.9,
          ]);
        }

        if (lmap.getLayer('boundary_county')) {
          try {
            lmap.setLayerZoomRange('boundary_county', 8.0, 24);
          } catch (_) {}
          lmap.setPaintProperty('boundary_county', 'line-color', '#8C857B');
          lmap.setPaintProperty('boundary_county', 'line-opacity', 0.3);
          lmap.setPaintProperty('boundary_county', 'line-width', 0.5);
        }

        // General pass across all line layers for boundaries and waterways/coastlines
        for (const layer of layers) {
          const id = layer.id;
          if (layer.type === 'line') {
            if (id.includes('boundary') || id.includes('admin')) {
              try {
                const curFilter = lmap.getFilter(id);
                const hasMaritime = curFilter && JSON.stringify(curFilter).includes('maritime');
                if (!hasMaritime) {
                  lmap.setFilter(id, curFilter ? ['all', curFilter, maritimeFilter] : maritimeFilter);
                }
              } catch (_) {}

              if (id.includes('state') || id.includes('province') || id.includes('county') || id.includes('sub')) {
                try {
                  lmap.setLayerZoomRange(id, 4.5, 24);
                } catch (_) {}
              }
            }

            if (
              id === 'waterway' ||
              id.includes('water_outline') ||
              id.includes('coastline') ||
              id.includes('water_line')
            ) {
              try {
                lmap.setPaintProperty(id, 'line-width', 0.5);
                lmap.setPaintProperty(id, 'line-color', '#9EB2C0');
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.warn('Error configuring locator atlas layers:', err);
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

      // 3. Center Camera Position Target: 8px vermilion dot (#B84A39), 20px outer ring, 6px directional tick mark
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

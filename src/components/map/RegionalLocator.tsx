import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Compass, X, RotateCcw } from 'lucide-react';
import type { SkiResort } from '../../types';
import { formatCoords } from '../../utils/formatters';

interface RegionalLocatorProps {
  locatorOpen: boolean;
  onToggleLocator: () => void;
  onCloseLocator: () => void;
  selectedResort: SkiResort | null;
  mapCenter: [number, number];
  mapZoom: number;
  viewportBounds: [number, number, number, number] | null;
  resorts: SkiResort[];
  onFlyTo: (center: [number, number]) => void;
  onResetToGlobal: (e: React.MouseEvent) => void;
}

export const RegionalLocator: React.FC<RegionalLocatorProps> = ({
  locatorOpen,
  onToggleLocator,
  onCloseLocator,
  selectedResort: _selectedResort,
  mapCenter,
  mapZoom,
  viewportBounds,
  resorts,
  onFlyTo,
  onResetToGlobal,
}) => {
  const [locatorZoomPreset, setLocatorZoomPreset] = useState<'regional' | 'continental' | 'global'>(() =>
    mapZoom >= 8.5 ? 'regional' : mapZoom < 3.5 ? 'global' : 'continental'
  );
  const locatorMenuRef = useRef<HTMLDivElement | null>(null);
  const locatorContainerRef = useRef<HTMLDivElement | null>(null);
  const locatorMapRef = useRef<maplibregl.Map | null>(null);

  // Automatically switch zoom preset based on main map zoom level (unpinned from selected resort)
  useEffect(() => {
    if (mapZoom < 3.5) {
      setLocatorZoomPreset('global');
    } else if (mapZoom >= 8.5) {
      setLocatorZoomPreset('regional');
    } else {
      setLocatorZoomPreset(prev => prev === 'global' ? 'continental' : prev);
    }
  }, [mapZoom]);

  // Geographic context for Regional Locator dynamically derived from live camera position
  const activeRegionContext = useMemo(() => {
    // Find closest resort to live camera center
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
    if (mapZoom >= 4 && activeRegionContext.region) {
      return activeRegionContext.region;
    }
    if (mapZoom >= 4 && activeRegionContext.country) {
      return activeRegionContext.country;
    }
    return 'Overview';
  }, [activeRegionContext, mapZoom]);

  const regionButtonLabel = useMemo(() => {
    if (mapZoom >= 4 && activeRegionContext.region) {
      return activeRegionContext.region;
    }
    if (mapZoom >= 4 && activeRegionContext.country) {
      return activeRegionContext.country;
    }
    return null;
  }, [mapZoom, activeRegionContext]);

  const getViewportGeoJson = useCallback((): any => {
    if (!viewportBounds) return { type: 'FeatureCollection', features: [] };
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
  }, [viewportBounds]);

  // Live camera center indicator GeoJSON
  const getCameraCenterGeoJson = useCallback((): any => {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [mapCenter[0], mapCenter[1]],
          },
          properties: {
            name: activeRegionContext.name || activeRegionContext.region || 'Camera View',
          },
        },
      ],
    };
  }, [mapCenter, activeRegionContext]);

  // Handle outside click and Escape key to close locator menu
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

  // Helper to determine optimal overview map center based on live camera center
  const getOverviewTargetCenter = useCallback((
    center: [number, number],
    preset: 'regional' | 'continental' | 'global'
  ): [number, number] => {
    const [targetLng, targetLat] = center;

    if (preset === 'regional') {
      return [targetLng, targetLat];
    }

    if (preset === 'continental') {
      if (mapZoom >= 4) {
        const balancedLat = Math.max(-45, Math.min(55, targetLat));
        return [targetLng, balancedLat];
      }
      // When at global scope with nothing selected, continental preset targets primary ski continents
      if (targetLng >= -170 && targetLng <= -50) return [-98, 40]; // North America
      if (targetLng >= 120 && targetLng <= 150) return [138, 38]; // Japan
      return [12, 48]; // Europe
    }

    // World / global view:
    // Center horizontally on targetLng, balanced latitude
    if (mapZoom >= 4) {
      const balancedLat = Math.max(-25, Math.min(48, targetLat));
      return [targetLng, balancedLat];
    }

    // Otherwise at global scope
    return [12, 28];
  }, [mapZoom]);

  // Helper to determine optimal overview map zoom
  const getOverviewTargetZoom = useCallback((
    preset: 'regional' | 'continental' | 'global'
  ): number => {
    return preset === 'regional' ? 5.5 : preset === 'continental' ? 3.0 : 1.1;
  }, []);

  // Initialize and manage secondary 2D MapLibre instance for Regional Locator
  useEffect(() => {
    if (!locatorOpen) {
      if (locatorMapRef.current) {
        locatorMapRef.current.remove();
        locatorMapRef.current = null;
      }
      return;
    }

    if (!locatorContainerRef.current) return;

    const initialCenter = getOverviewTargetCenter(mapCenter, locatorZoomPreset);
    const initialZoom = getOverviewTargetZoom(locatorZoomPreset);

    const lmap = new maplibregl.Map({
      container: locatorContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-topo-base': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri Topo',
          },
        },
        layers: [
          {
            id: 'esri-base-layer',
            type: 'raster',
            source: 'esri-topo-base',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      renderWorldCopies: true,
      fadeDuration: 0,
    });

    lmap.on('load', () => {
      // Add Viewport bounds layer
      lmap.addSource('locator-viewport', {
        type: 'geojson',
        data: getViewportGeoJson(),
      });
      lmap.addLayer({
        id: 'locator-viewport-fill',
        type: 'fill',
        source: 'locator-viewport',
        paint: {
          'fill-color': '#2C4C64',
          'fill-opacity': 0.15,
        },
      });
      lmap.addLayer({
        id: 'locator-viewport-line',
        type: 'line',
        source: 'locator-viewport',
        paint: {
          'line-color': '#2C4C64',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
      });

      // Add live camera center indicator layer (unpinned)
      lmap.addSource('locator-camera', {
        type: 'geojson',
        data: getCameraCenterGeoJson(),
      });
      lmap.addLayer({
        id: 'locator-camera-outer',
        type: 'circle',
        source: 'locator-camera',
        paint: {
          'circle-radius': 7,
          'circle-color': '#2C4C64',
          'circle-opacity': 0.25,
        },
      });
      lmap.addLayer({
        id: 'locator-camera-dot',
        type: 'circle',
        source: 'locator-camera',
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#2C4C64',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      locatorMapRef.current = lmap;
      // Immediately set center and zoom upon load completion
      const targetCenter = getOverviewTargetCenter(mapCenter, locatorZoomPreset);
      const targetZoom = getOverviewTargetZoom(locatorZoomPreset);
      lmap.jumpTo({ center: targetCenter, zoom: targetZoom });

      setTimeout(() => {
        lmap.resize();
      }, 50);
    });

    lmap.on('click', (e) => {
      onFlyTo([e.lngLat.lng, e.lngLat.lat]);
    });

    return () => {
      if (locatorMapRef.current) {
        locatorMapRef.current.remove();
        locatorMapRef.current = null;
      }
    };
  }, [locatorOpen]);

  // Sync GeoJSON features in locator map
  useEffect(() => {
    const lmap = locatorMapRef.current;
    if (!lmap || !locatorOpen || !lmap.isStyleLoaded()) return;

    const vpSource = lmap.getSource('locator-viewport') as maplibregl.GeoJSONSource | undefined;
    if (vpSource) {
      vpSource.setData(getViewportGeoJson());
    }

    const cSource = lmap.getSource('locator-camera') as maplibregl.GeoJSONSource | undefined;
    if (cSource) {
      cSource.setData(getCameraCenterGeoJson());
    }
  }, [viewportBounds, mapCenter, locatorOpen, getViewportGeoJson, getCameraCenterGeoJson]);

  // Sync center and zoom in locator map with live camera
  useEffect(() => {
    const lmap = locatorMapRef.current;
    if (!lmap || !locatorOpen) return;

    const targetCenter = getOverviewTargetCenter(mapCenter, locatorZoomPreset);
    const targetZoom = getOverviewTargetZoom(locatorZoomPreset);

    lmap.jumpTo({
      center: targetCenter,
      zoom: targetZoom,
    });
  }, [mapCenter, locatorZoomPreset, locatorOpen, getOverviewTargetCenter, getOverviewTargetZoom]);

  const handleSetLocatorPreset = (preset: 'regional' | 'continental' | 'global') => {
    setLocatorZoomPreset(preset);
    if (!locatorMapRef.current) return;
    const targetCenter = getOverviewTargetCenter(mapCenter, preset);
    const targetZoom = getOverviewTargetZoom(preset);
    locatorMapRef.current.easeTo({
      center: targetCenter,
      zoom: targetZoom,
      duration: 350,
    });
  };

  const handleLocatorZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!locatorMapRef.current) return;
    locatorMapRef.current.zoomIn({ duration: 200 });
  };

  const handleLocatorZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!locatorMapRef.current) return;
    locatorMapRef.current.zoomOut({ duration: 200 });
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
        <span className="text-xs font-semibold max-w-[140px] truncate">
          {triggerLabel}
        </span>
      </button>

      {locatorOpen && (
        <div className="absolute left-0 top-0 w-80 sm:w-88 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md shadow-xl overflow-hidden z-30 origin-top-left transition-all duration-200 animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <Compass className="w-3.5 h-3.5 text-[#5C5852] shrink-0" />
              <span className="text-xs font-bold text-[#1C1B18] tracking-tight truncate">
                {triggerLabel || 'Regional Overview'}
              </span>
            </div>
            {/* Quick Zoom Presets */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleSetLocatorPreset('regional')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'regional'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title={`Zoom to Regional / State Level${regionButtonLabel ? ` (${regionButtonLabel})` : ''}`}
              >
                Region
              </button>
              <button
                onClick={() => handleSetLocatorPreset('continental')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'continental'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Continental Level"
              >
                Continent
              </button>
              <button
                onClick={() => handleSetLocatorPreset('global')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  locatorZoomPreset === 'global'
                    ? 'bg-[#1C1B18] text-[#FAF8F3] border-[#1C1B18]'
                    : 'bg-[#FAF8F3] text-[#5C5852] hover:text-[#1C1B18] border-[#D6D0C2]'
                }`}
                title="Zoom to Global Level"
              >
                World
              </button>
              <button
                onClick={onCloseLocator}
                className="p-1 rounded text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer ml-1"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Location Context Banner: Live Camera Location and View Extent */}
          <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-[10px] uppercase font-bold text-[#736E67] tracking-wider leading-none flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2C4C64] shrink-0" />
                <span>Camera View</span>
              </div>
              <div className="font-bold text-xs text-[#1C1B18] break-words leading-tight mt-0.5">
                {mapZoom >= 4 && (activeRegionContext.region || activeRegionContext.country)
                  ? activeRegionContext.name
                    ? `${activeRegionContext.name}${activeRegionContext.region ? `, ${activeRegionContext.region}` : ''}`
                    : activeRegionContext.region && activeRegionContext.country
                    ? `${activeRegionContext.region}, ${activeRegionContext.country}`
                    : activeRegionContext.country
                  : 'World Overview'}
              </div>
            </div>
            <div className="text-right shrink-0">
              {mapZoom >= 4 && (activeRegionContext.region || activeRegionContext.country) ? (
                <div>
                  <span className="text-[10px] font-bold text-[#1C1B18] block break-words leading-tight max-w-[130px]">
                    {activeRegionContext.region ? `${activeRegionContext.region}, ` : ''}{activeRegionContext.country}
                  </span>
                  <span className="font-mono text-[9px] text-[#8A847C] block mt-0.5">
                    {formatCoords(mapCenter[1], mapCenter[0])}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] font-medium text-[#8A847C] block">
                    Global Extent
                  </span>
                  <span className="font-mono text-[9px] text-[#8A847C] block mt-0.5">
                    {formatCoords(mapCenter[1], mapCenter[0])}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MapLibre 2D Simple Basemap Canvas */}
          <div className="relative w-full h-48 bg-[#FAF8F3] overflow-hidden">
            <div ref={locatorContainerRef} className="w-full h-full" />
            {/* Micro Zoom Buttons on map */}
            <div className="absolute bottom-2 right-2 flex flex-col bg-[#FAF8F3] border border-[#D6D0C2] rounded shadow-xs divide-y divide-[#D6D0C2] overflow-hidden z-10">
              <button
                onClick={handleLocatorZoomIn}
                className="w-6 h-6 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] text-xs font-bold cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={handleLocatorZoomOut}
                className="w-6 h-6 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] text-xs font-bold cursor-pointer"
                title="Zoom Out"
              >
                −
              </button>
            </div>
          </div>

          {/* Footnote / Reset */}
          <div className="px-3 py-1.5 bg-[#FAF8F3] border-t border-[#D6D0C2] flex items-center justify-between text-[10px]">
            <span className="text-[#8A847C] truncate">
              Click map to center main view
            </span>
            <button
              onClick={(e) => {
                setLocatorZoomPreset('global');
                onResetToGlobal(e);
              }}
              className="flex items-center gap-1 font-semibold text-[#5C5852] hover:text-[#1C1B18] cursor-pointer"
              title="Reset main map to global extent"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset Global</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

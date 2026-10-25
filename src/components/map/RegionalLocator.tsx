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
  selectedResort,
  mapCenter,
  mapZoom,
  viewportBounds,
  resorts,
  onFlyTo,
  onResetToGlobal,
}) => {
  const [locatorZoomPreset, setLocatorZoomPreset] = useState<'regional' | 'continental' | 'global'>('regional');
  const locatorMenuRef = useRef<HTMLDivElement | null>(null);
  const locatorContainerRef = useRef<HTMLDivElement | null>(null);
  const locatorMapRef = useRef<maplibregl.Map | null>(null);

  // Geographic context for Regional Locator
  const activeRegionContext = useMemo(() => {
    if (selectedResort) {
      return {
        region: selectedResort.region || '',
        country: selectedResort.country || '',
        name: selectedResort.name,
      };
    }
    // Find closest resort within 600km of mapCenter
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
          name: `Near ${closest.name}`,
        };
      }
    }
    return {
      region: '',
      country: '',
      name: '',
    };
  }, [selectedResort, mapCenter, resorts]);

  const triggerLabel = useMemo(() => {
    if (selectedResort) {
      return selectedResort.region || selectedResort.country;
    }
    if (activeRegionContext.region) {
      return activeRegionContext.region;
    }
    if (activeRegionContext.country) {
      return activeRegionContext.country;
    }
    return 'Locator';
  }, [selectedResort, activeRegionContext]);

  const getViewportGeoJson = useCallback((): GeoJSON.FeatureCollection => {
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

  const getResortPinGeoJson = useCallback((): GeoJSON.FeatureCollection => {
    if (!selectedResort) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [selectedResort.lng, selectedResort.lat],
          },
          properties: { name: selectedResort.name },
        },
      ],
    };
  }, [selectedResort]);

  // Handle outside click to close locator menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locatorMenuRef.current && !locatorMenuRef.current.contains(event.target as Node)) {
        onCloseLocator();
      }
    };
    if (locatorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [locatorOpen, onCloseLocator]);

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

    const initialCenter: [number, number] = selectedResort
      ? [selectedResort.lng, selectedResort.lat]
      : mapCenter;

    const initialZoom = selectedResort
      ? 5.2
      : Math.max(1.8, Math.min(5.8, mapZoom - 6.5));

    const lmap = new maplibregl.Map({
      container: locatorContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-canvas-base': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri, HERE, Garmin',
          },
          'esri-canvas-ref': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri',
          },
        },
        layers: [
          {
            id: 'esri-base-layer',
            type: 'raster',
            source: 'esri-canvas-base',
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

      // Add Selected Resort Pin layer
      lmap.addSource('locator-resort', {
        type: 'geojson',
        data: getResortPinGeoJson(),
      });
      lmap.addLayer({
        id: 'locator-resort-outer',
        type: 'circle',
        source: 'locator-resort',
        paint: {
          'circle-radius': 9,
          'circle-color': '#B84A39',
          'circle-opacity': 0.3,
        },
      });
      lmap.addLayer({
        id: 'locator-resort-inner',
        type: 'circle',
        source: 'locator-resort',
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#B84A39',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FAF8F3',
        },
      });

      // Reference labels and state/national borders rendered over viewport
      lmap.addLayer({
        id: 'esri-ref-layer',
        type: 'raster',
        source: 'esri-canvas-ref',
        minzoom: 0,
        maxzoom: 20,
      });

      locatorMapRef.current = lmap;
      // Immediately set center and zoom upon load completion
      const targetCenter: [number, number] = selectedResort
        ? [selectedResort.lng, selectedResort.lat]
        : mapCenter;
      const targetZoom = selectedResort
        ? (locatorZoomPreset === 'regional' ? 5.2 : locatorZoomPreset === 'continental' ? 3.2 : 1.8)
        : (locatorZoomPreset === 'regional'
            ? Math.max(1.8, Math.min(5.8, mapZoom - 6.5))
            : locatorZoomPreset === 'continental'
            ? 3.2
            : 1.8);
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

    const rSource = lmap.getSource('locator-resort') as maplibregl.GeoJSONSource | undefined;
    if (rSource) {
      rSource.setData(getResortPinGeoJson());
    }
  }, [viewportBounds, selectedResort, locatorOpen, getViewportGeoJson, getResortPinGeoJson]);

  // Sync center and zoom in locator map
  useEffect(() => {
    const lmap = locatorMapRef.current;
    if (!lmap || !locatorOpen) return;

    const targetCenter: [number, number] = selectedResort
      ? [selectedResort.lng, selectedResort.lat]
      : mapCenter;

    const targetZoom = selectedResort
      ? (locatorZoomPreset === 'regional' ? 5.2 : locatorZoomPreset === 'continental' ? 3.2 : 1.8)
      : (locatorZoomPreset === 'regional'
          ? Math.max(1.8, Math.min(5.8, mapZoom - 6.5))
          : locatorZoomPreset === 'continental'
          ? 3.2
          : 1.8);

    lmap.easeTo({
      center: targetCenter,
      zoom: targetZoom,
      duration: 350,
    });
  }, [selectedResort, mapCenter, mapZoom, locatorZoomPreset, locatorOpen]);

  const handleSetLocatorPreset = (preset: 'regional' | 'continental' | 'global') => {
    setLocatorZoomPreset(preset);
    if (!locatorMapRef.current) return;
    const targetCenter: [number, number] = selectedResort
      ? [selectedResort.lng, selectedResort.lat]
      : mapCenter;
    const targetZoom = preset === 'regional' ? 5.2 : preset === 'continental' ? 3.2 : 1.8;
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
        className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
          locatorOpen
            ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-semibold'
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
        <div className="absolute left-0 top-10 w-80 sm:w-88 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md shadow-xl overflow-hidden z-30 animate-in fade-in duration-150">
          {/* Header */}
          <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 text-[#5C5852] shrink-0" />
              <span className="text-xs font-bold text-[#1C1B18] tracking-tight truncate">
                Regional Overview
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
                title="Zoom to State / Country Level"
              >
                State / Country
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
                onClick={onCloseLocator}
                className="p-1 rounded text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Location Context Banner: What Country or State are we in? */}
          <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-[10px] uppercase font-bold text-[#736E67] tracking-wider leading-none">
                Current Location
              </div>
              <div className="font-bold text-xs text-[#1C1B18] truncate mt-0.5">
                {activeRegionContext.region && activeRegionContext.country
                  ? `${activeRegionContext.region}, ${activeRegionContext.country}`
                  : activeRegionContext.country || activeRegionContext.region || 'Global Overview'}
              </div>
            </div>
            <div className="text-right shrink-0">
              {activeRegionContext.name ? (
                <span className="text-[10px] font-medium text-[#736E67] truncate block max-w-[120px]">
                  {activeRegionContext.name}
                </span>
              ) : (
                <span className="font-mono text-[9px] text-[#8A847C]">
                  {formatCoords(mapCenter[1], mapCenter[0])}
                </span>
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
              onClick={onResetToGlobal}
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

import React, { useRef, useEffect } from 'react';
import { Layers, X, Mountain } from 'lucide-react';
import type { BasemapMode, TerrainOverlayMode } from '../../types';

interface BasemapMenuProps {
  mapMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  basemapMode: BasemapMode;
  onSelectBasemap: (mode: BasemapMode) => void;
  showPeaks: boolean;
  onTogglePeaks: () => void;
  terrainExaggeration: number;
  onChangeTerrainExaggeration: (val: number) => void;
  terrainOverlay: TerrainOverlayMode;
  onSelectTerrainOverlay: (mode: TerrainOverlayMode) => void;
  terrainOverlayOpacity: number;
  onChangeTerrainOverlayOpacity: (val: number) => void;
}

export const BasemapMenu: React.FC<BasemapMenuProps> = ({
  mapMenuOpen,
  onToggleMenu,
  onCloseMenu,
  basemapMode,
  onSelectBasemap,
  showPeaks,
  onTogglePeaks,
  terrainExaggeration,
  onChangeTerrainExaggeration,
  terrainOverlay,
  onSelectTerrainOverlay,
  terrainOverlayOpacity,
  onChangeTerrainOverlayOpacity,
}) => {
  const basemapMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (basemapMenuRef.current && !basemapMenuRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };
    if (mapMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mapMenuOpen, onCloseMenu]);

  return (
    <div
      ref={basemapMenuRef}
      className="absolute top-14 right-3 md:right-4 z-20 flex items-center gap-2 transition-all duration-300 select-none"
    >
      <div className="relative">
        <button
          onClick={onToggleMenu}
          className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
            mapMenuOpen
              ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-semibold'
              : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
          }`}
          title="Basemap Styles & Earth Projection"
        >
          <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
          <span className="text-xs font-semibold">Basemap</span>
        </button>

        {mapMenuOpen && (
          <div className="absolute right-0 top-10 w-80 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md p-3.5 space-y-3 z-30 text-xs shadow-xl animate-in fade-in duration-150 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
                <span className="text-xs font-bold text-[#1C1B18] tracking-tight">
                  Cartographic Controls
                </span>
              </div>
              <button
                onClick={onCloseMenu}
                className="p-0.5 text-[#8A847C] hover:text-[#1C1B18] cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* BASEMAP STYLE SELECTION */}
            <div>
              <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider mb-1.5">
                Cartographic Base
              </div>
              <div className="space-y-1">
                {[
                  { id: 'satellite', label: 'Satellite 3D' },
                  { id: 'osm', label: 'OpenStreetMap' },
                  { id: 'topo', label: 'Alpine Topo' },
                ].map((item) => {
                  const isSelected = basemapMode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectBasemap(item.id as BasemapMode)}
                      className={`w-full flex items-center justify-between p-2 rounded-md border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                          : 'bg-[#F7F4ED] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4] font-medium'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isSelected && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#EAE5D9] text-[#1C1B18] border border-[#A8A299]">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MOUNTAIN SUMMITS (PEAKFINDER HORIZON LABELS) */}
            <div className="pt-2.5 border-t border-[#D6D0C2] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                  Horizon Summits
                </span>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                    showPeaks
                      ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299]'
                      : 'bg-[#F2EFE8] text-[#8A847C] border-[#D6D0C2]'
                  }`}
                >
                  {showPeaks ? 'Active' : 'Off'}
                </span>
              </div>
              <button
                type="button"
                onClick={onTogglePeaks}
                className={`w-full flex items-center justify-between p-2 rounded-md border text-xs transition-all cursor-pointer ${
                  showPeaks
                    ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                    : 'bg-[#F7F4ED] text-[#736E67] border-[#D6D0C2] hover:bg-[#EFECE4] hover:text-[#1C1B18] font-medium'
                }`}
                title="Toggle prominent mountain summits and elevations on the 3D horizon"
              >
                <div className="flex items-center gap-2">
                  <Mountain className="w-3.5 h-3.5 text-[#B84A39]" />
                  <span>Mountain Summits</span>
                </div>
                <span className="text-[10px] font-semibold text-[#5C5852]">
                  {showPeaks ? 'Visible' : 'Hidden'}
                </span>
              </button>
            </div>

            {/* TERRAIN ANALYSIS OVERLAYS (SLOPE & ASPECT) */}
            <div className="pt-2.5 border-t border-[#D6D0C2] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                  Terrain Overlays
                </span>
                {terrainOverlay !== 'none' && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#EAE5D9] text-[#1C1B18] border border-[#A8A299]">
                    {terrainOverlay === 'slope' ? 'Slope Active' : 'Aspect Active'}
                  </span>
                )}
              </div>

              {/* Segmented Toggles: None / Slope / Aspect */}
              <div className="grid grid-cols-3 gap-1 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => onSelectTerrainOverlay('none')}
                  className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                    terrainOverlay === 'none'
                      ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                      : 'text-[#736E67] hover:text-[#1C1B18]'
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTerrainOverlay('slope')}
                  className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                    terrainOverlay === 'slope'
                      ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                      : 'text-[#736E67] hover:text-[#1C1B18]'
                  }`}
                  title="CalTopo / Avalanche Grade Slope Incline (0° - 90°)"
                >
                  Slope Angle
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTerrainOverlay('aspect')}
                  className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                    terrainOverlay === 'aspect'
                      ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                      : 'text-[#736E67] hover:text-[#1C1B18]'
                  }`}
                  title="Compass Fall Line & Solar Exposure (N, E, S, W)"
                >
                  Aspect
                </button>
              </div>

              {/* Opacity Slider & Micro-Legend (when overlay is active) */}
              {terrainOverlay !== 'none' && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                      Overlay Opacity
                    </span>
                    <span className="text-xs font-bold text-[#1C1B18] tabular-nums">
                      {Math.round(terrainOverlayOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.0"
                    step="0.05"
                    value={terrainOverlayOpacity}
                    onChange={(e) => onChangeTerrainOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="Terrain overlay opacity"
                  />

                  {/* Micro-Legend */}
                  {terrainOverlay === 'slope' && (
                    <div className="pt-1.5 border-t border-[#E8E4DA] space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#5C5852] font-semibold">
                        <span>Slope Incline Key</span>
                        <span className="text-[9px] text-[#8A847C]">Avalanche Grade</span>
                      </div>
                      <div className="h-2 rounded-xs overflow-hidden flex shadow-2xs border border-[#D6D0C2]">
                        <div className="h-full bg-[#A0C850] flex-1" title="<27° Low / Mild" />
                        <div className="h-full bg-[#F5D13B] flex-1" title="27-30° Caution" />
                        <div className="h-full bg-[#E87722] flex-1" title="30-35° Prime Avalanche Release" />
                        <div className="h-full bg-[#D2232D] flex-1" title="35-40° Steep Release Zone" />
                        <div className="h-full bg-[#91143C] flex-1" title="40-45° Extreme Steep" />
                        <div className="h-full bg-[#4A154B] flex-1" title="45-60° Couloir / Cliff" />
                      </div>
                      <div className="flex justify-between text-[8.5px] text-[#736E67] font-medium px-0.5">
                        <span>&lt;27°</span>
                        <span>30°</span>
                        <span className="text-[#C82333] font-bold">35°</span>
                        <span>40°</span>
                        <span>45°+</span>
                      </div>
                    </div>
                  )}

                  {terrainOverlay === 'aspect' && (
                    <div className="pt-1.5 border-t border-[#E8E4DA] space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#5C5852] font-semibold">
                        <span>Compass Exposure Key</span>
                        <span className="text-[9px] text-[#8A847C]">Solar / Wind</span>
                      </div>
                      <div className="h-2 rounded-xs overflow-hidden flex shadow-2xs border border-[#D6D0C2]">
                        <div className="h-full bg-[#1E5FAF] flex-1" title="North (Cold / Shaded Powder)" />
                        <div className="h-full bg-[#00A896] flex-1" title="Northeast" />
                        <div className="h-full bg-[#41AA8C] flex-1" title="East (Morning Sun)" />
                        <div className="h-full bg-[#91BE6E] flex-1" title="Southeast" />
                        <div className="h-full bg-[#F5C84B] flex-1" title="South (Solar Warmth / Corn)" />
                        <div className="h-full bg-[#F5911E] flex-1" title="Southwest" />
                        <div className="h-full bg-[#EB5032] flex-1" title="West (Afternoon Sun)" />
                        <div className="h-full bg-[#6455A0] flex-1" title="Northwest" />
                      </div>
                      <div className="flex justify-between text-[8.5px] text-[#736E67] font-medium px-0.5">
                        <span className="text-[#1E5FAF] font-bold">N</span>
                        <span>E</span>
                        <span className="text-[#E87722] font-bold">S</span>
                        <span>W</span>
                        <span className="text-[#1E5FAF] font-bold">N</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3D TERRAIN RELIEF (DEM EXAGGERATION MULTIPLIER) */}
            <div className="pt-2.5 border-t border-[#D6D0C2] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                  Terrain Relief Multiplier
                </span>
                <span className="text-xs font-bold text-[#1C1B18] tabular-nums">
                  {terrainExaggeration.toFixed(2)}×
                </span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min="0"
                  max="2.5"
                  step="0.05"
                  value={terrainExaggeration}
                  onChange={(e) => onChangeTerrainExaggeration(parseFloat(e.target.value))}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="3D terrain relief vertical exaggeration multiplier"
                />

                {/* Preset Quick Toggles */}
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {[
                    { label: 'Flat (0×)', val: 0.0 },
                    { label: '0.7×', val: 0.7 },
                    { label: '1.0×', val: 1.0 },
                    { label: 'Alpine (2×)', val: 2.0 },
                  ].map((preset) => {
                    const isActive = Math.abs(terrainExaggeration - preset.val) < 0.04;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onChangeTerrainExaggeration(preset.val)}
                        className={`py-1 px-1 text-center rounded-[4px] border text-[10px] transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                            : 'bg-[#F7F4ED] text-[#5C5852] border-[#D6D0C2] hover:bg-[#EFECE4] hover:text-[#1C1B18] font-medium'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

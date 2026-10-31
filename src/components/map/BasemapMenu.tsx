import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Menu, X, Layers, Mountain, Globe, MapPin } from 'lucide-react';
import type { BasemapMode, TerrainOverlayMode } from '../../types';

interface BasemapMenuProps {
  mapMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  basemapMode: BasemapMode;
  onSelectBasemap: (mode: BasemapMode) => void;
  showPeaks: boolean;
  onTogglePeaks: () => void;
  showCountryOutlines: boolean;
  onToggleCountryOutlines: () => void;
  showMajorCities: boolean;
  onToggleMajorCities: () => void;
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
  showCountryOutlines,
  onToggleCountryOutlines,
  showMajorCities,
  onToggleMajorCities,
  terrainExaggeration,
  onChangeTerrainExaggeration,
  terrainOverlay,
  onSelectTerrainOverlay,
  terrainOverlayOpacity,
  onChangeTerrainOverlayOpacity,
}) => {
  const basemapMenuRef = useRef<HTMLDivElement | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const hoverOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect coarse pointer or touch screen (iPad, phone, tablet)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isCoarse || (hasTouch && !window.matchMedia('(pointer: fine)').matches));
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsSticky(false);
    setIsHovered(false);
    if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    onCloseMenu();
  }, [onCloseMenu]);

  // Click/tap outside and Escape key handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (basemapMenuRef.current && !basemapMenuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (mapMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mapMenuOpen, handleClose]);

  // If menu is closed externally, reset sticky and hover state
  useEffect(() => {
    if (!mapMenuOpen) {
      setIsSticky(false);
      setIsHovered(false);
      if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    }
  }, [mapMenuOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);

    if (mapMenuOpen && isSticky) {
      handleClose();
    } else {
      setIsSticky(true);
      setIsHovered(true);
      if (!mapMenuOpen) {
        onToggleMenu();
      }
    }
  };

  const handleMouseEnter = () => {
    if (isTouchDevice) return;
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    setIsHovered(true);

    if (!mapMenuOpen && !isSticky) {
      hoverOpenTimeoutRef.current = setTimeout(() => {
        onToggleMenu();
      }, 120);
    }
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);

    if (!isSticky) {
      leaveTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
        if (mapMenuOpen) {
          onCloseMenu();
        }
      }, 200);
    }
  };

  return (
    <div
      ref={basemapMenuRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute top-14 right-3 md:right-4 z-20 flex items-center select-none"
    >
      <div className="relative group">
        <button
          onClick={handleButtonClick}
          className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs ${
            mapMenuOpen
              ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
              : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
          } ${
            isTouchDevice || mapMenuOpen || isHovered
              ? 'opacity-100'
              : 'max-md:opacity-100 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100'
          }`}
          title={mapMenuOpen ? 'Close Cartographic Controls' : 'Basemap Styles & Cartographic Controls'}
          aria-label={mapMenuOpen ? 'Close Cartographic Controls' : 'Basemap Styles & Cartographic Controls'}
          aria-expanded={mapMenuOpen}
        >
          {mapMenuOpen ? (
            <X className="w-4 h-4 text-[#1C1B18]" />
          ) : (
            <Menu className="w-4 h-4 text-[#5C5852]" />
          )}
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
                onClick={handleClose}
                className="p-1 rounded text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close"
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

            {/* GEOGRAPHIC REFERENCE (COUNTRY BOUNDARIES & MAJOR CITIES) */}
            <div className="pt-2.5 border-t border-[#D6D0C2] space-y-2">
              <div className="text-[10px] uppercase text-[#8A847C] font-semibold tracking-wider">
                Geographic Reference
              </div>
              <div className="space-y-1">
                {/* Country Outlines Toggle */}
                <button
                  type="button"
                  onClick={onToggleCountryOutlines}
                  className={`w-full flex items-center justify-between p-2 rounded-md border text-xs transition-all cursor-pointer ${
                    showCountryOutlines
                      ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                      : 'bg-[#F7F4ED] text-[#736E67] border-[#D6D0C2] hover:bg-[#EFECE4] hover:text-[#1C1B18] font-medium'
                  }`}
                  title="Toggle international political boundaries and country names"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#2C4C64]" />
                    <span>Country Outlines</span>
                  </div>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                      showCountryOutlines
                        ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299]'
                        : 'bg-[#F2EFE8] text-[#8A847C] border-[#D6D0C2]'
                    }`}
                  >
                    {showCountryOutlines ? 'Active' : 'Off'}
                  </span>
                </button>

                {/* Major Cities Toggle */}
                <button
                  type="button"
                  onClick={onToggleMajorCities}
                  className={`w-full flex items-center justify-between p-2 rounded-md border text-xs transition-all cursor-pointer ${
                    showMajorCities
                      ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs font-bold'
                      : 'bg-[#F7F4ED] text-[#736E67] border-[#D6D0C2] hover:bg-[#EFECE4] hover:text-[#1C1B18] font-medium'
                  }`}
                  title="Toggle major world cities, regional capitals, and ski gateway hubs"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#B84A39]" />
                    <span>Major Cities</span>
                  </div>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                      showMajorCities
                        ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299]'
                        : 'bg-[#F2EFE8] text-[#8A847C] border-[#D6D0C2]'
                    }`}
                  >
                    {showMajorCities ? 'Active' : 'Off'}
                  </span>
                </button>
              </div>
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

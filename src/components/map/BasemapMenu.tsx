import React, { useRef, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import type { BasemapMode } from '../../types';

interface BasemapMenuProps {
  mapMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  basemapMode: BasemapMode;
  onSelectBasemap: (mode: BasemapMode) => void;
  terrainExaggeration: number;
  onChangeTerrainExaggeration: (val: number) => void;
}

export const BasemapMenu: React.FC<BasemapMenuProps> = ({
  mapMenuOpen,
  onToggleMenu,
  onCloseMenu,
  basemapMode,
  onSelectBasemap,
  terrainExaggeration,
  onChangeTerrainExaggeration,
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

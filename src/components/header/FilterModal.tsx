import React from 'react';
import { Sliders, X, Globe, Layers } from 'lucide-react';
import type { EarthProjectionMode, PassNetwork } from '../../types';
import { PASS_COLORS, PASS_DISPLAY_NAMES, PASS_SHORT_LABELS } from '../../utils/classification';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFiltersCount: number;
  onResetFilters: () => void;
  earthProjection: EarthProjectionMode;
  onSelectProjection: (mode: EarthProjectionMode) => void;
  unitsMetric: boolean;
  onSetUnitsMetric: (toMetric: boolean) => void;
  filteredCount: number;
  showDownhill: boolean;
  onToggleDownhill: () => void;
  showNordic: boolean;
  onToggleNordic: () => void;
  showHeliCat: boolean;
  onToggleHeliCat: () => void;
  categoryFilterCounts: { downhill: number; nordic: number; heli_cat: number };
  selectedPasses: PassNetwork[];
  onTogglePass: (pass: PassNetwork) => void;
  onSetAllPasses: () => void;
  onClearPasses: () => void;
  minVerticalM: number;
  onChangeMinVerticalM: (v: number) => void;
  minVerticalFt: number;
  onChangeMinVerticalFt: (v: number) => void;
  minAreaHa: number;
  onChangeMinAreaHa: (v: number) => void;
  minAreaAcres: number;
  onChangeMinAreaAcres: (v: number) => void;
  minNordicKm: number;
  onChangeMinNordicKm: (v: number) => void;
  minNordicMi: number;
  onChangeMinNordicMi: (v: number) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  activeFiltersCount,
  onResetFilters,
  earthProjection,
  onSelectProjection,
  unitsMetric,
  onSetUnitsMetric,
  filteredCount,
  showDownhill,
  onToggleDownhill,
  showNordic,
  onToggleNordic,
  showHeliCat,
  onToggleHeliCat,
  categoryFilterCounts,
  selectedPasses,
  onTogglePass,
  onSetAllPasses,
  onClearPasses,
  minVerticalM,
  onChangeMinVerticalM,
  minVerticalFt,
  onChangeMinVerticalFt,
  minAreaHa,
  onChangeMinAreaHa,
  minAreaAcres,
  onChangeMinAreaAcres,
  minNordicKm,
  onChangeMinNordicKm,
  minNordicMi,
  onChangeMinNordicMi,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-3 top-13 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-92 max-h-[calc(100vh-70px)] sm:max-h-[calc(100vh-64px)] overflow-y-auto bg-[#FAF8F3] border border-[#D6D0C2] rounded-lg shadow-xl p-3.5 z-50 text-[#1C1B18] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#D6D0C2]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#5C5852]" />
          <span className="font-bold text-sm text-[#1C1B18] tracking-tight">Display & Filters</span>
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={onResetFilters}
              className="text-[#B84A39] hover:underline cursor-pointer text-xs font-bold"
            >
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#EFECE4] text-[#8A847C] hover:text-[#1C1B18] rounded-md transition-colors cursor-pointer"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Display Settings Section */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold text-[#5C5852] uppercase tracking-wider">
          Display
        </div>

        {/* Projection Segmented */}
        <div className="space-y-1">
          <div className="text-xs text-[#5C5852] font-medium">Earth Projection</div>
          <div className="grid grid-cols-2 gap-1 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md p-0.5">
            <button
              onClick={() => onSelectProjection('globe')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                earthProjection === 'globe'
                  ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title="3D Globe Projection"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Globe</span>
            </button>
            <button
              onClick={() => onSelectProjection('mercator')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                earthProjection === 'mercator'
                  ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title="Flat Map Projection"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flat Map</span>
            </button>
          </div>
        </div>

        {/* Unit System Segmented */}
        <div className="space-y-1">
          <div className="text-xs text-[#5C5852] font-medium">Units of Measure</div>
          <div className="grid grid-cols-2 gap-1 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md p-0.5">
            <button
              onClick={() => onSetUnitsMetric(false)}
              className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                !unitsMetric
                  ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title="Imperial Units (ft, in, °F)"
            >
              Imperial (ft, in, °F)
            </button>
            <button
              onClick={() => onSetUnitsMetric(true)}
              className={`py-1.5 px-2 rounded-[4px] text-xs font-bold transition-all cursor-pointer text-center ${
                unitsMetric
                  ? 'bg-[#FAF8F3] text-[#1C1B18] border border-[#A8A299] shadow-2xs'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title="Metric Units (m, cm, °C)"
            >
              Metric (m, cm, °C)
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#D6D0C2]" />

      {/* Resort Filters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#5C5852] uppercase tracking-wider">
            Resort Filters
          </span>
          <span className="text-xs text-[#736E67] font-semibold tabular-nums">
            {filteredCount.toLocaleString()} matching
          </span>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={onToggleDownhill}
            className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
              showDownhill
                ? 'bg-[#3B627E]/10 border-[#3B627E] text-[#3B627E] shadow-2xs'
                : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
            }`}
            title={`Toggle Downhill Ski Areas (${categoryFilterCounts.downhill.toLocaleString()})`}
          >
            <span className="truncate">⛷️ Downhill</span>
          </button>
          <button
            onClick={onToggleNordic}
            className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
              showNordic
                ? 'bg-[#2E5A44]/10 border-[#2E5A44] text-[#2E5A44] shadow-2xs'
                : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
            }`}
            title={`Toggle Nordic Centers (${categoryFilterCounts.nordic.toLocaleString()})`}
          >
            <span className="truncate">🎿 Nordic</span>
          </button>
          <button
            onClick={onToggleHeliCat}
            className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
              showHeliCat
                ? 'bg-[#B84A39]/10 border-[#B84A39] text-[#B84A39] shadow-2xs'
                : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C] opacity-75 hover:opacity-100'
            }`}
            title={`Toggle Guided Heli/Cat Operations (${categoryFilterCounts.heli_cat.toLocaleString()})`}
          >
            <span className="truncate">🚁 Heli/Cat</span>
          </button>
        </div>

        {/* Pass Networks */}
        <div className="space-y-1.5 pt-1 border-t border-[#D6D0C2]">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-[#4A463F] font-semibold">Pass Networks</span>
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={onSetAllPasses}
                className="text-[#5C5852] hover:text-[#1C1B18] hover:underline cursor-pointer font-medium"
              >
                All
              </button>
              <span className="text-[#D6D0C2]">·</span>
              <button
                onClick={onClearPasses}
                className="text-[#5C5852] hover:text-[#1C1B18] hover:underline cursor-pointer font-medium"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'] as PassNetwork[]).map((pass) => {
              const active = selectedPasses.includes(pass);
              const color = PASS_COLORS[pass];
              const label = PASS_SHORT_LABELS[pass] || pass;
              return (
                <button
                  key={pass}
                  onClick={() => onTogglePass(pass)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-[#FAF8F3] border-[#1C1B18] text-[#1C1B18] shadow-2xs'
                      : 'bg-[#F2EFE8] border-[#D6D0C2] text-[#8A847C] opacity-60 hover:opacity-100'
                  }`}
                  title={PASS_DISPLAY_NAMES[pass] || `Filter by ${label}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Downhill Sliders */}
        {showDownhill && (
          <>
            {/* Min Vertical Drop Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[12.5px] text-[#4A463F] font-semibold">Min Vertical Drop</span>
                <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                  {unitsMetric
                    ? (minVerticalM > 0 ? `${minVerticalM.toLocaleString()} m` : 'Any')
                    : (minVerticalFt > 0 ? `${minVerticalFt.toLocaleString()}'` : 'Any')}
                </span>
              </div>
              {unitsMetric ? (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="1500"
                    step="50"
                    value={minVerticalM}
                    onChange={(e) => onChangeMinVerticalM(Number(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="Minimum vertical drop filter in meters"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                    <span>Any</span>
                    <span>300m</span>
                    <span>600m</span>
                    <span>1,000m</span>
                    <span>1,500m</span>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="4000"
                    step="100"
                    value={minVerticalFt}
                    onChange={(e) => onChangeMinVerticalFt(Number(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="Minimum vertical drop filter in feet"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                    <span>Any</span>
                    <span>1,000'</span>
                    <span>2,000'</span>
                    <span>3,000'</span>
                    <span>4,000'</span>
                  </div>
                </div>
              )}
            </div>

            {/* Min Skiable Area Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[12.5px] text-[#4A463F] font-semibold">
                  {unitsMetric ? 'Min Skiable Area' : 'Min Skiable Acres'}
                </span>
                <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                  {unitsMetric
                    ? (minAreaHa > 0 ? `${minAreaHa.toLocaleString()} ha` : 'Any')
                    : (minAreaAcres > 0 ? `${minAreaAcres.toLocaleString()} ac` : 'Any')}
                </span>
              </div>
              {unitsMetric ? (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="1200"
                    step="25"
                    value={minAreaHa}
                    onChange={(e) => onChangeMinAreaHa(Number(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="Minimum skiable area filter in hectares"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                    <span>Any</span>
                    <span>200 ha</span>
                    <span>500 ha</span>
                    <span>800 ha</span>
                    <span>1,200 ha</span>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="100"
                    value={minAreaAcres}
                    onChange={(e) => onChangeMinAreaAcres(Number(e.target.value))}
                    className="w-full tufte-slider cursor-pointer"
                    aria-label="Minimum skiable acreage filter in acres"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                    <span>Any</span>
                    <span>500 ac</span>
                    <span>1,000 ac</span>
                    <span>2,000 ac</span>
                    <span>3,000 ac</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Nordic Network Slider */}
        {showNordic && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[12.5px] text-[#4A463F] font-semibold">
                {showDownhill ? 'Min Nordic Network' : 'Min Trail Network'}
              </span>
              <span className="text-[13.5px] text-[#1C1B18] font-bold tabular-nums">
                {unitsMetric
                  ? (minNordicKm > 0 ? `${minNordicKm} km` : 'Any')
                  : (minNordicMi > 0 ? `${minNordicMi} mi` : 'Any')}
              </span>
            </div>
            {unitsMetric ? (
              <div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minNordicKm}
                  onChange={(e) => onChangeMinNordicKm(Number(e.target.value))}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum nordic trail network filter in kilometers"
                />
                <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                  <span>Any</span>
                  <span>25 km</span>
                  <span>50 km</span>
                  <span>75 km</span>
                  <span>100 km</span>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={minNordicMi}
                  onChange={(e) => onChangeMinNordicMi(Number(e.target.value))}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum nordic trail network filter in miles"
                />
                <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                  <span>Any</span>
                  <span>15 mi</span>
                  <span>30 mi</span>
                  <span>45 mi</span>
                  <span>60 mi</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

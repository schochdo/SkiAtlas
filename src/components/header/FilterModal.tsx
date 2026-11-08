import React from 'react';
import type { EarthProjectionMode, PassNetwork } from '../../types';
import { PASS_COLORS, PASS_DISPLAY_NAMES, PASS_SHORT_LABELS } from '../../utils/classification';

export interface FilterPanelProps {
  activeFiltersCount: number;
  onResetFilters: () => void;
  earthProjection?: EarthProjectionMode;
  onSelectProjection?: (mode: EarthProjectionMode) => void;
  unitsMetric?: boolean;
  onSetUnitsMetric?: (toMetric: boolean) => void;
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

// Active pass styles with soft, desaturated background tint, low-contrast border, and matching colored dot
const PASS_ACTIVE_STYLES: Record<PassNetwork, { bg: string; border: string; dot: string; text: string }> = {
  Ikon: {
    bg: 'bg-[#B84A39]/10',
    border: 'border-[#B84A39]/30',
    dot: '#B84A39',
    text: 'text-[#8C2C1D]',
  },
  Epic: {
    bg: 'bg-[#2E5A44]/10',
    border: 'border-[#2E5A44]/30',
    dot: '#2E5A44',
    text: 'text-[#1E4331]',
  },
  'Mountain Collective': {
    bg: 'bg-[#2B5B84]/10',
    border: 'border-[#2B5B84]/30',
    dot: '#2B5B84',
    text: 'text-[#1F4567]',
  },
  Indy: {
    bg: 'bg-[#C2842F]/12',
    border: 'border-[#C2842F]/30',
    dot: '#C2842F',
    text: 'text-[#8F5B15]',
  },
  Independent: {
    bg: 'bg-[#8A847C]/12',
    border: 'border-[#8A847C]/30',
    dot: '#8A847C',
    text: 'text-[#4A463F]',
  },
};

// Generates visible blue active track fill (#2B5B84) from the thumb to the end (minimum threshold range)
const getSliderTrackBackground = (val: number, max: number): string => {
  if (val <= 0) return '#D6D3CD';
  const pct = Math.min(100, Math.max(0, (val / max) * 100));
  return `linear-gradient(to right, #D6D3CD 0%, #D6D3CD ${pct}%, #2B5B84 ${pct}%, #2B5B84 100%)`;
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  unitsMetric,
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
  return (
    <div className="space-y-3.5 text-[#1C1B18]">
      {/* Category Segmented Controls (Compact icons, clear active/inactive states) */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={onToggleDownhill}
          className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showDownhill
              ? 'bg-[#2B5B84]/15 border-[#2B5B84] text-[#2B5B84] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D3CD] text-[#8A847C] opacity-75 hover:opacity-100 hover:text-[#5C5852]'
          }`}
          title={`Toggle Downhill Ski Areas (${categoryFilterCounts.downhill.toLocaleString()})`}
        >
          <span className={`text-xs ${showDownhill ? '' : 'opacity-50 grayscale'}`}>⛷️</span>
          <span className="truncate">Downhill</span>
        </button>
        <button
          onClick={onToggleNordic}
          className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showNordic
              ? 'bg-[#2E5A44]/15 border-[#2E5A44] text-[#2E5A44] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D3CD] text-[#8A847C] opacity-75 hover:opacity-100 hover:text-[#5C5852]'
          }`}
          title={`Toggle Nordic Centers (${categoryFilterCounts.nordic.toLocaleString()})`}
        >
          <span className={`text-xs ${showNordic ? '' : 'opacity-50 grayscale'}`}>🎿</span>
          <span className="truncate">Nordic</span>
        </button>
        <button
          onClick={onToggleHeliCat}
          className={`py-2 px-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showHeliCat
              ? 'bg-[#B84A39]/15 border-[#B84A39] text-[#B84A39] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D3CD] text-[#8A847C] opacity-75 hover:opacity-100 hover:text-[#5C5852]'
          }`}
          title={`Toggle Guided Heli/Cat Operations (${categoryFilterCounts.heli_cat.toLocaleString()})`}
        >
          <span className={`text-xs ${showHeliCat ? '' : 'opacity-50 grayscale'}`}>🚁</span>
          <span className="truncate">Heli/Cat</span>
        </button>
      </div>

      {/* Pass Networks (Low-contrast borders, soft tinted backgrounds for active, gray for inactive) */}
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
            const style = PASS_ACTIVE_STYLES[pass];
            const label = PASS_SHORT_LABELS[pass] || pass;
            return (
              <button
                key={pass}
                onClick={() => onTogglePass(pass)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? `${style.bg} ${style.border} ${style.text} shadow-2xs`
                    : 'bg-[#FAF8F3] border-[#E2DDD5] text-[#8A847C] hover:text-[#5C5852] hover:border-[#D6D0C2]'
                }`}
                title={PASS_DISPLAY_NAMES[pass] || `Filter by ${label}`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}
                  style={{ backgroundColor: active ? style.dot : '#C4BFB6' }}
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
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={minVerticalM}
                  onChange={(e) => onChangeMinVerticalM(Number(e.target.value))}
                  style={{ background: getSliderTrackBackground(minVerticalM, 1500) }}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum vertical drop filter in meters"
                />
                {/* 5 Major Anchor Ticks */}
                <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                </div>
                <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                  <span>Any</span>
                  <span>300m</span>
                  <span>600m</span>
                  <span>1,000m</span>
                  <span>1,500m</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="4000"
                  step="100"
                  value={minVerticalFt}
                  onChange={(e) => onChangeMinVerticalFt(Number(e.target.value))}
                  style={{ background: getSliderTrackBackground(minVerticalFt, 4000) }}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum vertical drop filter in feet"
                />
                {/* 5 Major Anchor Ticks */}
                <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                </div>
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
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="1200"
                  step="25"
                  value={minAreaHa}
                  onChange={(e) => onChangeMinAreaHa(Number(e.target.value))}
                  style={{ background: getSliderTrackBackground(minAreaHa, 1200) }}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum skiable area filter in hectares"
                />
                {/* 5 Major Anchor Ticks */}
                <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                </div>
                <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                  <span>Any</span>
                  <span>200 ha</span>
                  <span>500 ha</span>
                  <span>800 ha</span>
                  <span>1,200 ha</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="100"
                  value={minAreaAcres}
                  onChange={(e) => onChangeMinAreaAcres(Number(e.target.value))}
                  style={{ background: getSliderTrackBackground(minAreaAcres, 3000) }}
                  className="w-full tufte-slider cursor-pointer"
                  aria-label="Minimum skiable acreage filter in acres"
                />
                {/* 5 Major Anchor Ticks */}
                <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                  <span className="w-[1px] h-1 bg-[#A8A299]" />
                </div>
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
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minNordicKm}
                onChange={(e) => onChangeMinNordicKm(Number(e.target.value))}
                style={{ background: getSliderTrackBackground(minNordicKm, 100) }}
                className="w-full tufte-slider cursor-pointer"
                aria-label="Minimum nordic trail network filter in kilometers"
              />
              {/* 5 Major Anchor Ticks */}
              <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
              </div>
              <div className="flex justify-between text-[10px] text-[#8A847C] font-mono tabular-nums px-0.5 select-none -mt-0.5">
                <span>Any</span>
                <span>25 km</span>
                <span>50 km</span>
                <span>75 km</span>
                <span>100 km</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={minNordicMi}
                onChange={(e) => onChangeMinNordicMi(Number(e.target.value))}
                style={{ background: getSliderTrackBackground(minNordicMi, 60) }}
                className="w-full tufte-slider cursor-pointer"
                aria-label="Minimum nordic trail network filter in miles"
              />
              {/* 5 Major Anchor Ticks */}
              <div className="relative w-full flex justify-between px-[6px] pointer-events-none -mt-0.5">
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
                <span className="w-[1px] h-1 bg-[#A8A299]" />
              </div>
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
  );
};

// Backward-compatible alias
export const FilterModal = FilterPanel;

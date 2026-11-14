import React from 'react';
import { MountainSnow, Trees, Plane, Route } from 'lucide-react';
import type { EarthProjectionMode, PassNetwork } from '../../types';
import { PASS_DISPLAY_NAMES } from '../../utils/classification';

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
  showTouring?: boolean;
  onToggleTouring?: () => void;
  categoryFilterCounts: { downhill: number; nordic: number; heli_cat: number; touring?: number };
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

// Display labels and authentic pass dot colors
const PASS_DISPLAY_MAP: Record<PassNetwork, string> = {
  Ikon: 'Ikon',
  Epic: 'Epic',
  Indy: 'Indy',
  'Mountain Collective': 'Mtn Collective',
  Independent: 'Unaffiliated',
};

const PASS_DOT_COLORS: Record<PassNetwork, string> = {
  Ikon: '#B84A39',
  Epic: '#2E5A44',
  'Mountain Collective': '#2B5B84',
  Indy: '#C2842F',
  Independent: '#8A847C',
};

// Generates charcoal ink active track fill (#2C2A27) from the thumb to the end (minimum threshold range)
const getSliderTrackBackground = (val: number, max: number): string => {
  if (val <= 0) return '#D6D0C2';
  const pct = Math.min(100, Math.max(0, (val / max) * 100));
  return `linear-gradient(to right, #D6D0C2 0%, #D6D0C2 ${pct}%, #2C2A27 ${pct}%, #2C2A27 100%)`;
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  unitsMetric,
  showDownhill,
  onToggleDownhill,
  showNordic,
  onToggleNordic,
  showHeliCat,
  onToggleHeliCat,
  showTouring = true,
  onToggleTouring,
  categoryFilterCounts,
  selectedPasses,
  onTogglePass,
  onSetAllPasses,
  onClearPasses: _onClearPasses,
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
      {/* Category Segmented Controls (Monochrome Lucide icons, solid charcoal active states) */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          onClick={onToggleDownhill}
          className={`py-2 px-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showDownhill
              ? 'bg-[#2C2A27] border-[#2C2A27] text-[#FAF8F3] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#736E67] hover:text-[#1C1B18] hover:border-[#8A847C]'
          }`}
          title={`Toggle Downhill Ski Areas (${categoryFilterCounts.downhill.toLocaleString()})`}
        >
          <MountainSnow className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Downhill</span>
        </button>
        <button
          onClick={onToggleNordic}
          className={`py-2 px-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showNordic
              ? 'bg-[#2C2A27] border-[#2C2A27] text-[#FAF8F3] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#736E67] hover:text-[#1C1B18] hover:border-[#8A847C]'
          }`}
          title={`Toggle Nordic Centers (${categoryFilterCounts.nordic.toLocaleString()})`}
        >
          <Trees className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Nordic</span>
        </button>
        <button
          onClick={onToggleHeliCat}
          className={`py-2 px-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showHeliCat
              ? 'bg-[#2C2A27] border-[#2C2A27] text-[#FAF8F3] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#736E67] hover:text-[#1C1B18] hover:border-[#8A847C]'
          }`}
          title={`Toggle Guided Heli/Cat Operations (${categoryFilterCounts.heli_cat.toLocaleString()})`}
        >
          <Plane className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Heli/Cat</span>
        </button>
        <button
          onClick={onToggleTouring}
          className={`py-2 px-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            showTouring
              ? 'bg-[#2C2A27] border-[#2C2A27] text-[#FAF8F3] shadow-2xs'
              : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#736E67] hover:text-[#1C1B18] hover:border-[#8A847C]'
          }`}
          title={`Toggle Backcountry Ski Touring Routes & Zones (${(categoryFilterCounts.touring ?? 1).toLocaleString()})`}
        >
          <Route className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Touring</span>
        </button>
      </div>

      {/* Pass Networks (Neutral pills, highlight dot/border only when filtered, single subtle Reset) */}
      <div className="space-y-1.5 pt-1 border-t border-[#D6D0C2]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-[#4A463F] font-semibold">Pass Networks</span>
          {selectedPasses.length !== 5 && (
            <button
              type="button"
              onClick={onSetAllPasses}
              className="text-[10px] text-[#736E67] hover:text-[#1C1B18] hover:underline cursor-pointer font-medium"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['Ikon', 'Epic', 'Indy', 'Mountain Collective', 'Independent'] as PassNetwork[]).map((pass) => {
            const isAllActive = selectedPasses.length === 5;
            const isSelected = selectedPasses.includes(pass);
            const label = PASS_DISPLAY_MAP[pass];
            const dotColor = PASS_DOT_COLORS[pass];

            let buttonStyle = 'bg-[#F4F1EA] border-[#D8D3C8] text-[#5C5852] hover:text-[#1C1B18]';
            let dotStyle = { backgroundColor: dotColor, opacity: 0.6 };

            if (!isAllActive) {
              if (isSelected) {
                buttonStyle = 'bg-[#FAF8F3] border-[#2C2A27] text-[#1C1B18] shadow-2xs font-bold';
                dotStyle = { backgroundColor: dotColor, opacity: 1 };
              } else {
                buttonStyle = 'bg-[#F4F1EA] border-[#E2DDD5] text-[#8A847C] opacity-45 hover:opacity-75';
                dotStyle = { backgroundColor: '#C4BFB6', opacity: 0.5 };
              }
            }

            return (
              <button
                key={pass}
                type="button"
                onClick={() => onTogglePass(pass)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${buttonStyle}`}
                title={PASS_DISPLAY_NAMES[pass] || `Filter by ${label}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                  style={dotStyle}
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
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                  <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
                <span className="w-[2px] h-1.5 bg-[#8A847C]" />
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

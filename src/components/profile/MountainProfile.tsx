import React from 'react';
import { ChevronUp, ChevronDown, Minus, X, Globe, ExternalLink, Snowflake } from 'lucide-react';
import type { SkiResort, MobileSheetState } from '../../types';
import { formatSnow, formatVert, formatAcres, formatDistance } from '../../utils/formatters';
import {
  PASS_COLORS,
  PASS_DISPLAY_NAMES,
  PASS_SHORT_LABELS,
  getResortStats,
  getResortWebsite,
} from '../../utils/classification';

interface MountainProfileProps {
  resort: SkiResort;
  unitsMetric: boolean;
  mobileSheetState: MobileSheetState;
  onSetMobileSheetState: (state: MobileSheetState) => void;
  onDeselect: () => void;
}

export const MountainProfile: React.FC<MountainProfileProps> = ({
  resort,
  unitsMetric,
  mobileSheetState,
  onSetMobileSheetState,
  onDeselect,
}) => {
  const stats = getResortStats(resort);
  const url = getResortWebsite(resort);
  const snow72 = resort.weather?.snowfall_72h_in ?? 0;
  const snow7d = resort.weather?.daily_forecast
    ? Math.round(
        resort.weather.daily_forecast.reduce(
          (sum, d) => sum + (unitsMetric ? d.snowfall_cm / 2.54 : d.snowfall_in),
          0
        ) * 10
      ) / 10
    : 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F7F4ED] overflow-hidden">
      {/* Mountain Profile Header */}
      <div className="p-3.5 border-b border-[#D6D0C2] bg-[#FAF8F3] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5C5852] font-medium leading-tight">
              <span>{resort.region ? `${resort.region}, ` : ''}{resort.country}</span>
              <span className="text-[#A8A299]">·</span>
              <span className="text-[#8A847C] uppercase tracking-wider font-semibold text-[10px]">Mountain Profile</span>
            </div>
            <h2 className="text-lg font-bold text-[#1C1B18] tracking-tight mt-0.5 break-words leading-snug">
              {resort.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-0.5">
            {/* On mobile, show sheet resize buttons */}
            <div className="md:hidden flex items-center gap-1 mr-1 pr-1 border-r border-[#D6D0C2]">
              {mobileSheetState === 'half' ? (
                <button
                  onClick={() => onSetMobileSheetState('full')}
                  className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                  title="Expand to Fullscreen"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => onSetMobileSheetState('half')}
                  className="p-1 text-[#5C5852] hover:text-[#1C1B18] rounded cursor-pointer"
                  title="Collapse to Half"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onSetMobileSheetState('peek')}
                className="p-1 text-[#8A847C] hover:text-[#1C1B18] rounded cursor-pointer"
                title="Minimize to Peek"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onDeselect}
              className="p-1 hover:bg-[#EFECE4] text-[#8A847C] hover:text-[#1C1B18] rounded-md transition-colors cursor-pointer"
              title="Close profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official Website Link */}
        {url && (
          <div className="mt-1.5">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E5A44] hover:text-[#1C1B18] hover:underline transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Official Website</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        )}

        {/* Pass Affiliations */}
        {resort.pass_networks && resort.pass_networks.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {resort.pass_networks.map((pass) => (
              <span
                key={pass}
                className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-md border bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] shadow-2xs"
                title={PASS_DISPLAY_NAMES[pass]}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: PASS_COLORS[pass] || '#8A847C' }}
                />
                <span>{PASS_SHORT_LABELS[pass] || pass}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mountain Profile Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 bg-[#F7F4ED]">
        {/* Metric Tables */}
        <div className="bg-[#FAF8F3] border border-[#D6D0C2] rounded-md overflow-hidden text-center shadow-2xs">
          {/* Row 1: Infrastructure */}
          <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] border-b border-[#D6D0C2] p-2.5">
            {resort.category === 'nordic' ? (
              <>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Trails</div>
                  <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{resort.run_count ?? stats.pistes ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Network</div>
                  <div className="text-sm font-bold text-[#2E5A44] mt-0.5">{resort.trail_km ? formatDistance(resort.trail_km, unitsMetric) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Type</div>
                  <div className="text-sm font-bold text-[#1C1B18] mt-0.5">Nordic XC</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Lifts</div>
                  <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.lifts ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Pistes</div>
                  <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{stats.pistes ?? resort.run_count ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Acres</div>
                  <div className="text-sm font-bold text-[#1C1B18] mt-0.5">
                    {stats.acres && stats.acres > 0 ? formatAcres(stats.acres, unitsMetric) : '—'}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Row 2: Elevations */}
          <div className="grid grid-cols-3 divide-x divide-[#D6D0C2] p-2.5 bg-[#F7F4ED]">
            <div>
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Vertical</div>
              <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.vertical_drop_ft, unitsMetric)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Summit</div>
              <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.summit_elev_ft, unitsMetric)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider">Base</div>
              <div className="text-sm font-bold text-[#1C1B18] mt-0.5">{formatVert(resort.base_elev_ft, unitsMetric)}</div>
            </div>
          </div>
        </div>

        {/* Summit Weather Forecast */}
        <div className="bg-[#FAF8F3] p-3.5 rounded-md border border-[#D6D0C2] space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#1C1B18]">
              <Snowflake className="w-3.5 h-3.5 text-[#3B627E]" />
              <span>Summit Meteorology</span>
            </div>
            {resort.weather?.is_live && (
              <span className="text-[10px] font-medium text-[#8A847C]">{resort.weather.last_updated}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">72h Snow</div>
              <div className="text-base font-bold text-[#3B627E] mt-0.5">
                {formatSnow(snow72, unitsMetric)}
              </div>
            </div>
            <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">7-Day Snow</div>
              <div className="text-base font-bold text-[#3B627E] mt-0.5">
                {resort.weather?.daily_forecast ? formatSnow(snow7d, unitsMetric) : '—'}
              </div>
            </div>
            <div className="bg-[#F7F4ED] p-2.5 border border-[#D6D0C2] rounded-md">
              <div className="text-[10px] font-semibold text-[#5C5852] uppercase tracking-wider truncate">Avg Annual</div>
              <div className="text-base font-bold text-[#1C1B18] mt-0.5">
                {resort.avg_snowfall_in ? formatSnow(resort.avg_snowfall_in, unitsMetric) : '—'}
              </div>
            </div>
          </div>

          {/* 7-Day Snowfall Bars */}
          {resort.weather?.daily_forecast && resort.weather.daily_forecast.length > 0 && (
            <div className="grid grid-cols-7 gap-1 h-16 items-end bg-[#F7F4ED] p-2 border border-[#D6D0C2] rounded-md">
              {resort.weather.daily_forecast.map((day, idx) => {
                const val = unitsMetric ? day.snowfall_cm : day.snowfall_in;
                const maxVal = Math.max(1, ...resort.weather!.daily_forecast.map((d) => (unitsMetric ? d.snowfall_cm : d.snowfall_in)));
                const heightPercent = Math.max(8, Math.min(100, Math.round((val / maxVal) * 100)));
                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-xs transition-all ${
                        val > 0 ? 'bg-[#3B627E]' : 'bg-[#D6D0C2]'
                      }`}
                      title={`${day.date}: ${val}${unitsMetric ? 'cm' : 'in'} snow`}
                    />
                    <span className="text-[10px] font-bold text-[#8A847C] mt-1">
                      {new Date(day.date).toLocaleDateString([], { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

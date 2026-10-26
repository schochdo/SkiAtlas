import React from 'react';
import { Snowflake, X, ChevronRight } from 'lucide-react';
import type { SkiResort } from '../../types';
import { formatSnow, formatVert, formatAcres, formatDistance } from '../../utils/formatters';
import {
  PASS_COLORS,
  PASS_DISPLAY_NAMES,
  PASS_SHORT_LABELS,
  getCategoryBadge,
} from '../../utils/classification';

interface ResortCardProps {
  resort: SkiResort;
  isSelected: boolean;
  unitsMetric: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onViewProfile: () => void;
}

export const ResortCard: React.FC<ResortCardProps> = ({
  resort: r,
  isSelected,
  unitsMetric,
  onSelect,
  onDeselect,
  onViewProfile,
}) => {
  const snow7d = r.weather?.snowfall_7d_in ?? 0;
  const badge = getCategoryBadge(r.category);

  return (
    <div
      data-resort-id={r.id}
      onClick={() => {
        if (isSelected) {
          onDeselect();
        } else {
          onSelect(r.id);
        }
      }}
      className={`p-3 rounded-lg transition-all cursor-pointer group ${
        isSelected
          ? 'bg-[#FAF8F3] border-2 border-[#1C1B18] ring-1 ring-[#1C1B18] shadow-md'
          : 'bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#A8A299] hover:shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-[#1C1B18] tracking-tight break-words leading-snug">
            {r.name}
            <span
              className={`inline-flex items-center text-xs px-1.5 py-0.2 rounded-md border ${badge.bg} ${badge.border} align-middle ml-1.5 shrink-0`}
              title={badge.label}
              aria-label={badge.label}
            >
              {badge.icon}
            </span>
            {r.pass_networks && r.pass_networks.length > 0 && r.pass_networks[0] !== 'Independent' && (
              <span
                className="inline-flex items-center text-[9.5px] font-bold px-1.5 py-0.2 rounded border text-white shadow-2xs align-middle ml-1 shrink-0"
                style={{
                  backgroundColor: PASS_COLORS[r.pass_networks[0]] || '#8A847C',
                  borderColor: PASS_COLORS[r.pass_networks[0]] || '#8A847C',
                }}
                title={PASS_DISPLAY_NAMES[r.pass_networks[0]] || r.pass_networks[0]}
                aria-label={PASS_DISPLAY_NAMES[r.pass_networks[0]] || r.pass_networks[0]}
              >
                {PASS_SHORT_LABELS[r.pass_networks[0]] || r.pass_networks[0]}
              </span>
            )}
          </h3>

          {/* Line 2: Location (Region, Country) */}
          <div className="text-xs text-[#5C5852] font-medium mt-1 break-words leading-tight">
            {r.region ? `${r.region}, ` : ''}{r.country}
          </div>

          {/* Line 3: Mountain specs without leading dot */}
          {(() => {
            const stats: string[] = [];
            if (r.category !== 'nordic') {
              if (r.vertical_drop_ft && r.vertical_drop_ft > 0) {
                stats.push(formatVert(r.vertical_drop_ft, unitsMetric));
              }
              if (r.skiable_acres > 0) {
                stats.push(formatAcres(r.skiable_acres, unitsMetric));
              }
              if (r.avg_snowfall_in && r.avg_snowfall_in > 0) {
                stats.push(`${formatSnow(r.avg_snowfall_in, unitsMetric)}/yr`);
              }
            } else {
              if (r.trail_km && r.trail_km > 0) {
                stats.push(formatDistance(r.trail_km, unitsMetric));
              }
              if (r.run_count && r.run_count > 0) {
                stats.push(`${r.run_count} trails`);
              }
              if (r.vertical_drop_ft && r.vertical_drop_ft > 0) {
                stats.push(`${formatVert(r.vertical_drop_ft, unitsMetric)} vert`);
              }
            }
            if (stats.length === 0) return null;
            return (
              <div className="text-xs text-[#5C5852] font-medium mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {stats.join(' · ')}
              </div>
            );
          })()}
        </div>

        {/* Live Upcoming Snowfall Forecast Chip */}
        {r.weather?.is_live && (
          <div className="shrink-0 flex items-center text-xs">
            <span
              className={`px-2 py-1 rounded-md border flex items-center gap-1 text-xs font-bold ${
                snow7d > 0
                  ? 'bg-[#3B627E]/10 border-[#3B627E]/40 text-[#3B627E]'
                  : 'bg-[#FAF8F3] border-[#D6D0C2] text-[#8A847C]'
              }`}
              title="Upcoming 7-day forecast snowfall"
            >
              <Snowflake className="w-3 h-3 text-[#3B627E]" />
              <span>{formatSnow(snow7d, unitsMetric)}</span>
            </span>
          </div>
        )}
      </div>

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-[#D6D0C2] flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeselect();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F3] hover:bg-[#EAE5D9] border border-[#D6D0C2] hover:border-[#1C1B18] text-[#5C5852] hover:text-[#1C1B18] text-xs font-bold rounded transition-colors cursor-pointer"
            title="Deselect this ski area"
          >
            <X className="w-3.5 h-3.5" />
            <span>Deselect</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1C1B18] hover:bg-[#33312B] text-[#FAF8F3] text-xs font-bold rounded transition-colors cursor-pointer shadow-2xs"
            title="View detailed mountain profile and weather"
          >
            <span>Mountain Profile</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

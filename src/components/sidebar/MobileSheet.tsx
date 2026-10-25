import React from 'react';
import { Search, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import type { SkiResort, MobileSheetState, PanelView } from '../../types';
import { formatVert, formatSnow } from '../../utils/formatters';

interface MobileSheetProps {
  mobileSheetState: MobileSheetState;
  onSetMobileSheetState: (state: MobileSheetState | ((prev: MobileSheetState) => MobileSheetState)) => void;
  selectedResort: SkiResort | null;
  panelView: PanelView;
  filteredResortsCount: number;
  activeFiltersCount: number;
  unitsMetric: boolean;
  children: React.ReactNode;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  mobileSheetState,
  onSetMobileSheetState,
  selectedResort,
  panelView,
  filteredResortsCount,
  activeFiltersCount,
  unitsMetric,
  children,
}) => {
  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#F7F4ED] rounded-t-2xl border-t border-[#D6D0C2] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out ${
        mobileSheetState === 'peek'
          ? 'h-20'
          : mobileSheetState === 'half'
          ? 'h-[50vh]'
          : 'h-[88vh]'
      }`}
    >
      {/* Pull tab / Drag handle pill */}
      <div
        onClick={() => {
          onSetMobileSheetState((prev) => (prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'));
        }}
        className="w-full py-2 flex items-center justify-center cursor-pointer shrink-0"
      >
        <div className="w-10 h-1.5 rounded-full bg-[#C4BEB1] hover:bg-[#8A847C] transition-colors" />
      </div>

      {mobileSheetState === 'peek' ? (
        /* Mobile Peek Glance */
        <div
          onClick={() => onSetMobileSheetState('half')}
          className="flex items-center justify-between px-4 pb-3 cursor-pointer select-none flex-1"
        >
          {selectedResort ? (
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-bold text-sm text-[#1C1B18] truncate">
                  {selectedResort.name}
                </span>
                <span className="text-[11px] font-semibold text-[#5C5852] truncate">
                  · {selectedResort.country}
                </span>
              </div>
              <div className="text-xs text-[#5C5852] font-medium truncate mt-0.5">
                {selectedResort.vertical_drop_ft && selectedResort.vertical_drop_ft > 0
                  ? `${formatVert(selectedResort.vertical_drop_ft, unitsMetric)} vert · `
                  : ''}
                {selectedResort.weather?.snowfall_7d_in
                  ? `${formatSnow(selectedResort.weather.snowfall_7d_in, unitsMetric)} 7d snow`
                  : 'Tap for Mountain Profile'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#5C5852] min-w-0 flex-1 pr-2">
              <Search className="w-4 h-4 text-[#8A847C] shrink-0" />
              <span className="font-bold text-sm text-[#1C1B18] truncate">
                {filteredResortsCount.toLocaleString()} ski areas
              </span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#EAE5D9] text-[#1C1B18] border border-[#A8A299] text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums shrink-0">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetMobileSheetState('half');
              }}
              className="p-1.5 rounded-md bg-[#FAF8F3] border border-[#D6D0C2] text-[#1C1B18] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
              title="Expand panel"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Mobile Half or Full Sheet */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Sheet Control Strip (Shown in Directory view; Profile view integrates controls in its header) */}
          {panelView === 'directory' && (
            <div className="px-3.5 py-1.5 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center justify-between shrink-0 select-none">
              <span className="text-xs font-bold text-[#1C1B18] uppercase tracking-wider truncate">
                Mountain Directory ({filteredResortsCount.toLocaleString()})
              </span>

              <div className="flex items-center gap-1 shrink-0">
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
            </div>
          )}

          {/* Scrollable Content inside sheet */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

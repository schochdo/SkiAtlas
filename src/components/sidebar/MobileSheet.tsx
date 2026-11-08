import React, { useRef } from 'react';
import { Search, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
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
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;
    const dy = touchCurrentY.current - touchStartY.current;
    if (Math.abs(dy) > 10) {
      isDragging.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || touchCurrentY.current === null) {
      touchStartY.current = null;
      touchCurrentY.current = null;
      isDragging.current = false;
      return;
    }

    const dy = touchCurrentY.current - touchStartY.current;
    const distance = Math.abs(dy);

    if (distance > 35) {
      if (dy < 0) {
        // Swiped UP
        if (mobileSheetState === 'peek') {
          // Swipe up from peek expands to full (or half if short swipe)
          onSetMobileSheetState(distance > 110 ? 'full' : 'half');
        } else if (mobileSheetState === 'half') {
          onSetMobileSheetState('full');
        }
      } else {
        // Swiped DOWN
        if (mobileSheetState === 'full') {
          // Swipe down from full drops to half or all the way to peek
          onSetMobileSheetState(distance > 150 ? 'peek' : 'half');
        } else if (mobileSheetState === 'half') {
          onSetMobileSheetState('peek');
        }
      }
    }

    touchStartY.current = null;
    touchCurrentY.current = null;
    setTimeout(() => {
      isDragging.current = false;
    }, 60);
  };

  const handleHandleClick = () => {
    if (isDragging.current) return;
    // Tap handle: peek -> full; half -> full; full -> peek
    onSetMobileSheetState((prev) => (prev === 'peek' ? 'full' : prev === 'half' ? 'full' : 'peek'));
  };

  const handlePeekClick = () => {
    if (isDragging.current) return;
    // Single tap on collapsed peek bar directly expands to full
    onSetMobileSheetState('full');
  };

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#F7F4ED] rounded-t-2xl border-t border-[#D6D0C2] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom,0px)] transition-all duration-300 ease-in-out ${
        mobileSheetState === 'peek'
          ? 'h-[calc(5rem+env(safe-area-inset-bottom,0px))]'
          : mobileSheetState === 'half'
          ? 'h-[50dvh]'
          : 'h-[88dvh]'
      }`}
    >
      {/* Pull tab / Drag handle pill with touch gesture support */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleHandleClick}
        className="w-full py-2 flex items-center justify-center cursor-pointer shrink-0 select-none touch-none"
        title={
          mobileSheetState === 'peek'
            ? 'Tap or swipe up to expand to fullscreen'
            : mobileSheetState === 'half'
            ? 'Tap or swipe up for fullscreen, swipe down to collapse'
            : 'Tap or swipe down to collapse'
        }
      >
        <div className="w-10 h-1.5 rounded-full bg-[#C4BEB1] hover:bg-[#8A847C] transition-colors" />
      </div>

      {mobileSheetState === 'peek' ? (
        /* Mobile Peek Glance (Direct 1-tap expand) */
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handlePeekClick}
          className="flex items-center justify-between px-4 pb-3 cursor-pointer select-none flex-1"
        >
          {selectedResort ? (
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
                <span className="font-bold text-sm text-[#1C1B18] break-words">
                  {selectedResort.name}
                </span>
                <span className="text-[11px] font-semibold text-[#5C5852] shrink-0">
                  · {selectedResort.country}
                </span>
              </div>
              <div className="text-xs text-[#5C5852] font-medium break-words leading-tight mt-0.5">
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
                onSetMobileSheetState('full');
              }}
              className="p-1.5 rounded-md bg-[#FAF8F3] border border-[#D6D0C2] text-[#1C1B18] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
              title="Expand to fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Mobile Half or Full Sheet */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Sheet Control Strip (Shown in Directory view; Profile view integrates controls in its header) */}
          {panelView === 'directory' && (
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="px-3.5 py-1.5 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center justify-between shrink-0 select-none"
            >
              <span className="text-xs font-bold text-[#1C1B18] uppercase tracking-wider truncate">
                Mountain Directory ({filteredResortsCount.toLocaleString()})
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {mobileSheetState === 'half' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetMobileSheetState('full');
                    }}
                    className="p-1 text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#EAE5D9] rounded transition-colors cursor-pointer"
                    title="Expand to Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetMobileSheetState('half');
                    }}
                    className="p-1 text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#EAE5D9] rounded transition-colors cursor-pointer"
                    title="Split view (half screen)"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetMobileSheetState('peek');
                  }}
                  className="p-1 text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EAE5D9] rounded transition-colors cursor-pointer"
                  title="Minimize to Peek"
                >
                  <ChevronDown className="w-4 h-4" />
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

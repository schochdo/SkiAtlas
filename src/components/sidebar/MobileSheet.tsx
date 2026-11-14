import React, { useRef } from 'react';
import type { SkiResort, MobileSheetState, PanelView, TrailInspectionData } from '../../types';
import { formatVert, formatSnow } from '../../utils/formatters';

interface MobileSheetProps {
  mobileSheetState: MobileSheetState;
  onSetMobileSheetState: (state: MobileSheetState | ((prev: MobileSheetState) => MobileSheetState)) => void;
  selectedResort: SkiResort | null;
  selectedTrail?: TrailInspectionData | null;
  panelView: PanelView;
  filteredResortsCount: number;
  inViewResortsCount: number;
  activeFiltersCount: number;
  unitsMetric: boolean;
  children: React.ReactNode;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  mobileSheetState,
  onSetMobileSheetState,
  selectedResort,
  selectedTrail,
  filteredResortsCount: _filteredResortsCount,
  inViewResortsCount,
  unitsMetric,
  children,
}) => {
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    touchStartTime.current = performance.now();
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
      touchStartTime.current = null;
      isDragging.current = false;
      return;
    }

    const dy = touchCurrentY.current - touchStartY.current;
    const dt = Math.max(1, performance.now() - (touchStartTime.current ?? performance.now()));
    const velocity = dy / dt; // px/ms (negative = upward swipe, positive = downward swipe)
    const distance = Math.abs(dy);
    const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const heightThreshold = windowH * 0.35;

    // Responsive 2-state drawer: snap between 'peek' and 'full' based on velocity (>0.4 px/ms) or 35% height threshold
    if (mobileSheetState === 'peek') {
      // Swiping up from peek expands to full
      if (velocity < -0.4 || dy < -heightThreshold || dy < -30) {
        onSetMobileSheetState('full');
      }
    } else {
      // Swiping down from full collapses to peek
      if (velocity > 0.4 || dy > heightThreshold || dy > 50) {
        onSetMobileSheetState('peek');
      }
    }

    touchStartY.current = null;
    touchCurrentY.current = null;
    touchStartTime.current = null;
    setTimeout(() => {
      isDragging.current = false;
    }, 60);
  };

  const handleHandleClick = () => {
    if (isDragging.current) return;
    // Tap drag handle toggles sheet state
    onSetMobileSheetState((prev) => (prev === 'peek' ? 'full' : 'peek'));
  };

  const handlePeekClick = () => {
    if (isDragging.current) return;
    // Single tap on collapsed floating pill directly expands to full
    onSetMobileSheetState('full');
  };

  if (mobileSheetState === 'peek') {
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handlePeekClick}
        className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 z-30 h-11 px-4 mb-[calc(env(safe-area-inset-bottom,0px)+12px)] bg-[#FAF8F3] border border-[#2C2A27] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.18)] flex items-center justify-between gap-3 cursor-pointer select-none max-w-[calc(100vw-24px)] whitespace-nowrap active:scale-98 transition-transform"
        role="button"
        aria-label={
          selectedResort
            ? `View details for ${selectedResort.name}`
            : selectedTrail
            ? `View details for ${selectedTrail.name}`
            : `View ${inViewResortsCount.toLocaleString()} ski areas in view`
        }
      >
        {selectedResort ? (
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="font-bold text-xs text-[#1C1B18] truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px]">
              {selectedResort.name}
            </span>
            {(() => {
              const parts = [
                selectedResort.vertical_drop_ft && selectedResort.vertical_drop_ft > 0
                  ? formatVert(selectedResort.vertical_drop_ft, unitsMetric)
                  : null,
                selectedResort.weather?.snowfall_7d_in
                  ? `${formatSnow(selectedResort.weather.snowfall_7d_in, unitsMetric)} 7d`
                  : null,
              ].filter(Boolean);
              return parts.length > 0 ? (
                <span className="text-[11px] font-semibold text-[#5C5852] shrink-0">
                  · {parts.join(' · ')}
                </span>
              ) : null;
            })()}
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84A39] bg-[#EFECE4] border border-[#D6D0C2] px-1.5 py-0.5 rounded shrink-0 ml-1">
              Details ↑
            </span>
          </div>
        ) : selectedTrail ? (
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="font-bold text-xs text-[#1C1B18] truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px]">
              {selectedTrail.name}
            </span>
            {selectedTrail.verticalDropFt && selectedTrail.verticalDropFt > 0 && (
              <span className="text-[11px] font-semibold text-[#5C5852] shrink-0">
                · {formatVert(selectedTrail.verticalDropFt, unitsMetric)}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B84A39] bg-[#EFECE4] border border-[#D6D0C2] px-1.5 py-0.5 rounded shrink-0 ml-1">
              Details ↑
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-[#1C1B18]">
            <span className="text-[#B84A39] text-[10px]">▲</span>
            <span>{inViewResortsCount.toLocaleString()} in view · Directory</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C5852] bg-[#EFECE4] px-1.5 py-0.5 rounded border border-[#D6D0C2] shrink-0 ml-1">
              ↑
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#F7F4ED] rounded-t-2xl border-t border-[#D6D0C2] shadow-[0_-4px_24px_rgba(0,0,0,0.2)] pb-[env(safe-area-inset-bottom,0px)] h-[88dvh] transition-all duration-300 ease-in-out"
    >
      {/* Pull tab / Drag handle pill with touch gesture support */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleHandleClick}
        className="w-full py-2.5 flex items-center justify-center cursor-pointer shrink-0 select-none touch-none"
        title="Swipe down or tap to collapse"
      >
        <div className="w-10 h-1.5 rounded-full bg-[#C4BEB1] hover:bg-[#8A847C] transition-colors" />
      </div>

      {/* Scrollable Content inside sheet */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {children}
      </div>
    </div>
  );
};

import React from 'react';
import { Sliders, Maximize, Minimize } from 'lucide-react';

interface TopNavBarProps {
  onResetToGlobal: () => void;
  filtersMenuOpen: boolean;
  onToggleFilters: () => void;
  activeFiltersCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: React.ReactNode;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  onResetToGlobal,
  filtersMenuOpen,
  onToggleFilters,
  activeFiltersCount,
  isFullscreen,
  onToggleFullscreen,
  children,
}) => {
  return (
    <header className="absolute top-0 inset-x-0 z-40 h-11 flex items-center justify-between px-4 bg-[#F7F4ED] border-b border-[#D6D0C2]">
      <div className="flex items-center min-w-0">
        {/* Tracked Mountain Editorial Wordmark with Alpine Snow Globe Crest in the center */}
        <button
          onClick={onResetToGlobal}
          className="flex items-center select-none shrink-0 cursor-pointer group text-left p-0 bg-transparent border-0 focus:outline-hidden"
          title="Reset to Global Extent"
          aria-label="Snow Globe: Reset to Global Extent"
        >
          <span className="font-bold tracking-[0.16em] text-[17px] uppercase text-[#1C1B18] group-hover:text-[#B84A39] transition-colors leading-none">
            SNOW
          </span>

          {/* Alpine Snow Globe Crest in between SNOW and GLOBE */}
          <svg
            className="w-6.5 h-6.5 mx-2.5 shrink-0 -mt-0.5 group-hover:scale-105 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Glass Sphere Dome */}
            <circle cx="12" cy="10.5" r="8" stroke="#1C1B18" strokeWidth="1.3" />
            {/* Pedestal Base */}
            <path d="M7 20H17" stroke="#1C1B18" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8.5 18.5L7 20M15.5 18.5L17 20" stroke="#1C1B18" strokeWidth="1.2" strokeLinecap="round" />
            {/* Alpine Mountain Silhouette inside Dome */}
            <path d="M6 16L10.5 10L13.5 14L15 12L18 16" stroke="#5C5852" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Vermilion Summit Accent */}
            <polygon points="10.5,10 12,12 9,12" fill="#B84A39" />
            {/* Drifting Snow Crystals */}
            <circle cx="10" cy="6" r="0.75" fill="#B84A39" />
            <circle cx="14.5" cy="7.2" r="0.65" fill="#8A847C" />
            <circle cx="7.5" cy="9.5" r="0.5" fill="#8A847C" />
          </svg>

          <span className="font-bold tracking-[0.16em] text-[17px] uppercase text-[#1C1B18] group-hover:text-[#B84A39] transition-colors leading-none">
            GLOBE
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium">
        {/* Display & Filters Popover Trigger & Floating Panel */}
        <div className="relative">
          <button
            onClick={onToggleFilters}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              filtersMenuOpen || activeFiltersCount > 0
                ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
                : 'bg-[#FAF8F3] text-[#1C1B18] border-[#D6D0C2] hover:bg-[#EFECE4]'
            }`}
            title="Display Settings & Resort Filters"
            aria-label="Display Settings & Resort Filters"
            aria-expanded={filtersMenuOpen}
          >
            <Sliders className="w-3.5 h-3.5 text-[#5C5852]" />
            <span className="hidden sm:inline">Display & Filters</span>
            <span className="sm:hidden">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-[#1C1B18] text-[#FAF8F3] text-[9.5px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {children}
        </div>

        <button
          onClick={onToggleFullscreen}
          className="h-7 w-7 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-md transition-colors cursor-pointer flex items-center justify-center"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5 text-[#5C5852]" />
          ) : (
            <Maximize className="w-3.5 h-3.5 text-[#5C5852]" />
          )}
        </button>
      </div>
    </header>
  );
};

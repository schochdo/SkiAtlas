import React from 'react';
import { Maximize, Minimize, Globe, Map } from 'lucide-react';
import type { EarthProjectionMode } from '../../types';

interface TopNavBarProps {
  onResetToGlobal: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  unitsMetric: boolean;
  onSetUnitsMetric: (toMetric: boolean) => void;
  earthProjection: EarthProjectionMode;
  onToggleProjection: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  onResetToGlobal,
  isFullscreen,
  onToggleFullscreen,
  unitsMetric,
  onSetUnitsMetric,
  earthProjection,
  onToggleProjection,
}) => {
  return (
    <header className="hidden md:flex absolute top-0 inset-x-0 z-40 h-11 items-center justify-between px-4 bg-[#F7F4ED] border-b border-[#D6D0C2]">
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

      <div className="flex items-center gap-1.5 text-xs font-medium">
        {/* Earth Projection Icon Toggle (3D Globe vs 2D Flat Map) */}
        <button
          type="button"
          onClick={onToggleProjection}
          className="h-7 w-7 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-md transition-colors cursor-pointer flex items-center justify-center select-none shadow-2xs focus:outline-hidden"
          title={earthProjection === 'globe' ? 'Switch to 2D Flat Map' : 'Switch to 3D Globe'}
          aria-label={earthProjection === 'globe' ? '3D Globe projection active. Click to switch to 2D Flat Map' : '2D Flat Map active. Click to switch to 3D Globe'}
        >
          {earthProjection === 'globe' ? (
            <Globe className="w-3.5 h-3.5 text-[#1C1B18]" />
          ) : (
            <Map className="w-3.5 h-3.5 text-[#1C1B18]" />
          )}
        </button>

        {/* Minimalist Units Toggle: Shows only active unit (°F or °C); clicking flips to the other */}
        <button
          type="button"
          onClick={() => onSetUnitsMetric(!unitsMetric)}
          className="h-7 min-w-7 px-1.5 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] font-bold text-[11px] rounded-md transition-colors cursor-pointer flex items-center justify-center select-none shadow-2xs focus:outline-hidden"
          title={unitsMetric ? 'Metric units active (°C, m). Click for Imperial (°F, ft)' : 'Imperial units active (°F, ft). Click for Metric (°C, m)'}
          aria-label={unitsMetric ? 'Metric units active. Click for Imperial' : 'Imperial units active. Click for Metric'}
        >
          {unitsMetric ? '°C' : '°F'}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="h-7 w-7 bg-[#FAF8F3] hover:bg-[#EFECE4] border border-[#D6D0C2] text-[#1C1B18] rounded-md transition-colors cursor-pointer flex items-center justify-center select-none shadow-2xs focus:outline-hidden"
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

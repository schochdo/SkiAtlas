import React from 'react';

interface CompassGimbalProps {
  mapBearing: number;
  mapPitch: number;
  is3D: boolean;
  isCompassDragging: boolean;
  isTiltDragging: boolean;
  onCompassMouseDown: (e: React.MouseEvent) => void;
  onResetNorth: (e?: React.MouseEvent) => void;
  onTiltMouseDown: (e: React.MouseEvent) => void;
  onToggle3D: (e: React.MouseEvent) => void;
  onFlattenMap: (e: React.MouseEvent) => void;
}

export const CompassGimbal: React.FC<CompassGimbalProps> = ({
  mapBearing,
  mapPitch,
  is3D,
  isCompassDragging,
  isTiltDragging,
  onCompassMouseDown,
  onResetNorth,
  onTiltMouseDown,
  onToggle3D,
  onFlattenMap,
}) => {
  return (
    <div
      className="hidden md:block absolute bottom-8 right-6 z-20 select-none transition-all duration-300"
    >
      <div
        className="relative w-[66px] h-[66px] rounded-full bg-[#FAF8F3] border border-[#D6D0C2] shadow-sm flex items-center justify-center p-0"
        title="Navigation Instrument: Outer ring controls heading (click to reset North) · Inner disc controls 3D tilt & perspective"
      >
        {/* 1. OUTER ROTARY COMPASS BEZEL (HEADING / BEARING) */}
        <div
          onMouseDown={onCompassMouseDown}
          onClick={onResetNorth}
          className={`absolute inset-0 rounded-full flex items-center justify-center cursor-pointer transition-all ${
            isCompassDragging ? 'cursor-grabbing scale-[1.02] ring-1 ring-[#1C1B18]' : 'cursor-grab hover:bg-[#F2EFE8]'
          }`}
        >
          {/* Dynamic Rotating SVG Bezel */}
          <svg
            className="w-full h-full pointer-events-none transition-transform ease-out"
            viewBox="0 0 66 66"
            style={{
              transform: `rotate(${-mapBearing}deg)`,
              transitionDuration: isCompassDragging ? '0ms' : '150ms',
            }}
          >
            {/* Soft Calibration Ring */}
            <circle cx="33" cy="33" r="28" fill="none" stroke="#EAE5D9" strokeWidth="1" />

            {/* Cardinal North Indicator (Alpine Vermilion #B84A39) */}
            <polygon points="33,5 36,11 33,9.5 30,11" fill="#B84A39" />
            <text
              x="33"
              y="18.5"
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fill="#B84A39"
            >
              N
            </text>

            {/* Minimal Cardinal Ticks at East, South, West */}
            <line x1="56" y1="33" x2="60" y2="33" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
            <line x1="33" y1="56" x2="33" y2="60" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
            <line x1="6" y1="33" x2="10" y2="33" stroke="#8A847C" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>

        {/* 2. INNER 3D HORIZON & PITCH GIMBAL DISC */}
        <div
          onMouseDown={onTiltMouseDown}
          onClick={onToggle3D}
          onDoubleClick={onFlattenMap}
          className={`relative z-10 w-[38px] h-[38px] rounded-full bg-[#FAF8F3] border border-[#D6D0C2] shadow-2xs flex items-center justify-center transition-all ${
            isTiltDragging
              ? 'cursor-grabbing scale-105 ring-1 ring-[#1C1B18]'
              : 'cursor-grab hover:bg-[#EFECE4]'
          }`}
          title="Navigation Gimbal: Drag horizontally to rotate heading · Drag vertically to tilt pitch · Click to toggle 2D/3D · Double-click to flatten"
        >
          {/* SVG Perimeter Ring & Dynamic Pitch Arc Meter */}
          <svg className="w-[32px] h-[32px] pointer-events-none" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13.5" fill="none" stroke="#EAE5D9" strokeWidth="1" />
            {/* Pitch Arc Angle Meter */}
            <circle
              cx="16"
              cy="16"
              r="13.5"
              fill="none"
              stroke="#B84A39"
              strokeWidth="1.5"
              strokeDasharray={`${(mapPitch / 85) * 34} 100`}
              strokeLinecap="round"
              transform="rotate(-90 16 16)"
              opacity={is3D ? 0.9 : 0}
            />
          </svg>

          {/* Viewing Angle Display - Strictly Centered */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-[11px] font-bold tabular-nums text-[#1C1B18] tracking-tight leading-none">
              {is3D ? `${mapPitch}°` : '2D'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

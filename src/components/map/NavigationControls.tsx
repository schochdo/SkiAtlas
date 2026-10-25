import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface NavigationControlsProps {
  onZoomIn: (e: React.MouseEvent) => void;
  onZoomOut: (e: React.MouseEvent) => void;
  onResetNorth: (e?: React.MouseEvent) => void;
  mapBearing: number;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  mapBearing,
}) => {
  return (
    <div
      className="flex flex-col bg-[#FAF8F3] border border-[#D6D0C2] rounded-md shadow-sm divide-y divide-[#D6D0C2] overflow-hidden shrink-0"
      role="group"
      aria-label="Map navigation controls"
    >
      <button
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
      </button>
      <button
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={2.2} />
      </button>
      <button
        onClick={onResetNorth}
        className="w-8 h-8 flex items-center justify-center text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#EFECE4] active:bg-[#E5E0D5] transition-colors cursor-pointer group"
        title="Reorient to True North (0°)"
        aria-label="Reorient to True North"
      >
        <svg
          className="w-3.5 h-3.5 pointer-events-none transition-transform duration-150 ease-out"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ transform: `rotate(${-mapBearing}deg)`, transformOrigin: 'center' }}
        >
          <polygon points="12,2.5 19,20.5 12,16.5 5,20.5" />
        </svg>
      </button>
    </div>
  );
};

import React from 'react';
import { X } from 'lucide-react';
import type { SkiResort } from '../../types';

interface ActiveSelectionBannerProps {
  selectedResort: SkiResort | null;
  onDeselect: () => void;
}

export const ActiveSelectionBanner: React.FC<ActiveSelectionBannerProps> = ({
  selectedResort,
  onDeselect,
}) => {
  if (!selectedResort) return null;

  return (
    <div className="px-3 py-2 bg-[#FAF8F3] border-b border-[#D6D0C2] flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
      <div className="min-w-0 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#B84A39] shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-bold text-[#736E67] tracking-wider leading-none">
            Selected Area
          </div>
          <div className="font-bold text-xs text-[#1C1B18] truncate mt-0.5">
            {selectedResort.name}
          </div>
        </div>
      </div>
      <button
        onClick={onDeselect}
        className="flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F3] hover:bg-[#EAE5D9] border border-[#D6D0C2] hover:border-[#1C1B18] text-[#1C1B18] text-xs font-bold rounded transition-colors cursor-pointer shadow-2xs shrink-0"
        title="Deselect this ski area"
      >
        <X className="w-3.5 h-3.5 text-[#5C5852]" />
        <span>Deselect</span>
      </button>
    </div>
  );
};

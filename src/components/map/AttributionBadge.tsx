import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface AttributionBadgeProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const AttributionBadge: React.FC<AttributionBadgeProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const attributionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attributionRef.current && !attributionRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={attributionRef}
      className="absolute bottom-2 right-3 md:right-6 z-20 transition-all duration-300 pointer-events-auto select-none"
    >
      {!isOpen ? (
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-5 h-5 rounded-md bg-[#FAF8F3]/90 hover:bg-[#FAF8F3] backdrop-blur-xs border border-[#D6D0C2] hover:border-[#1C1B18] text-[#5C5852] hover:text-[#1C1B18] shadow-xs transition-colors cursor-pointer"
          title="Map Attribution & Data Sources"
          aria-label="Toggle map attribution"
        >
          <span className="font-sans italic font-bold text-[11px] leading-none">i</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 text-[9.5px] font-medium px-2 py-0.5 rounded-md bg-[#FAF8F3]/95 backdrop-blur-xs border border-[#D6D0C2] text-[#8A847C] shadow-sm animate-in fade-in duration-150">
          <button
            onClick={onClose}
            className="text-[#5C5852] hover:text-[#1C1B18] cursor-pointer font-sans italic font-bold text-[10px] pr-0.5"
            title="Collapse attribution"
          >
            i
          </button>
          <span>
            ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#1C1B18]"
            >
              OpenStreetMap
            </a>
          </span>
          <span>·</span>
          <span>
            <a
              href="https://openskidata.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#1C1B18]"
            >
              OpenSkiData
            </a>
          </span>
          <span>·</span>
          <span>
            <a
              href="https://www.esri.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#1C1B18]"
            >
              Esri
            </a>
          </span>
          <span>·</span>
          <span>
            <a
              href="https://github.com/tilezen/joerd"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#1C1B18]"
            >
              Mapterhorn
            </a>
          </span>
          <span>·</span>
          <span>
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#1C1B18]"
            >
              Open-Meteo
            </a>
          </span>
          <button
            onClick={onClose}
            className="ml-0.5 text-[#8A847C] hover:text-[#1C1B18] cursor-pointer"
            title="Close attribution"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useRef, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { formatCameraAltitude } from '../../utils/formatters';

interface CartographicLegendProps {
  mapLegendOpen: boolean;
  onToggleLegend: () => void;
  onCloseLegend: () => void;
  leftDockOpen: boolean;
  mapScale: { distStr: string; barWidth: number };
  cameraAltitudeMeters?: number | null;
  unitsMetric: boolean;
}

export const CartographicLegend: React.FC<CartographicLegendProps> = ({
  mapLegendOpen,
  onToggleLegend,
  onCloseLegend,
  leftDockOpen,
  mapScale,
  cameraAltitudeMeters,
  unitsMetric,
}) => {
  const mapLegendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mapLegendRef.current && !mapLegendRef.current.contains(event.target as Node)) {
        onCloseLegend();
      }
    };
    if (mapLegendOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mapLegendOpen, onCloseLegend]);

  return (
    <div
      ref={mapLegendRef}
      className={`hidden md:block absolute bottom-5 ${
        leftDockOpen ? 'left-88 md:left-106' : 'left-8'
      } z-20 transition-all duration-300 select-none`}
    >
      {mapLegendOpen && (
        <div className="absolute bottom-11 left-0 w-72 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md p-3.5 space-y-3 z-30 text-xs shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[#D6D0C2] pb-2">
            <span className="text-xs font-bold text-[#1C1B18] tracking-tight">Cartographic Key</span>
            <button onClick={onCloseLegend} className="text-[#8A847C] hover:text-[#1C1B18] cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Piste Key */}
          <div className="space-y-1.5 text-xs text-[#5C5852] font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-xs bg-[#2E7D32]" />
              <span>Novice (Green)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-xs bg-[#1565C0]" />
              <span>Intermediate (Blue)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-xs bg-[#1C1B18]" />
              <span>Advanced (Black)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-xs bg-[#B84A39]" />
              <span>Expert / Extreme (Double Black)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-2 rounded-[2px] bg-[#B84A39]/20 border border-dashed border-[#B84A39]" />
              <span>Freeride Bowls, Chutes & Glades</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-[#D6D0C2]">
              <span className="w-3 border-t-2 border-dashed border-[#B84A39]" />
              <span>Aerialway / Ski Lift</span>
            </div>
          </div>
          {/* Navigation & Gesture Guide */}
          <div className="pt-2 border-t border-[#D6D0C2] text-xs text-[#5C5852] space-y-1">
            <div><strong className="font-semibold text-[#1C1B18]">Trackpad:</strong> Pinch to zoom · Right-drag to orbit · Shift+scroll to tilt</div>
            <div><strong className="font-semibold text-[#1C1B18]">Touch:</strong> Pinch to zoom · Two fingers to rotate &amp; tilt</div>
            <div><strong className="font-semibold text-[#1C1B18]">Keyboard:</strong> Arrows to pan · A/D to orbit · W/S to tilt</div>
          </div>
        </div>
      )}

      {/* Alternating Scale Bar */}
      <div className="flex items-center gap-2.5 bg-[#FAF8F3] border border-[#D6D0C2] rounded-md px-3 py-1.5 text-xs font-semibold text-[#1C1B18] shadow-xs">
        <button
          onClick={onToggleLegend}
          className="flex items-center gap-1 text-[#5C5852] hover:text-[#1C1B18] transition-colors cursor-pointer mr-0.5"
          title="Toggle Map Key & Controls"
        >
          <Layers className="w-3.5 h-3.5 text-[#5C5852]" />
          <span className="font-semibold hover:underline">Key</span>
        </button>
        <div className="h-3 w-px bg-[#D6D0C2]" />
        <div className="flex items-center gap-1.5">
          <span className="font-bold tabular-nums text-[#1C1B18]">{mapScale.distStr}</span>
          <div className="flex h-1.5 border border-[#BDB7A9] rounded-[1px] overflow-hidden" style={{ width: `${mapScale.barWidth}px` }}>
            <div className="h-full bg-[#5C5852] flex-1" />
            <div className="h-full bg-[#FAF8F3] flex-1" />
            <div className="h-full bg-[#5C5852] flex-1" />
            <div className="h-full bg-[#FAF8F3] flex-1" />
          </div>
        </div>
        {cameraAltitudeMeters !== null && cameraAltitudeMeters !== undefined && (
          <>
            <div className="h-3 w-px bg-[#D6D0C2]" />
            <div
              className="flex items-center gap-1 text-[#5C5852]"
              title="Camera Altitude Above Sea Level"
            >
              <span className="text-[10px] text-[#8A847C] select-none">▲</span>
              <span className="font-bold tabular-nums text-[#1C1B18]">
                {formatCameraAltitude(cameraAltitudeMeters, unitsMetric)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

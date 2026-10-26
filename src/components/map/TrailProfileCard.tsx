import React from 'react';
import { X, TrendingDown, ArrowUpRight, Compass, Gauge, CableCar } from 'lucide-react';
import { TrailInspectionData } from '../../types';
import { formatVert, formatDistance } from '../../utils/formatters';

interface TrailProfileCardProps {
  trail: TrailInspectionData;
  unitsMetric: boolean;
  onClose: () => void;
  screenPos?: { x: number; y: number } | null;
  leftDockOpen?: boolean;
  isMobile?: boolean;
}

export const TrailProfileCard: React.FC<TrailProfileCardProps> = ({
  trail,
  unitsMetric,
  onClose,
  screenPos,
  leftDockOpen = true,
  isMobile = false,
}) => {
  const isLift = trail.kind === 'lift';

  // Format difficulty badge
  const renderBadge = () => {
    if (isLift) {
      const liftType = (trail.aerialway || 'lift').replace(/_/g, ' ');
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-stone-100 text-stone-800 border border-stone-200">
          <CableCar className="w-3 h-3 text-[#B84A39]" />
          <span>{liftType}</span>
        </span>
      );
    }

    const d = (trail.difficulty || '').toLowerCase();
    if (d === 'novice' || d === 'easy') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="text-xs">●</span>
          <span>{d === 'novice' ? 'Novice' : 'Easy'}</span>
        </span>
      );
    }
    if (d === 'intermediate') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <span className="text-xs">■</span>
          <span>Intermediate</span>
        </span>
      );
    }
    if (d === 'expert') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-zinc-900 text-white border border-zinc-700 shadow-sm">
          <span className="text-[10px] tracking-tighter">◆◆</span>
          <span>Expert</span>
        </span>
      );
    }
    if (d === 'advanced') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-zinc-900 text-white border border-zinc-700 shadow-sm">
          <span className="text-[10px]">◆</span>
          <span>Advanced</span>
        </span>
      );
    }
    if (d === 'freeride') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-amber-50 text-amber-900 border border-amber-300">
          <span className="text-[10px]">⬢</span>
          <span>Freeride</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-stone-100 text-stone-700 border border-stone-200">
        <span>Ski Trail</span>
      </span>
    );
  };

  // Compute anchor positioning
  const cardStyle: React.CSSProperties = {};
  if (typeof window !== 'undefined') {
    if (isMobile) {
      cardStyle.left = '16px';
      cardStyle.right = '16px';
      cardStyle.bottom = '84px';
      cardStyle.maxWidth = '360px';
      cardStyle.margin = '0 auto';
    } else if (screenPos) {
      const cardWidth = 320;
      const cardHeight = 260;
      const padding = 16;
      const minLeft = leftDockOpen ? 404 : 20;

      let left = screenPos.x + 20;
      let top = screenPos.y - cardHeight / 2;

      // Flip to left of cursor if overflowing right edge
      if (left + cardWidth > window.innerWidth - padding) {
        left = screenPos.x - cardWidth - 20;
      }
      // Clamp within viewport
      left = Math.max(minLeft + padding, Math.min(window.innerWidth - cardWidth - padding, left));
      top = Math.max(padding + 48, Math.min(window.innerHeight - cardHeight - padding, top));

      cardStyle.left = `${left}px`;
      cardStyle.top = `${top}px`;
    }
  }

  return (
    <div
      style={cardStyle}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed z-40 w-[320px] max-w-[calc(100vw-32px)] bg-[#FCFAF7]/95 backdrop-blur-md border border-stone-300/80 rounded-lg shadow-xl shadow-stone-900/15 overflow-hidden text-stone-900 font-sans animate-in fade-in zoom-in-95 duration-150 ${
        !screenPos && !isMobile ? 'bottom-6 right-6' : ''
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between px-3.5 pt-3 pb-2 border-b border-stone-200/70 bg-stone-50/60">
        <div className="flex flex-col gap-1 pr-2">
          <div className="flex items-center gap-2">
            {renderBadge()}
            {trail.gladed && (
              <span className="text-[10px] font-mono uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Glades
              </span>
            )}
            {trail.lit && (
              <span className="text-[10px] font-mono uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Night Skiing
              </span>
            )}
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 tracking-tight leading-snug line-clamp-2">
            {trail.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close trail inspection"
          className="text-stone-400 hover:text-stone-800 p-1 -mr-1 -mt-0.5 rounded transition-colors hover:bg-stone-200/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="p-3.5 space-y-2.5 text-xs text-stone-700">
        {/* Row 1: Vertical Drop & Total Surface Length */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
            <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
              <TrendingDown className="w-3 h-3 text-[#B84A39]" />
              <span>{isLift ? 'Vertical Rise' : 'Vertical Drop'}</span>
            </div>
            <div className="text-sm font-semibold font-mono text-stone-900">
              {formatVert(trail.verticalDropFt, unitsMetric)}
            </div>
          </div>

          <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
            <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
              <ArrowUpRight className="w-3 h-3 text-stone-500" />
              <span>Length</span>
            </div>
            <div className="text-sm font-semibold font-mono text-stone-900">
              {formatDistance(trail.lengthKm, unitsMetric)}
            </div>
          </div>
        </div>

        {/* Row 2: Steepness & Aspect for Pistes, or Capacity & Duration for Lifts */}
        {!isLift ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
                <Gauge className="w-3 h-3 text-stone-500" />
                <span>Pitch / Gradient</span>
              </div>
              <div className="text-xs font-semibold font-mono text-stone-900">
                {trail.avgSlopeDeg !== undefined ? (
                  <>
                    <span>{trail.avgSlopeDeg}°</span>
                    {trail.avgSlopeGrade !== undefined && (
                      <span className="text-[11px] font-normal text-stone-500 ml-1">
                        ({trail.avgSlopeGrade}%)
                      </span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </div>
              {trail.maxSlopeDeg && trail.maxSlopeDeg > (trail.avgSlopeDeg || 0) && (
                <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                  Max pitch: {trail.maxSlopeDeg}°
                </div>
              )}
            </div>

            <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
                <Compass className="w-3 h-3 text-stone-500" />
                <span>Aspect</span>
              </div>
              <div className="text-xs font-semibold font-mono text-stone-900">
                {trail.aspect || 'Variable'}
              </div>
              <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                Fall-line solar exposure
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
                <Gauge className="w-3 h-3 text-stone-500" />
                <span>Capacity</span>
              </div>
              <div className="text-xs font-semibold font-mono text-stone-900">
                {trail.capacity ? `${Number(trail.capacity).toLocaleString()} skiers/hr` : 'Standard carrier'}
              </div>
            </div>

            <div className="bg-stone-100/60 p-2 rounded border border-stone-200/50">
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-0.5">
                <Compass className="w-3 h-3 text-stone-500" />
                <span>Occupancy</span>
              </div>
              <div className="text-xs font-semibold font-mono text-stone-900">
                {trail.occupancy ? `${trail.occupancy}-person` : (trail.aerialway?.replace(/_/g, ' ') || 'Aerialway')}
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Summit & Base Elevation Benchmarks */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-stone-100/40 border border-stone-200/40 text-[11px] font-mono text-stone-600">
          <div>
            <span className="text-stone-400 mr-1">TOP</span>
            <span className="font-semibold text-stone-800">{formatVert(trail.topElevationFt, unitsMetric)}</span>
          </div>
          <div className="text-stone-300">→</div>
          <div>
            <span className="text-stone-400 mr-1">BASE</span>
            <span className="font-semibold text-stone-800">{formatVert(trail.baseElevationFt, unitsMetric)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

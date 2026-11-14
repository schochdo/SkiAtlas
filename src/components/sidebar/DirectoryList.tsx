import React, { useState } from 'react';
import { Search, X, Sliders, ChevronDown } from 'lucide-react';
import type { SkiResort, SortBy, SortOrder, DirectoryScope, MajorPeak, FireLookout, PassNetwork } from '../../types';
import { ResortCard } from './ResortCard';
import { FilterPanel } from '../header/FilterModal';

interface DirectoryListProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortClick: (type: SortBy) => void;
  showNordic: boolean;
  showDownhill: boolean;
  showHeliCat: boolean;
  showTouring?: boolean;
  directoryScope: DirectoryScope;
  onScopeChange: (scope: DirectoryScope) => void;
  filteredResortsCount: number;
  inViewResortsCount: number;
  displayedResorts: SkiResort[];
  selectedResort: SkiResort | null;
  selectedResortId: string | null;
  unitsMetric: boolean;
  matchingPeaks?: MajorPeak[];
  onSelectPeak?: (peak: MajorPeak) => void;
  matchingLookouts?: FireLookout[];
  onSelectLookout?: (lookout: FireLookout) => void;
  onSelectResort: (id: string) => void;
  onDeselectResort: () => void;
  onViewProfile: () => void;
  onCollapseSheet?: () => void;
  isFiltersOpen?: boolean;
  onToggleFilters?: () => void;
  // Filter Props
  activeFiltersCount: number;
  onResetFilters: () => void;
  onToggleDownhill: () => void;
  onToggleNordic: () => void;
  onToggleHeliCat: () => void;
  onToggleTouring?: () => void;
  categoryFilterCounts: { downhill: number; nordic: number; heli_cat: number; touring?: number };
  selectedPasses: PassNetwork[];
  onTogglePass: (pass: PassNetwork) => void;
  onSetAllPasses: () => void;
  onClearPasses: () => void;
  minVerticalM: number;
  onChangeMinVerticalM: (v: number) => void;
  minVerticalFt: number;
  onChangeMinVerticalFt: (v: number) => void;
  minAreaHa: number;
  onChangeMinAreaHa: (v: number) => void;
  minAreaAcres: number;
  onChangeMinAreaAcres: (v: number) => void;
  minNordicKm: number;
  onChangeMinNordicKm: (v: number) => void;
  minNordicMi: number;
  onChangeMinNordicMi: (v: number) => void;
}

export const DirectoryList: React.FC<DirectoryListProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortClick,
  showNordic,
  showDownhill,
  showHeliCat,
  showTouring = true,
  directoryScope,
  onScopeChange,
  filteredResortsCount,
  inViewResortsCount,
  displayedResorts,
  selectedResort,
  selectedResortId,
  unitsMetric,
  matchingPeaks = [],
  onSelectPeak,
  matchingLookouts = [],
  onSelectLookout,
  onSelectResort,
  onDeselectResort,
  onViewProfile,
  onCollapseSheet,
  isFiltersOpen: externalFiltersOpen,
  onToggleFilters,
  activeFiltersCount,
  onResetFilters,
  onToggleDownhill,
  onToggleNordic,
  onToggleHeliCat,
  onToggleTouring,
  categoryFilterCounts,
  selectedPasses,
  onTogglePass,
  onSetAllPasses,
  onClearPasses,
  minVerticalM,
  onChangeMinVerticalM,
  minVerticalFt,
  onChangeMinVerticalFt,
  minAreaHa,
  onChangeMinAreaHa,
  minAreaAcres,
  onChangeMinAreaAcres,
  minNordicKm,
  onChangeMinNordicKm,
  minNordicMi,
  onChangeMinNordicMi,
}) => {
  const [internalFiltersOpen, setInternalFiltersOpen] = useState(false);
  const isFiltersOpen = externalFiltersOpen !== undefined ? externalFiltersOpen : internalFiltersOpen;
  const toggleFilters = () => {
    if (onToggleFilters) {
      onToggleFilters();
    } else {
      setInternalFiltersOpen((prev) => !prev);
    }
  };
  const setIsFiltersOpen = (open: boolean) => {
    if (onToggleFilters) {
      if (open !== isFiltersOpen) onToggleFilters();
    } else {
      setInternalFiltersOpen(open);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F7F4ED] overflow-hidden relative">
      {/* Search & Directory Controls (Sticky Top) */}
      <div className="p-2.5 sm:p-3 border-b border-[#D6D0C2] bg-[#FAF8F3] space-y-2 shrink-0">
        {/* Row 1: Search Input + Filters Button + Optional Minimize Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center min-w-0">
            <Search className="absolute left-2.5 w-4 h-4 text-[#8A847C] pointer-events-none" />
            <input
              type="text"
              placeholder="Search alpine resorts, peaks, countries..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (displayedResorts.length > 0) {
                    onSelectResort(displayedResorts[0].id);
                  } else if (matchingLookouts && matchingLookouts.length > 0 && onSelectLookout) {
                    onSelectLookout(matchingLookouts[0]);
                  } else if (matchingPeaks && matchingPeaks.length > 0 && onSelectPeak) {
                    onSelectPeak(matchingPeaks[0]);
                  }
                }
              }}
              className="w-full bg-[#F7F4ED] border border-[#D6D0C2] rounded-md pl-8.5 pr-7 py-1.5 text-sm text-[#1C1B18] placeholder-[#8A847C] font-medium focus:outline-none focus:border-[#8A847C] focus:bg-[#FAF8F3] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 text-[#8A847C] hover:text-[#1C1B18] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={toggleFilters}
            className={`h-8.5 px-2.5 rounded-md border flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0 select-none ${
              isFiltersOpen
                ? 'bg-[#DDD9CF] border-[#2C2A27] text-[#1C1B18]'
                : 'bg-[#E5E1D7] border-[#C4BEB1] text-[#1C1B18] hover:bg-[#DDD9CF]'
            }`}
            aria-expanded={isFiltersOpen}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-[#B84A39] text-[#FAF8F3] text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Optional Mobile Collapse Button */}
          {onCollapseSheet && (
            <button
              type="button"
              onClick={onCollapseSheet}
              className="md:hidden p-1.5 text-[#8A847C] hover:text-[#1C1B18] hover:bg-[#EAE5D9] rounded transition-colors cursor-pointer shrink-0"
              title="Minimize to peek"
              aria-label="Minimize to peek"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Fire Lookouts Quick-Fly Matches */}
        {matchingLookouts.length > 0 && onSelectLookout && (
          <div className="p-2 bg-[#FAF5EE] border border-[#E2CEBC] rounded-md text-xs space-y-1 shadow-2xs">
            <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-[#A0522D]">
              <span className="flex items-center gap-1.5">
                <span className="text-[#D96B27] font-bold">⌂</span>
                <span>Fire Lookouts</span>
              </span>
              <span className="text-[9px] font-normal text-[#8A847C] lowercase">Enter or click to fly</span>
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {matchingLookouts.map((lookout) => (
                <button
                  key={lookout.id}
                  onClick={() => onSelectLookout(lookout)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#FAF8F3] hover:text-[#1C1B18] text-[#3D3A36] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-semibold truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-[#D96B27] text-xs font-bold shrink-0">⌂</span>
                    <span className="truncate">{lookout.name}</span>
                    {lookout.state && (
                      <span className="text-[9.5px] px-1 py-0.2 bg-[#EFECE4] text-[#736E67] font-bold rounded shrink-0">
                        {lookout.state}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-[#8A847C] tabular-nums font-mono shrink-0 ml-2">
                    {lookout.elevation_ft > 0
                      ? unitsMetric
                        ? `${lookout.elevation_m.toLocaleString()} m`
                        : `${lookout.elevation_ft.toLocaleString()}'`
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mountain Summits Quick-Fly Matches */}
        {matchingPeaks.length > 0 && onSelectPeak && (
          <div className="p-2 bg-[#F2EFE8] border border-[#D6D0C2] rounded-md text-xs space-y-1">
            <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-[#736E67]">
              <span>Mountain Summits</span>
              <span className="text-[9px] font-normal text-[#8A847C] lowercase">Enter or click to fly</span>
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {matchingPeaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => onSelectPeak(peak)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#FAF8F3] hover:text-[#1C1B18] text-[#3D3A36] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-semibold truncate flex items-center gap-1.5">
                    <span className="text-[#B84A39] text-xs">▲</span>
                    <span>{peak.name}</span>
                  </span>
                  <span className="text-[11px] text-[#8A847C] tabular-nums font-mono shrink-0 ml-2">
                    {unitsMetric ? `${peak.elevation_m.toLocaleString()} m` : `${peak.elevation_ft.toLocaleString()}'`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Combined Scope + Sort Row */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {/* Scope Segmented Buttons: All vs In View */}
          <div className="flex items-center p-0.5 bg-[#EFECE6] rounded-md border border-[#D6D3CD] shrink-0">
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className={`py-1 px-2 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                directoryScope === 'all'
                  ? 'bg-[#FAF8F3] text-[#1C1B18] shadow-2xs border border-[#A8A299]'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title={`All matching ski areas (${filteredResortsCount.toLocaleString()})`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('in_frame')}
              className={`py-1 px-2 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                directoryScope === 'in_frame'
                  ? 'bg-[#FAF8F3] text-[#1C1B18] shadow-2xs border border-[#A8A299]'
                  : 'text-[#736E67] hover:text-[#1C1B18]'
              }`}
              title={`Ski areas currently in view frame (${inViewResortsCount.toLocaleString()})`}
            >
              In View
            </button>
          </div>

          {/* Sort Pills */}
          <div className="flex items-center gap-0.5 bg-[#FAF8F3] p-0.5 rounded-md border border-[#D6D3CD] flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onSortClick('name')}
              className={`flex-1 py-1 px-1 rounded-[4px] text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                sortBy === 'name'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299]'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>A-Z</span>
              {sortBy === 'name' && <span className="text-[9px] ml-0.5">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </button>
            <button
              type="button"
              onClick={() => onSortClick('vert')}
              className={`flex-1 py-1 px-1 rounded-[4px] text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                sortBy === 'vert'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299]'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>Vert</span>
              {sortBy === 'vert' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              type="button"
              onClick={() => onSortClick('acres')}
              className={`flex-1 py-1 px-1 rounded-[4px] text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                sortBy === 'acres'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299]'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>{showNordic && !showDownhill && !showHeliCat && !showTouring ? 'Network' : 'Acres'}</span>
              {sortBy === 'acres' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              type="button"
              onClick={() => onSortClick('snow')}
              className={`flex-1 py-1 px-1 rounded-[4px] text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                sortBy === 'snow'
                  ? 'bg-[#EAE5D9] text-[#2B5B84] font-bold border border-[#A8A299]'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>7d ❄</span>
              {sortBy === 'snow' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main List Area + Expanded Filters Overlay */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {/* Filters Overlay View */}
        {isFiltersOpen && (
          <div className="absolute inset-0 z-20 bg-[#F7F4ED] flex flex-col min-h-0 overflow-y-auto animate-in fade-in duration-150">
            <div className="p-2.5 sm:p-3 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center justify-between sticky top-0 z-10 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#1C1B18]" />
                <span className="font-bold text-xs uppercase tracking-wider text-[#1C1B18]">
                  Filter Criteria
                </span>
                {activeFiltersCount > 0 && (
                  <span className="bg-[#B84A39] text-[#FAF8F3] text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-xs text-[#B84A39] font-bold hover:underline cursor-pointer mr-1"
                  >
                    Reset All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(false)}
                  className="px-2.5 py-1 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] hover:bg-[#EAE5D9] border border-[#2C2A27] rounded cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
            <div className="p-3 pb-8">
              <FilterPanel
                activeFiltersCount={activeFiltersCount}
                onResetFilters={onResetFilters}
                filteredCount={filteredResortsCount}
                showDownhill={showDownhill}
                onToggleDownhill={onToggleDownhill}
                showNordic={showNordic}
                onToggleNordic={onToggleNordic}
                showHeliCat={showHeliCat}
                onToggleHeliCat={onToggleHeliCat}
                showTouring={showTouring}
                onToggleTouring={onToggleTouring}
                categoryFilterCounts={categoryFilterCounts}
                selectedPasses={selectedPasses}
                onTogglePass={onTogglePass}
                onSetAllPasses={onSetAllPasses}
                onClearPasses={onClearPasses}
                unitsMetric={unitsMetric}
                minVerticalM={minVerticalM}
                onChangeMinVerticalM={onChangeMinVerticalM}
                minVerticalFt={minVerticalFt}
                onChangeMinVerticalFt={onChangeMinVerticalFt}
                minAreaHa={minAreaHa}
                onChangeMinAreaHa={onChangeMinAreaHa}
                minAreaAcres={minAreaAcres}
                onChangeMinAreaAcres={onChangeMinAreaAcres}
                minNordicKm={minNordicKm}
                onChangeMinNordicKm={onChangeMinNordicKm}
                minNordicMi={minNordicMi}
                onChangeMinNordicMi={onChangeMinNordicMi}
              />
            </div>
          </div>
        )}

        {/* Directory Cards List */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F4ED] p-2.5 space-y-2">
          {displayedResorts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A847C] space-y-2.5">
              <div>
                {directoryScope === 'in_frame'
                  ? '0 ski areas in current map view frame.'
                  : `No ski areas match ${searchQuery ? `"${searchQuery}"` : 'current filters'}.`}
              </div>
              {directoryScope === 'in_frame' && filteredResortsCount > 0 && (
                <button
                  onClick={() => onScopeChange('all')}
                  className="inline-block px-3 py-1.5 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#8A847C] rounded-md hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                >
                  View all {filteredResortsCount.toLocaleString()} matching areas →
                </button>
              )}
              {matchingLookouts.length > 0 && onSelectLookout && (
                <div className="pt-2.5 border-t border-[#D6D0C2]">
                  <div className="text-[11px] font-medium text-[#5C5852] mb-1.5">
                    Found fire lookout:
                  </div>
                  <button
                    onClick={() => onSelectLookout(matchingLookouts[0])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#8A847C] rounded-md hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                  >
                    <span className="text-[#D96B27] font-bold">⌂</span>
                    <span>{matchingLookouts[0].name}</span>
                    {matchingLookouts[0].state && (
                      <span className="text-[10px] text-[#736E67]">({matchingLookouts[0].state})</span>
                    )}
                    {matchingLookouts[0].elevation_ft > 0 && (
                      <span className="text-[10px] text-[#8A847C] font-mono">
                        · {unitsMetric ? `${matchingLookouts[0].elevation_m.toLocaleString()} m` : `${matchingLookouts[0].elevation_ft.toLocaleString()}'`}
                      </span>
                    )}
                    <span className="ml-1 text-[#8A847C]">→ Pan &amp; Zoom</span>
                  </button>
                </div>
              )}
              {matchingPeaks.length > 0 && onSelectPeak && (
                <div className="pt-2.5 border-t border-[#D6D0C2]">
                  <div className="text-[11px] font-medium text-[#5C5852] mb-1.5">
                    Found mountain summit:
                  </div>
                  <button
                    onClick={() => onSelectPeak(matchingPeaks[0])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] border border-[#D6D0C2] hover:border-[#8A847C] rounded-md hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                  >
                    <span className="text-[#B84A39]">▲</span>
                    <span>{matchingPeaks[0].name}</span>
                    <span className="text-[10px] text-[#8A847C] font-mono">
                      ({unitsMetric ? `${matchingPeaks[0].elevation_m.toLocaleString()} m` : `${matchingPeaks[0].elevation_ft.toLocaleString()}'`})
                    </span>
                    <span className="ml-1 text-[#8A847C]">→ Pan &amp; Zoom</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            displayedResorts.map((r) => (
              <ResortCard
                key={r.id}
                resort={r}
                isSelected={r.id === selectedResortId}
                unitsMetric={unitsMetric}
                onSelect={onSelectResort}
                onDeselect={onDeselectResort}
                onViewProfile={onViewProfile}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

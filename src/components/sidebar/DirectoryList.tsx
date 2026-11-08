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
  // Filter Props
  activeFiltersCount: number;
  onResetFilters: () => void;
  onToggleDownhill: () => void;
  onToggleNordic: () => void;
  onToggleHeliCat: () => void;
  categoryFilterCounts: { downhill: number; nordic: number; heli_cat: number };
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
  activeFiltersCount,
  onResetFilters,
  onToggleDownhill,
  onToggleNordic,
  onToggleHeliCat,
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F7F4ED] overflow-hidden">
      {/* Search & Directory Controls */}
      <div className="p-3 border-b border-[#D6D0C2] bg-[#FAF8F3] space-y-2.5 shrink-0">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-[#8A847C] pointer-events-none" />
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
            className="w-full bg-[#F7F4ED] border border-[#D6D0C2] rounded-md pl-9.5 pr-8 py-2 text-base md:text-sm text-[#1C1B18] placeholder-[#8A847C] font-medium focus:outline-none focus:border-[#8A847C] focus:bg-[#FAF8F3] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-[#8A847C] hover:text-[#1C1B18]"
            >
              <X className="w-4 h-4" />
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
            <div className="space-y-0.5">
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
            <div className="space-y-0.5">
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

        {/* Collapsible Filters Section */}
        <div className="border border-[#C4BEB1] rounded-md bg-[#EFECE4] overflow-hidden transition-all shadow-2xs">
          <div
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs font-semibold text-[#1C1B18] transition-colors cursor-pointer select-none group ${
              isFiltersOpen ? 'bg-[#EAE5D9] border-b border-[#D6D0C2]' : 'bg-[#EFECE4] hover:bg-[#E5E1D7]'
            }`}
            role="button"
            tabIndex={0}
            aria-expanded={isFiltersOpen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  setIsFiltersOpen((prev) => !prev);
                }
              }
            }}
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#1C1B18]" />
              <span className="font-bold text-xs text-[#1C1B18]">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#B84A39] text-[#FAF8F3] text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetFilters();
                  }}
                  className="text-[#B84A39] hover:underline cursor-pointer font-bold mr-0.5"
                >
                  Reset
                </button>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1C1B18] bg-[#FAF8F3] px-2 py-0.5 rounded border border-[#C4BEB1] shadow-2xs group-hover:border-[#8A847C] transition-colors">
                <span>{isFiltersOpen ? 'Hide' : 'Show'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#1C1B18] transition-transform duration-200 ${
                    isFiltersOpen ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </div>
          </div>

          {isFiltersOpen && (
            <div className="p-3 pt-2.5 border-t border-[#D6D0C2] max-h-[46vh] overflow-y-auto bg-[#F7F4ED]">
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
          )}
        </div>

        {/* Sort Controls Row */}
        <div className="flex items-center justify-between gap-2.5 pt-1">
          <span className="text-[#736E67] uppercase tracking-wider font-bold text-[11px] shrink-0">
            Sort:
          </span>
          <div className="flex items-center gap-0.5 bg-[#FAF8F3] p-0.5 rounded-md border border-[#D6D3CD] flex-1">
            <button
              onClick={() => onSortClick('name')}
              className={`flex-1 py-1 px-1 rounded-[5px] text-xs font-semibold text-center transition-colors cursor-pointer flex items-center justify-center ${
                sortBy === 'name'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>A-Z</span>
              {sortBy === 'name' && <span className="text-[10px] ml-0.5">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </button>
            <button
              onClick={() => onSortClick('vert')}
              className={`flex-1 py-1 px-1 rounded-[5px] text-xs font-semibold text-center transition-colors cursor-pointer flex items-center justify-center ${
                sortBy === 'vert'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>Vert</span>
              {sortBy === 'vert' && <span className="text-[10px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              onClick={() => onSortClick('acres')}
              className={`flex-1 py-1 px-1 rounded-[5px] text-xs font-semibold text-center transition-colors cursor-pointer flex items-center justify-center ${
                sortBy === 'acres'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>{showNordic && !showDownhill && !showHeliCat ? 'Network' : 'Acres'}</span>
              {sortBy === 'acres' && <span className="text-[10px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              onClick={() => onSortClick('snow')}
              className={`flex-1 py-1 px-1 rounded-[5px] text-xs font-semibold text-center transition-colors cursor-pointer flex items-center justify-center ${
                sortBy === 'snow'
                  ? 'bg-[#EAE5D9] text-[#2B5B84] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>7-Day ❄</span>
              {sortBy === 'snow' && <span className="text-[10px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Directory Scope Category Tabs: Unified Segmented Toggle */}
      <div className="px-3 py-2 border-b border-[#D6D0C2] bg-[#FAF8F3] shrink-0">
        <div className="flex items-center p-0.5 bg-[#EFECE6] rounded-md border border-[#D6D3CD] shadow-2xs">
          <button
            onClick={() => onScopeChange('all')}
            className={`flex-1 py-1.5 px-2 rounded-[5px] text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
              directoryScope === 'all'
                ? 'bg-[#FAF8F3] text-[#1C1B18] shadow-xs border border-[#C8C2B7]'
                : 'text-[#8A847C] hover:text-[#1C1B18] border border-transparent'
            }`}
            title="Show all ski areas matching current filters worldwide"
          >
            <span className="tabular-nums">{filteredResortsCount.toLocaleString()}</span>
            <span>ALL MATCHING</span>
          </button>
          <button
            onClick={() => onScopeChange('in_frame')}
            className={`flex-1 py-1.5 px-2 rounded-[5px] text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
              directoryScope === 'in_frame'
                ? 'bg-[#FAF8F3] text-[#1C1B18] shadow-xs border border-[#C8C2B7]'
                : 'text-[#8A847C] hover:text-[#1C1B18] border border-transparent'
            }`}
            title="Show only ski areas currently inside the map view frame"
          >
            <span className="tabular-nums">{inViewResortsCount.toLocaleString()}</span>
            <span>IN FRAME</span>
          </button>
        </div>
      </div>


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
  );
};

import React, { useState } from 'react';
import { Search, X, Sliders, ChevronDown } from 'lucide-react';
import type { SkiResort, SortBy, SortOrder, DirectoryScope, MajorPeak, PassNetwork } from '../../types';
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
        {/* Collapsible Filters Section */}
        <div className="border border-[#D6D0C2] rounded-md bg-[#FAF8F3] overflow-hidden transition-all shadow-2xs">
          <div
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-xs font-semibold text-[#1C1B18] hover:bg-[#EFECE4] transition-colors cursor-pointer select-none"
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
              <Sliders className="w-3.5 h-3.5 text-[#5C5852]" />
              <span className="font-bold text-xs text-[#1C1B18]">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#B84A39] text-[#FAF8F3] text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#736E67]">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetFilters();
                  }}
                  className="text-[#B84A39] hover:underline cursor-pointer font-bold mr-1"
                >
                  Reset
                </button>
              )}
              <span className="text-[11px] font-medium text-[#736E67]">{isFiltersOpen ? 'Hide' : 'Show'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#736E67] transition-transform duration-200 ${
                  isFiltersOpen ? 'rotate-180' : ''
                }`}
              />
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

        {/* Sort Controls Row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[#736E67] uppercase tracking-wider font-bold text-[11px] shrink-0">
            Sort:
          </span>
          <div className="flex items-center gap-1 bg-[#FAF8F3] p-0.5 rounded-md border border-[#D6D0C2]">
            <button
              onClick={() => onSortClick('name')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'name'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>A-Z</span>
              {sortBy === 'name' && <span className="text-[10px] ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </button>
            <button
              onClick={() => onSortClick('vert')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'vert'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>Vert</span>
              {sortBy === 'vert' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              onClick={() => onSortClick('acres')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'acres'
                  ? 'bg-[#EAE5D9] text-[#1C1B18] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>{showNordic && !showDownhill && !showHeliCat ? 'Network' : 'Acres'}</span>
              {sortBy === 'acres' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
            <button
              onClick={() => onSortClick('snow')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === 'snow'
                  ? 'bg-[#EAE5D9] text-[#3B627E] font-bold border border-[#A8A299] shadow-2xs'
                  : 'text-[#5C5852] hover:text-[#1C1B18]'
              }`}
            >
              <span>7-Day ❄</span>
              {sortBy === 'snow' && <span className="text-[10px] ml-1">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Directory Scope Category Tabs: All Matching vs In Frame */}
      <div className="px-3 py-2 border-b border-[#D6D0C2] bg-[#FAF8F3] flex items-center gap-2 shrink-0">
        <button
          onClick={() => onScopeChange('all')}
          className={`flex-1 py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
            directoryScope === 'all'
              ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
              : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
          }`}
          title="Show all ski areas matching current filters worldwide"
        >
          <span className="tabular-nums">{filteredResortsCount.toLocaleString()}</span>
          <span>ALL MATCHING</span>
        </button>
        <button
          onClick={() => onScopeChange('in_frame')}
          className={`flex-1 py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 ${
            directoryScope === 'in_frame'
              ? 'bg-[#EAE5D9] text-[#1C1B18] border-[#A8A299] shadow-2xs'
              : 'bg-[#FAF8F3] text-[#8A847C] border-[#D6D0C2] hover:text-[#1C1B18] hover:bg-[#F2EFE8]'
          }`}
          title="Show only ski areas currently inside the map view frame"
        >
          <span className="tabular-nums">{inViewResortsCount.toLocaleString()}</span>
          <span>IN FRAME</span>
        </button>
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

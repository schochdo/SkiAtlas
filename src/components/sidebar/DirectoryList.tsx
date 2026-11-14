import React, { useState, useMemo } from 'react';
import { Search, X, Sliders, ChevronDown } from 'lucide-react';
import type { SkiResort, SortBy, SortOrder, DirectoryScope, MajorPeak, FireLookout, PassNetwork } from '../../types';
import { ResortCard } from './ResortCard';
import { FilterPanel } from '../header/FilterModal';

interface QuickMatchItem {
  id: string;
  type: 'lookout' | 'summit';
  name: string;
  state?: string;
  elevation_ft: number;
  elevation_m: number;
  raw: FireLookout | MajorPeak;
}

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
  onCloseFilters?: () => void;
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
  selectedResort: _selectedResort,
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
  onCloseFilters,
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

  const handleCloseFilters = () => {
    if (onCloseFilters) {
      onCloseFilters();
    } else if (onToggleFilters) {
      if (isFiltersOpen) onToggleFilters();
    } else {
      setInternalFiltersOpen(false);
    }
  };

  // Consolidate Fire Lookouts and Mountain Summits into top 5 quick matches
  const combinedQuickMatches = useMemo<QuickMatchItem[]>(() => {
    if (!searchQuery.trim()) return [];
    const items: QuickMatchItem[] = [];

    for (const l of matchingLookouts) {
      items.push({
        id: `lookout-${l.id}`,
        type: 'lookout',
        name: l.name,
        state: l.state,
        elevation_ft: l.elevation_ft || 0,
        elevation_m: l.elevation_m || 0,
        raw: l,
      });
    }

    for (const p of matchingPeaks) {
      items.push({
        id: `peak-${p.id}`,
        type: 'summit',
        name: p.name,
        elevation_ft: p.elevation_ft || 0,
        elevation_m: p.elevation_m || 0,
        raw: p,
      });
    }

    const q = searchQuery.toLowerCase().trim();
    items.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return b.elevation_ft - a.elevation_ft;
    });

    return items.slice(0, 5);
  }, [matchingLookouts, matchingPeaks, searchQuery]);

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
                  } else if (combinedQuickMatches.length > 0) {
                    const topMatch = combinedQuickMatches[0];
                    if (topMatch.type === 'lookout' && onSelectLookout) {
                      onSelectLookout(topMatch.raw as FireLookout);
                    } else if (topMatch.type === 'summit' && onSelectPeak) {
                      onSelectPeak(topMatch.raw as MajorPeak);
                    }
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
                ? 'bg-[#2C2A27] border-[#2C2A27] text-[#FAF8F3]'
                : 'bg-[#EAE5D9] border-[#D6D0C2] text-[#1C1B18] hover:bg-[#DDD9CF]'
            }`}
            aria-expanded={isFiltersOpen}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Filters{activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : ''}</span>
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

        {/* Consolidated Quick-Fly Matches (Lookouts & Summits) */}
        {!isFiltersOpen && combinedQuickMatches.length > 0 && (
          <div className="pt-1.5 pb-0.5 border-t border-[#D6D0C2] space-y-0.5">
            <div className="px-1 text-[9.5px] font-bold uppercase tracking-wider text-[#736E67]">
              Quick Matches
            </div>
            {combinedQuickMatches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.type === 'lookout' && onSelectLookout) {
                    onSelectLookout(item.raw as FireLookout);
                  } else if (item.type === 'summit' && onSelectPeak) {
                    onSelectPeak(item.raw as MajorPeak);
                  }
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-[#EAE5D9] text-[#1C1B18] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="font-semibold text-xs truncate flex items-center gap-1.5 min-w-0">
                  <span className="text-[#5C5852] font-mono text-xs shrink-0 select-none">
                    {item.type === 'lookout' ? '△' : '▲'}
                  </span>
                  <span className="truncate">{item.name}</span>
                  {item.state && (
                    <span className="text-[9.5px] px-1 py-0.2 bg-[#E5E1D7] text-[#5C5852] font-bold rounded shrink-0">
                      {item.state}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-[#736E67] tabular-nums font-mono shrink-0 ml-2">
                  {item.elevation_ft > 0
                    ? unitsMetric
                      ? `${item.elevation_m.toLocaleString()} m`
                      : `${item.elevation_ft.toLocaleString()}'`
                    : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Combined Scope + Sort Controls (Hidden when in exclusive Filter Criteria mode) */}
        {!isFiltersOpen && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {/* Scope: All vs In View */}
            <div className="flex items-center p-0.5 bg-[#EAE5D9] rounded-md border border-[#D6D0C2] shrink-0">
              <button
                type="button"
                onClick={() => onScopeChange('all')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  directoryScope === 'all'
                    ? 'bg-[#2C2A27] text-[#FAF8F3]'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
                title={`All matching ski areas (${filteredResortsCount.toLocaleString()})`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onScopeChange('in_frame')}
                className={`py-1 px-2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  directoryScope === 'in_frame'
                    ? 'bg-[#2C2A27] text-[#FAF8F3]'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
                title={`Ski areas currently in view frame (${inViewResortsCount.toLocaleString()})`}
              >
                In View
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-0.5 bg-[#EAE5D9] p-0.5 rounded-md border border-[#D6D0C2] flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onSortClick('name')}
                className={`flex-1 py-1 px-1 rounded text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                  sortBy === 'name'
                    ? 'bg-[#2C2A27] text-[#FAF8F3] font-bold'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>A-Z</span>
                {sortBy === 'name' && <span className="text-[9px] ml-0.5">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </button>
              <button
                type="button"
                onClick={() => onSortClick('vert')}
                className={`flex-1 py-1 px-1 rounded text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                  sortBy === 'vert'
                    ? 'bg-[#2C2A27] text-[#FAF8F3] font-bold'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>Vert</span>
                {sortBy === 'vert' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
              <button
                type="button"
                onClick={() => onSortClick('acres')}
                className={`flex-1 py-1 px-1 rounded text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                  sortBy === 'acres'
                    ? 'bg-[#2C2A27] text-[#FAF8F3] font-bold'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>{showNordic && !showDownhill && !showHeliCat && !showTouring ? 'Network' : 'Acres'}</span>
                {sortBy === 'acres' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
              <button
                type="button"
                onClick={() => onSortClick('snow')}
                className={`flex-1 py-1 px-1 rounded text-[11px] font-semibold text-center transition-colors cursor-pointer flex items-center justify-center truncate ${
                  sortBy === 'snow'
                    ? 'bg-[#2C2A27] text-[#FAF8F3] font-bold'
                    : 'text-[#5C5852] hover:text-[#1C1B18]'
                }`}
              >
                <span>7d ❄</span>
                {sortBy === 'snow' && <span className="text-[9px] ml-0.5">{sortOrder === 'desc' ? '▼' : '▲'}</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Body: Either Exclusive Filter Criteria Panel OR Directory Cards List */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {isFiltersOpen ? (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F4ED] flex flex-col animate-in fade-in duration-150">
            {/* Filter Criteria Header */}
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
                  onClick={handleCloseFilters}
                  className="px-2.5 py-1 text-xs font-bold text-[#1C1B18] bg-[#FAF8F3] hover:bg-[#EAE5D9] border border-[#2C2A27] rounded cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Filter Panel Content */}
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
        ) : (
          /* Directory Cards List */
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
        )}
      </div>
    </div>
  );
};

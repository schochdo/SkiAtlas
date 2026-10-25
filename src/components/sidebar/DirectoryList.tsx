import React from 'react';
import { Search, X } from 'lucide-react';
import type { SkiResort, SortBy, SortOrder, DirectoryScope } from '../../types';
import { ResortCard } from './ResortCard';
import { ActiveSelectionBanner } from './ActiveSelectionBanner';

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
  onSelectResort: (id: string) => void;
  onDeselectResort: () => void;
  onViewProfile: () => void;
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
  onSelectResort,
  onDeselectResort,
  onViewProfile,
}) => {
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
            className="w-full bg-[#F7F4ED] border border-[#D6D0C2] rounded-md pl-9.5 pr-8 py-2 text-sm text-[#1C1B18] placeholder-[#8A847C] font-medium focus:outline-none focus:border-[#8A847C] focus:bg-[#FAF8F3] transition-colors"
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

      {/* Sticky Active Selection Banner when a ski area is selected */}
      <ActiveSelectionBanner
        selectedResort={selectedResort}
        onDeselect={onDeselectResort}
      />

      {/* Directory Cards List */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F4ED] p-2.5 space-y-2">
        {displayedResorts.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#8A847C] space-y-2">
            <div>
              {directoryScope === 'in_frame'
                ? '0 ski areas in current map view frame.'
                : 'No ski areas match current filters.'}
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
    </div>
  );
};

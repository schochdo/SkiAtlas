import type { SkiResort, PassNetwork, SortBy, SortOrder } from '../../types';

/* =========================================================================
   RESORT PIPELINE & DATASET SERVICE TYPES
   ========================================================================= */

export interface ResortFilterCriteria {
  showDownhill: boolean;
  showNordic: boolean;
  showHeliCat: boolean;
  selectedPasses: PassNetwork[];
  effectiveMinVerticalFt: number;
  effectiveMinAcreage: number;
  effectiveMinNordicKm: number;
  searchQuery: string;
}

export interface ResortCatalogSortOptions {
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export interface CuratedResortSeed {
  id: string;
  name: string;
  cleanName: string;
  tokens: string[];
  lat: number;
  lng: number;
}

export interface GlobalSkiAreasResult {
  features: any[];
  resorts: SkiResort[];
  counts: {
    downhill: number;
    nordic: number;
    heli_cat: number;
  };
}

import React, { useRef, useEffect } from 'react';
import { X, ExternalLink, Mountain, Compass, MapPin, Eye, CloudSnow, Globe, Layers } from 'lucide-react';

interface AttributionBadgeProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface SourceEntry {
  title: string;
  category: string;
  provider: string;
  providerUrl: string;
  description: string;
  coverage: string;
  license: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CARTOGRAPHIC_SOURCES: SourceEntry[] = [
  {
    title: '3D Terrain & Elevation',
    category: 'DEM',
    provider: 'Mapterhorn Project',
    providerUrl: 'https://github.com/tilezen/joerd',
    description: '30m global ground-resolution Digital Elevation Model encoded in Terrarium RGB tiles, calibrated to 0.70× alpine vertical exaggeration.',
    coverage: 'Worldwide · 30m DEM',
    license: 'Open Data / ODbL',
    icon: Mountain,
  },
  {
    title: 'Satellite Orthoimagery',
    category: 'Orthophotos',
    provider: 'Esri & EOX Sentinel-2',
    providerUrl: 'https://www.esri.com/en-us/arcgis/products/world-imagery',
    description: 'Seamless global sub-meter orthoimagery composite (Maxar, Earthstar, USDA) paired with European Space Agency cloud-free summer mosaics.',
    coverage: 'Global High-Res Orthos',
    license: 'Esri Terms / © ESA',
    icon: Layers,
  },
  {
    title: 'Ski Lifts & Trail Geometry',
    category: 'Infrastructure',
    provider: 'OpenSkiData & OpenStreetMap',
    providerUrl: 'https://openskidata.org',
    description: 'Curated directory of 1,611 ski areas, 23,000+ aerial and surface lifts, downhill runs, nordic trail systems, and multi-pass network affiliations.',
    coverage: '1,611 Global Ski Areas',
    license: 'ODbL / OSM Contributors',
    icon: Compass,
  },
  {
    title: 'Fire Lookouts & Watchtowers',
    category: 'Historic Registry',
    provider: 'NHLR & FFLA',
    providerUrl: 'https://nhlr.org',
    description: '1,843 surveyed fire lookouts across North America, classified into authentic operational statuses (active, rental, ruins) with USFS/NPS managing agencies.',
    coverage: '1,843 Lookouts · US & Canada',
    license: 'Public Domain / NHLR',
    icon: Eye,
  },
  {
    title: 'Mountain Summits & Peaks',
    category: 'Hypsometry',
    provider: 'USGS GNIS & Natural Earth',
    providerUrl: 'https://www.usgs.gov/u.s.-board-on-geographic-names',
    description: 'Prominent mountain peaks and summits with official surveyed benchmark elevations in feet and meters, filtered by topographic prominence.',
    coverage: '1,093 Prominent Peaks',
    license: 'Public Domain / USGS',
    icon: MapPin,
  },
  {
    title: 'International Boundaries',
    category: 'Boundaries',
    provider: 'Natural Earth 10m Land Mesh',
    providerUrl: 'https://www.naturalearthdata.com',
    description: '383 continuous terrestrial international land borders with 100% tripoint connectivity. Completely purged of maritime and open-water extensions.',
    coverage: '175 Global Tripoints · 0 Ocean Lines',
    license: 'Public Domain / NACIS',
    icon: Globe,
  },
  {
    title: 'Alpine Snowfall & Weather',
    category: 'Meteorology',
    provider: 'Open-Meteo Alpine Ensemble',
    providerUrl: 'https://open-meteo.com',
    description: 'Summit-calibrated snowfall water equivalents and 7-day weather forecasts utilizing high-resolution ECMWF and NOAA HRRR model ensembles.',
    coverage: '7-Day Cumulative Snowfall',
    license: 'CC-BY 4.0 / NOAA / ECMWF',
    icon: CloudSnow,
  },
];

export const AttributionBadge: React.FC<AttributionBadgeProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Quiet, unobtrusive trigger button in bottom-right corner (never clutters the map) */}
      <div className="absolute bottom-2 right-3 md:right-6 z-20 pointer-events-auto select-none">
        <button
          onClick={onToggle}
          className={`flex items-center justify-center w-5 h-5 rounded-md transition-all cursor-pointer ${
            isOpen
              ? 'bg-[#1C1B18] text-[#FAF8F3] border border-[#1C1B18] shadow-md'
              : 'bg-[#FAF8F3]/90 hover:bg-[#FAF8F3] backdrop-blur-xs border border-[#D6D0C2] hover:border-[#1C1B18] text-[#5C5852] hover:text-[#1C1B18] shadow-xs'
          }`}
          title="Data Sources & Cartographic Provenance"
          aria-label="Toggle data sources modal"
        >
          <span className="font-sans italic font-bold text-[11px] leading-none">i</span>
        </button>
      </div>

      {/* On-demand Editorial Cartographic Provenance Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/35 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={onClose}
        >
          <div
            ref={modalContentRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#FAF8F3] border border-[#D6D0C2] rounded-lg shadow-xl overflow-hidden text-[#1C1B18] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-4 pb-3 border-b border-[#E5E0D5] bg-[#F7F4ED]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wider text-[11px] uppercase text-[#B84A39]">
                    Cartographic Provenance
                  </span>
                  <span className="text-[10px] text-[#8A847C] font-mono">
                    · Editorial Standard
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#1C1B18] tracking-tight mt-0.5">
                  Foundational Datasets &amp; Sources
                </h2>
                <p className="text-xs text-[#736E67] mt-0.5 leading-relaxed">
                  Every elevation benchmark, vector boundary, and snowfall metric is grounded in verifiable real-world provenance.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-[#736E67] hover:text-[#1C1B18] hover:bg-[#EAE5D9] transition-colors cursor-pointer"
                title="Close sources (Esc)"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Sources Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {CARTOGRAPHIC_SOURCES.map((source) => {
                  const Icon = source.icon;
                  return (
                    <div
                      key={source.title}
                      className="p-3 bg-[#FAF8F3] border border-[#E5E0D5] hover:border-[#A8A299] rounded-md transition-all flex flex-col justify-between space-y-2 shadow-2xs group"
                    >
                      <div>
                        {/* Card Header: Icon + Category + Title */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="p-1 rounded-sm bg-[#EFECE6] text-[#5C5852] group-hover:text-[#1C1B18] group-hover:bg-[#E2DDD5] transition-colors shrink-0">
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-bold text-[#1C1B18] truncate">
                              {source.title}
                            </span>
                          </div>
                          <span className="text-[9.5px] font-mono uppercase text-[#8A847C] px-1.5 py-0.5 rounded-xs bg-[#EFECE6] border border-[#E0DBD0] shrink-0">
                            {source.category}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-[#5C5852] leading-snug">
                          {source.description}
                        </p>
                      </div>

                      {/* Card Footer: Provider Link & Coverage / License */}
                      <div className="pt-2 border-t border-[#EAE5D9] flex items-center justify-between text-[10px]">
                        <a
                          href={source.providerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#2B5B84] hover:text-[#1F4567] hover:underline inline-flex items-center gap-1 group/link"
                        >
                          <span>{source.provider}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover/link:opacity-100" />
                        </a>
                        <span className="text-[#8A847C] font-mono text-[9px] truncate max-w-[130px]" title={`${source.coverage} · ${source.license}`}>
                          {source.coverage}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-4 border-t border-[#E5E0D5] bg-[#F7F4ED] flex items-center justify-between text-[11px] text-[#736E67]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1C1B18]">Full documentation:</span>
                <span className="font-mono text-[10px] bg-[#EFECE6] px-1.5 py-0.5 rounded border border-[#E0DBD0]">
                  DATA_SOURCES.md
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-md text-xs font-bold bg-[#FAF8F3] hover:bg-[#EAE5D9] border border-[#D6D0C2] hover:border-[#A8A299] text-[#1C1B18] transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

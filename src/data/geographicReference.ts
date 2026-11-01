// Comprehensive Geographic Reference Dataset (Countries, Gateway Metros & Alpine Valley Hubs)
// Optimized for 360° viewport billboarding (always upright during 3D orbits)

export interface GeoReferenceFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    name: string;
    kind: 'country' | 'gateway' | 'alpine_hub';
    country?: string;
    minzoom: number;
    maxzoom: number;
    importance: number; // 1 = highest
  };
}

export const GEOGRAPHIC_REFERENCE_GEOJSON: {
  type: 'FeatureCollection';
  features: GeoReferenceFeature[];
} = {
  type: 'FeatureCollection',
  features: [
    // =========================================================================
    // 1. SOVEREIGN NATIONS (CENTROIDS) — Visible at macro scale (z 1.2 - 5.5)
    // =========================================================================
    // Major Ski Nations (Americas)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-98.5795, 39.8283] }, properties: { name: 'United States', kind: 'country', minzoom: 1.2, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.3468, 56.1304] }, properties: { name: 'Canada', kind: 'country', minzoom: 1.2, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-71.5430, -35.6751] }, properties: { name: 'Chile', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-63.6167, -38.4161] }, properties: { name: 'Argentina', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-102.5528, 23.6345] }, properties: { name: 'Mexico', kind: 'country', minzoom: 2.0, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-51.9253, -14.2350] }, properties: { name: 'Brazil', kind: 'country', minzoom: 2.0, maxzoom: 5.5, importance: 2 } },

    // Major Ski Nations (Europe & Alps)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [8.2275, 46.8182] }, properties: { name: 'Switzerland', kind: 'country', minzoom: 1.8, maxzoom: 6.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [14.5501, 47.5162] }, properties: { name: 'Austria', kind: 'country', minzoom: 1.8, maxzoom: 6.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [2.2137, 46.2276] }, properties: { name: 'France', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [12.5674, 41.8719] }, properties: { name: 'Italy', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.4515, 51.1657] }, properties: { name: 'Germany', kind: 'country', minzoom: 1.8, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-3.7492, 40.4637] }, properties: { name: 'Spain', kind: 'country', minzoom: 1.8, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [8.4689, 60.4720] }, properties: { name: 'Norway', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [18.6435, 60.1282] }, properties: { name: 'Sweden', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [25.7482, 61.9241] }, properties: { name: 'Finland', kind: 'country', minzoom: 1.8, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-3.4360, 55.3781] }, properties: { name: 'United Kingdom', kind: 'country', minzoom: 1.8, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [19.1451, 51.9194] }, properties: { name: 'Poland', kind: 'country', minzoom: 2.0, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [15.4730, 49.8175] }, properties: { name: 'Czechia', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [19.6990, 48.6690] }, properties: { name: 'Slovakia', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [14.9955, 46.1512] }, properties: { name: 'Slovenia', kind: 'country', minzoom: 2.4, maxzoom: 6.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [21.8243, 39.0742] }, properties: { name: 'Greece', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [25.4858, 42.7339] }, properties: { name: 'Bulgaria', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [24.9668, 45.9432] }, properties: { name: 'Romania', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [35.2433, 38.9637] }, properties: { name: 'Turkey', kind: 'country', minzoom: 2.0, maxzoom: 5.5, importance: 2 } },

    // Asia & Pacific
    { type: 'Feature', geometry: { type: 'Point', coordinates: [138.2529, 36.2048] }, properties: { name: 'Japan', kind: 'country', minzoom: 1.5, maxzoom: 5.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [104.1954, 35.8617] }, properties: { name: 'China', kind: 'country', minzoom: 1.2, maxzoom: 5.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [127.7669, 35.9078] }, properties: { name: 'South Korea', kind: 'country', minzoom: 2.0, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [78.9629, 20.5937] }, properties: { name: 'India', kind: 'country', minzoom: 1.5, maxzoom: 5.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [84.1240, 28.3949] }, properties: { name: 'Nepal', kind: 'country', minzoom: 2.2, maxzoom: 5.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [133.7751, -25.2744] }, properties: { name: 'Australia', kind: 'country', minzoom: 1.2, maxzoom: 5.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [174.8860, -40.9006] }, properties: { name: 'New Zealand', kind: 'country', minzoom: 1.8, maxzoom: 5.5, importance: 1 } },

    // =========================================================================
    // 2. ALPINE GATEWAY METROS & MAJOR AIRPORTS — Visible at regional scale (z 3.8 - 9.0)
    // =========================================================================
    // North America (US Rockies & West)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.9903, 39.7392] }, properties: { name: 'Denver', country: 'USA', kind: 'gateway', minzoom: 3.8, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-111.8910, 40.7608] }, properties: { name: 'Salt Lake City', country: 'USA', kind: 'gateway', minzoom: 3.8, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.3321, 47.6062] }, properties: { name: 'Seattle', country: 'USA', kind: 'gateway', minzoom: 4.0, maxzoom: 9.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] }, properties: { name: 'San Francisco', country: 'USA', kind: 'gateway', minzoom: 4.0, maxzoom: 9.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.2437, 34.0522] }, properties: { name: 'Los Angeles', country: 'USA', kind: 'gateway', minzoom: 3.8, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-119.8138, 39.5296] }, properties: { name: 'Reno', country: 'USA', kind: 'gateway', minzoom: 4.5, maxzoom: 10.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-116.2023, 43.6150] }, properties: { name: 'Boise', country: 'USA', kind: 'gateway', minzoom: 4.5, maxzoom: 10.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-111.0429, 45.6770] }, properties: { name: 'Bozeman', country: 'USA', kind: 'gateway', minzoom: 5.0, maxzoom: 10.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-105.9378, 35.6870] }, properties: { name: 'Santa Fe', country: 'USA', kind: 'gateway', minzoom: 5.0, maxzoom: 10.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-71.0589, 42.3601] }, properties: { name: 'Boston', country: 'USA', kind: 'gateway', minzoom: 4.0, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9851, 40.7488] }, properties: { name: 'New York', country: 'USA', kind: 'gateway', minzoom: 3.5, maxzoom: 9.0, importance: 1 } },

    // North America (Canada)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-114.0719, 51.0447] }, properties: { name: 'Calgary', country: 'Canada', kind: 'gateway', minzoom: 3.8, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-123.1207, 49.2827] }, properties: { name: 'Vancouver', country: 'Canada', kind: 'gateway', minzoom: 3.8, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-113.4938, 53.5461] }, properties: { name: 'Edmonton', country: 'Canada', kind: 'gateway', minzoom: 4.2, maxzoom: 9.5, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.5673, 45.5017] }, properties: { name: 'Montreal', country: 'Canada', kind: 'gateway', minzoom: 4.0, maxzoom: 9.5, importance: 1 } },

    // Europe (Alps & Gateway Hubs)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.1432, 46.2044] }, properties: { name: 'Geneva', country: 'Switzerland', kind: 'gateway', minzoom: 4.5, maxzoom: 11.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [8.5417, 47.3769] }, properties: { name: 'Zurich', country: 'Switzerland', kind: 'gateway', minzoom: 4.5, maxzoom: 11.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [11.3945, 47.2692] }, properties: { name: 'Innsbruck', country: 'Austria', kind: 'gateway', minzoom: 4.5, maxzoom: 11.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [13.0550, 47.8095] }, properties: { name: 'Salzburg', country: 'Austria', kind: 'gateway', minzoom: 4.8, maxzoom: 11.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [16.3738, 48.2082] }, properties: { name: 'Vienna', country: 'Austria', kind: 'gateway', minzoom: 4.0, maxzoom: 9.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [11.5820, 48.1351] }, properties: { name: 'Munich', country: 'Germany', kind: 'gateway', minzoom: 4.2, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [9.1900, 45.4642] }, properties: { name: 'Milan', country: 'Italy', kind: 'gateway', minzoom: 4.2, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [7.6869, 45.0703] }, properties: { name: 'Turin', country: 'Italy', kind: 'gateway', minzoom: 4.5, maxzoom: 10.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [4.8357, 45.7640] }, properties: { name: 'Lyon', country: 'France', kind: 'gateway', minzoom: 4.2, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [5.7245, 45.1885] }, properties: { name: 'Grenoble', country: 'France', kind: 'gateway', minzoom: 5.0, maxzoom: 11.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [2.3522, 48.8566] }, properties: { name: 'Paris', country: 'France', kind: 'gateway', minzoom: 3.5, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.7522, 59.9139] }, properties: { name: 'Oslo', country: 'Norway', kind: 'gateway', minzoom: 4.2, maxzoom: 10.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [18.0686, 59.3293] }, properties: { name: 'Stockholm', country: 'Sweden', kind: 'gateway', minzoom: 4.2, maxzoom: 10.0, importance: 1 } },

    // Asia & Pacific Gateways
    { type: 'Feature', geometry: { type: 'Point', coordinates: [139.6917, 35.6895] }, properties: { name: 'Tokyo', country: 'Japan', kind: 'gateway', minzoom: 3.5, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [141.3545, 43.0618] }, properties: { name: 'Sapporo', country: 'Japan', kind: 'gateway', minzoom: 4.5, maxzoom: 10.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [138.1811, 36.6513] }, properties: { name: 'Nagano', country: 'Japan', kind: 'gateway', minzoom: 5.2, maxzoom: 11.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [172.6362, -43.5321] }, properties: { name: 'Christchurch', country: 'New Zealand', kind: 'gateway', minzoom: 4.5, maxzoom: 10.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [151.2093, -33.8688] }, properties: { name: 'Sydney', country: 'Australia', kind: 'gateway', minzoom: 3.8, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [144.9631, -37.8136] }, properties: { name: 'Melbourne', country: 'Australia', kind: 'gateway', minzoom: 4.0, maxzoom: 9.5, importance: 1 } },

    // South America Gateways
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-70.6693, -33.4489] }, properties: { name: 'Santiago', country: 'Chile', kind: 'gateway', minzoom: 3.8, maxzoom: 9.5, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-58.3816, -34.6037] }, properties: { name: 'Buenos Aires', country: 'Argentina', kind: 'gateway', minzoom: 3.8, maxzoom: 9.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-68.8458, -32.8895] }, properties: { name: 'Mendoza', country: 'Argentina', kind: 'gateway', minzoom: 4.8, maxzoom: 10.5, importance: 2 } },

    // =========================================================================
    // 3. ALPINE VALLEY HUBS & SKI CENTERS — Visible at mountain scale (z 6.5 - 13.0)
    // =========================================================================
    // North America (US Rockies & Sierra)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.8175, 39.1911] }, properties: { name: 'Aspen', country: 'USA', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.3742, 39.6403] }, properties: { name: 'Vail', country: 'USA', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.0384, 39.4817] }, properties: { name: 'Breckenridge', country: 'USA', kind: 'alpine_hub', minzoom: 7.5, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.8317, 40.4850] }, properties: { name: 'Steamboat Springs', country: 'USA', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-107.8123, 37.9375] }, properties: { name: 'Telluride', country: 'USA', kind: 'alpine_hub', minzoom: 7.5, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-106.9878, 38.8697] }, properties: { name: 'Crested Butte', country: 'USA', kind: 'alpine_hub', minzoom: 7.5, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-110.7624, 43.4799] }, properties: { name: 'Jackson', country: 'USA', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-114.3637, 43.6811] }, properties: { name: 'Sun Valley', country: 'USA', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-111.4980, 40.6461] }, properties: { name: 'Park City', country: 'USA', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-120.0324, 39.0968] }, properties: { name: 'Lake Tahoe', country: 'USA', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.9721, 37.6485] }, properties: { name: 'Mammoth Lakes', country: 'USA', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-105.5734, 36.4072] }, properties: { name: 'Taos', country: 'USA', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },

    // North America (Canada)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.9574, 50.1163] }, properties: { name: 'Whistler', country: 'Canada', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-115.5708, 51.1784] }, properties: { name: 'Banff', country: 'Canada', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-115.3637, 51.0899] }, properties: { name: 'Canmore', country: 'Canada', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-118.1957, 50.9981] }, properties: { name: 'Revelstoke', country: 'Canada', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-116.9654, 51.2980] }, properties: { name: 'Golden', country: 'Canada', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-115.0631, 49.5042] }, properties: { name: 'Fernie', country: 'Canada', kind: 'alpine_hub', minzoom: 7.5, maxzoom: 13.0, importance: 2 } },

    // Europe (Alps)
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.8694, 45.9237] }, properties: { name: 'Chamonix', country: 'France', kind: 'alpine_hub', minzoom: 6.5, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [7.7491, 45.9765] }, properties: { name: 'Zermatt', country: 'Switzerland', kind: 'alpine_hub', minzoom: 6.5, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [9.8355, 46.4908] }, properties: { name: 'St. Moritz', country: 'Switzerland', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [9.8329, 46.8027] }, properties: { name: 'Davos', country: 'Switzerland', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [7.2286, 46.0968] }, properties: { name: 'Verbier', country: 'Switzerland', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [7.8632, 46.6863] }, properties: { name: 'Interlaken', country: 'Switzerland', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [8.0414, 46.6242] }, properties: { name: 'Grindelwald', country: 'Switzerland', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.6348, 45.4150] }, properties: { name: 'Courchevel', country: 'France', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.9803, 45.4480] }, properties: { name: "Val d'Isère", country: 'France', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.7089, 46.1792] }, properties: { name: 'Morzine', country: 'France', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [12.3913, 47.4464] }, properties: { name: 'Kitzbühel', country: 'Austria', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.2644, 47.1296] }, properties: { name: 'St. Anton am Arlberg', country: 'Austria', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [11.0076, 46.9655] }, properties: { name: 'Sölden', country: 'Austria', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.2917, 47.0116] }, properties: { name: 'Ischgl', country: 'Austria', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [12.1357, 46.5405] }, properties: { name: "Cortina d'Ampezzo", country: 'Italy', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.8272, 46.2294] }, properties: { name: 'Madonna di Campiglio', country: 'Italy', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [10.1357, 46.5386] }, properties: { name: 'Livigno', country: 'Italy', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [6.9724, 45.7969] }, properties: { name: 'Courmayeur', country: 'Italy', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [11.0955, 47.4917] }, properties: { name: 'Garmisch-Partenkirchen', country: 'Germany', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 2 } },

    // Asia & Southern Hemisphere
    { type: 'Feature', geometry: { type: 'Point', coordinates: [137.8633, 36.7022] }, properties: { name: 'Hakuba', country: 'Japan', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [140.6974, 42.8617] }, properties: { name: 'Niseko', country: 'Japan', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [138.4414, 36.9208] }, properties: { name: 'Nozawa Onsen', country: 'Japan', kind: 'alpine_hub', minzoom: 7.2, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [168.6626, -45.0312] }, properties: { name: 'Queenstown', country: 'New Zealand', kind: 'alpine_hub', minzoom: 6.5, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [169.1321, -44.7032] }, properties: { name: 'Wanaka', country: 'New Zealand', kind: 'alpine_hub', minzoom: 6.8, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-71.3082, -41.1335] }, properties: { name: 'Bariloche', country: 'Argentina', kind: 'alpine_hub', minzoom: 6.5, maxzoom: 13.0, importance: 1 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-71.3533, -40.1580] }, properties: { name: 'San Martín de los Andes', country: 'Argentina', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [148.6219, -36.4253] }, properties: { name: 'Jindabyne', country: 'Australia', kind: 'alpine_hub', minzoom: 7.0, maxzoom: 13.0, importance: 2 } },
  ],
};

const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '..', 'public', 'data', 'major_peaks.geojson');
const raw = fs.readFileSync(geojsonPath, 'utf8');
const data = JSON.parse(raw);

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function makePeakProps(id, name, elev_m, continent = 'Europe') {
  const elev_ft = Math.round(elev_m * 3.28084);
  const formatted_ft = `${formatNumber(elev_ft)}'`;
  const formatted_m = `${formatNumber(elev_m)} m`;
  return {
    id,
    name,
    elevation_ft: elev_ft,
    elevation_m: elev_m,
    elevation_formatted_ft: formatted_ft,
    elevation_formatted_m: formatted_m,
    label_ft: `▲ ${name} · ${formatted_ft}`,
    label_m: `▲ ${name} · ${formatted_m}`,
    label_stacked_ft: `▲ ${name}\n${formatted_ft}`,
    label_stacked_m: `▲ ${name}\n${formatted_m}`,
    sort_key: 40000 - elev_ft,
    continent,
  };
}

// 1. IDs to remove (duplicates / invalid)
const idsToRemove = new Set([
  'peak-832', // exact duplicate of Mount Olympus
  'peak-2825', // duplicate of Cerro General Belgrano / Famatina
  'peak-2829', // duplicate range entry
]);

// 2. Specific feature overrides
const featureUpdates = {
  // Mount Olympus (Mytikas) — surveyed geodetic benchmark coordinate
  'peak-831': {
    name: 'Mount Olympus (Mytikas)',
    coords: [22.358553, 40.086239],
    elev_m: 2918,
    continent: 'Europe',
  },
  // Greek peaks: snap to surveyed summit markers
  'peak-835': {
    name: 'Mount Parnassus (Liakoura)',
    coords: [22.624167, 38.535833],
    elev_m: 2457,
    continent: 'Europe',
  },
  'peak-823': {
    name: 'Falakro (Profitis Ilias)',
    coords: [24.094722, 41.293889],
    elev_m: 2232,
    continent: 'Europe',
  },
  'peak-822': {
    name: 'Erymanthos (Olenos)',
    coords: [21.847500, 37.985556],
    elev_m: 2224,
    continent: 'Europe',
  },
  'peak-836': {
    name: 'Pieria Ori (Flambouro)',
    coords: [22.285833, 40.231944],
    elev_m: 2190,
    continent: 'Europe',
  },
  'peak-828': {
    name: 'Koziakas (Astrapodi)',
    coords: [21.554167, 39.567778],
    elev_m: 1901,
    continent: 'Europe',
  },
  'peak-826': {
    name: 'Karava (Schizokaravo)',
    coords: [21.571389, 39.314722],
    elev_m: 2184,
    continent: 'Europe',
  },
  'peak-838': {
    name: 'Psiloreitis (Timios Stavros)',
    coords: [24.772500, 35.226667],
    elev_m: 2456,
    continent: 'Europe',
  },
  'peak-827': {
    name: 'Katafidhi (Tzoumerka)',
    coords: [21.129444, 39.467778],
    elev_m: 2393,
    continent: 'Europe',
  },
  'peak-837': {
    name: 'Pinovo',
    coords: [22.124167, 41.107500],
    elev_m: 2156,
    continent: 'Europe',
  },
  'peak-825': {
    name: 'Kakarditsa',
    coords: [21.200833, 39.526667],
    elev_m: 2429,
    continent: 'Europe',
  },
  'peak-824': {
    name: 'Gingilos',
    coords: [23.928611, 35.284444],
    elev_m: 2080,
    continent: 'Europe',
  },
  'peak-830': {
    name: 'Loupata',
    coords: [21.433333, 39.483333],
    elev_m: 2066,
    continent: 'Europe',
  },
  'peak-833': {
    name: 'Othrys (Gerakovouni)',
    coords: [22.709722, 39.016944],
    elev_m: 1726,
    continent: 'Europe',
  },
  'peak-834': {
    name: 'Paiko (Gola Tsouka)',
    coords: [22.383333, 40.950000],
    elev_m: 1650,
    continent: 'Europe',
  },

  // Coordinate collision fixes across global peaks
  'peak-121': {
    name: 'Kedarnath Dome',
    coords: [79.080556, 30.806944],
    elev_m: 6831,
    continent: 'Asia',
  },
  'peak-122': {
    name: 'Kedarnath',
    coords: [79.096389, 30.796111],
    elev_m: 6940,
    continent: 'Asia',
  },
  'peak-574': {
    name: 'Hochwand',
    coords: [11.008056, 47.336111],
    elev_m: 2719,
    continent: 'Europe',
  },
  'peak-794': {
    name: 'Partenkirchener Dreitorspitze',
    coords: [11.116667, 47.416667],
    elev_m: 2633,
    continent: 'Europe',
  },
  'peak-927': {
    name: 'Monte Matto',
    coords: [7.253611, 44.225556],
    elev_m: 3097,
    continent: 'Europe',
  },
  'peak-1191': {
    name: 'Portillín Oriental',
    coords: [-5.946300, 43.029800],
    elev_m: 2233,
    continent: 'Europe',
  },
  'peak-1210': {
    name: 'Torre Parda',
    coords: [-5.951700, 43.030100],
    elev_m: 2350,
    continent: 'Europe',
  },
  'peak-1823': {
    name: 'North Suicide Peak',
    coords: [-149.579167, 61.036667],
    elev_m: 1544,
    continent: 'North America',
  },
  'peak-1840': {
    name: 'South Suicide Peak',
    coords: [-149.570833, 61.023889],
    elev_m: 1526,
    continent: 'North America',
  },
  'peak-1949': {
    name: 'Mount Gayley',
    coords: [-118.508333, 37.098889],
    elev_m: 4118,
    continent: 'North America',
  },
  'peak-1956': {
    name: 'Polemonium Peak',
    coords: [-118.513333, 37.092778],
    elev_m: 4328,
    continent: 'North America',
  },
  'peak-2799': {
    name: 'Cerro General Belgrano',
    coords: [-67.828611, -29.014167],
    elev_m: 6250,
    continent: 'South America',
  },
  'peak-2809': {
    name: 'Cerro San Bernardo',
    coords: [-69.390556, -32.967222],
    elev_m: 4100,
    continent: 'South America',
  },
  'peak-2811': {
    name: 'Cerro Stepanek',
    coords: [-69.375278, -32.973056],
    elev_m: 4179,
    continent: 'South America',
  },
  'peak-2881': {
    name: 'Paine Grande',
    coords: [-73.094444, -51.050000],
    elev_m: 2884,
    continent: 'South America',
  },
  'peak-2887': {
    name: 'Torre Sur',
    coords: [-72.977222, -50.998889],
    elev_m: 2500,
    continent: 'South America',
  },
};

// 3. New prominent summits to add (premier Greek ranges & ski hubs)
const newPeaksToAdd = [
  {
    id: 'peak-gr-smolikas',
    name: 'Mount Smolikas',
    coords: [20.925556, 40.089444],
    elev_m: 2637,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-voras',
    name: 'Mount Voras (Kaimaktsalan)',
    coords: [21.789167, 40.932778],
    elev_m: 2524,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-giona',
    name: 'Mount Giona (Pyramida)',
    coords: [22.253611, 38.647778],
    elev_m: 2510,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-tymfi',
    name: 'Mount Tymfi (Gamila)',
    coords: [20.816389, 39.996111],
    elev_m: 2497,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-taygetus',
    name: 'Mount Taygetus (Profitis Ilias)',
    coords: [22.350278, 36.953611],
    elev_m: 2404,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-kyllini',
    name: 'Mount Kyllini (Ziria)',
    coords: [22.395833, 37.940556],
    elev_m: 2376,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-helmos',
    name: 'Mount Helmos (Aroania)',
    coords: [22.202500, 37.979444],
    elev_m: 2355,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-vasilitsa',
    name: 'Mount Vasilitsa',
    coords: [21.084722, 40.038611],
    elev_m: 2249,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-mainalo',
    name: 'Mount Mainalo (Ostrakina)',
    coords: [22.261667, 37.653889],
    elev_m: 1981,
    continent: 'Europe',
  },
  {
    id: 'peak-gr-pelion',
    name: 'Mount Pelion (Pourianos Stavros)',
    coords: [23.047500, 39.444722],
    elev_m: 1624,
    continent: 'Europe',
  },
];

// Apply filter and updates
let features = data.features.filter(f => !idsToRemove.has(f.id));

features = features.map(f => {
  if (featureUpdates[f.id]) {
    const upd = featureUpdates[f.id];
    return {
      type: 'Feature',
      id: f.id,
      geometry: {
        type: 'Point',
        coordinates: upd.coords,
      },
      properties: makePeakProps(f.id, upd.name, upd.elev_m, upd.continent),
    };
  }
  return f;
});

// Append new features
for (const np of newPeaksToAdd) {
  features.push({
    type: 'Feature',
    id: np.id,
    geometry: {
      type: 'Point',
      coordinates: np.coords,
    },
    properties: makePeakProps(np.id, np.name, np.elev_m, np.continent),
  });
}

// Sort features by sort_key ascending (highest summits first)
features.sort((a, b) => a.properties.sort_key - b.properties.sort_key);

data.features = features;

fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${geojsonPath} successfully! Total features: ${features.length}`);

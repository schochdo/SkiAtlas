const fs = require('fs');
const path = require('path');

const geojsonPath = path.resolve(__dirname, '../public/data/major_peaks.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// 1. Explicit name cleanups (disambiguation removal and inverted names)
const cleanNameMap = {
  "peak-48": "Widerøefjellet",
  "peak-69": "Nangpai Gosum I",
  "peak-93": "Phola Gangchen",
  "peak-182": "Arakawadake",
  "peak-207": "Tsubakuro-dake",
  "peak-258": "Chulu East",
  "peak-449": "Central Mount Wedge",
  "peak-450": "Lambs Head",
  "peak-492": "Mount Roberts",
  "peak-499": "Point Lookout",
  "peak-506": "The Round Mountain",
  "peak-518": "Mount Taranaki",
  "peak-538": "Tukwasmera",
  "peak-672": "Klínovec",
  "peak-730": "Punta di a Vacca",
  "peak-869": "Cima Canali",
  "peak-870": "Torre Castello",
  "peak-895": "Dreiherrnspitze",
  "peak-896": "Geisterspitze",
  "peak-902": "Hirzer",
  "peak-903": "Hochgall",
  "peak-904": "Hohe Schneide",
  "peak-905": "Hoher Weißzint",
  "peak-906": "Ifinger",
  "peak-933": "Monte Nero",
  "peak-935": "Ortler",
  "peak-947": "Punta del Naso",
  "peak-958": "Rocca Provenzale",
  "peak-961": "Punta Roma",
  "peak-963": "Roteck",
  "peak-965": "Schwarzenstein",
  "peak-970": "Schneebiger Nock",
  "peak-972": "Cima Scotoni",
  "peak-973": "Piz Sesvenna",
  "peak-978": "Texelspitze",
  "peak-983": "Punta Udine",
  "peak-1046": "Wołowiec",
  "peak-1077": "Šljeme",
  "peak-1240": "Simplon-Breithorn",
  "peak-1324": "Rötlspitz",
  "peak-1337": "Silberhorn",
  "peak-1347": "Wasenhorn",
  "peak-1421": "Y Lliwedd",
  "peak-1530": "Mont Albert Nord",
  "peak-1685": "East End of Rundle",
  "peak-1696": "Storm Mountain",
  "peak-1702": "The Lions - East Peak",
  "peak-1786": "Matanuska Peak",
  "peak-1810": "Denali",
  "peak-1932": "Mount Morgan South",
  "peak-2120": "Borah Peak",
  "peak-2818": "Cerro Dos Picos",
  "peak-2823": "Cerro Nato",
  "peak-2857": "Pedra Bonita",
  "peak-2896": "Ritacuba Blanco",
  "peak-2918": "Cerro Blanco"
};

// 2. High-precision coordinate & elevation overrides for prominent summits
const summitOverrides = {
  // Mönch (Bernese Alps): fix Guggigletscher displacement (was 7.9833, 46.5667)
  "peak-1296": {
    coords: [7.997271, 46.558506],
    elevation_m: 4107,
    elevation_ft: 13474
  },
  // Jungfrau (Bernese Alps)
  "peak-1279": {
    coords: [7.962591, 46.536774],
    elevation_m: 4158,
    elevation_ft: 13642
  },
  // Silberhorn (Bernese Alps)
  "peak-1337": {
    name: "Silberhorn",
    coords: [7.948989, 46.541964],
    elevation_m: 3695,
    elevation_ft: 12123
  },
  // Finsteraarhorn (Bernese Alps)
  "peak-1259": {
    coords: [8.126114, 46.537347],
    elevation_m: 4274,
    elevation_ft: 14022
  },
  // Aletschhorn (Bernese Alps)
  "peak-1231": {
    coords: [7.993212, 46.465198],
    elevation_m: 4195,
    elevation_ft: 13763
  },
  // Wetterhorn (Bernese Alps)
  "peak-1351": {
    coords: [8.115604, 46.638666],
    elevation_m: 3692,
    elevation_ft: 12113
  },
  // Schilthorn (Bernese Alps)
  "peak-1333": {
    coords: [7.835175, 46.557282],
    elevation_m: 2970,
    elevation_ft: 9744
  },
  // Matterhorn (Pennine Alps)
  "peak-1293": {
    coords: [7.658602, 45.976426],
    elevation_m: 4478,
    elevation_ft: 14692
  },
  // Breithorn (Pennine Alps / Zermatt)
  "peak-1241": {
    coords: [7.747732, 45.941013],
    elevation_m: 4164,
    elevation_ft: 13661
  },
  // Dom (Mischabel / Pennine Alps)
  "peak-1251": {
    coords: [7.858889, 46.093889],
    elevation_m: 4545,
    elevation_ft: 14911
  },
  // Weisshorn (Pennine Alps)
  "peak-1348": {
    coords: [7.716070, 46.101250],
    elevation_m: 4505,
    elevation_ft: 14780
  },
  // Dent Blanche (Pennine Alps)
  "peak-1246": {
    coords: [7.611931, 46.034176],
    elevation_m: 4357,
    elevation_ft: 14295
  },
  // Grand Combin (Pennine Alps)
  "peak-1265": {
    coords: [7.299224, 45.937576],
    elevation_m: 4314,
    elevation_ft: 14154
  },
  // Dufourspitze / Monte Rosa (Pennine Alps)
  "peak-1252": {
    name: "Dufourspitze",
    coords: [7.866757, 45.936924],
    elevation_m: 4634,
    elevation_ft: 15203
  },
  // Mont Blanc (Grais Alps)
  "peak-699": {
    coords: [6.864350, 45.832620],
    elevation_m: 4809,
    elevation_ft: 15777
  },
  // Gran Paradiso (Grais Alps)
  "peak-897": {
    coords: [7.251944, 45.518611],
    elevation_m: 4061,
    elevation_ft: 13323
  },
  // Piz Bernina (Bernina Range)
  "peak-1238": {
    coords: [9.908052, 46.382428],
    elevation_m: 4049,
    elevation_ft: 13284
  },
  // Grossglockner (Hohe Tauern)
  "peak-565": {
    name: "Grossglockner",
    coords: [12.693883, 47.074546],
    elevation_m: 3798,
    elevation_ft: 12461
  },
  // Zugspitze (Wetterstein)
  "peak-819": {
    coords: [10.986297, 47.421215],
    elevation_m: 2962,
    elevation_ft: 9718
  },
  // Ortler (Ortler Alps)
  "peak-935": {
    name: "Ortler",
    coords: [10.544930, 46.509096],
    elevation_m: 3905,
    elevation_ft: 12812
  },
  // Marmolada (Dolomites)
  "peak-912": {
    name: "Marmolada",
    coords: [11.851348, 46.434546],
    elevation_m: 3343,
    elevation_ft: 10968
  },
  // Aiguille Verte (Mont Blanc Massif - fix 30km displacement)
  "peak-682": {
    coords: [6.973056, 45.936389],
    elevation_m: 4122,
    elevation_ft: 13524
  },
  // Grandes Jorasses (Mont Blanc Massif)
  "peak-694": {
    coords: [6.988056, 45.867222],
    elevation_m: 4208,
    elevation_ft: 13806
  },
  // Piz Buin (Silvretta - fix 65km displacement)
  "peak-599": {
    coords: [10.118889, 46.844167],
    elevation_m: 3312,
    elevation_ft: 10866
  },
  // Gross Fiescherhorn
  "peak-1268": {
    coords: [8.061304, 46.551187],
    elevation_m: 4049,
    elevation_ft: 13284
  },
  // Trugberg
  "peak-1342": {
    coords: [8.015471, 46.547528],
    elevation_m: 3933,
    elevation_ft: 12904
  },
  // Blüemlisalphorn (Bernese Alps - fix 1.31km displacement into Blüemlisalpgletscher)
  "peak-1239": {
    name: "Blüemlisalphorn",
    coords: [7.772511, 46.488896],
    elevation_m: 3661,
    elevation_ft: 12011
  },
  // Aiguille de Rochefort (Mont Blanc Massif)
  "peak-539": {
    name: "Aiguille de Rochefort",
    coords: [6.959972, 45.862102],
    elevation_m: 4001,
    elevation_ft: 13127
  },
  // Augstenberg (Silvretta)
  "peak-544": {
    name: "Augstenberg",
    coords: [10.203855, 46.864624],
    elevation_m: 3228,
    elevation_ft: 10591
  },
  // Drei Türme (Rätikon)
  "peak-545": {
    name: "Drei Türme",
    coords: [9.809874, 47.024655],
    elevation_m: 2830,
    elevation_ft: 9285
  },
  // Hoher Freschen (Bregenz Forest)
  "peak-576": {
    name: "Hoher Freschen",
    coords: [9.777654, 47.306903],
    elevation_m: 2004,
    elevation_ft: 6575
  },
  // Mont Maudit (Mont Blanc Massif)
  "peak-706": {
    name: "Mont Maudit",
    coords: [6.875986, 45.847439],
    elevation_m: 4465,
    elevation_ft: 14649
  },
  // Biberkopf (Allgäu Alps)
  "peak-761": {
    name: "Biberkopf",
    coords: [10.232368, 47.270566],
    elevation_m: 2599,
    elevation_ft: 8527
  },
  // Mädelegabel (Allgäu Alps)
  "peak-792": {
    name: "Mädelegabel",
    coords: [10.295680, 47.299925],
    elevation_m: 2645,
    elevation_ft: 8678
  },
  // Balmenhorn (Pennine Alps)
  "peak-863": {
    name: "Balmenhorn",
    coords: [7.858134, 45.913836],
    elevation_m: 4167,
    elevation_ft: 13671
  },
  // Grigna Meridionale (Bergamo Alps)
  "peak-899": {
    name: "Grigna Meridionale",
    coords: [9.390717, 45.921896],
    elevation_m: 2177,
    elevation_ft: 7142
  },
  // Monte Disgrazia (Bregaglia)
  "peak-921": {
    name: "Monte Disgrazia",
    coords: [9.749624, 46.269535],
    elevation_m: 3678,
    elevation_ft: 12067
  },
  // Resegone (Bergamo Alps)
  "peak-955": {
    name: "Resegone",
    coords: [9.471216, 45.857585],
    elevation_m: 1874,
    elevation_ft: 6148
  },
  // Chörblispitz (Fribourg Alps)
  "peak-1245": {
    name: "Chörblispitz",
    coords: [7.268844, 46.629724],
    elevation_m: 2103,
    elevation_ft: 6900
  },
  // Dents du Midi (Chablais Alps)
  "peak-1250": {
    name: "Dents du Midi",
    coords: [6.925149, 46.162604],
    elevation_m: 3257,
    elevation_ft: 10686
  },
  // Flüela Schwarzhorn (Albula Alps)
  "peak-1260": {
    name: "Flüela Schwarzhorn",
    coords: [9.940556, 46.732778],
    elevation_m: 3147,
    elevation_ft: 10325
  },
  // Galenstock (Urner Alps - fix 48km displacement)
  "peak-1262": {
    name: "Galenstock",
    coords: [8.416957, 46.612621],
    elevation_m: 3586,
    elevation_ft: 11765
  },
  // Grand Muveran (Vaud Alps)
  "peak-1266": {
    name: "Grand Muveran",
    coords: [7.126150, 46.237167],
    elevation_m: 3051,
    elevation_ft: 10010
  },
  // Hinderi Spillgerte (Bernese Alps)
  "peak-1273": {
    name: "Hinderi Spillgerte",
    coords: [7.446713, 46.536484],
    elevation_m: 2476,
    elevation_ft: 8123
  },
  // Lobhörner (Bernese Alps)
  "peak-1291": {
    name: "Lobhörner",
    coords: [7.844250, 46.602565],
    elevation_m: 2566,
    elevation_ft: 8419
  },
  // Mittaghorn (Bernese Alps)
  "peak-1294": {
    name: "Mittaghorn",
    coords: [7.932653, 46.498248],
    elevation_m: 3892,
    elevation_ft: 12769
  },
  // Mont Blanc de Cheilon (Pennine Alps)
  "peak-1297": {
    name: "Mont Blanc de Cheilon",
    coords: [7.417229, 45.993571],
    elevation_m: 3870,
    elevation_ft: 12697
  },
  // Mont Gelé (Pennine Alps)
  "peak-1299": {
    name: "Mont Gelé",
    coords: [7.365899, 45.904139],
    elevation_m: 3518,
    elevation_ft: 11542
  },
  // Tomlishorn / Pilatus (Emmental Alps)
  "peak-1302": {
    name: "Tomlishorn (Pilatus)",
    coords: [8.243333, 46.979722],
    elevation_m: 2128,
    elevation_ft: 6982
  },
  // Nordend (Monte Rosa)
  "peak-1305": {
    name: "Nordend",
    coords: [7.869928, 45.941994],
    elevation_m: 4609,
    elevation_ft: 15121
  },
  // Pigne d'Arolla (Pennine Alps)
  "peak-1310": {
    name: "Pigne d'Arolla",
    coords: [7.455146, 45.991343],
    elevation_m: 3790,
    elevation_ft: 12434
  },
  // Piz Kesch (Albula Alps)
  "peak-1312": {
    name: "Piz Kesch",
    coords: [9.872788, 46.621297],
    elevation_m: 3418,
    elevation_ft: 11214
  },
  // Pollux (Pennine Alps)
  "peak-1319": {
    name: "Pollux",
    coords: [7.785310, 45.927808],
    elevation_m: 4092,
    elevation_ft: 13425
  },
  // Rohrbachstein (Bernese Alps)
  "peak-1325": {
    name: "Rohrbachstein",
    coords: [7.462209, 46.376254],
    elevation_m: 2950,
    elevation_ft: 9678
  },
  // Tödi (Glarus Alps)
  "peak-1341": {
    name: "Tödi",
    coords: [8.914859, 46.811153],
    elevation_m: 3614,
    elevation_ft: 11857
  },
  // Vorderi Spillgerte (Bernese Alps)
  "peak-1345": {
    name: "Vorderi Spillgerte",
    coords: [7.446800, 46.544600],
    elevation_m: 2476,
    elevation_ft: 8123
  },
  // Zinalrothorn (Pennine Alps)
  "peak-1354": {
    name: "Zinalrothorn",
    coords: [7.690124, 46.064827],
    elevation_m: 4221,
    elevation_ft: 13848
  },
  // Derby Peak (Colorado - Flat Tops Wilderness: fix 1.05km displacement below basalt cliff rim)
  "peak-2002": {
    name: "Derby Peak",
    coords: [-107.125329, 39.973596],
    elevation_m: 3714,
    elevation_ft: 12185
  },
  // Buffalo Mountain (Colorado - Gore Range)
  "peak-1868": {
    name: "Buffalo Mountain",
    coords: [-106.142512, 39.620264],
    elevation_m: 3894,
    elevation_ft: 12777
  },
  // Blodgett Peak (Colorado - Front Range)
  "peak-1987": {
    name: "Blodgett Peak",
    coords: [-104.918037, 38.966934],
    elevation_m: 2872,
    elevation_ft: 9423
  },
  // California Peak (Colorado - Sangre de Cristo)
  "peak-1988": {
    name: "California Peak",
    coords: [-105.498623, 37.614171],
    elevation_m: 4221,
    elevation_ft: 13849
  },
  // Cathedral Peak (Colorado - Elk Mountains)
  "peak-1992": {
    name: "Cathedral Peak",
    coords: [-106.858929, 39.034435],
    elevation_m: 4250,
    elevation_ft: 13943
  },
  // Hayden Peak (Colorado - Elk Mountains)
  "peak-2011": {
    name: "Hayden Peak",
    coords: [-106.851985, 39.059434],
    elevation_m: 4133,
    elevation_ft: 13561
  },
  // Mount Daly (Colorado - Elk Mountains)
  "peak-2039": {
    name: "Mount Daly",
    coords: [-107.068658, 39.172209],
    elevation_m: 4055,
    elevation_ft: 13305
  },
  // Mount Toll (Colorado - Indian Peaks)
  "peak-2068": {
    name: "Mount Toll",
    coords: [-105.633614, 40.088319],
    elevation_m: 3956,
    elevation_ft: 12979
  },
  // Ormes Peak (Colorado - Front Range)
  "peak-2076": {
    name: "Ormes Peak",
    coords: [-104.943037, 38.955823],
    elevation_m: 2965,
    elevation_ft: 9728
  },
  // Pyramid Peak (Colorado - Elk Mountains)
  "peak-2083": {
    name: "Pyramid Peak",
    coords: [-106.950112, 39.071657],
    elevation_m: 4273,
    elevation_ft: 14018
  },
  // Twin Sisters Peaks (Colorado - Front Range)
  "peak-2099": {
    name: "Twin Sisters Peaks",
    coords: [-105.518332, 40.288873],
    elevation_m: 3483,
    elevation_ft: 11428
  },
  // Mount Assiniboine (Canadian Rockies)
  "peak-1547": {
    name: "Mount Assiniboine",
    coords: [-115.651347, 50.870019],
    elevation_m: 3618,
    elevation_ft: 11870
  },
  // Humphreys Peak (San Francisco Peaks / Arizona)
  "peak-1856": {
    name: "Humphreys Peak",
    coords: [-111.677963, 35.346381],
    elevation_m: 3852,
    elevation_ft: 12637
  },
  // US and other prominent mountains with known official imperial heights
  "peak-1809": { name: "Mount McGinnis", elevation_ft: 11400, elevation_m: 3475 },
  "peak-1819": { name: "Mt. Palmer", elevation_ft: 6970, elevation_m: 2124 },
  "peak-2017": { name: "Ice Mountain", elevation_ft: 13951, elevation_m: 4252 },
  "peak-2046": { name: "Mount Harvard", elevation_ft: 14420, elevation_m: 4395 },
  "peak-2090": { name: "Snowmass Mountain", elevation_ft: 14092, elevation_m: 4295 },
  "peak-2428": { name: "Lost Mine Peak", elevation_ft: 7535, elevation_m: 2297 },
  "peak-2703": { name: "Sahale Mountain", elevation_ft: 8680, elevation_m: 2646 },
  "peak-2710": { name: "Shriner Peak", elevation_ft: 5834, elevation_m: 1778 },
  "peak-2722": { name: "Sourdough Mountain", elevation_ft: 6112, elevation_m: 1863 },
  "peak-374":  { name: "Mount Kanlaon", elevation_m: 2450, elevation_ft: 8038 },
  "peak-314":  { name: "Haramosh Kutwal Galli", elevation_m: 4800, elevation_ft: 15748 },
  "peak-895":  { name: "Dreiherrnspitze", elevation_m: 3498, elevation_ft: 11476 },
  "peak-913":  { name: "Moncucco", elevation_m: 1896, elevation_ft: 6220 },
  "peak-982":  { name: "Torri del Vajolet", elevation_m: 2805, elevation_ft: 9203 },
  "peak-1330": { name: "Säntis", elevation_m: 2502, elevation_ft: 8209 },
  "peak-2817": { name: "Domuyo", elevation_m: 4709, elevation_ft: 15449 },
  "peak-2939": { name: "Siula Grande", elevation_m: 6344, elevation_ft: 20814 }
};

let updatedCount = 0;

data.features.forEach(f => {
  const id = f.id;
  const p = f.properties;

  // 1. Name cleaning
  if (cleanNameMap[id]) {
    p.name = cleanNameMap[id];
  } else if (/\(/.test(p.name)) {
    // General fallback for remaining parenthetical suffixes
    p.name = p.name.replace(/\s*\([^)]*\)/g, '').trim();
  }

  // 2. Apply summit overrides if present
  if (summitOverrides[id]) {
    const o = summitOverrides[id];
    if (o.name) p.name = o.name;
    if (o.coords) f.geometry.coordinates = o.coords;
    if (o.elevation_m !== undefined) p.elevation_m = o.elevation_m;
    if (o.elevation_ft !== undefined) p.elevation_ft = o.elevation_ft;
  }

  // 3. Strict unit hygiene: guarantee elevation_ft is mathematically consistent with elevation_m
  if (summitOverrides[id] && summitOverrides[id].elevation_ft !== undefined && summitOverrides[id].elevation_m !== undefined) {
    // Keep explicit summit overrides
    p.elevation_m = summitOverrides[id].elevation_m;
    p.elevation_ft = summitOverrides[id].elevation_ft;
  } else if (p.elevation_m) {
    p.elevation_ft = Math.round(p.elevation_m * 3.28084);
  } else if (p.elevation_ft) {
    p.elevation_m = Math.round(p.elevation_ft / 3.28084);
  }

  // 4. Regenerate all formatted strings and sort keys
  p.elevation_formatted_ft = `${p.elevation_ft.toLocaleString()}'`;
  p.elevation_formatted_m = `${p.elevation_m.toLocaleString()} m`;
  p.label_ft = `▲ ${p.name} · ${p.elevation_formatted_ft}`;
  p.label_m = `▲ ${p.name} · ${p.elevation_formatted_m}`;
  p.label_stacked_ft = `▲ ${p.name}\n${p.elevation_formatted_ft}`;
  p.label_stacked_m = `▲ ${p.name}\n${p.elevation_formatted_m}`;
  p.sort_key = 40000 - p.elevation_ft;

  updatedCount++;
});

fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Successfully updated ${updatedCount} features in ${geojsonPath}`);

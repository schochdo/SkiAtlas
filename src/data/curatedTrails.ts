// Curated High-Quality Alpine Ski Trails, Lift Alignments & Boundaries
// Pre-bundled for 0ms Instant Loading (No Slow Ad-Hoc Overpass Network Queries)

export interface PisteFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    id: string;
    kind: 'piste' | 'lift';
    name: string;
    difficulty: 'novice' | 'intermediate' | 'advanced' | 'expert' | 'unknown';
    lift_type?: string;
    'piste:type'?: 'downhill';
    'piste:difficulty'?: string;
    aerialway?: string;
  };
}

export const CURATED_RESORT_BOUNDARIES: Record<string, [number, number][]> = {
  'jackson-hole': [
    [-110.826, 43.585],
    [-110.835, 43.609],
    [-110.849, 43.611],
    [-110.865, 43.606],
    [-110.875, 43.599],
    [-110.871, 43.590],
    [-110.861, 43.586],
    [-110.838, 43.582],
    [-110.826, 43.585],
  ],
  telluride: [
    [-107.810, 37.938],
    [-107.828, 37.940],
    [-107.862, 37.938],
    [-107.868, 37.925],
    [-107.858, 37.902],
    [-107.838, 37.896],
    [-107.818, 37.894],
    [-107.805, 37.915],
    [-107.810, 37.938],
  ],
  vail: [
    [-106.395, 39.646],
    [-106.355, 39.644],
    [-106.330, 39.638],
    [-106.320, 39.610],
    [-106.335, 39.578],
    [-106.365, 39.575],
    [-106.388, 39.588],
    [-106.402, 39.615],
    [-106.395, 39.646],
  ],
  'aspen-snowmass': [
    [-106.940, 39.215],
    [-106.925, 39.200],
    [-106.948, 39.170],
    [-106.985, 39.168],
    [-106.995, 39.185],
    [-106.965, 39.220],
    [-106.940, 39.215],
  ],
  breckenridge: [
    [-106.045, 39.482],
    [-106.042, 39.460],
    [-106.072, 39.445],
    [-106.095, 39.475],
    [-106.088, 39.502],
    [-106.060, 39.500],
    [-106.045, 39.482],
  ],
  alta: [
    [-111.642, 40.592],
    [-111.625, 40.590],
    [-111.605, 40.575],
    [-111.615, 40.560],
    [-111.645, 40.570],
    [-111.642, 40.592],
  ],
  snowbird: [
    [-111.662, 40.585],
    [-111.642, 40.582],
    [-111.635, 40.550],
    [-111.658, 40.548],
    [-111.670, 40.570],
    [-111.662, 40.585],
  ],
  'big-sky': [
    [-111.390, 45.290],
    [-111.385, 45.275],
    [-111.425, 45.258],
    [-111.468, 45.270],
    [-111.460, 45.295],
    [-111.410, 45.302],
    [-111.390, 45.290],
  ],
  'whistler-blackcomb': [
    [-122.965, 50.122],
    [-122.915, 50.110],
    [-122.875, 50.080],
    [-122.920, 50.052],
    [-122.972, 50.060],
    [-122.985, 50.095],
    [-122.965, 50.122],
  ],
};

export const CURATED_RESORT_TRAILS: Record<string, PisteFeature[]> = {
  // -------------------------------------------------------------------------
  // TELLURIDE, COLORADO (Clean, Upright, Authentic Mountain Infrastructure)
  // -------------------------------------------------------------------------
  telluride: [
    // Lifts & Aerialways
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.812, 37.937], // Town Station (8,750')
          [-107.828, 37.930], // San Sophia Station (10,540')
          [-107.855, 37.935], // Mountain Village Station (9,540')
        ],
      },
      properties: {
        id: 'tel-gondola',
        kind: 'lift',
        name: 'Free Town-to-Village Gondola',
        difficulty: 'unknown',
        lift_type: '8-Passenger Public Transit Gondola',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.855, 37.935], // Mountain Village base
          [-107.838, 37.918], // Top of Lift 4
        ],
      },
      properties: {
        id: 'tel-lift4',
        kind: 'lift',
        name: 'Village Express (Lift 4)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.838, 37.918],
          [-107.836, 37.905], // Gold Hill top (12,255')
        ],
      },
      properties: {
        id: 'tel-lift14',
        kind: 'lift',
        name: 'Gold Hill Express (Lift 14)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.836, 37.905], // Gold Hill Ridge
          [-107.834, 37.898], // Revelation Bowl (12,570')
        ],
      },
      properties: {
        id: 'tel-lift15',
        kind: 'lift',
        name: 'Revelation Lift (Lift 15)',
        difficulty: 'unknown',
        lift_type: 'Fixed-Grip Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.818, 37.936], // Town Base (Lift 7 / 8)
          [-107.828, 37.920], // Top of Plunge (11,960')
        ],
      },
      properties: {
        id: 'tel-lift9',
        kind: 'lift',
        name: 'Plunge Lift (Lift 9)',
        difficulty: 'unknown',
        lift_type: 'Triple Chair (3,140 ft vert)',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.842, 37.915],
          [-107.835, 37.905],
        ],
      },
      properties: {
        id: 'tel-lift6',
        kind: 'lift',
        name: 'Apex Lift (Lift 6)',
        difficulty: 'unknown',
        lift_type: 'Triple Chair',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.852, 37.925],
          [-107.838, 37.910],
        ],
      },
      properties: {
        id: 'tel-lift5',
        kind: 'lift',
        name: 'Polar Queen Express (Lift 5)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.860, 37.920],
          [-107.848, 37.908],
        ],
      },
      properties: {
        id: 'tel-lift10',
        kind: 'lift',
        name: 'Sunshine Express (Lift 10)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },

    // Downhill Pistes
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.848, 37.908], // Top of Sunshine
          [-107.852, 37.912],
          [-107.855, 37.918],
          [-107.862, 37.925],
          [-107.858, 37.932], // Mountain Village base
        ],
      },
      properties: {
        id: 'tel-galloping-goose',
        kind: 'piste',
        name: 'Galloping Goose',
        difficulty: 'novice',
        'piste:type': 'downhill',
        'piste:difficulty': 'novice',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.854, 37.930],
          [-107.855, 37.934],
        ],
      },
      properties: {
        id: 'tel-meadows',
        kind: 'piste',
        name: 'The Meadows',
        difficulty: 'novice',
        'piste:type': 'downhill',
        'piste:difficulty': 'novice',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.850, 37.926],
          [-107.856, 37.932],
        ],
      },
      properties: {
        id: 'tel-bridges',
        kind: 'piste',
        name: 'Bridges',
        difficulty: 'novice',
        'piste:type': 'downhill',
        'piste:difficulty': 'novice',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.836, 37.905], // Gold Hill summit ridge
          [-107.834, 37.915],
          [-107.830, 37.925],
          [-107.828, 37.930], // San Sophia Station
        ],
      },
      properties: {
        id: 'tel-see-forever',
        kind: 'piste',
        name: 'See Forever',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.838, 37.910],
          [-107.845, 37.918],
          [-107.852, 37.925],
        ],
      },
      properties: {
        id: 'tel-polar-queen',
        kind: 'piste',
        name: 'Polar Queen',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.842, 37.912],
          [-107.848, 37.920],
        ],
      },
      properties: {
        id: 'tel-butterfly',
        kind: 'piste',
        name: 'Butterfly',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.845, 37.915],
          [-107.852, 37.930],
        ],
      },
      properties: {
        id: 'tel-double-cabin',
        kind: 'piste',
        name: 'Double Cabin',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.828, 37.920], // Top of Lift 9
          [-107.822, 37.928],
          [-107.818, 37.936], // Town of Telluride base
        ],
      },
      properties: {
        id: 'tel-the-plunge',
        kind: 'piste',
        name: 'The Plunge',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.826, 37.922],
          [-107.820, 37.932],
        ],
      },
      properties: {
        id: 'tel-bushwacker',
        kind: 'piste',
        name: 'Bushwacker',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.824, 37.924],
          [-107.817, 37.934],
        ],
      },
      properties: {
        id: 'tel-spiral-stairs',
        kind: 'piste',
        name: 'Spiral Stairs',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.825, 37.926],
          [-107.816, 37.935],
        ],
      },
      properties: {
        id: 'tel-kant-mak-m',
        kind: 'piste',
        name: 'Kant-Mak-M',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.836, 37.905], // Gold Hill ridge
          [-107.833, 37.901],
          [-107.830, 37.898], // Bowl basin
        ],
      },
      properties: {
        id: 'tel-revelation-bowl',
        kind: 'piste',
        name: 'Revelation Bowl',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.832, 37.903],
          [-107.828, 37.909],
        ],
      },
      properties: {
        id: 'tel-gold-hill-chute-1',
        kind: 'piste',
        name: 'Gold Hill Chute 1',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-107.825, 37.898],
          [-107.822, 37.906],
        ],
      },
      properties: {
        id: 'tel-palmyra-peak',
        kind: 'piste',
        name: 'Palmyra Peak (Senior\'s Run)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // VAIL, COLORADO (Front Side, Legendary Back Bowls & Blue Sky Basin)
  // -------------------------------------------------------------------------
  vail: [
    // Lifts
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.374, 39.642], // Vail Village Base (8,120')
          [-106.364, 39.620], // Mid-Vail (10,250')
        ],
      },
      properties: {
        id: 'vail-gondola-one',
        kind: 'lift',
        name: 'Gondola One',
        difficulty: 'unknown',
        lift_type: '10-Passenger High-Speed Gondola (heated seats)',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.388, 39.643], // Lionshead Base (8,150')
          [-106.386, 39.615], // Eagle\'s Nest (10,350')
        ],
      },
      properties: {
        id: 'vail-eagle-bahn',
        kind: 'lift',
        name: 'Eagle Bahn Gondola (Lift 19)',
        difficulty: 'unknown',
        lift_type: '12-Passenger Gondola',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.364, 39.620], // Mid-Vail
          [-106.361, 39.605], // Patrol HQ / Mountain Top (11,250')
        ],
      },
      properties: {
        id: 'vail-chair4',
        kind: 'lift',
        name: 'Mountain Top Express (Chair 4)',
        difficulty: 'unknown',
        lift_type: '6-Passenger High-Speed Chair',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.380, 39.638],
          [-106.372, 39.614],
        ],
      },
      properties: {
        id: 'vail-chair2',
        kind: 'lift',
        name: 'Avanti Express (Chair 2)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.362, 39.638], // Golden Peak Base
          [-106.350, 39.615],
        ],
      },
      properties: {
        id: 'vail-chair10',
        kind: 'lift',
        name: 'Highline Express (Chair 10)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.382, 39.610],
          [-106.395, 39.618],
        ],
      },
      properties: {
        id: 'vail-chair7',
        kind: 'lift',
        name: 'Game Creek Express (Chair 7)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.375, 39.595], // Sun Down Bowl base
          [-106.361, 39.605], // Top of Mountain Top
        ],
      },
      properties: {
        id: 'vail-chair5',
        kind: 'lift',
        name: 'High Noon Express (Chair 5)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad (Back Bowls access)',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.352, 39.585], // Tea Cup Bowl base
          [-106.345, 39.576], // Belle\'s Camp (Blue Sky Basin)
        ],
      },
      properties: {
        id: 'vail-chair37',
        kind: 'lift',
        name: 'Skyline Express (Chair 37)',
        difficulty: 'unknown',
        lift_type: 'High-Speed Quad (Blue Sky Basin)',
        aerialway: 'chair_lift',
      },
    },

    // Downhill Trails
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.361, 39.605], // Mountain Top Summit
          [-106.368, 39.618], // Tourist Trap
          [-106.371, 39.630], // Alley\'s Way
          [-106.374, 39.642], // Vail Village
        ],
      },
      properties: {
        id: 'vail-riva-ridge',
        kind: 'piste',
        name: 'Riva Ridge (4.0 mi)',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.386, 39.615], // Eagle\'s Nest
          [-106.390, 39.628],
          [-106.388, 39.643], // Lionshead base
        ],
      },
      properties: {
        id: 'vail-born-free',
        kind: 'piste',
        name: 'Born Free',
        difficulty: 'novice',
        'piste:type': 'downhill',
        'piste:difficulty': 'novice',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.386, 39.615],
          [-106.392, 39.625],
          [-106.390, 39.640],
        ],
      },
      properties: {
        id: 'vail-simba',
        kind: 'piste',
        name: 'Simba',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.364, 39.620],
          [-106.370, 39.635],
        ],
      },
      properties: {
        id: 'vail-look-ma',
        kind: 'piste',
        name: 'Look Ma',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.362, 39.615],
          [-106.365, 39.632],
        ],
      },
      properties: {
        id: 'vail-prima',
        kind: 'piste',
        name: 'Prima',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.350, 39.615],
          [-106.358, 39.635],
        ],
      },
      properties: {
        id: 'vail-highline',
        kind: 'piste',
        name: 'Highline',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.361, 39.605], // Ridge of Back Bowls
          [-106.370, 39.598],
          [-106.375, 39.595], // Sun Down Bowl base
        ],
      },
      properties: {
        id: 'vail-forever',
        kind: 'piste',
        name: 'Forever (Sun Down Bowl)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.345, 39.576], // Belle\'s Camp
          [-106.342, 39.582],
          [-106.348, 39.586],
        ],
      },
      properties: {
        id: 'vail-lovers-leap',
        kind: 'piste',
        name: 'Lover\'s Leap (Blue Sky Basin)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.345, 39.576],
          [-106.350, 39.584],
        ],
      },
      properties: {
        id: 'vail-cloud-9',
        kind: 'piste',
        name: 'Cloud 9',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.355, 39.602],
          [-106.340, 39.598],
        ],
      },
      properties: {
        id: 'vail-genghis-khan',
        kind: 'piste',
        name: 'Genghis Khan (China Bowl)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // ASPEN SNOWMASS, COLORADO (Highlands Bowl, Big Burn & Ruthie's)
  // -------------------------------------------------------------------------
  'aspen-snowmass': [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.820, 39.188],
          [-106.825, 39.162],
        ],
      },
      properties: {
        id: 'aspen-silver-queen',
        kind: 'lift',
        name: 'Silver Queen Gondola (3,267 ft vert)',
        difficulty: 'unknown',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.825, 39.162],
          [-106.830, 39.175],
          [-106.822, 39.188],
        ],
      },
      properties: {
        id: 'aspen-ruthies',
        kind: 'piste',
        name: 'Ruthie\'s Run (World Cup Downhill)',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.949, 39.208],
          [-106.965, 39.185],
        ],
      },
      properties: {
        id: 'aspen-big-burn-lift',
        kind: 'lift',
        name: 'Big Burn 6-Passenger Express',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.965, 39.185],
          [-106.955, 39.198],
          [-106.949, 39.208],
        ],
      },
      properties: {
        id: 'aspen-big-burn',
        kind: 'piste',
        name: 'Big Burn (Wide Open Cruising)',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.858, 39.155], // Highland Bowl summit (12,392')
          [-106.852, 39.165],
          [-106.845, 39.172],
        ],
      },
      properties: {
        id: 'aspen-highland-bowl',
        kind: 'piste',
        name: 'Highland Bowl (G-8 / Ozone)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // BRECKENRIDGE, COLORADO (Imperial SuperChair, Peak 8 & Peak 9)
  // -------------------------------------------------------------------------
  breckenridge: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.070, 39.485],
          [-106.082, 39.488], // North America\'s highest chairlift (12,840')
        ],
      },
      properties: {
        id: 'breck-imperial',
        kind: 'lift',
        name: 'Imperial Express SuperChair (12,840 ft)',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.052, 39.480],
          [-106.070, 39.485],
        ],
      },
      properties: {
        id: 'breck-colorado-chair',
        kind: 'lift',
        name: 'Colorado SuperChair (Peak 8)',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.082, 39.488],
          [-106.075, 39.482],
          [-106.065, 39.475],
          [-106.048, 39.480],
        ],
      },
      properties: {
        id: 'breck-four-oclock',
        kind: 'piste',
        name: 'Four O\'Clock (3.5 mi to town)',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-106.082, 39.488],
          [-106.078, 39.492],
        ],
      },
      properties: {
        id: 'breck-whales-tail',
        kind: 'piste',
        name: 'Whale\'s Tail (High Alpine Chute)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // ALTA & SNOWBIRD, UTAH (High Rustler, Mineral Basin, Gad Chutes)
  // -------------------------------------------------------------------------
  alta: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.638, 40.588],
          [-111.632, 40.575],
        ],
      },
      properties: {
        id: 'alta-collins',
        kind: 'lift',
        name: 'Collins Express Quad',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.632, 40.575],
          [-111.635, 40.582],
          [-111.638, 40.588],
        ],
      },
      properties: {
        id: 'alta-high-rustler',
        kind: 'piste',
        name: 'Alf\'s High Rustler ("High Boy")',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.625, 40.585],
          [-111.615, 40.565],
        ],
      },
      properties: {
        id: 'alta-supreme',
        kind: 'lift',
        name: 'Supreme High-Speed Quad',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.615, 40.565],
          [-111.622, 40.578],
        ],
      },
      properties: {
        id: 'alta-supreme-challenge',
        kind: 'piste',
        name: 'Supreme Challenge',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
  ],

  snowbird: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.656, 40.583], // Snowbird Center
          [-111.653, 40.561], // Hidden Peak (11,000')
        ],
      },
      properties: {
        id: 'snowbird-tram',
        kind: 'lift',
        name: 'Aerial Tram (Roof Balcony Cabins)',
        difficulty: 'unknown',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.653, 40.561],
          [-111.645, 40.552],
        ],
      },
      properties: {
        id: 'snowbird-mineral-express',
        kind: 'lift',
        name: 'Mineral Basin Express',
        difficulty: 'unknown',
        aerialway: 'chair_lift',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.653, 40.561],
          [-111.655, 40.572],
        ],
      },
      properties: {
        id: 'snowbird-great-scott',
        kind: 'piste',
        name: 'Great Scott (Circus Headwall)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.653, 40.561],
          [-111.648, 40.555],
        ],
      },
      properties: {
        id: 'snowbird-mineral-basin',
        kind: 'piste',
        name: 'Mineral Basin (Pathfinder)',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // BIG SKY, MONTANA (Lone Peak Tram, Big Couloir & Liberty Bowl)
  // -------------------------------------------------------------------------
  'big-sky': [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.435, 45.280],
          [-111.451, 45.278], // Lone Mountain Summit (11,166')
        ],
      },
      properties: {
        id: 'bigsky-tram',
        kind: 'lift',
        name: 'Lone Peak Tram (75-Passenger)',
        difficulty: 'unknown',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.451, 45.278],
          [-111.442, 45.275],
        ],
      },
      properties: {
        id: 'bigsky-big-couloir',
        kind: 'piste',
        name: 'Big Couloir (50° Chute)',
        difficulty: 'expert',
        'piste:type': 'downhill',
        'piste:difficulty': 'expert',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-111.451, 45.278],
          [-111.455, 45.265],
        ],
      },
      properties: {
        id: 'bigsky-liberty-bowl',
        kind: 'piste',
        name: 'Liberty Bowl (South Face Alpine Basin)',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
  ],

  // -------------------------------------------------------------------------
  // WHISTLER BLACKCOMB, BC (Peak 2 Peak, Dave Murray Downhill, Peak to Creek)
  // -------------------------------------------------------------------------
  'whistler-blackcomb': [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.950, 50.088], // Whistler Mountain
          [-122.915, 50.095], // Blackcomb Mountain (1,430 ft above valley floor)
        ],
      },
      properties: {
        id: 'wb-peak2peak',
        kind: 'lift',
        name: 'Peak 2 Peak Gondola (World Record Span)',
        difficulty: 'unknown',
        aerialway: 'gondola',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.955, 50.061], // Whistler Peak
          [-122.952, 50.075],
          [-122.950, 50.095],
          [-122.957, 50.116], // Creekside Base (5,020 ft vert)
        ],
      },
      properties: {
        id: 'wb-peak-to-creek',
        kind: 'piste',
        name: 'Peak to Creek (5,020 ft continuous descent)',
        difficulty: 'intermediate',
        'piste:type': 'downhill',
        'piste:difficulty': 'intermediate',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.948, 50.078],
          [-122.955, 50.098],
        ],
      },
      properties: {
        id: 'wb-dave-murray',
        kind: 'piste',
        name: 'Dave Murray Downhill (Olympic Course)',
        difficulty: 'advanced',
        'piste:type': 'downhill',
        'piste:difficulty': 'advanced',
      },
    },
  ],
};

const WebSocket = require('ws');

async function verifyPeaks() {
  const listRes = await fetch('http://localhost:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('5173'));
  if (!page) {
    console.error('No page found on 5173');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });
  await new Promise(r => ws.onopen = r);

  console.log('Connected to CDP. Reloading to ensure fresh GeoJSON...');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2500));

  // Query features loaded in MapLibre for major-peaks-source
  const res = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const map = window.__skiAtlasMap;
        if (!map) return { error: 'no map' };

        // Test querying several key mountain locations
        const testPoints = [
          { name: 'Hinterer Seelenkogel', coords: [11.044444, 46.801389] },
          { name: 'Grossvenediger', coords: [12.346389, 47.108889] },
          { name: 'Mönch', coords: [7.997271, 46.558506] },
          { name: 'Mount of the Holy Cross', coords: [-106.481667, 39.466944] },
          { name: 'Mount Robson', coords: [-119.156667, 53.110556] },
          { name: 'Mount Timpanogos', coords: [-111.645944, 40.390836] }
        ];

        // Fetch the raw geojson loaded by client
        const geojsonRes = await fetch('/data/major_peaks.geojson');
        const geojson = await geojsonRes.json();

        const results = testPoints.map(t => {
          const found = geojson.features.find(f => f.properties.name.toLowerCase().includes(t.name.toLowerCase().split(' ')[0]));
          return {
            query: t.name,
            expected: t.coords,
            actual: found ? found.geometry.coordinates : null,
            name: found ? found.properties.name : null,
            elevation: found ? found.properties.elevation_formatted_ft : null
          };
        });

        return {
          totalPeaks: geojson.features.length,
          results
        };
      })()
    `,
    returnByValue: true,
    awaitPromise: true
  });

  console.log('Verification Results:', JSON.stringify(res.result.value, null, 2));
  ws.close();
}

verifyPeaks();

const WebSocket = require('ws');
const fs = require('fs');

async function run() {
  const listRes = await fetch('http://localhost:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('5173'));
  if (!page) {
    console.error('Page not found on 9223');
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

  console.log('Connected to CDP. Reloading...');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3500));

  // Set Satellite basemap and navigate to Sunlight Mountain perspective
  console.log('Switching to Satellite basemap and navigating to Sunlight Mountain...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        if (map) {
          if (map.getLayer('basemap-satellite')) map.setLayoutProperty('basemap-satellite', 'visibility', 'visible');
          if (map.getLayer('basemap-osm')) map.setLayoutProperty('basemap-osm', 'visibility', 'none');
          if (map.getLayer('basemap-topo')) map.setLayoutProperty('basemap-topo', 'visibility', 'none');

          map.jumpTo({
            center: [-107.335, 39.432],
            zoom: 14.0,
            pitch: 58,
            bearing: 135
          });
          map.fire('moveend');
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 4500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const artDir = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c';
  fs.writeFileSync(`${artDir}/screen_sunlight_clarity.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_sunlight_clarity.png');

  ws.close();
}

run().catch(console.error);

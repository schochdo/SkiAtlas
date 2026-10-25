const WebSocket = require('ws');
const fs = require('fs');

async function captureSeelenkogel() {
  const listRes = await fetch('http://localhost:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('5173'));
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

  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2000));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        // Jump to Hinterer Seelenkogel
        map.jumpTo({
          center: [11.044444, 46.801389],
          zoom: 14.2,
          pitch: 0,
          bearing: 0
        });
        // Set topo basemap visible
        if (map.getLayer('basemap-topo')) map.setLayoutProperty('basemap-topo', 'visibility', 'visible');
        if (map.getLayer('basemap-osm')) map.setLayoutProperty('basemap-osm', 'visibility', 'none');
        if (map.getLayer('basemap-satellite')) map.setLayoutProperty('basemap-satellite', 'visibility', 'none');
      })()
    `
  });

  await new Promise(r => setTimeout(r, 2500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(shot.data, 'base64');
  const outPath = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/screen_seelenkogel_reconciled.png';
  fs.writeFileSync(outPath, buffer);
  console.log('Saved screenshot to:', outPath);
  ws.close();
}

captureSeelenkogel();

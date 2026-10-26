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

  const artDir = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c';

  // 1. Portillo view at 7km scale (zoom 10.7)
  console.log('Navigating to Portillo perspective at 7km scale...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        map.jumpTo({
          center: [-70.08, -32.80],
          zoom: 10.7,
          pitch: 58,
          bearing: 25
        });
        map.fire('moveend');
      })()
    `
  });
  await new Promise(r => setTimeout(r, 3500));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artDir}/screen_portillo_peaks_7km.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_portillo_peaks_7km.png');

  // 2. Regional Colorado view (zoom 9.3)
  console.log('Navigating to Colorado regional view (zoom 9.3)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        map.jumpTo({
          center: [-106.85, 39.15],
          zoom: 9.3,
          pitch: 0,
          bearing: 0
        });
        map.fire('moveend');
      })()
    `
  });
  await new Promise(r => setTimeout(r, 3000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artDir}/screen_colorado_regional_clear.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_colorado_regional_clear.png');

  ws.close();
  console.log('Verification finished!');
}

run().catch(console.error);

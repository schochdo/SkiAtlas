const WebSocket = require('ws');
const fs = require('fs');

async function run() {
  const listRes = await fetch('http://localhost:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('5173'));
  if (!page) {
    console.error('Could not find SkiAtlas page on localhost:9223');
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

  console.log('Connected to CDP. Reloading page...');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3500));

  // 1. Regional Colorado view (zoom 9.5)
  console.log('Navigating to Colorado regional view (zoom 9.5)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const m = window.__skiAtlasMap;
        if (m) {
          m.jumpTo({ center: [-106.85, 39.15], zoom: 9.3, pitch: 0, bearing: 0 });
          m.fire('moveend');
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  const artDir = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c';
  fs.writeFileSync(`${artDir}/screen_co_regional_view.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_co_regional_view.png');

  // 2. Mount of the Holy Cross (zoom 13.5)
  console.log('Navigating to Mount of the Holy Cross (zoom 13.5)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const m = window.__skiAtlasMap;
        if (m) {
          m.jumpTo({ center: [-106.4818, 39.4668], zoom: 13.5, pitch: 50, bearing: 25 });
          m.fire('moveend');
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 3500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artDir}/screen_holy_cross_no_trails.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_holy_cross_no_trails.png');

  // 3. New York Peak (zoom 13.8)
  console.log('Navigating to New York Peak (zoom 13.8)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const m = window.__skiAtlasMap;
        if (m) {
          m.jumpTo({ center: [-106.6933, 39.0858], zoom: 13.8, pitch: 45, bearing: -20 });
          m.fire('moveend');
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 3500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artDir}/screen_new_york_peak_aligned.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_new_york_peak_aligned.png');

  ws.close();
  console.log('Verification run complete!');
}

run().catch(console.error);

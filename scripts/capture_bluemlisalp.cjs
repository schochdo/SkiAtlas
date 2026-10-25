const WebSocket = require('ws');
const fs = require('fs');
const { execSync } = require('child_process');

async function captureBluemlisalp() {
  const listRes = await fetch('http://localhost:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('5173'));
  if (!page) {
    console.error('No page found');
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
  console.log('Connected to CDP');

  // Reload page to pick up updated major_peaks.geojson
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3000));

  // Configure Satellite basemap, jump to the Blüemlisalphorn viewpoint
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        if (map.getLayer('basemap-satellite')) map.setLayoutProperty('basemap-satellite', 'visibility', 'visible');
        if (map.getLayer('basemap-topo')) map.setLayoutProperty('basemap-topo', 'visibility', 'none');
        if (map.getLayer('basemap-osm')) map.setLayoutProperty('basemap-osm', 'visibility', 'none');
        
        map.jumpTo({
          center: [7.7725, 46.495],
          zoom: 13.5,
          pitch: 62,
          bearing: 195
        });
        map.fire('moveend');
      })()
    `
  });

  await new Promise(r => setTimeout(r, 4000));

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/screen_bluemlisalp_fixed.png';
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved screenshot to:', outPath);

  // Crop around center
  const cropPath = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/crop_bluemlisalp_fixed.png';
  execSync(`python3 -c "from PIL import Image; img = Image.open('${outPath}'); crop = img.crop((550, 200, 1450, 950)); crop.save('${cropPath}'); print('Cropped successfully')"`);

  ws.close();
}

captureBluemlisalp();

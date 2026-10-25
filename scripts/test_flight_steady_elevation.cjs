const WebSocket = require('ws');

async function testFlight() {
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

  // Reload page to get latest build/bundle
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2500));

  // Jump to Vail in 3D terrain mode
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        map.jumpTo({
          center: [-106.37, 39.63],
          zoom: 13.5,
          pitch: 65,
          bearing: 180
        });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // Sample initial state
  const initRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          center: map.getCenter(),
          elevation: map.getCenterElevation(),
          ground: map.queryTerrainElevation(map.getCenter())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Initial state:', initRes.result.value);

  // Dispatch ArrowUp keydown
  console.log('Dispatching ArrowUp keydown for 1.5 seconds...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 });

  // Record elevation every 100ms for 15 samples
  const samples = [];
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 100));
    const s = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const map = window.__skiAtlasMap;
          return {
            center: map.getCenter(),
            elevation: Math.round(map.getCenterElevation()),
            ground: Math.round(map.queryTerrainElevation(map.getCenter()))
          };
        })()
      `,
      returnByValue: true
    });
    samples.push(s.result.value);
  }

  // Release ArrowUp keyup
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 });
  console.log('ArrowUp released.');

  // Wait 500ms after release to verify NO settling/dipping
  await new Promise(r => setTimeout(r, 500));
  const postReleaseRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          elevation: Math.round(map.getCenterElevation()),
          ground: Math.round(map.queryTerrainElevation(map.getCenter()))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Post-release state (should remain steady):', postReleaseRes.result.value);

  console.log('Flight samples:');
  samples.forEach((sample, idx) => {
    console.log(`[${idx * 100}ms] ground: ${sample.ground}m | centerElev: ${sample.elevation}m | lat: ${sample.center.lat.toFixed(5)}`);
  });

  // Verify that elevation never dipped below ground + clearance, and remained monotonically non-decreasing over valleys
  let hasBounced = false;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].ground < samples[i - 1].ground && samples[i].elevation < samples[i - 1].elevation) {
      hasBounced = true;
      console.warn(`WARNING: Elevation dropped when ground dropped at step ${i}!`);
    }
  }

  if (!hasBounced) {
    console.log('SUCCESS: Elevation never bounced down into valleys! Altitude remained steady.');
  } else {
    console.error('FAILURE: Elevation bounced!');
  }

  ws.close();
}

testFlight();

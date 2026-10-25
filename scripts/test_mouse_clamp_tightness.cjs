const WebSocket = require('ws');

async function testMouseClamp() {
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

  // Reload page
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2500));

  // Jump to Vail at zoom 15.5 (close zoom where user reported looseness)
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        map.jumpTo({
          center: [-106.37, 39.63],
          zoom: 15.5,
          pitch: 65,
          bearing: 180
        });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Initial State before keyboard flight
  const s1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          clamped: map.getCenterClampedToGround(),
          centerElev: Math.round(map.getCenterElevation()),
          terrain: Math.round(map.queryTerrainElevation(map.getCenter()))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('1. Initial state before flight:', s1.result.value);

  // 2. Perform right-click drag to pitch/rotate
  console.log('2. Right-click drag (pitch/rotate) before flight...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 820, y: 530, button: 'right' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 820, y: 530, button: 'right' });
  await new Promise(r => setTimeout(r, 400));

  const s2 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          clamped: map.getCenterClampedToGround(),
          centerElev: Math.round(map.getCenterElevation()),
          terrain: Math.round(map.queryTerrainElevation(map.getCenter())),
          pitch: Math.round(map.getPitch()),
          bearing: Math.round(map.getBearing())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('2. State after initial right-click drag (should be clamped on terrain):', s2.result.value);

  // 3. Perform keyboard flight for 1.5 seconds
  console.log('3. Flying with ArrowUp...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 });

  const flightSamples = [];
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 100));
    const sample = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const map = window.__skiAtlasMap;
          return {
            clamped: map.getCenterClampedToGround(),
            centerElev: Math.round(map.getCenterElevation()),
            terrain: Math.round(map.queryTerrainElevation(map.getCenter()))
          };
        })()
      `,
      returnByValue: true
    });
    flightSamples.push(sample.result.value);
  }

  // 4. Release ArrowUp
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowUp', key: 'ArrowUp', windowsVirtualKeyCode: 38 });
  console.log('4. ArrowUp released.');
  await new Promise(r => setTimeout(r, 200));

  const s4 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          clamped: map.getCenterClampedToGround(),
          centerElev: Math.round(map.getCenterElevation()),
          terrain: Math.round(map.queryTerrainElevation(map.getCenter()))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('4. State immediately after flight release (clamped should be true):', s4.result.value);

  // 5. Perform right-click drag after flight
  console.log('5. Right-click drag after flight...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 820, y: 530, button: 'right' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 820, y: 530, button: 'right' });
  await new Promise(r => setTimeout(r, 400));

  const s5 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__skiAtlasMap;
        return {
          clamped: map.getCenterClampedToGround(),
          centerElev: Math.round(map.getCenterElevation()),
          terrain: Math.round(map.queryTerrainElevation(map.getCenter())),
          diff: Math.abs(Math.round(map.getCenterElevation()) - Math.round(map.queryTerrainElevation(map.getCenter())))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('5. State after right-click drag post-flight (diff must be 0):', s5.result.value);

  // Verify that clamped was restored and diff is 0
  if (s5.result.value.clamped && s5.result.value.diff <= 1) {
    console.log('SUCCESS: Camera pivot is firmly clamped to terrain! Right-click drag is tight and anchored.');
  } else {
    console.error('FAILURE: Pivot is floating in mid-air!');
  }

  ws.close();
}

testMouseClamp();

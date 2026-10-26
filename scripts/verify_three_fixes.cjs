const WebSocket = require('ws');
const fs = require('fs');

async function verifyAll() {
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

  // --- TEST 1: Elevation Camera Control ---
  console.log('\n--- Test 1: Elevation Camera Control ---');
  const elevRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const map = window.__skiAtlasMap;
        map.jumpTo({ center: [-107.335, 39.432], zoom: 14, pitch: 50 });
        await new Promise(r => setTimeout(r, 600));

        const ground = map.queryTerrainElevation([-107.335, 39.432]);

        // Press KeyE to climb
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
        await new Promise(r => setTimeout(r, 800));
        const elevWhileClimbing = map.getCenterElevation();

        // Release KeyE (stop flight)
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        const elevAfterRelease = map.getCenterElevation();

        // Press ArrowUp to fly forward
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        const elevWhileMoving = map.getCenterElevation();
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }));

        return { ground, elevWhileClimbing, elevAfterRelease, elevWhileMoving };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Elevation results:', elevRes.result.value);

  // --- TEST 2: Mini Map (Regional Locator) Consistency ---
  console.log('\n--- Test 2: Mini Map (Regional Locator) Consistency ---');
  const locatorRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Find Cardrona card or point
        const cards = Array.from(document.querySelectorAll('[data-resort-id]'));
        const cardronaCard = cards.find(c => c.textContent.includes('Cardrona'));
        
        let openOnCardrona = false;
        if (cardronaCard) {
          cardronaCard.click();
          await new Promise(r => setTimeout(r, 500));
          const locator = document.querySelector('[data-locator-popup]');
          openOnCardrona = !!locator;
        }

        // Test clicking Treble Cone
        const trebleCard = cards.find(c => c.textContent.includes('Treble Cone'));
        let openOnTreble = false;
        if (trebleCard) {
          trebleCard.click();
          await new Promise(r => setTimeout(r, 500));
          const locator = document.querySelector('[data-locator-popup]');
          openOnTreble = !!locator;
        }

        return { openOnCardrona, openOnTreble };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Locator popup on select results:', locatorRes.result.value);

  // --- TEST 3: Mountain Profile Header Layout ---
  console.log('\n--- Test 3: Mountain Profile Header Layout ---');
  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Open profile for active resort
        const profileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Mountain Profile'));
        if (profileBtn) profileBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const artDir = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c';
  fs.writeFileSync(`${artDir}/screen_profile_layout_fixed.png`, Buffer.from(shot.data, 'base64'));
  console.log('Captured screen_profile_layout_fixed.png');

  ws.close();
  console.log('\nAll tests complete!');
}

verifyAll().catch(console.error);

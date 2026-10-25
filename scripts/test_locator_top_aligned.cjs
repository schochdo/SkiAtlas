const WebSocket = require('ws');
const fs = require('fs');

async function testLocator() {
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

  console.log('Connected to CDP. Reloading...');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2500));

  // Select a resort with region e.g. Vail (Colorado)
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find Vail or any resort
        const cards = document.querySelectorAll('[data-resort-id]');
        if (cards.length > 0) cards[0].click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Capture before opening
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/screen_locator_button.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved button screenshot.');

  // 2. Click the locator button to open it
  const openRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('button[title*="Regional Overview"]');
        if (!btn) return 'no button';
        btn.click();
        return 'clicked';
      })()
    `
  });
  console.log('Click result:', openRes.result.value);
  await new Promise(r => setTimeout(r, 1200));

  // 3. Capture open state
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/screen_locator_open.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved open screenshot.');

  // 4. Test clicking X to close
  const closeRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const xBtn = document.querySelector('button[aria-label="Close"]');
        if (!xBtn) return 'no x button';
        xBtn.click();
        return 'clicked x';
      })()
    `
  });
  console.log('Close result:', closeRes.result.value);
  await new Promise(r => setTimeout(r, 600));

  // 5. Capture after close
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/screen_locator_closed.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved closed screenshot.');

  // 6. Test outside click
  // Re-open
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('button[title*="Regional Overview"]');
        if (btn) btn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Click on map canvas outside locator menu
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 500, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 500, button: 'left' });
  await new Promise(r => setTimeout(r, 600));

  const afterOutsideClick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popup = document.querySelector('button[aria-label="Close"]');
        return popup ? 'still open' : 'closed successfully';
      })()
    `
  });
  console.log('Outside click test:', afterOutsideClick.result.value);

  ws.close();
}

testLocator();

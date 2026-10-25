const WebSocket = require('ws');
const fs = require('fs');

async function captureCard() {
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

  // Search for Jangle
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('input[placeholder*="Search"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Jangle');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Capture screenshot of area around x: 10, y: 150, width: 380, height: 250
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 10, y: 150, width: 380, height: 220, scale: 1 }
  });

  const outPath = '/Users/macstudio/.gemini/antigravity/brain/5ff8e958-2e7a-4a0d-aefd-381b377a812c/card_kurobushi_wrapped.png';
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  console.log('Saved element screenshot to:', outPath);
  ws.close();
}

captureCard();

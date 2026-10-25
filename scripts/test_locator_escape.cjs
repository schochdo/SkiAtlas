const WebSocket = require('ws');

async function testEscape() {
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

  // 1. Open locator
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('button[title*="Regional Overview"]');
        if (btn) btn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Verify open
  const openCheck = await send('Runtime.evaluate', {
    expression: `!!document.querySelector('button[aria-label="Close"]')`,
    returnByValue: true
  });
  console.log('Is open before Escape:', openCheck.result.value);

  // 2. Press Escape key
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 500));

  // Verify closed
  const closeCheck = await send('Runtime.evaluate', {
    expression: `!!document.querySelector('button[aria-label="Close"]')`,
    returnByValue: true
  });
  console.log('Is open after Escape:', closeCheck.result.value);

  if (openCheck.result.value === true && closeCheck.result.value === false) {
    console.log('SUCCESS: Escape key closes locator menu smoothly!');
  } else {
    console.error('FAILURE: Escape key did not close locator menu.');
  }

  ws.close();
}

testEscape();

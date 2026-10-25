const WebSocket = require('ws');

async function run() {
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

  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('input[placeholder*="Search"]');
        if (!input) return 'no input';
        const r = input.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()
    `,
    returnByValue: true
  });
  console.log('Search input rect:', res.result.value);

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
  await new Promise(r => setTimeout(r, 600));

  // Find card of Kurobushi
  const cardRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const cards = Array.from(document.querySelectorAll('div')).filter(d => d.textContent.includes('黒伏高原'));
        if (cards.length === 0) return 'no card with 黒伏高原';
        const card = cards[cards.length - 1];
        const r = card.getBoundingClientRect();
        return {
          text: card.innerText,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height }
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Kurobushi card rect & text:', cardRes.result.value);
  ws.close();
}
run();

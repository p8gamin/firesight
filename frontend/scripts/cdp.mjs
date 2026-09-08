/**
 * Headless-Chrome CDP driver for visual QA.
 *
 *   node scripts/cdp.mjs <url> [opts]
 *     --eval "expr" / --eval-file f   evaluate JS, print result
 *     --act "expr" / --act-file f     evaluate after eval (interactions)
 *     --console                        stream console logs / page errors
 *     --shot out.png                   capture screenshot (after --act if any)
 *     --settle ms                      wait after load (default 4000)
 *     --after ms                       wait after act before shot (default 900)
 *     --emulate WxH                    override device metrics (e.g. 390x844)
 */
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';

const [url, ...rest] = process.argv.slice(2);
const opts = { eval: null, evalFile: null, act: null, actFile: null, console: false, shot: null, settle: 4000, after: 900, emulate: null };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--eval') opts.eval = rest[++i];
  else if (a === '--eval-file') opts.evalFile = rest[++i];
  else if (a === '--act') opts.act = rest[++i];
  else if (a === '--act-file') opts.actFile = rest[++i];
  else if (a === '--console') opts.console = true;
  else if (a === '--shot') opts.shot = rest[++i];
  else if (a === '--settle') opts.settle = Number(rest[++i]);
  else if (a === '--after') opts.after = Number(rest[++i]);
  else if (a === '--emulate') opts.emulate = rest[++i];
}
if (!url) {
  console.error('usage: node scripts/cdp.mjs <url> [opts]');
  process.exit(1);
}

function win(p) {
  // Accept both bash-style (/c/...) and native (C:/...) paths.
  return p.replace(/^\/([a-z])\//i, (_m, d) => `${d.toUpperCase()}:/`);
}
const CHROME =
  process.env.CHROME
    ? win(process.env.CHROME)
    : [
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
      ].find((p) => existsSync(p));
const PORT = 9333;
const proc = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}/cdp-${Date.now()}`,
    '--window-size=390,844',
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.on('open', res);
  ws.on('error', rej);
});

let msgId = 0;
const pending = new Map();
const listeners = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id) {
    const p = pending.get(m.id);
    if (p) {
      pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error)));
      else p.resolve(m.result);
    }
  } else if (m.method === 'Runtime.consoleAPICalled') {
    const args = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    console.log('[console]', args);
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.log('[page-error]', d.exception?.description || d.text);
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    console.log('[log-error]', m.params.entry.text);
  }
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
if (opts.emulate) {
  const [w, h] = opts.emulate.split('x').map(Number);
  await send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
await send('Page.navigate', { url });
await sleep(opts.settle);

async function runExpr(expr, label) {
  if (!expr) return;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log(label + ' ERROR:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  } else {
    const v = r.result && r.result.type === 'object' && 'value' in r.result ? r.result.value : undefined;
    if (v !== undefined) console.log(label + ':', JSON.stringify(v).slice(0, 800));
  }
}

await runExpr(opts.evalFile ? readFileSync(opts.evalFile, 'utf8') : opts.eval, 'RESULT');

if (opts.act || opts.actFile) {
  await runExpr(opts.actFile ? readFileSync(opts.actFile, 'utf8') : opts.act, 'ACT');
  await sleep(opts.after);
}

if (opts.shot) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(opts.shot, Buffer.from(data, 'base64'));
  console.log('SHOT:', opts.shot);
}

proc.kill();
process.exit(0);

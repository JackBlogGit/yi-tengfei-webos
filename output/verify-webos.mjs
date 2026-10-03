/**
 * 以腾飞 WebOS 的实机验收：跑在 vite preview 的产物上（不是 dev server），
 * 逐项核对窗口管理器、存储适配层与三个内容窗的真实行为。
 * 用法：先在项目根执行 `npx vite preview --port 4178`，再 `node output/verify-webos.mjs`。
 */
import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.WB_BASE ?? 'http://localhost:4178/yi-tengfei-webos/';
const PORT = 9311;
const PROFILE = 'C:/Users/javam/Documents/yi-tengfei-webos/output/edge-profile-webos';
const SHOTS = 'C:/Users/javam/Documents/yi-tengfei-webos/output/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 240)}`);
}

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-gpu',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

function cleanup() {
  spawn('taskkill', ['-PID', String(browser.pid), '-T', '-F'], { stdio: 'ignore' });
}
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, (err) => {
    console.error('FATAL', err?.message ?? err);
    cleanup();
    process.exit(1);
  });
}

async function getVersion() {
  for (let i = 0; i < 80; i += 1) {
    try {
      return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    } catch {
      await sleep(300);
    }
  }
  throw new Error('devtools 没起来');
}

let id = 0;
const pending = new Map();
const events = [];
const version = await getVersion();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
    return;
  }
  events.push(msg);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const msgId = (id += 1);
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });
}
function waitEvent(method, sessionId, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error(`timeout ${method}`));
    }, timeoutMs);
    function onMsg(ev) {
      const msg = JSON.parse(ev.data);
      if (msg.method === method && msg.sessionId === sessionId) {
        clearTimeout(timer);
        resolve(msg.params);
      }
    }
    ws.addEventListener('message', onMsg);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const call = (m, p = {}) => send(m, p, sessionId);
await call('Page.enable');
await call('Runtime.enable');
await call('Network.enable');
await call('Log.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const ev = async (expression) => {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`页面表达式抛错：${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
};
const exists = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const text = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.textContent ?? '').trim()`);

/** 存储探测是异步的，先等条件成立再断言，别把时序问题读成 bug */
async function until(expr, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await ev(`(() => { try { return Boolean(${expr}); } catch { return false; } })()`)) return true;
    await sleep(120);
  }
  return false;
}

async function open(url) {
  const loaded = waitEvent('Page.loadEventFired', sessionId);
  await call('Page.navigate', { url });
  await loaded;
  await sleep(700);
}

/** 桌面级鼠标动作：坐标取自元素中心，clickCount=2 即双击 */
async function clickAt(selector, { dbl = false, offsetX = 0, offsetY = 0, wait = 320 } = {}) {
  const box = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`找不到元素 ${selector}`);
  const x = box.x + offsetX;
  const y = box.y + offsetY;
  const type = (clickCount) =>
    call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount, buttons: 1 });
  await type(dbl ? 2 : 1);
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: dbl ? 2 : 1, buttons: 0 });
  await sleep(wait);
  return { x, y };
}

async function drag(fromSelector, dx, dy) {
  const box = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(fromSelector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + 12 };
  })()`);
  if (!box) throw new Error(`找不到元素 ${fromSelector}`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 1 });
  for (let i = 1; i <= 6; i += 1) {
    await call('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: box.x + (dx * i) / 6,
      y: box.y + (dy * i) / 6,
      button: 'left',
      buttons: 1,
    });
    await sleep(30);
  }
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + dx, y: box.y + dy, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(260);
}

async function shot(file, clip) {
  const { data } = await call('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(SHOTS + file, Buffer.from(data, 'base64'));
  return `output/${file}`;
}

const consoleErrors = [];
function collectErrors() {
  for (const m of events) {
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      consoleErrors.push(m.params.args?.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? 'exception');
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const e = m.params.entry;
      consoleErrors.push(`${e.source}: ${e.url ?? ''} ${e.text}`);
    }
  }
}

await open(BASE);

// —— 1. 外壳与静态资源路径
check('首页在 /yi-tengfei-webos/ 下挂载出桌面', await exists('.desk'));
const scriptSrc = await ev(`document.querySelector('script[src]')?.src ?? ''`);
check('构建产物的资源路径带 Pages 子路径', scriptSrc.includes('/yi-tengfei-webos/assets/'), scriptSrc);
const iconCount = await count('[data-test="desk-icon"]');
check('标题与桌面图标就位', iconCount === 5, `图标 ${iconCount} 个`);
check('任务栏时钟在走', /\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}/.test((await text('[data-test="tray-clock"]')) ?? ''), await text('[data-test="tray-clock"]'));

// —— 2. 存储适配层：storage.json → 清单适配器 → 探测
check('storage.json 读通并完成根目录探测', await until(`document.querySelector('[data-test="tray-storage"]').textContent === '存储 1/1'`), await text('[data-test="tray-storage"]'));
check('endpoint 为空的 Alist 源被跳过（不计入可用数）', (await text('[data-test="tray-storage"]')) === '存储 1/1', await text('[data-test="tray-storage"]'));

// —— 3. 启动即开的「关于」窗
check('开机自动打开关于窗', await exists('[data-os="window"][data-app="about"]'));
check('关于窗报出存储源清单', await exists('[data-test="about-sources"]'), await text('[data-test="about-sources"] li'));
await clickAt('[data-os="window"][data-app="about"] [data-os="close"]');
check('关窗按钮生效', !(await exists('[data-os="window"][data-app="about"]')));
check('关掉后桌面不再叠窗', (await count('[data-os="window"]')) === 0);

// —— 4. 文件窗：目录树 + 直链三态
await clickAt('[data-test="desk-icon"][data-app="files"]', { dbl: true });
check('双击图标开文件窗', await exists('[data-os="window"][data-app="files"]'));
const rootRows = await ev(`[...document.querySelectorAll('[data-app="files"] [data-test="file-row"]')].map(r => r.dataset.name)`);
check('根目录列出 3 个子目录', rootRows.length === 3, rootRows.join(','));
await clickAt('[data-app="files"] [data-test="file-row"][data-name="照片"]');
const photoRows = await count('[data-app="files"] [data-test="file-row"]');
check('单击目录即进入', photoRows === 2, `条目 ${photoRows}`);
check(
  '站内示例图判为「可用」',
  (await ev(`[...document.querySelectorAll('[data-app="files"] [data-test="file-row"] .row__meta b')].every(b => b.textContent.trim() === '可用')`)) === true,
  await ev(`[...document.querySelectorAll('[data-app="files"] [data-test="file-row"] .row__meta b')].map(b => b.textContent.trim()).join(',')`),
);
await clickAt('[data-app="files"] [data-test="crumb-root"]');
await clickAt('[data-app="files"] [data-test="file-row"][data-name="待接入"]');
check('占位条目列为「待填」', (await text('[data-app="files"] [data-test="file-row"] .row__meta b')) === '待填', await text('[data-app="files"] [data-test="file-row"] .row__meta b'));
await clickAt('[data-app="files"] [data-test="file-row"]', { dbl: true });
check('占位直链被拦下并给出下一步', (await text('[data-test="files-hint"]')).includes('storage.json'), await text('[data-test="files-hint"]'));
await clickAt('[data-app="files"] [data-test="crumb-root"]');
check('面包屑回根目录', (await count('[data-app="files"] [data-test="file-row"]')) === 3);
check('面包屑显示当前路径', (await text('[data-app="files"] .files__crumbs')).includes('存储根目录'));
await clickAt('[data-app="files"] [data-test="files-up"]');
check('根目录时「上级」禁用不发请求', (await ev(`document.querySelector('[data-app="files"] [data-test="files-up"]').disabled`)) === true);

// —— 5. 相册：跨目录收集 + 真图加载 + 灯箱
await clickAt('[data-test="desk-icon"][data-app="photos"]', { dbl: true });
await sleep(500);
check('相册收到 2 张图', (await text('[data-test="photos-count"]')) === '2 张', await text('[data-test="photos-count"]'));
const loaded = await ev(`[...document.querySelectorAll('[data-test="photo-cell"] img')].filter(i => i.naturalWidth > 0).length`);
check('缩略图是真解码成功的 JPEG', loaded === 2, `loaded ${loaded}`);
await clickAt('[data-test="photo-cell"]');
check('点开进灯箱', await exists('[data-test="photo-viewer"]'));
const big = await ev(`document.querySelector('[data-test="photo-viewer"] img')?.naturalWidth ?? 0`);
check('灯箱原图加载', big > 800, `naturalWidth ${big}`);
await clickAt('[data-test="viewer-next"]');
check('灯箱可切换', (await text('[data-test="photo-viewer"] .viewer__name')).includes('示例'), await text('[data-test="photo-viewer"] .viewer__name'));
await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(200);
check('Esc 关灯箱', !(await exists('[data-test="photo-viewer"]')));

// —— 6. 音乐：真解码播放
await clickAt('[data-test="desk-icon"][data-app="music"]', { dbl: true });
await sleep(400);
check('列出 1 条音轨', (await count('[data-test="music-track"]')) === 1);
await clickAt('[data-test="music-track"]');
await sleep(1200);
const audio = await ev(`(() => { const a = document.querySelector('[data-test="music-audio"]'); return { paused: a.paused, t: a.currentTime, dur: a.duration, src: a.currentSrc }; })()`);
check('示例音频真在播', audio.paused === false && audio.t > 0, JSON.stringify(audio).slice(0, 200));
check('播放态同步到标题', (await text('[data-test="music-title"]')).includes('示例音频'), await text('[data-test="music-title"]'));
await clickAt('[data-test="music-toggle"]');
const paused = await ev(`document.querySelector('[data-test="music-audio"]').paused`);
check('暂停按钮有效', paused === true);

// —— 7. 窗口管理器：拖拽 / 最大化 / 最小化 / 任务栏 / 关闭
const W = '[data-os="window"][data-app="music"]';
const before = await ev(`(() => { const r = document.querySelector(${JSON.stringify(W)}).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; })()`);
await drag(`${W} .win__bar`, -180, 120);
const after = await ev(`(() => { const r = document.querySelector(${JSON.stringify(W)}).getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
check('标题栏拖拽移动窗口', Math.abs(after.x - before.x) > 100 && Math.abs(after.y - before.y) > 60, JSON.stringify({ before, after }));
await clickAt(`${W} [data-os="max"]`);
const maxed = await ev(`(() => { const r = document.querySelector(${JSON.stringify(W)}).getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top }; })()`);
check('最大化铺满到任务栏上方', maxed.w === 1440 && maxed.top === 0 && Math.abs(maxed.h - 852) < 2, JSON.stringify(maxed));
await clickAt(`${W} [data-os="max"]`);
const restored = await ev(`document.querySelector(${JSON.stringify(W)}).getBoundingClientRect().width`);
check('还原回到原尺寸', Math.abs(restored - before.w) < 2, `${restored} vs ${before.w}`);
await clickAt(`${W} [data-os="min"]`);
check('最小化后窗口不可见', (await ev(`getComputedStyle(document.querySelector(${JSON.stringify(W)})).display`)) === 'none');
check('任务栏标为最小化', (await ev(`document.querySelector('[data-test="task-item"][data-app="music"]').classList.contains('is-min')`)) === true);
await clickAt('[data-test="task-item"][data-app="music"]');
check('点任务栏重新唤起', (await ev(`getComputedStyle(document.querySelector(${JSON.stringify(W)})).display`)) !== 'none');
const zAll = await ev(`[...document.querySelectorAll('[data-os="window"]')].map(w => Number(w.style.zIndex))`);
const zMusic = await ev(`Number(document.querySelector(${JSON.stringify(W)}).style.zIndex)`);
check('唤起后置顶', zMusic === Math.max(...zAll), `z ${zAll.join(',')} → ${zMusic}`);
await clickAt(`${W} [data-os="close"]`);
const winLeft = await count('[data-os="window"]');
check('关闭后窗口数减一', winLeft === 2, `剩 ${winLeft} 个`);

// —— 8. 设置窗：外观切换 + 存储面板
await clickAt('[data-test="desk-icon"][data-app="settings"]', { dbl: true });
await sleep(300);
const wallBefore = await ev(`document.querySelector('.desk__bg').getAttribute('style')`);
await clickAt('[data-test="wall-opt"][data-index="1"]');
const wallAfter = await ev(`document.querySelector('.desk__bg').getAttribute('style')`);
check('外观切换改到桌面背景', wallBefore !== wallAfter, String(wallAfter).slice(0, 120));
await clickAt('[data-test="wall-opt"][data-index="3"]');
const usePhoto = await ev(`document.querySelector('.desk__bg').style.backgroundImage.includes('/wallpaper.jpg')`);
check('实拍壁纸走 BASE_URL 子路径', usePhoto === true);
await clickAt('[data-test="wall-opt"][data-index="0"]');
const srcRows = await ev(`[...document.querySelectorAll('[data-test="set-source"]')].map(r => r.dataset.id)`);
check('设置里只列出建起来的适配器', srcRows.length === 1 && srcRows[0] === 'aliyun', srcRows.join(','));
check('适配器探测报出根目录条目', (await text('[data-test="set-source"] .src__detail')).includes('根目录'), await text('[data-test="set-source"] .src__detail'));
await clickAt('[data-test="set-reload"]', { wait: 900 });
check('重新探测不报错', !(await text('[data-test="set-message"]')).includes('失败'), await text('[data-test="set-message"]'));

// —— 9. 开始菜单与单一实例
await clickAt('[data-test="start-btn"]');
check('开始菜单展开', await exists('[data-test="start-menu"]'));
check('菜单列 5 个应用', (await count('[data-test="menu-item"]')) === 5);
await clickAt('[data-test="menu-item"][data-app="settings"]');
check('菜单点开后收起', !(await exists('[data-test="start-menu"]')));
check('已开的窗不重复创建', (await count('[data-os="window"][data-app="settings"]')) === 1);
await clickAt('[data-os="window"][data-app="files"] [data-os="min"]');
await clickAt('[data-test="desk-icon"][data-app="files"]', { dbl: true });
check('最小化的窗被唤起而不是新开', (await count('[data-os="window"][data-app="files"]')) === 1);
check('唤起后重新可见', (await ev(`getComputedStyle(document.querySelector('[data-os="window"][data-app="files"]')).display`)) !== 'none');

// —— 10. 深链与截图
const resp = await fetch(`${BASE}storage.json`, { headers: { Accept: 'application/json' } });
check('storage.json 可被公网直取', resp.status === 200, `HTTP ${resp.status}`);
await open(BASE);
await sleep(600);
check('刷新后回到干净桌面', (await count('[data-os="window"]')) === 1);
const shots = [];
shots.push(await shot('webos-desktop.png'));
await clickAt('[data-test="desk-icon"][data-app="photos"]', { dbl: true });
await sleep(500);
shots.push(await shot('webos-photos.png'));
console.log(`截图：${shots.join('、')}`);

collectErrors();
const noise = consoleErrors.filter((e) => !/favicon|Download the Vue Devtools/i.test(e));
check('全程无控制台报错/未捕获异常', noise.length === 0, noise.slice(0, 3).join(' || ') || 'clean');

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
if (failed.length) console.log(`失败项：${failed.map((f) => f.name).join(' / ')}`);

ws.close();
cleanup();
process.exit(failed.length ? 1 : 0);

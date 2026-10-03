import { reactive } from 'vue';
import { appOf } from './apps';

export const TASKBAR_H = 48;

export interface WinState {
  id: number;
  appId: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restore: { x: number; y: number; w: number; h: number } | null;
}

export const osState = reactive({
  wins: [] as WinState[],
  seq: 0,
  z: 10,
  activeId: 0,
});

function viewport() {
  return { vw: window.innerWidth, vh: Math.max(200, window.innerHeight - TASKBAR_H) };
}

/** 窗口至少留一截标题栏在屏内，拖出边界也不会关不掉 */
export function clampPos(x: number, y: number, win: WinState): { x: number; y: number } {
  const { vw, vh } = viewport();
  return {
    x: Math.min(Math.max(x, 8 - win.w + 120), Math.max(0, vw - 120)),
    y: Math.min(Math.max(y, 0), Math.max(0, vh - 40)),
  };
}

function topmost(): WinState | undefined {
  return osState.wins
    .filter((w) => !w.minimized)
    .slice()
    .sort((a, b) => b.z - a.z)[0];
}

export function focus(id: number): void {
  const win = osState.wins.find((w) => w.id === id);
  if (!win) return;
  win.minimized = false;
  win.z = ++osState.z;
  osState.activeId = id;
}

export function openApp(appId: string): void {
  const app = appOf(appId);
  if (!app) return;

  const existing = osState.wins.find((w) => w.appId === appId);
  if (existing) {
    focus(existing.id);
    return;
  }

  const { vw, vh } = viewport();
  const w = Math.min(app.w, Math.max(300, vw - 32));
  const h = Math.min(app.h, Math.max(220, vh - 32));
  const step = osState.wins.length % 5;
  const draft: WinState = {
    id: ++osState.seq,
    appId,
    title: app.name,
    x: 0,
    y: 0,
    w,
    h,
    z: ++osState.z,
    minimized: false,
    maximized: false,
    restore: null,
  };
  // 132 起叠放：桌面图标列占到 x=106，压住它就连双击都点不动了
  const pos = clampPos(132 + step * 30, 24 + step * 26, draft);
  draft.x = pos.x;
  draft.y = pos.y;
  osState.wins.push(draft);
  osState.activeId = draft.id;
}

export function close(id: number): void {
  const i = osState.wins.findIndex((w) => w.id === id);
  if (i < 0) return;
  osState.wins.splice(i, 1);
  if (osState.activeId === id) osState.activeId = topmost()?.id ?? 0;
}

export function minimize(id: number): void {
  const win = osState.wins.find((w) => w.id === id);
  if (!win) return;
  win.minimized = true;
  if (osState.activeId === id) osState.activeId = topmost()?.id ?? 0;
}

export function toggleMaximize(id: number): void {
  const win = osState.wins.find((w) => w.id === id);
  if (!win) return;
  const { vw, vh } = viewport();
  if (win.maximized) {
    const r = win.restore;
    if (r) Object.assign(win, r);
    win.maximized = false;
    win.restore = null;
  } else {
    win.restore = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.x = 0;
    win.y = 0;
    win.w = vw;
    win.h = vh;
    win.maximized = true;
  }
  focus(id);
}

/** 任务栏点击：当前且展开→最小化，其余→唤到前台 */
export function toggleFromTaskbar(id: number): void {
  const win = osState.wins.find((w) => w.id === id);
  if (!win) return;
  if (osState.activeId === id && !win.minimized) minimize(id);
  else focus(id);
}

export function moveTo(id: number, x: number, y: number): void {
  const win = osState.wins.find((w) => w.id === id);
  if (!win || win.maximized) return;
  const pos = clampPos(x, y, win);
  win.x = pos.x;
  win.y = pos.y;
}

export function resizeTo(id: number, w: number, h: number): void {
  const win = osState.wins.find((w2) => w2.id === id);
  if (!win || win.maximized) return;
  const { vw, vh } = viewport();
  win.w = Math.min(Math.max(w, 300), vw);
  win.h = Math.min(Math.max(h, 200), vh);
  const pos = clampPos(win.x, win.y, win);
  win.x = pos.x;
  win.y = pos.y;
}

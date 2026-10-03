import { reactive } from 'vue';
import { AlistAdapter } from './alist';
import type { SourceConfig, StorageConfig } from './config';
import { LocalManifestAdapter } from './local';
import type { FsEntry, StorageAdapter } from './types';
import { normPath } from './types';

const CONFIG_URL = `${import.meta.env.BASE_URL}storage.json`;

export interface SourceStatus {
  id: string;
  label: string;
  kind: string;
  ready: boolean;
  detail: string;
  note: string;
}

interface Probe {
  ok: boolean;
  detail: string;
}

export const storageState = reactive({
  loading: false,
  loaded: false,
  configUrl: CONFIG_URL,
  message: '',
  adapters: [] as StorageAdapter[],
  activeId: '',
  probes: {} as Record<string, Probe>,
});

function build(cfg: SourceConfig): StorageAdapter | string {
  if (cfg.kind === 'manifest') return new LocalManifestAdapter(cfg.id, cfg.label, cfg);
  if (cfg.kind === 'alist') {
    if (!/^https?:\/\//i.test(cfg.endpoint)) return `${cfg.label}：endpoint 不是 http(s) 地址，已跳过`;
    return new AlistAdapter(cfg.id, cfg.label, cfg);
  }
  return `未知存储类型 ${(cfg as SourceConfig).kind}，已跳过`;
}

/** 同源相对直链要补上部署子路径；已是绝对地址则原样交给浏览器 */
export function absUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  return url;
}

async function probe(adapter: StorageAdapter): Promise<Probe> {
  try {
    const listing = await adapter.list('/');
    const dirs = listing.entries.filter((e) => e.kind === 'dir').length;
    const files = listing.entries.length - dirs;
    return { ok: true, detail: `根目录 ${dirs} 个子目录 / ${files} 个条目` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function initStorage(): Promise<void> {
  if (storageState.loading) return;
  storageState.loading = true;
  storageState.message = '';
  storageState.probes = {};
  try {
    const res = await fetch(CONFIG_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = (await res.json()) as StorageConfig;
    if (!Array.isArray(cfg.sources)) throw new Error('sources 不是数组');

    const adapters: StorageAdapter[] = [];
    const notes: string[] = [];
    for (const src of cfg.sources) {
      const built = build(src);
      if (typeof built === 'string') notes.push(built);
      else adapters.push(built);
    }
    storageState.adapters = adapters;
    storageState.activeId =
      adapters.some((a) => a.id === cfg.defaultSourceId) ? cfg.defaultSourceId : (adapters[0]?.id ?? '');
    if (!adapters.length) notes.push('一个存储源都没建起来，检查 storage.json 的 sources');
    if (notes.length) storageState.message = notes.join('；');
    await refreshProbes();
  } catch (err) {
    storageState.adapters = [];
    storageState.activeId = '';
    storageState.message = `读取 ${CONFIG_URL} 失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    storageState.loading = false;
    storageState.loaded = true;
  }
}

/** 逐个源探一次根目录，让设置窗显示「能不能用」而不是「配没配」 */
export async function refreshProbes(): Promise<void> {
  const next: Record<string, Probe> = {};
  await Promise.all(
    storageState.adapters.map(async (adapter) => {
      next[adapter.id] = await probe(adapter);
    }),
  );
  storageState.probes = next;
}

export function activeAdapter(): StorageAdapter | null {
  return storageState.adapters.find((a) => a.id === storageState.activeId) ?? null;
}

export function setActiveSource(id: string): void {
  if (storageState.adapters.some((a) => a.id === id)) storageState.activeId = id;
}

export function statusRows(): SourceStatus[] {
  return storageState.adapters.map((adapter) => {
    const p = storageState.probes[adapter.id];
    const detail = p ? (p.ok ? p.detail : `不可用：${p.detail}`) : '未探测';
    const facts =
      adapter instanceof LocalManifestAdapter
        ? `清单 ${adapter.fileCount} 个文件 / 根目录 ${adapter.rootCount} 项`
        : adapter instanceof AlistAdapter
          ? `端点 ${adapter.endpointLabel}（代码里没有 token 字段）`
          : '';
    const hint = adapter instanceof LocalManifestAdapter || adapter instanceof AlistAdapter ? adapter.note : '';
    return {
      id: adapter.id,
      label: adapter.label,
      kind: adapter.kind,
      ready: Boolean(p?.ok),
      detail,
      note: [facts, hint].filter(Boolean).join(' · '),
    };
  });
}

export interface WalkOptions {
  /** 最多下潜几层，防止大目录树把浏览器拖死 */
  maxDepth?: number;
  /** 最多收多少个文件 */
  limit?: number;
}

/** 跨目录收集文件（相册、播放器要的是「全部」而不是「当前层」） */
export async function walk(
  adapter: StorageAdapter,
  dirPath: string,
  predicate: (entry: FsEntry) => boolean,
  opts: WalkOptions = {},
): Promise<FsEntry[]> {
  const maxDepth = opts.maxDepth ?? 4;
  const limit = opts.limit ?? 300;
  const out: FsEntry[] = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: normPath(dirPath), depth: 0 }];

  while (queue.length && out.length < limit) {
    const node = queue.shift();
    if (!node) break;
    let entries: FsEntry[] = [];
    try {
      entries = (await adapter.list(node.path)).entries;
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.kind === 'dir') {
        if (node.depth < maxDepth) queue.push({ path: entry.path, depth: node.depth + 1 });
        continue;
      }
      if (predicate(entry) && out.length < limit) out.push(entry);
    }
  }
  return out;
}

export type EntryKind = 'dir' | 'file';

export interface FsEntry {
  name: string;
  /** 绝对路径，始终以 / 开头，以 / 分隔 */
  path: string;
  kind: EntryKind;
  size?: number;
  mime?: string;
  /** 直链；未填则视为「占位」，播放器/预览器会拒绝并提示 */
  url?: string;
  thumb?: string;
  mtime?: string;
}

export interface DirListing {
  path: string;
  entries: FsEntry[];
  sourceId: string;
  sourceLabel: string;
}

export interface StorageAdapter {
  readonly id: string;
  readonly label: string;
  readonly kind: 'manifest' | 'alist';
  list(dirPath: string): Promise<DirListing>;
  resolve(entry: FsEntry): Promise<string>;
}

export type StorageErrorCode = 'unconfigured' | 'network' | 'not-found' | 'bad-response';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/** 直链是否可用：空值与示例占位串都算不可用 */
export function hasDirectLink(entry: FsEntry): boolean {
  const u = entry.url ?? '';
  if (!u) return false;
  return !/REPLACE|example\.com|INVALID/i.test(u);
}

export function normPath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export function parentPath(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

export function baseName(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}

/** 目录在前、同类按名称排；这是全站唯一的排序口径，文件管理器与搜索结果共用 */
export function sortEntries(list: FsEntry[]): FsEntry[] {
  return list.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  md: 'text/markdown',
};

export function guessMime(p: string): string | undefined {
  const ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext];
}

export function isImage(entry: FsEntry): boolean {
  return (entry.mime ?? guessMime(entry.path) ?? '').startsWith('image/');
}

export function isAudio(entry: FsEntry): boolean {
  return (entry.mime ?? guessMime(entry.path) ?? '').startsWith('audio/');
}

export function formatSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

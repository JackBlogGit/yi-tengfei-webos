import type { EntryKind } from './types';

/** storage.json 里一条文件的原始形状 */
export interface ManifestEntryConfig {
  path: string;
  kind: EntryKind;
  size?: number;
  mime?: string;
  url?: string;
  thumb?: string;
  mtime?: string;
}

/** 本地清单：把阿里云盘转出来的直链逐条填进 JSON，零凭据 */
export interface ManifestSourceConfig {
  id: string;
  kind: 'manifest';
  label: string;
  note?: string;
  entries: ManifestEntryConfig[];
}

/** Alist 直连：只需站点地址，浏览器直挂 /api/fs/list 与 /d/ 前缀，代码里没有 token 字段 */
export interface AlistSourceConfig {
  id: string;
  kind: 'alist';
  label: string;
  note?: string;
  endpoint: string;
}

export type SourceConfig = ManifestSourceConfig | AlistSourceConfig;

export interface StorageConfig {
  version: number;
  defaultSourceId: string;
  sources: SourceConfig[];
}

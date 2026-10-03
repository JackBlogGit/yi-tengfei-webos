import type { AlistSourceConfig } from './config';
import type { DirListing, FsEntry, StorageAdapter } from './types';
import { StorageError, guessMime, normPath } from './types';
import type { StorageErrorCode } from './types';

interface AlistItem {
  name?: string;
  size?: number;
  is_dir?: boolean;
  last_modified?: string;
  link_url?: string;
}

/** Alist 的路径要逐段转义，否则中文目录名会 404 */
function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

/**
 * Alist 直连适配器。刻意没有 token / password 字段：静态站上任何凭据都是公开的，
 * 只挂匿名可读（或已在 Alist 侧配好「直链免登录」）的挂载点。
 * 另外浏览器直连要求该 Alist 站点放行 CORS，这属于外部服务限制，失败会如实显示在设置窗里。
 */
export class AlistAdapter implements StorageAdapter {
  readonly kind = 'alist' as const;

  constructor(
    readonly id: string,
    readonly label: string,
    private readonly cfg: AlistSourceConfig,
  ) {}

  private get endpoint(): string {
    return this.cfg.endpoint.replace(/\/+$/, '');
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new StorageError('network', `连不上 ${this.label}（网络或 CORS 被拒）`);
    }
    if (!res.ok) throw new StorageError('network', `${this.label} 返回 HTTP ${res.status}`);
    const payload = (await res.json()) as { code?: number; message?: string; data?: unknown };
    if (payload.code !== 200) {
      const code: StorageErrorCode = payload.code === 404 ? 'not-found' : 'bad-response';
      throw new StorageError(code, `${this.label}：${payload.message ?? `code ${payload.code}`}`);
    }
    return payload.data;
  }

  async list(dirPath: string): Promise<DirListing> {
    const path = normPath(dirPath);
    const data = (await this.post('/api/fs/list', { path, password: '' })) as
      | { content?: AlistItem[] }
      | null
      | undefined;
    const items = data?.content ?? [];
    const entries: FsEntry[] = items.map((item) => {
      const name = item.name ?? '';
      const child = `${path === '/' ? '' : path}/${name}`;
      const dir = Boolean(item.is_dir);
      const link = item.link_url ?? '';
      return {
        name,
        path: normPath(child),
        kind: dir ? 'dir' : 'file',
        size: dir ? undefined : item.size,
        mime: dir ? undefined : guessMime(child),
        mtime: item.last_modified,
        url: dir ? undefined : link.startsWith('http') ? link : `${this.endpoint}/d${encodePath(normPath(child))}`,
      };
    });
    return { path, entries, sourceId: this.id, sourceLabel: this.label };
  }

  /** Alist 的 /d 前缀本身就是直链；条目里带回的绝对 link_url 优先级更高 */
  async resolve(entry: FsEntry): Promise<string> {
    if (entry.url?.startsWith('http')) return entry.url;
    return `${this.endpoint}/d${encodePath(entry.path)}`;
  }

  get note(): string {
    return this.cfg.note ?? '';
  }

  get endpointLabel(): string {
    return this.endpoint;
  }
}

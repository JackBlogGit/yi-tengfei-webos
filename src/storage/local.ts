import type { ManifestEntryConfig, ManifestSourceConfig } from './config';
import type { DirListing, FsEntry, StorageAdapter } from './types';
import { StorageError, baseName, guessMime, normPath, parentPath, sortEntries } from './types';

function toEntry(cfg: ManifestEntryConfig): FsEntry {
  const path = normPath(cfg.path);
  return {
    name: baseName(path),
    path,
    kind: cfg.kind,
    size: cfg.size,
    mime: cfg.mime ?? (cfg.kind === 'file' ? guessMime(path) : undefined),
    url: cfg.url,
    thumb: cfg.thumb,
    mtime: cfg.mtime,
  };
}

/**
 * 清单适配器：目录树在构造期一次成型，list() 只做查表。
 * 未声明的中间目录会按父路径自动补出来，少写一行 "kind":"dir" 不会让树断裂。
 */
export class LocalManifestAdapter implements StorageAdapter {
  readonly kind = 'manifest' as const;
  readonly fileCount: number;
  readonly rootCount: number;
  private readonly children = new Map<string, FsEntry[]>();

  constructor(
    readonly id: string,
    readonly label: string,
    private readonly cfg: ManifestSourceConfig,
  ) {
    const entries = cfg.entries.map(toEntry);
    this.fileCount = entries.filter((e) => e.kind === 'file').length;
    this.rootCount = entries.filter((e) => parentPath(e.path) === '/').length;

    const implicitDirs = new Set<string>(['/']);
    for (const e of entries) {
      if (e.kind === 'dir') continue;
      let dir = parentPath(e.path);
      while (dir !== '/' && !implicitDirs.has(dir)) {
        implicitDirs.add(dir);
        dir = parentPath(dir);
      }
    }
    for (const dir of implicitDirs) this.children.set(dir, []);

    const declared = new Set(entries.filter((e) => e.kind === 'dir').map((e) => e.path));
    for (const e of entries) {
      const dir = parentPath(e.path);
      if (e.path !== '/' && !declared.has(e.path) && !this.children.has(e.path)) {
        this.children.set(e.path, []);
      }
      const bucket = this.children.get(dir);
      if (bucket) bucket.push(e);
    }
    for (const list of this.children.values()) sortEntries(list);
  }

  async list(dirPath: string): Promise<DirListing> {
    const path = normPath(dirPath);
    if (!this.children.has(path)) {
      throw new StorageError('not-found', `清单里没有这个目录：${path}`);
    }
    return { path, entries: this.children.get(path) ?? [], sourceId: this.id, sourceLabel: this.label };
  }

  /** 清单模式没有第二跳：直链就写在 JSON 里 */
  async resolve(entry: FsEntry): Promise<string> {
    if (!entry.url) throw new StorageError('unconfigured', `${entry.name} 还没有填直链`);
    return entry.url;
  }

  get note(): string {
    return this.cfg.note ?? '';
  }
}

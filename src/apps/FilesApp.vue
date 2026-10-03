<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { absUrl, activeAdapter, storageState } from '../storage';
import type { FsEntry } from '../storage/types';
import { formatSize, hasDirectLink, parentPath } from '../storage/types';

const adapter = computed(() => activeAdapter());
const path = ref('/');
const entries = ref<FsEntry[]>([]);
const loading = ref(false);
const error = ref('');
const hint = ref('');

const crumbs = computed(() => {
  const segs = path.value.split('/').filter(Boolean);
  return segs.map((name, i) => ({ name, path: '/' + segs.slice(0, i + 1).join('/') }));
});

async function load(to = path.value) {
  const a = adapter.value;
  if (!a) {
    error.value = storageState.message || '还没有可用的存储源';
    entries.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  hint.value = '';
  try {
    const listing = await a.list(to);
    path.value = listing.path;
    entries.value = listing.entries;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function enter(entry: FsEntry) {
  if (entry.kind === 'dir') void load(entry.path);
}

function go(to: string) {
  void load(to);
}

function goUp() {
  void load(parentPath(path.value));
}

async function open(entry: FsEntry) {
  const a = adapter.value;
  if (!a || entry.kind === 'dir') return;
  if (!hasDirectLink(entry)) {
    hint.value = `${entry.name} 的直链还没填：在 storage.json 里把 url 换成阿里云盘直链即可。`;
    return;
  }
  try {
    window.open(absUrl(await a.resolve(entry)), '_blank', 'noopener');
  } catch (err) {
    hint.value = err instanceof Error ? err.message : String(err);
  }
}

onMounted(() => void load('/'));
</script>

<template>
  <div class="files">
    <div class="files__bar">
      <button class="wb-btn" type="button" :disabled="path === '/'" data-test="files-up" @click="goUp">上级</button>
      <nav class="files__crumbs" aria-label="路径">
        <button type="button" data-test="crumb-root" @click="go('/')">存储根目录</button>
        <span v-for="c in crumbs" :key="c.path" class="files__crumb">
          <i>/</i>
          <button type="button" @click="go(c.path)">{{ c.name }}</button>
        </span>
      </nav>
      <span class="wb-badge" data-test="files-source">{{ adapter?.label ?? '未接入' }}</span>
    </div>

    <p v-if="hint" class="wb-note files__hint" data-test="files-hint">{{ hint }}</p>
    <p v-if="error" class="wb-note files__err" data-test="files-error">{{ error }}</p>

    <div class="files__head">
      <span>名称</span>
      <span>大小</span>
      <span>直链</span>
      <span>时间</span>
    </div>

    <div class="wb-scroll files__body">
      <p v-if="loading" class="files__state">读取中…</p>
      <p v-else-if="!entries.length && !error" class="files__state">这个目录是空的。</p>
      <ul v-else>
        <li
          v-for="e in entries"
          :key="e.path"
          class="row"
          :class="{ 'row--dir': e.kind === 'dir' }"
          data-test="file-row"
          :data-name="e.name"
          @click="enter(e)"
          @dblclick="open(e)"
        >
          <span class="row__name">
            <i class="row__mark">{{ e.kind === 'dir' ? '目录' : '文件' }}</i>
            {{ e.name }}
          </span>
          <span class="row__meta">{{ e.kind === 'dir' ? '—' : formatSize(e.size) }}</span>
          <span class="row__meta">
            <b v-if="e.kind === 'dir'" class="wb-badge">—</b>
            <b v-else-if="hasDirectLink(e)" class="wb-badge wb-badge--ok">可用</b>
            <b v-else class="wb-badge wb-badge--warn">待填</b>
          </span>
          <span class="row__meta wb-mono">{{ e.mtime?.slice(0, 10) ?? '—' }}</span>
        </li>
      </ul>
    </div>

    <footer class="files__foot">
      <span>{{ entries.length }} 个条目</span>
      <span class="wb-dim">双击打开；目录单击进入</span>
    </footer>
  </div>
</template>

<style scoped>
.files {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  gap: 10px;
}

.files__bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.files__crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  font-size: 13px;
}

.files__crumbs button {
  color: var(--ink-2);
  border-radius: 6px;
  padding: 2px 6px;
  white-space: nowrap;
}

.files__crumbs button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--ink);
}

.files__crumb {
  display: flex;
  align-items: center;
  min-width: 0;
}

.files__crumb i {
  color: var(--ink-3);
  font-style: normal;
}

.files__hint {
  border-color: rgba(255, 187, 85, 0.4);
  color: #ffe0b3;
}

.files__err {
  border-color: rgba(255, 122, 122, 0.4);
  color: #ffc9c9;
}

.files__head,
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px 76px 96px;
  gap: 10px;
  align-items: center;
}

.files__head {
  padding: 0 10px;
  font-size: 12px;
  color: var(--ink-3);
  border-bottom: 1px solid var(--hairline-2);
}

.files__body {
  flex: 1;
}

.files__state {
  padding: 18px 10px;
  color: var(--ink-3);
}

.row {
  padding: 7px 10px;
  border-radius: 9px;
  cursor: default;
}

.row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.row--dir {
  cursor: pointer;
}

.row__name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.row__mark {
  flex: 0 0 auto;
  font-size: 10.5px;
  font-style: normal;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  color: var(--ink-3);
}

.row--dir .row__mark {
  color: var(--accent);
  border-color: rgba(92, 200, 255, 0.4);
}

.row__meta {
  font-size: 12.5px;
  color: var(--ink-2);
  white-space: nowrap;
}

.files__foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--ink-3);
  border-top: 1px solid var(--hairline-2);
  padding-top: 8px;
}
</style>

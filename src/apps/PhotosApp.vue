<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { absUrl, activeAdapter, storageState, walk } from '../storage';
import type { FsEntry } from '../storage/types';
import { hasDirectLink, isImage } from '../storage/types';

const adapter = computed(() => activeAdapter());
const photos = ref<FsEntry[]>([]);
const loading = ref(false);
const error = ref('');
const index = ref(-1);

const current = computed(() => (index.value >= 0 ? (photos.value[index.value] ?? null) : null));

async function load() {
  const a = adapter.value;
  if (!a) {
    error.value = storageState.message || '还没有可用的存储源';
    photos.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    photos.value = await walk(a, '/', isImage, { maxDepth: 4, limit: 200 });
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

function thumbOf(entry: FsEntry): string {
  const raw = entry.thumb ?? entry.url ?? '';
  return raw && hasDirectLink(entry) ? absUrl(raw) : '';
}

function step(delta: number) {
  if (!photos.value.length) return;
  index.value = (index.value + delta + photos.value.length) % photos.value.length;
}

function onKey(e: KeyboardEvent) {
  if (index.value < 0) return;
  if (e.key === 'Escape') index.value = -1;
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
}

onMounted(() => {
  void load();
  document.addEventListener('keydown', onKey);
});

onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="photos">
    <div class="photos__bar">
      <span class="wb-badge" data-test="photos-source">{{ adapter?.label ?? '未接入' }}</span>
      <span class="wb-dim photos__count" data-test="photos-count">{{ photos.length }} 张</span>
      <button class="wb-btn" type="button" @click="load">重新扫描</button>
    </div>

    <p v-if="error" class="wb-note photos__err">{{ error }}</p>
    <p v-if="loading" class="photos__state">正在跨目录收集图片…</p>
    <p v-else-if="!photos.length && !error" class="photos__state">
      没有找到图片。把图片直链写进 storage.json 的 entries（mime 会自动按扩展名推断）。
    </p>

    <div class="wb-scroll photos__grid" data-test="photos-grid">
      <button
        v-for="(p, i) in photos"
        :key="p.path"
        class="cell"
        type="button"
        data-test="photo-cell"
        :data-name="p.name"
        @click="index = i"
      >
        <img v-if="thumbOf(p)" :src="thumbOf(p)" :alt="p.name" loading="lazy" />
        <span v-else class="cell__void">无直链</span>
        <span class="cell__cap">{{ p.name }}</span>
      </button>
    </div>

    <div v-if="current" class="viewer" data-test="photo-viewer" @click.self="index = -1">
      <div class="viewer__box">
        <img v-if="thumbOf(current)" :src="thumbOf(current)" :alt="current.name" />
        <p v-else class="viewer__void">这张图的 url 还是占位值，填上阿里云盘直链后就能看。</p>
        <div class="viewer__foot">
          <button class="wb-btn" type="button" data-test="viewer-prev" @click="step(-1)">上一张</button>
          <span class="viewer__name">{{ current.name }}</span>
          <button class="wb-btn" type="button" data-test="viewer-next" @click="step(1)">下一张</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photos {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  gap: 10px;
}

.photos__bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.photos__count {
  flex: 1;
}

.photos__err {
  border-color: rgba(255, 122, 122, 0.4);
  color: #ffc9c9;
}

.photos__state {
  color: var(--ink-3);
  font-size: 13px;
}

.photos__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
  align-content: start;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  border-radius: 11px;
  border: 1px solid var(--hairline-2);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  transition: border-color 0.16s ease, transform 0.16s ease;
}

.cell:hover {
  border-color: rgba(92, 200, 255, 0.55);
  transform: translateY(-2px);
}

.cell img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
}

.cell__void {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  color: var(--warn);
  font-size: 12px;
  background: rgba(255, 187, 85, 0.08);
}

.cell__cap {
  padding: 0 8px 7px;
  font-size: 12px;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viewer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(4, 8, 18, 0.74);
  backdrop-filter: blur(6px);
  z-index: 2;
}

.viewer__box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 100%;
}

.viewer__box img {
  max-width: 100%;
  max-height: 62vh;
  border-radius: 12px;
  border: 1px solid var(--hairline);
}

.viewer__void {
  padding: 40px 24px;
  color: var(--ink-2);
  text-align: center;
}

.viewer__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.viewer__name {
  font-size: 13px;
  color: var(--ink);
}
</style>

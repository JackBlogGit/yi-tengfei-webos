<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { absUrl, activeAdapter, storageState, walk } from '../storage';
import type { FsEntry } from '../storage/types';
import { formatSize, hasDirectLink, isAudio } from '../storage/types';

const adapter = computed(() => activeAdapter());
const tracks = ref<FsEntry[]>([]);
const loading = ref(false);
const error = ref('');
const hint = ref('');
const current = ref<FsEntry | null>(null);
const playing = ref(false);
const position = ref(0);
const duration = ref(0);
const player = ref<HTMLAudioElement | null>(null);

const playable = computed(() => tracks.value.filter((t) => hasDirectLink(t)));

function clock(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function load() {
  const a = adapter.value;
  if (!a) {
    error.value = storageState.message || '还没有可用的存储源';
    tracks.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    tracks.value = await walk(a, '/', isAudio, { maxDepth: 4, limit: 120 });
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function play(entry: FsEntry) {
  const a = adapter.value;
  if (!a) return;
  if (!hasDirectLink(entry)) {
    hint.value = `${entry.name} 的直链还没填，播不了。`;
    return;
  }
  hint.value = '';
  current.value = entry;
  const el = player.value;
  if (!el) return;
  el.src = absUrl(await a.resolve(entry));
  try {
    await el.play();
    playing.value = true;
  } catch {
    playing.value = false;
    hint.value = '浏览器拦下了自动播放：再点一次这一行即可。';
  }
}

function toggle() {
  const el = player.value;
  if (!el || !current.value) return;
  if (el.paused) {
    void el.play().then(() => (playing.value = true));
  } else {
    el.pause();
    playing.value = false;
  }
}

function seek(e: Event) {
  const el = player.value;
  if (!el) return;
  el.currentTime = Number((e.target as HTMLInputElement).value);
  position.value = el.currentTime;
}

function step(delta: number) {
  if (!playable.value.length) return;
  const at = current.value ? playable.value.findIndex((t) => t.path === current.value?.path) : -1;
  void play(playable.value[(at + delta + playable.value.length) % playable.value.length] as FsEntry);
}

onMounted(() => void load());
onUnmounted(() => player.value?.pause());
</script>

<template>
  <div class="music">
    <audio
      ref="player"
      data-test="music-audio"
      preload="metadata"
      @timeupdate="position = player?.currentTime ?? 0"
      @loadedmetadata="duration = player?.duration ?? 0"
      @ended="playing = false"
      @error="playing = false"
    ></audio>

    <div class="music__now">
      <div class="music__disc" :class="{ 'is-spin': playing }" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M9.4 17.6V6.2l10-2v11.4" /><circle cx="6.7" cy="17.9" r="2.6" /><circle cx="16.7" cy="15.9" r="2.6" /></svg>
      </div>
      <div class="music__meta">
        <p class="music__title" data-test="music-title">{{ current?.name ?? '未选择曲目' }}</p>
        <p class="wb-dim music__sub">
          {{ adapter?.label ?? '未接入存储' }} · 可直接播放 {{ playable.length }} / {{ tracks.length }}
        </p>
        <div class="music__seek">
          <span class="wb-mono">{{ clock(position) }}</span>
          <input
            type="range"
            min="0"
            :max="duration || 0"
            :step="0.1"
            :value="position"
            :disabled="!current"
            data-test="music-seek"
            @input="seek"
          />
          <span class="wb-mono">{{ clock(duration) }}</span>
        </div>
      </div>
      <div class="music__ctrl">
        <button class="wb-btn" type="button" title="上一首" @click="step(-1)">
          <svg viewBox="0 0 16 16" class="gl"><path d="M11 4.2 6.2 8 11 11.8z" /><path d="M5 4v8" /></svg>
        </button>
        <button class="wb-btn wb-btn--accent" type="button" data-test="music-toggle" :disabled="!current" @click="toggle">
          <svg viewBox="0 0 16 16" class="gl"><path v-if="!playing" d="M5.4 3.6 12 8l-6.6 4.4z" /><path v-else d="M6 3.6v8.8M10 3.6v8.8" /></svg>
          {{ playing ? '暂停' : '播放' }}
        </button>
        <button class="wb-btn" type="button" title="下一首" @click="step(1)">
          <svg viewBox="0 0 16 16" class="gl"><path d="M5 4.2 9.8 8 5 11.8z" /><path d="M11 4v8" /></svg>
        </button>
      </div>
    </div>

    <p v-if="hint" class="wb-note music__hint" data-test="music-hint">{{ hint }}</p>
    <p v-if="error" class="wb-note music__err" data-test="music-error">{{ error }}</p>

    <div class="wb-scroll music__list">
      <p v-if="loading" class="music__state">正在收集音频…</p>
      <p v-else-if="!tracks.length && !error" class="music__state">没有音频条目。把直链写进 storage.json 就会出现在这里。</p>
      <ul v-else>
        <li
          v-for="t in tracks"
          :key="t.path"
          class="track"
          :class="{ 'is-current': t.path === current?.path, 'is-out': !hasDirectLink(t) }"
          data-test="music-track"
          :data-name="t.name"
          @click="play(t)"
        >
          <span class="track__no">{{ hasDirectLink(t) ? '▶' : '·' }}</span>
          <span class="track__name">{{ t.name }}</span>
          <span class="track__size">{{ formatSize(t.size) }}</span>
          <span class="track__flag">
            <b v-if="hasDirectLink(t)" class="wb-badge wb-badge--ok">可播</b>
            <b v-else class="wb-badge wb-badge--warn">待填直链</b>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.music {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 14px;
  gap: 12px;
}

.music__now {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--hairline-2);
  background: linear-gradient(120deg, rgba(92, 200, 255, 0.09), rgba(155, 123, 255, 0.07));
}

.music__disc svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.music__disc {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--hairline);
  background: rgba(0, 0, 0, 0.32);
  flex: 0 0 46px;
}

.music__disc.is-spin {
  animation: spin 3.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.music__meta {
  flex: 1;
  min-width: 0;
}

.music__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music__sub {
  font-size: 12px;
}

.music__seek {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.music__seek input {
  flex: 1;
  accent-color: var(--accent);
}

.music__ctrl {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.gl {
  width: 13px;
  height: 13px;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
}

.music__hint {
  border-color: rgba(255, 187, 85, 0.4);
  color: #ffe0b3;
}

.music__err {
  border-color: rgba(255, 122, 122, 0.4);
  color: #ffc9c9;
}

.music__list {
  flex: 1;
}

.music__state {
  color: var(--ink-3);
  font-size: 13px;
  padding: 6px 2px;
}

.track {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 74px 84px;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.track:hover {
  background: rgba(255, 255, 255, 0.07);
}

.track.is-current {
  background: rgba(92, 200, 255, 0.14);
  border: 1px solid rgba(92, 200, 255, 0.32);
}

.track.is-out {
  cursor: default;
  opacity: 0.72;
}

.track__no {
  color: var(--accent);
  font-size: 11px;
}

.track__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.track__size {
  font-size: 12px;
  color: var(--ink-3);
}
</style>

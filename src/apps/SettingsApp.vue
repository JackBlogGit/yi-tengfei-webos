<script setup lang="ts">
import { computed, ref } from 'vue';
import { WALLPAPERS, prefs } from '../os/prefs';
import { initStorage, setActiveSource, statusRows, storageState } from '../storage';

const rows = computed(() => statusRows());
const busy = ref(false);
const activeId = computed({
  get: () => storageState.activeId,
  set: (id: string) => setActiveSource(id),
});

async function reload() {
  busy.value = true;
  await initStorage();
  busy.value = false;
}
</script>

<template>
  <div class="set wb-scroll">
    <section class="set__sect">
      <h2 class="set__h2">外观</h2>
      <div class="set__walls">
        <button
          v-for="(w, i) in WALLPAPERS"
          :key="w.label"
          class="wall"
          :class="{ 'is-on': prefs.wallpaper === i }"
          type="button"
          data-test="wall-opt"
          :data-index="i"
          @click="prefs.wallpaper = i"
        >
          <span class="wall__sw" :style="w.image ? { background: '#0b1020' } : { background: w.css }"></span>
          <span class="wall__lb">{{ w.label }}</span>
        </button>
      </div>
    </section>

    <section class="set__sect">
      <div class="set__row">
        <h2 class="set__h2">存储源</h2>
        <button class="wb-btn" type="button" :disabled="busy" data-test="set-reload" @click="reload">
          {{ busy ? '探测中…' : '重新探测' }}
        </button>
      </div>

      <label class="set__field">
        <span class="wb-dim">当前源</span>
        <select v-model="activeId" data-test="set-active">
          <option v-for="r in rows" :key="r.id" :value="r.id">{{ r.label }}</option>
          <option v-if="!rows.length" value="">（无可用源）</option>
        </select>
      </label>

      <ul class="set__list">
        <li v-for="r in rows" :key="r.id" class="src" data-test="set-source" :data-id="r.id">
          <div class="src__top">
            <span class="src__label">{{ r.label }}</span>
            <b v-if="r.ready" class="wb-badge wb-badge--ok">可用</b>
            <b v-else class="wb-badge wb-badge--bad">不可用</b>
            <span class="wb-badge">{{ r.kind }}</span>
          </div>
          <p class="src__detail wb-dim">{{ r.detail }}</p>
          <p v-if="r.note" class="src__note wb-dim">{{ r.note }}</p>
        </li>
        <li v-if="!rows.length" class="wb-dim">storage.json 没有建立起任何适配器。</li>
      </ul>

      <p v-if="storageState.message" class="wb-note" data-test="set-message">{{ storageState.message }}</p>
      <p class="set__path">
        配置文件：<span class="wb-mono" data-test="set-config-url">{{ storageState.configUrl }}</span>
      </p>
    </section>

    <section class="set__sect">
      <h2 class="set__h2">为什么没有登录/Token 输入框</h2>
      <p class="wb-note">
        本站是纯静态托管，任何写进前端的密钥都等于公开。所以阿里云盘走「先把直链转出来、再写进 JSON」的方式，
        Alist 走「匿名可读的挂载点」。两种适配层都不保留 token 字段，这是设计而非缺失。
      </p>
    </section>
  </div>
</template>

<style scoped>
.set {
  flex: 1;
  padding: 14px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.set__sect {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.set__h2 {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.set__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.set__walls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.wall {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px 7px 7px;
  border-radius: 10px;
  border: 1px solid var(--hairline-2);
  background: rgba(255, 255, 255, 0.04);
}

.wall:hover {
  border-color: var(--hairline);
}

.wall.is-on {
  border-color: rgba(92, 200, 255, 0.6);
  background: rgba(92, 200, 255, 0.12);
}

.wall__sw {
  width: 34px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--hairline);
  background-size: cover;
  background-position: center;
}

.wall__lb {
  font-size: 12.5px;
}

.set__field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
}

.set__field select {
  flex: 1;
  max-width: 260px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--hairline);
  background: rgba(10, 15, 27, 0.8);
}

.set__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.src {
  padding: 10px 12px;
  border-radius: 11px;
  border: 1px solid var(--hairline-2);
  background: rgba(255, 255, 255, 0.035);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.src__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.src__label {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.src__detail,
.src__note {
  font-size: 12px;
  line-height: 1.5;
}

.set__path {
  font-size: 12px;
  color: var(--ink-3);
}
</style>

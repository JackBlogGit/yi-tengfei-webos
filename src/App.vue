<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import WindowFrame from './components/WindowFrame.vue';
import { APPS, appOf } from './os/apps';
import { wallpaperStyle } from './os/prefs';
import { osState, openApp, toggleFromTaskbar } from './os/store';
import { initStorage, statusRows, storageState } from './storage';

const menuOpen = ref(false);
const selected = ref('');
const now = ref(new Date());
let timer: number | undefined;

const wins = computed(() => osState.wins);
const bg = computed(() => wallpaperStyle());
const storageChip = computed(() => {
  const rows = statusRows();
  if (!rows.length) return { text: '存储未接入', cls: 'is-bad' as const };
  const ok = rows.filter((r) => r.ready).length;
  if (ok === 0) return { text: '存储不可用', cls: 'is-bad' as const };
  return { text: `存储 ${ok}/${rows.length}`, cls: ok === rows.length ? ('is-ok' as const) : ('is-part' as const) };
});

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const clock = computed(() => {
  const d = now.value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${WEEKDAYS[d.getDay()]} ${p(d.getHours())}:${p(d.getMinutes())}`;
});

function launch(appId: string) {
  menuOpen.value = false;
  openApp(appId);
}

function onDeskDown() {
  if (menuOpen.value) menuOpen.value = false;
}

onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 10_000);
  void initStorage();
  openApp('about');
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="desk" @pointerdown="onDeskDown">
    <div class="desk__bg" :style="bg"></div>
    <div class="desk__veil"></div>

    <main class="desk__icons" aria-label="桌面图标">
      <button
        v-for="app in APPS"
        :key="app.id"
        class="ico"
        :class="{ 'is-sel': selected === app.id }"
        type="button"
        data-test="desk-icon"
        :data-app="app.id"
        @click="selected = app.id"
        @dblclick="launch(app.id)"
      >
        <span class="ico__glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" v-html="app.icon"></svg>
        </span>
        <span class="ico__name">{{ app.name }}</span>
      </button>
      <p class="desk__tip">双击图标打开窗口</p>
    </main>

    <div class="desk__wins">
      <WindowFrame v-for="w in wins" :key="w.id" :win="w" v-show="!w.minimized">
        <component :is="appOf(w.appId)?.component" />
      </WindowFrame>
    </div>

    <nav class="bar" aria-label="任务栏">
      <div class="bar__left">
        <button class="bar__start" :class="{ 'is-on': menuOpen }" type="button" data-test="start-btn" @pointerdown.stop @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 17.5 12 6.5l6 11z" />
            <path d="M9.4 17.5h5.2" />
          </svg>
          <span>以腾飞</span>
        </button>

        <ul v-if="menuOpen" class="menu" data-test="start-menu" @pointerdown.stop>
          <li class="menu__cap">应用</li>
          <li v-for="app in APPS" :key="app.id">
            <button class="menu__item" type="button" data-test="menu-item" :data-app="app.id" @click="launch(app.id)">
              <span class="menu__glyph" aria-hidden="true"><svg viewBox="0 0 24 24" v-html="app.icon"></svg></span>
              {{ app.name }}
            </button>
          </li>
          <li class="menu__cap">状态</li>
          <li class="menu__info">
            <span>{{ storageChip.text }}</span>
            <span v-if="storageState.message" class="menu__warn">{{ storageState.message }}</span>
            <span v-else class="menu__sub">配置来自 {{ storageState.configUrl }}</span>
          </li>
        </ul>
      </div>

      <ul class="bar__tasks">
        <li v-for="w in wins" :key="w.id">
          <button
            class="task"
            :class="{ 'is-on': osState.activeId === w.id && !w.minimized, 'is-min': w.minimized }"
            type="button"
            data-test="task-item"
            :data-app="w.appId"
            @click="toggleFromTaskbar(w.id)"
          >
            <span class="task__glyph" aria-hidden="true"><svg viewBox="0 0 24 24" v-html="appOf(w.appId)?.icon ?? ''"></svg></span>
            {{ w.title }}
          </button>
        </li>
        <li v-if="!wins.length" class="bar__idle">没有打开的窗口</li>
      </ul>

      <div class="bar__tray">
        <button class="tray" :class="storageChip.cls" type="button" data-test="tray-storage" @click="launch('settings')">
          {{ storageChip.text }}
        </button>
        <span class="tray__clock wb-mono" data-test="tray-clock">{{ clock }}</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.desk {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.desk__bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.desk__veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 60% at 20% 0%, rgba(92, 200, 255, 0.1), transparent 70%),
    radial-gradient(70% 50% at 100% 100%, rgba(155, 123, 255, 0.12), transparent 70%);
}

.desk__icons {
  position: absolute;
  top: 18px;
  left: 14px;
  bottom: calc(var(--taskbar-h) + 14px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 92px;
}

.ico {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 11px;
  border: 1px solid transparent;
}

.ico:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ico.is-sel {
  background: rgba(92, 200, 255, 0.16);
  border-color: rgba(92, 200, 255, 0.42);
}

.ico__glyph svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ico__name {
  font-size: 12px;
  color: var(--ink-2);
}

.desk__tip {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(233, 238, 251, 0.38);
}

.desk__wins {
  position: absolute;
  inset: 0;
  padding-bottom: var(--taskbar-h);
  pointer-events: none;
}

.desk__wins > * {
  pointer-events: auto;
}

.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--taskbar-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: rgba(8, 12, 22, 0.72);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-top: 1px solid var(--hairline);
  z-index: 2147483000;
}

.bar__left {
  position: relative;
  flex: 0 0 auto;
}

.bar__start {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 9px;
  border: 1px solid var(--hairline);
  background: linear-gradient(120deg, rgba(92, 200, 255, 0.2), rgba(155, 123, 255, 0.16));
  font-size: 13px;
  font-weight: 600;
}

.bar__start svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.bar__start.is-on {
  border-color: rgba(92, 200, 255, 0.6);
}

.menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: 232px;
  padding: 8px;
  border-radius: 13px;
  border: 1px solid var(--hairline);
  background: var(--glass-2);
  backdrop-filter: blur(22px) saturate(150%);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu__cap {
  padding: 6px 8px 2px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border-radius: 9px;
  font-size: 13px;
  text-align: left;
}

.menu__item:hover {
  background: rgba(92, 200, 255, 0.16);
}

.menu__glyph svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu__info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 8px 2px;
  font-size: 11.5px;
  color: var(--ink-3);
}

.menu__warn {
  color: var(--warn);
}

.bar__tasks {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
}

.task {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 170px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 12.5px;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task:hover {
  background: rgba(255, 255, 255, 0.09);
}

.task.is-on {
  color: var(--ink);
  border-color: var(--hairline);
  background: rgba(255, 255, 255, 0.1);
}

.task.is-min {
  opacity: 0.6;
}

.task__glyph svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.bar__idle {
  font-size: 12px;
  color: var(--ink-3);
}

.bar__tray {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tray {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  font-size: 11.5px;
}

.tray.is-ok {
  color: var(--ok);
}

.tray.is-part {
  color: var(--warn);
}

.tray.is-bad {
  color: var(--bad);
}

.tray__clock {
  color: var(--ink-2);
  white-space: nowrap;
}
</style>

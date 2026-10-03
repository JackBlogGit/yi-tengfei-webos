<script setup lang="ts">
import { computed, onUnmounted } from 'vue';
import { appOf } from '../os/apps';
import { TASKBAR_H, close, focus, minimize, moveTo, osState, resizeTo, toggleMaximize } from '../os/store';
import type { WinState } from '../os/store';

const props = defineProps<{ win: WinState }>();

const icon = computed(() => appOf(props.win.appId)?.icon ?? '');
const isActive = computed(() => osState.activeId === props.win.id);

const frameStyle = computed(() => {
  const w = props.win;
  const z = { zIndex: String(w.z) };
  if (w.maximized) {
    return { left: '0px', top: '0px', width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, ...z };
  }
  return { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px`, ...z };
});

type Mode = 'move' | 'resize';
interface Drag {
  mode: Mode;
  px: number;
  py: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
}
let drag: Drag | null = null;

function onDragStart(e: PointerEvent, mode: Mode) {
  if (e.button !== 0) return;
  focus(props.win.id);
  if (props.win.maximized) return;
  drag = {
    mode,
    px: e.clientX,
    py: e.clientY,
    ox: props.win.x,
    oy: props.win.y,
    w: props.win.w,
    h: props.win.h,
  };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  document.body.style.userSelect = 'none';
}

function onDragMove(e: PointerEvent) {
  if (!drag) return;
  if (drag.mode === 'move') {
    moveTo(props.win.id, drag.ox + (e.clientX - drag.px), drag.oy + (e.clientY - drag.py));
    return;
  }
  resizeTo(props.win.id, drag.w + (e.clientX - drag.px), drag.h + (e.clientY - drag.py));
}

function onDragEnd() {
  drag = null;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  document.body.style.userSelect = '';
}

onUnmounted(() => {
  if (drag) onDragEnd();
});
</script>

<template>
  <section
    class="win"
    :class="{ 'is-active': isActive, 'is-max': win.maximized }"
    :style="frameStyle"
    data-os="window"
    :data-app="win.appId"
    @pointerdown="focus(win.id)"
  >
    <header class="win__bar" @pointerdown="onDragStart($event, 'move')" @dblclick="toggleMaximize(win.id)">
      <span class="win__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" v-html="icon"></svg>
      </span>
      <h3 class="win__title">{{ win.title }}</h3>
      <div class="win__acts" @pointerdown.stop>
        <button class="win__btn" type="button" title="最小化" data-os="min" @click="minimize(win.id)">
          <svg viewBox="0 0 12 12"><path d="M2.4 6.2h7.2" /></svg>
        </button>
        <button class="win__btn" type="button" :title="win.maximized ? '还原' : '最大化'" data-os="max" @click="toggleMaximize(win.id)">
          <svg viewBox="0 0 12 12"><rect x="2.6" y="2.6" width="6.8" height="6.8" rx="1.2" /></svg>
        </button>
        <button class="win__btn win__btn--close" type="button" title="关闭" data-os="close" @click="close(win.id)">
          <svg viewBox="0 0 12 12"><path d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6" /></svg>
        </button>
      </div>
    </header>

    <div class="win__body">
      <slot />
    </div>

    <i class="win__grip" aria-hidden="true" @pointerdown="onDragStart($event, 'resize')"></i>
  </section>
</template>

<style scoped>
.win {
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  border: 1px solid var(--hairline);
  background: var(--glass);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.win.is-active {
  border-color: rgba(92, 200, 255, 0.42);
  box-shadow:
    0 0 0 1px rgba(92, 200, 255, 0.18),
    var(--shadow);
}

.win.is-max {
  border-radius: 0;
}

.win__bar {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 38px;
  flex: 0 0 38px;
  padding: 0 8px 0 12px;
  background: var(--glass-2);
  border-bottom: 1px solid var(--hairline-2);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.win.is-max .win__bar {
  cursor: default;
}

.win__icon svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.win__icon {
  display: flex;
  align-items: center;
}

.win__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-active .win__title {
  color: var(--ink);
}

.win__acts {
  display: flex;
  gap: 2px;
}

.win__btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
}

.win__btn svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
}

.win__btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.win__btn--close:hover {
  background: rgba(255, 96, 96, 0.85);
  color: #fff;
}

.win__body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.win__grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  touch-action: none;
}
</style>

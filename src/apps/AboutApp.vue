<script setup lang="ts">
import { computed } from 'vue';
import { statusRows, storageState } from '../storage';
import { openApp } from '../os/store';

const rows = computed(() => statusRows());
const okCount = computed(() => rows.value.filter((r) => r.ready).length);
</script>

<template>
  <div class="about wb-scroll">
    <header class="about__head">
      <div class="about__logo" aria-hidden="true">
        <svg viewBox="0 0 40 40">
          <path d="M6 26 20 8l14 18-6.4 8.6H12.4z" />
          <path d="M14.6 26h10.8" />
        </svg>
      </div>
      <div>
        <h1 class="about__name">以腾飞 WebOS</h1>
        <p class="about__sub">网页桌面外壳 · 存储可插 · GitHub Pages 直发</p>
      </div>
    </header>

    <p class="about__lede">
      它是一个「桌面」形状的前端外壳：窗口管理器、任务栏、文件/相册/音乐三个窗，
      数据全部来自一个可替换的存储适配层。当前内置演示素材来自站内 <span class="wb-mono">public/demo</span>，
      换成你自己的阿里云盘直链只需要改一个 JSON。
    </p>

    <section class="about__sect">
      <h2 class="about__h2">存储状态</h2>
      <p v-if="storageState.loading" class="wb-dim">读取配置中…</p>
      <p v-else-if="!rows.length" class="wb-dim" data-test="about-none">
        {{ storageState.message || 'storage.json 里一个可用源都没有。' }}
      </p>
      <ul v-else class="about__sources" data-test="about-sources">
        <li v-for="r in rows" :key="r.id">
          <span class="wb-dim">{{ r.label }}</span>
          <b v-if="r.ready" class="wb-badge wb-badge--ok">可用</b>
          <b v-else class="wb-badge wb-badge--warn">待接入</b>
          <p class="wb-dim about__detail">{{ r.detail }}</p>
        </li>
      </ul>
      <p class="about__tally">{{ okCount }} / {{ rows.length }} 个源当前可用</p>
    </section>

    <section class="about__sect">
      <h2 class="about__h2">接上阿里云盘（三步）</h2>
      <ol class="about__steps">
        <li>把云盘分享转成<b>直链</b>（能直接在浏览器地址栏打开、无需登录跳转的那种）。</li>
        <li>
          编辑 <span class="wb-mono">public/storage.json</span>，在 <span class="wb-mono">sources[0].entries</span>
          里把 <span class="wb-mono">url</span> 换成直链，<span class="wb-mono">path</span> 决定它在哪个目录显示。
        </li>
        <li>本地 <span class="wb-mono">npm run build</span> 后推到 GitHub，Pages 自动发布。</li>
      </ol>
      <p class="wb-note">
        静态站的所有文件都是公开的，所以这套代码里<b>没有</b> token / cookie / 密码字段。
        需要鉴权的资源请交给 Alist 这类中间层，浏览器只拿直链。
      </p>
    </section>

    <section class="about__sect">
      <h2 class="about__h2">技术</h2>
      <p class="about__tech">Vue 3 &lt;script setup&gt; + TypeScript + Vite，无路由、无第三方 UI 库、零运行时凭据。</p>
      <div class="about__acts">
        <button class="wb-btn" type="button" data-test="about-open-settings" @click="openApp('settings')">打开设置</button>
        <button class="wb-btn" type="button" data-test="about-open-files" @click="openApp('files')">打开文件窗</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about {
  flex: 1;
  padding: 16px 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.about__head {
  display: flex;
  align-items: center;
  gap: 13px;
}

.about__logo svg {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.7;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.about__name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.about__sub {
  font-size: 12.5px;
  color: var(--ink-3);
}

.about__lede {
  font-size: 13.5px;
  color: var(--ink-2);
}

.about__sect {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about__h2 {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.about__sources li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--hairline-2);
}

.about__detail {
  grid-column: 1 / -1;
  font-size: 12px;
}

.about__tally {
  font-size: 12px;
  color: var(--ink-3);
}

.about__steps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--ink-2);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about__tech {
  font-size: 13px;
  color: var(--ink-2);
}

.about__acts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

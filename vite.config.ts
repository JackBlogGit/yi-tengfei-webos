import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// GitHub Pages 项目站的固定前缀：资源与 public 取用都走 BASE_URL，改仓库名就要同步改这里。
export default defineConfig({
  base: '/yi-tengfei-webos/',
  plugins: [vue()],
});

import { reactive } from 'vue';

export interface Wallpaper {
  label: string;
  /** CSS background 值；'url' 型会在渲染时补部署子路径 */
  css: string;
  image?: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { label: '深海', css: 'linear-gradient(140deg,#0d2036 0%,#123a5c 45%,#0a1424 100%)' },
  { label: '夜紫', css: 'linear-gradient(160deg,#1a1030 0%,#3a1f5c 48%,#0b1020 100%)' },
  { label: '石墨', css: 'linear-gradient(120deg,#141a20 0%,#25313d 52%,#0d1117 100%)' },
  { label: '实拍图', css: '#0b1020', image: 'wallpaper.jpg' },
];

export const prefs = reactive({
  wallpaper: 0,
});

export function wallpaperStyle(): Record<string, string> {
  const w = WALLPAPERS[prefs.wallpaper] ?? WALLPAPERS[0];
  if (!w.image) return { background: w.css };
  return {
    background: `#0b1020 url("${import.meta.env.BASE_URL}${w.image}") center/cover no-repeat`,
  };
}

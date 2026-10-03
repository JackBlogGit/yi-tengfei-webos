import type { Component } from 'vue';
import AboutApp from '../apps/AboutApp.vue';
import FilesApp from '../apps/FilesApp.vue';
import MusicApp from '../apps/MusicApp.vue';
import PhotosApp from '../apps/PhotosApp.vue';
import SettingsApp from '../apps/SettingsApp.vue';

export interface AppDef {
  id: string;
  name: string;
  /** 24×24 viewBox 的描边图标内部路径，用 currentColor */
  icon: string;
  w: number;
  h: number;
  component: Component;
}

export const APPS: AppDef[] = [
  {
    id: 'files',
    name: '文件',
    icon: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    w: 720,
    h: 460,
    component: FilesApp,
  },
  {
    id: 'photos',
    name: '相册',
    icon: '<rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="8.8" cy="10" r="1.5"/><path d="M4.2 17.4 9 12.7l3.6 3.4 2.9-2.2 4.1 3.9"/>',
    w: 760,
    h: 520,
    component: PhotosApp,
  },
  {
    id: 'music',
    name: '音乐',
    icon: '<path d="M9.4 17.6V6.2l10-2v11.4"/><circle cx="6.7" cy="17.9" r="2.6"/><circle cx="16.7" cy="15.9" r="2.6"/>',
    w: 620,
    h: 420,
    component: MusicApp,
  },
  {
    id: 'settings',
    name: '设置',
    icon: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1"/>',
    w: 640,
    h: 470,
    component: SettingsApp,
  },
  {
    id: 'about',
    name: '关于',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.6M12 7.9v.01"/>',
    w: 560,
    h: 440,
    component: AboutApp,
  },
];

export function appOf(id: string): AppDef | null {
  return APPS.find((a) => a.id === id) ?? null;
}

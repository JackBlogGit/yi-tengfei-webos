# 以腾飞 WebOS

一个「网页桌面」形状的纯前端外壳：窗口管理器 + 任务栏 + 文件/相册/音乐三个窗，
数据全部来自一个**可插拔的存储适配层**。部署在 GitHub Pages 上，路径为
`https://jackbloggit.github.io/yi-tengfei-webos/`。

## 本地跑

```bash
npm install
npm run dev        # http://localhost:5173/yi-tengfei-webos/
npm run build      # vue-tsc --noEmit && vite build
npm run preview    # 验收脚本跑在产物上，不跑 dev server
node output/verify-webos.mjs   # 51 项实机断言（headless Edge + CDP）
```

## 存储怎么接

改一个文件：`public/storage.json`。

```jsonc
{
  "version": 1,
  "defaultSourceId": "aliyun",
  "sources": [
    {
      "id": "aliyun",
      "kind": "manifest",          // 清单：直链逐条写在 JSON 里
      "label": "阿里云盘（直连）",
      "entries": [
        { "path": "/照片", "kind": "dir" },
        { "path": "/照片/a.jpg", "kind": "file", "url": "https://你的直链…", "size": 113017 }
      ]
    },
    {
      "id": "alist",
      "kind": "alist",             // 实时：浏览器直挂 Alist 的 /api/fs/list 与 /d 直链
      "label": "Alist",
      "endpoint": "https://你的-alist 地址"
    }
  ]
}
```

- `path` 决定它在文件窗的哪一层；中间的目录不写也会自动补出来。
- `url` 以 `/` 开头表示站内相对路径（会自动补 Pages 子路径），也支持绝对直链。
- 未填 `url` 的条目会显示成「待填」，点击时被拦下并提示改哪里——不会白屏。
- 图片/音频按扩展名推断 mime，相册与音乐窗跨目录收集（深度 4、上限 200/120 条）。

## 为什么没有 token 输入框

本站是纯静态托管，仓库是公开的：任何写进前端的密钥都等于公开。所以

- 阿里云盘走「先把分享转成直链，再写进 JSON」；
- 需要鉴权的资源交给 Alist 这类中间层（挂载点设为匿名可读），浏览器只拿直链；
- 两个适配层的代码里都**没有** token / cookie / 密码字段，这是设计而非缺失。

Alist 走浏览器直连还要求该站点放行 CORS，失败时设置窗会如实显示原因。

## 结构

```
src/
  os/       store.ts 窗口管理器（层叠/聚焦/最小化/最大化/拖拽/缩放）、apps.ts 应用注册表、prefs.ts 外观
  storage/  types.ts 运行时模型 + 路径/排序/直链判定，local.ts 清单适配层，alist.ts 直连适配层，index.ts 装配与探测
  apps/     FilesApp / PhotosApp / MusicApp / SettingsApp / AboutApp
  components/WindowFrame.vue
public/storage.json   唯一的配置入口（示例素材在 public/demo、public/wallpaper.jpg）
```

无路由、无状态库、无第三方 UI 组件库。

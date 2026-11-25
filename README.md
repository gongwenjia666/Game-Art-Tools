# Game-Art-Tools

游戏美术在线工具箱 · 特效贴图处理工具包

纯前端实现，所有处理在本地浏览器完成，图片不上传服务器，输出透明 PNG 可直接进引擎。

## 在线地址

**https://gongwenjia666.github.io/Game-Art-Tools/**

## 工具列表

| 模块 | 入口 | 功能 |
|---|---|---|
| 01 刀光拉直 | `slash.html` | 用贝塞尔锚点描出刀光中心线，把透视 / S 形刀光展开为水平条带，可单独抠出刀光 |
| 02 圆形法阵提取 | `magic-circle.html` | 沿法阵外圆描点拟合椭圆，展平为正视平面，自动剔除角色等遮挡物，只输出法阵本体 |
| 03 精灵图生成 | `sprite-generator/index.html` | 视频逐帧提取为图片序列，按帧率 / 数量 / 时间间隔抽帧，合并为精灵序列图并打包下载 |
| 04 一键遮罩 | `mask-tool.html` | 图片转黑白遮罩图或 Sobel 边缘图，支持 Alpha 通道来源、羽化、扩图画布，可输出到 Alpha 通道 |
| 05 特效网格生成 | `effect-mesh/index.html` | 刀光 / 飘带 / 环形 / 球面 / 光束等特效网格，实时 3D 预览、UV 预览与旋转滚动、纹理预览，支持 OBJ / FBX 导出（第三方 MIT 项目，见 `effect-mesh/NOTICE.md`） |
| 像素化 | `pixelate.html` | 像素化 / 马赛克处理（首页暂未挂入口，可直接访问） |

## 目录结构

```
.
├── index.html              # 首页导航
├── slash.html              # 刀光拉直
├── magic-circle.html       # 圆形法阵提取
├── mask-tool.html          # 一键遮罩
├── pixelate.html           # 像素化
├── sprite-generator/       # 精灵图生成
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── vendor/jszip.min.js # 浏览器端打包下载
├── effect-mesh/            # 特效网格生成（Effect Mesh Generator 构建产物，MIT）
│   ├── index.html
│   ├── assets/
│   ├── LICENSE
│   └── NOTICE.md           # 来源与改动说明
├── tests/                  # 精度测试脚本
└── _dev/                   # 开发期调试脚本与中间产物，非工具本体
```

## 本地运行

无需构建，直接起个静态服务器即可（推荐，避免 `file://` 下的跨域限制）：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 部署

仓库已开启 GitHub Pages，`main` 分支根目录即发布源，推送后自动构建。

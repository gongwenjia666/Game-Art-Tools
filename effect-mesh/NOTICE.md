# 来源与授权 / Attribution

本目录（`effect-mesh/`）为第三方开源项目的**构建产物**，集成到 Game-Art-Tools 工具箱中。

- 项目：Effect Mesh Generator
- 作者：big615big615
- 原仓库：https://github.com/big615big615/EffectMeshGenerator
- 原在线版：https://big615big615.github.io/EffectMeshGenerator/
- 许可证：MIT（见同目录 `LICENSE`）

## 改动说明

功能逻辑与交互未改动，共三处调整：

1. 构建时把 Vite `base` 设为 `/Game-Art-Tools/effect-mesh/`，并将产出 `index.html` 的 `canonical` / `og:url` 指向本工具箱地址，以便在本仓库子路径下正确加载资源。
2. **界面语言本地化**：把原「日本語」语言包替换为简体中文语言包（`Language` 类型由 `'ja' | 'en'` 改为 `'zh' | 'en'`，`i18n.ts` 的 `ja` 字典译为 `zh`，网格类型名称同步翻译），默认语言改为中文。
3. `index.html` 的 `lang`、`title`、`description`、OG/Twitter 卡片文案改为中文。

**English 语言包原样保留**，界面右上角「语言」仍可在「中文 / English」之间切换。

如需上游最新版本，重新构建后覆盖本目录即可（注意上游只有日/英语言包，覆盖会丢失中文）：

```bash
git clone https://github.com/big615big615/EffectMeshGenerator.git
cd EffectMeshGenerator && npm ci
npx tsc && npx vite build --base=/Game-Art-Tools/effect-mesh/
# 将 dist/ 内容覆盖到本目录，并保留 LICENSE 与本文件
```

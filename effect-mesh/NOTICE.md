# 来源与授权 / Attribution

本目录（`effect-mesh/`）为第三方开源项目的**构建产物**，原样集成到 Game-Art-Tools 工具箱中，未修改功能代码。

- 项目：Effect Mesh Generator
- 作者：big615big615
- 原仓库：https://github.com/big615big615/EffectMeshGenerator
- 原在线版：https://big615big615.github.io/EffectMeshGenerator/
- 许可证：MIT（见同目录 `LICENSE`）

## 改动说明

仅一处改动：构建时把 Vite `base` 设为 `/Game-Art-Tools/effect-mesh/`，并将产出 `index.html` 中的 `canonical` / `og:url` 指向本工具箱地址，以便在本仓库子路径下正确加载资源。功能与界面保持原样。

如需上游最新版本，重新构建后覆盖本目录即可：

```bash
git clone https://github.com/big615big615/EffectMeshGenerator.git
cd EffectMeshGenerator && npm ci
npx tsc && npx vite build --base=/Game-Art-Tools/effect-mesh/
# 将 dist/ 内容覆盖到本目录，并保留 LICENSE 与本文件
```

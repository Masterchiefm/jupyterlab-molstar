# jupyterlab-molstar

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![JupyterLab](https://img.shields.io/badge/JupyterLab-%3E%3D4-blue)](https://jupyterlab.readthedocs.io/)
[![Mol*](https://img.shields.io/badge/viewer-Mol*-orange)](https://molstar.org/)

[English](README.md) | 简体中文

在 JupyterLab 文件浏览器中直接双击打开蛋白质/分子结构文件，用 [Mol*](https://molstar.org/)
（Molstar）查看器标签页进行浏览——无需内核，无需写任何代码。

双击 `.pdb` 或 `.cif` 文件即可在 Mol* 标签页中打开，体验和双击打开 CSV 一样自然。

![截图](https://raw.githubusercontent.com/Masterchiefm/jupyterlab-molstar/main/docs/screenshot.png)

## 为什么做这个插件？

Jupyter 现有的 Mol*/3Dmol 方案（`ipymolstar`、`nglview`、`molview`、`py3Dmol`）都是 **notebook
widget**：必须运行内核、执行 Python 代码才能看到结构。本插件注册的是真正的**文档查看器**，
让结构文件成为 JupyterLab 的一等公民——浏览、双击、直接看。

## 安装

从 GitHub 安装（仓库内已包含预构建扩展，无需 Node.js）：

```bash
pip install "jupyterlab-molstar @ git+https://github.com/Masterchiefm/jupyterlab-molstar.git"
```

或从源码构建：

```bash
git clone https://github.com/Masterchiefm/jupyterlab-molstar.git
cd jupyterlab-molstar
jlpm install && jlpm run build
pip install . --no-build-isolation
```

要求 JupyterLab >= 4 和支持 WebGL 的浏览器。安装后重启 `jupyter lab` 即可。

## 使用

- **打开**：在文件浏览器中双击结构文件（或直接拖入）。
- **改为编辑**：右键 → *Open With* → *Editor*；在编辑器中保存后，已打开的查看器标签页会自动
  重载。工具栏的 *Reload* 按钮可随时从磁盘重新读取。
- 查看器是完整的 Mol* 界面：表现方式预设、序列面板、测量、选择、动画、截图导出。
- 自动跟随 JupyterLab 明/暗主题。
- Mol*（约 5 MB）按需惰性加载——只在第一次打开结构文件时才加载，不影响 Lab 启动速度。

## 支持的格式

| 扩展名 | 格式 | Mol* 格式 |
| --- | --- | --- |
| `.pdb`、`.ent` | PDB | `pdb` |
| `.cif`、`.mmcif` | mmCIF / CIF | `mmcif` |
| `.bcif` | BinaryCIF | `mmcif`（二进制） |
| `.gro` | GROMACS GRO | `gro` |
| `.pdbqt` | AutoDock PDBQT | `pdbqt` |
| `.pqr` | PQR | `pqr` |
| `.xyz` | XYZ | `xyz` |
| `.mol` | MDL MOL | `mol` |
| `.sdf` | MDL SDF | `sdf` |
| `.mol2` | MOL2 | `mol2` |

说明：

- 不支持 MMTF——Mol* 在 v5 中移除了 MMTF 解析器。
- 小分子 CIF（core CIF）同样通过 Mol* 的 `cif` 通道支持。

## 实现原理

插件为每种格式向 `app.docRegistry` 注册一个文件类型和一个 widget 工厂。查看器是承载 Lumino
面板的 `DocumentWidget`，按需注入预构建的 Mol* viewer bundle
（`labextension/static/vendor/`），创建 `molstar.Viewer` 并调用
`loadStructureFromData(content, format)`。文件内容走 JupyterLab 标准 contents API（文本格式为
text，二进制格式为 base64），因此**不需要任何 server 端扩展**。

## 开发

架构说明、构建注意事项和测试方法见 [AGENTS.md](AGENTS.md)。

```bash
jlpm run build && pip install . --no-build-isolation && jupyter lab
```

## 致谢

基于 [Mol*](https://github.com/molstar/molstar)（MIT 许可）。如将其用于科研，请引用 Mol* 论文：

> David Sehnal, Sebastian Bittrich, Mandar Deshpande, Radka Svobodová, Karel Berka, Václav Bazgier,
> Sameer Velankar, Stephen K Burley, Jaroslav Koča, Alexander S Rose: *Mol\* Viewer: modern web app
> for 3D visualization and analysis of large biomolecular structures*, Nucleic Acids Research, 2021;
> doi:10.1093/nar/gkab314.

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。内置的 Mol* viewer 采用 MIT 许可。

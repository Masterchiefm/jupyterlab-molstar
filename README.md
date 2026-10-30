# jupyterlab-molstar

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![JupyterLab](https://img.shields.io/badge/JupyterLab-%3E%3D4-blue)](https://jupyterlab.readthedocs.io/)
[![Mol*](https://img.shields.io/badge/viewer-Mol*-orange)](https://molstar.org/)

English | [简体中文](README.zh-CN.md)

Open molecular structure files directly from the JupyterLab file browser and explore them in a full
[Mol*](https://molstar.org/) (Molstar) viewer tab — no kernel, no notebook code required.

Double-click a `.pdb` or `.cif` file in the file browser and it opens in a Mol* tab, just like a
CSV opening with the built-in viewer.

![screenshot](https://raw.githubusercontent.com/Masterchiefm/jupyterlab-molstar/main/docs/screenshot.png)

## Why this extension?

Most Mol*/3Dmol options for Jupyter (`ipymolstar`, `nglview`, `molview`, `py3Dmol`) are **notebook
widgets**: they need a running kernel and Python code before anything is displayed. This extension
instead registers real **document viewers**, so structure files behave like first-class JupyterLab
documents — browse, double-click, done.

## Install

From GitHub (the prebuilt extension ships in the repo — no Node.js needed):

```bash
pip install "jupyterlab-molstar @ git+https://github.com/Masterchiefm/jupyterlab-molstar.git"
```

Or from source:

```bash
git clone https://github.com/Masterchiefm/jupyterlab-molstar.git
cd jupyterlab-molstar
jlpm install && jlpm run build
pip install . --no-build-isolation
```

Requires JupyterLab >= 4 and a WebGL-capable browser. Then (re)start `jupyter lab`.

## Usage

- **Open**: double-click a structure file in the file browser (or drag it in).
- **Edit instead**: right-click → *Open With* → *Editor*; saving in the editor auto-reloads any
  open viewer tab. The toolbar *Reload* button re-reads from disk on demand.
- The viewer is the full Mol* UI: representation presets, sequence panel, measurements, selection,
  animation, screenshot export.
- Follows the JupyterLab light/dark theme automatically.
- Mol* (~5 MB) loads lazily — only when the first structure is opened; zero impact on Lab startup.

## Supported formats

| Extension | Format | Mol* format |
| --- | --- | --- |
| `.pdb`, `.ent` | PDB | `pdb` |
| `.cif`, `.mmcif` | mmCIF / CIF | `mmcif` |
| `.bcif` | BinaryCIF | `mmcif` (binary) |
| `.gro` | GROMACS GRO | `gro` |
| `.pdbqt` | AutoDock PDBQT | `pdbqt` |
| `.pqr` | PQR | `pqr` |
| `.xyz` | XYZ | `xyz` |
| `.mol` | MDL MOL | `mol` |
| `.sdf` | MDL SDF | `sdf` |
| `.mol2` | MOL2 | `mol2` |

Notes:

- MMTF is not supported — Mol* removed the MMTF parser in v5.
- Small-molecule CIF (core CIF) works through Mol*'s `cif` pipeline.

## How it works

The plugin registers one file type + widget factory per format with `app.docRegistry`. Widgets are
`DocumentWidget`s hosting a Lumino panel that lazily injects the prebuilt Mol* viewer bundle
(`labextension/static/vendor/`), creates `molstar.Viewer`, and calls
`loadStructureFromData(content, format)`. File content arrives through the normal JupyterLab
contents API (text or base64 for binary formats), so no extra server extension is needed.

## Development

See [AGENTS.md](AGENTS.md) for architecture notes, build gotchas and the testing recipe.

```bash
jlpm run build && pip install . --no-build-isolation && jupyter lab
```

## Acknowledgements

Built on [Mol*](https://github.com/molstar/molstar) (MIT). If you use this extension in research,
please cite the Mol* paper:

> David Sehnal, Sebastian Bittrich, Mandar Deshpande, Radka Svobodová, Karel Berka, Václav Bazgier,
> Sameer Velankar, Stephen K Burley, Jaroslav Koča, Alexander S Rose: *Mol\* Viewer: modern web app
> for 3D visualization and analysis of large biomolecular structures*, Nucleic Acids Research, 2021;
> doi:10.1093/nar/gkab314.

## License

Apache-2.0 — see [LICENSE](LICENSE). The bundled Mol* viewer is MIT-licensed.

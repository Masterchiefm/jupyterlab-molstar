/**
 * jupyterlab-molstar
 *
 * Registers molecular structure file types (PDB, mmCIF, BinaryCIF, GRO, PDBQT,
 * PQR, XYZ, MOL, SDF, MOL2) with the JupyterLab document registry and opens
 * them in a Mol* viewer tab. Double clicking a structure file in the file
 * browser opens the viewer; the plain text editor stays available via
 * "Open With".
 *
 * The Mol* viewer is loaded lazily from the prebuilt bundle shipped with this
 * extension in `static/vendor/`, so the federated extension stays small and
 * Mol* is only fetched when a structure is actually opened.
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { ToolbarButton } from '@jupyterlab/apputils';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
} from '@jupyterlab/docregistry';

import { refreshIcon } from '@jupyterlab/ui-components';

import { Widget } from '@lumino/widgets';

const PACKAGE_NAME = 'jupyterlab-molstar';
const VIEWER_LABEL = 'Mol* Viewer';

/** Minimal shape of the molstar global exposed by the prebuilt viewer bundle. */
interface IMolStarViewer {
  plugin: { clear(resetViewportSettings?: boolean): Promise<void> };
  loadStructureFromData(
    data: string | number[],
    format: string,
    options?: { dataLabel?: string }
  ): Promise<void>;
  dispose(): void;
}

interface IMolStarGlobal {
  Viewer: {
    create(
      element: HTMLElement,
      options?: Record<string, unknown>
    ): Promise<IMolStarViewer>;
  };
}

/** Description of one structure file type handled by this extension. */
interface IFormatSpec {
  /** Name used in the document registry. */
  name: string;
  displayName: string;
  mimeTypes: string[];
  extensions: string[];
  /** Whether the file is binary (delivered as base64 by the contents API). */
  binary: boolean;
  /** Format name understood by Mol* loadStructureFromData. */
  molstarFormat: string;
}

const FORMATS: IFormatSpec[] = [
  {
    name: 'pdb',
    displayName: 'PDB file',
    mimeTypes: ['text/x-pdb'],
    extensions: ['.pdb', '.ent'],
    binary: false,
    molstarFormat: 'pdb',
  },
  {
    name: 'mmcif',
    displayName: 'mmCIF file',
    mimeTypes: ['text/x-mmcif', 'chemical/x-mmcif'],
    extensions: ['.cif', '.mmcif'],
    binary: false,
    molstarFormat: 'mmcif',
  },
  {
    name: 'bcif',
    displayName: 'BinaryCIF file',
    mimeTypes: ['application/x-bcif'],
    extensions: ['.bcif'],
    binary: true,
    molstarFormat: 'mmcif',
  },
  {
    name: 'gro',
    displayName: 'GRO file',
    mimeTypes: ['text/x-gro', 'chemical/x-gro'],
    extensions: ['.gro'],
    binary: false,
    molstarFormat: 'gro',
  },
  {
    name: 'pdbqt',
    displayName: 'PDBQT file',
    mimeTypes: ['text/x-pdbqt', 'chemical/x-pdbqt'],
    extensions: ['.pdbqt'],
    binary: false,
    molstarFormat: 'pdbqt',
  },
  {
    name: 'pqr',
    displayName: 'PQR file',
    mimeTypes: ['text/x-pqr', 'chemical/x-pqr'],
    extensions: ['.pqr'],
    binary: false,
    molstarFormat: 'pqr',
  },
  {
    name: 'xyz',
    displayName: 'XYZ file',
    mimeTypes: ['text/x-xyz', 'chemical/x-xyz'],
    extensions: ['.xyz'],
    binary: false,
    molstarFormat: 'xyz',
  },
  {
    name: 'mol',
    displayName: 'MOL file',
    mimeTypes: ['chemical/x-mdl-molfile'],
    extensions: ['.mol'],
    binary: false,
    molstarFormat: 'mol',
  },
  {
    name: 'sdf',
    displayName: 'SDF file',
    mimeTypes: ['chemical/x-sdf'],
    extensions: ['.sdf'],
    binary: false,
    molstarFormat: 'sdf',
  },
  {
    name: 'mol2',
    displayName: 'MOL2 file',
    mimeTypes: ['chemical/x-mol2'],
    extensions: ['.mol2'],
    binary: false,
    molstarFormat: 'mol2',
  },
];

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? 'unknown error');
}

// ---------------------------------------------------------------------------
// Lazy loading of the Mol* viewer bundle + theme handling
// ---------------------------------------------------------------------------

let viewerAssetsPromise: Promise<IMolStarGlobal> | null = null;
let molstarThemeLink: HTMLLinkElement | null = null;

function vendorUrl(...parts: string[]): string {
  return URLExt.join(
    PageConfig.getBaseUrl(),
    'lab/extensions',
    PACKAGE_NAME,
    'static/vendor',
    ...parts
  );
}

/**
 * Mol* 5 ships complete stylesheets per theme: molstar.css (dark) and
 * theme/light.css. Point a single link element at whichever matches the
 * current JupyterLab theme.
 */
function applyMolStarTheme(): void {
  const isLight =
    (document.body.dataset.jpThemeLight ?? 'false') === 'true';
  const css = isLight
    ? vendorUrl('theme', 'light.css')
    : vendorUrl('molstar.css');
  if (!molstarThemeLink) {
    molstarThemeLink = document.createElement('link');
    molstarThemeLink.rel = 'stylesheet';
    molstarThemeLink.dataset.jpMolstar = 'true';
    document.head.appendChild(molstarThemeLink);
    // Watch theme flips so open viewers restyle together with JupyterLab.
    new MutationObserver(() => applyMolStarTheme()).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-jp-theme-light'],
    });
  }
  if (molstarThemeLink.href !== new URL(css, window.location.href).href) {
    molstarThemeLink.href = css;
  }
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load Mol* viewer bundle from ${url}`));
    document.head.appendChild(script);
  });
}

async function ensureMolStar(): Promise<IMolStarGlobal> {
  const existing = (window as unknown as { molstar?: IMolStarGlobal }).molstar;
  if (existing) {
    return existing;
  }
  if (!viewerAssetsPromise) {
    viewerAssetsPromise = (async () => {
      applyMolStarTheme();
      await loadScript(vendorUrl('molstar.js'));
      const molstar = (window as unknown as { molstar?: IMolStarGlobal })
        .molstar;
      if (!molstar?.Viewer) {
        throw new Error(
          'Mol* bundle loaded but window.molstar.Viewer is missing'
        );
      }
      return molstar;
    })();
    viewerAssetsPromise.catch(() => {
      // Allow a retry after a transient failure.
      viewerAssetsPromise = null;
    });
  }
  return viewerAssetsPromise;
}

// ---------------------------------------------------------------------------
// The Mol* viewing area
// ---------------------------------------------------------------------------

const STYLES = `
.jp-MolStarPanel {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 64px;
  min-height: 64px;
  background: #101014;
  overflow: hidden;
}
.jp-MolStarPanel > .jp-MolStarHost {
  position: absolute;
  inset: 0;
}
.jp-MolStarPanel > .jp-MolStarStatus {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  color: var(--jp-ui-font-color1, #ddd);
  font-size: var(--jp-ui-font-size1, 13px);
  pointer-events: none;
  z-index: 3;
}
.jp-MolStarPanel > .jp-MolStarStatus[data-error="true"] {
  color: var(--jp-error-color1, #f66);
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.55);
}
`;

function injectStyles(): void {
  if (document.head.querySelector('style[data-jp-molstar="true"]')) {
    return;
  }
  const style = document.createElement('style');
  style.dataset.jpMolstar = 'true';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

/**
 * A Lumino widget hosting a Mol* viewer instance, kept in sync with a
 * document context (reloadable when the file changes on disk).
 */
class MolStarPanel extends Widget {
  constructor(options: { format: string; binary: boolean; label: string }) {
    super();
    this.addClass('jp-MolStarPanel');
    this._format = options.format;
    this._binary = options.binary;
    this._label = options.label;

    this._host = document.createElement('div');
    this._host.className = 'jp-MolStarHost';
    this.node.appendChild(this._host);

    this._status = document.createElement('div');
    this._status.className = 'jp-MolStarStatus';
    this._status.textContent = 'Loading Mol* viewer…';
    this.node.appendChild(this._status);
  }

  /** (Re)load the structure from the given raw content. */
  setContent(data: string | Uint8Array): void {
    // Serialize loads: the latest call wins, earlier ones become no-ops.
    this._loadToken++;
    const token = this._loadToken;
    this._queue = this._queue.then(async () => {
      if (this.isDisposed || token !== this._loadToken) {
        return;
      }
      this._showStatus('Loading structure…', false);
      try {
        const viewer = await this._ensureViewer();
        if (this.isDisposed || token !== this._loadToken || !viewer) {
          return;
        }
        // loadStructureFromData appends to the state tree, so clear any
        // previously loaded structure first.
        await viewer.plugin.clear();
        const payload = this._binary
          ? Array.from(data as Uint8Array)
          : (data as string);
        await viewer.loadStructureFromData(payload, this._format, {
          dataLabel: this._label,
        });
        if (!this.isDisposed && token === this._loadToken) {
          this._showStatus(null, false);
        }
      } catch (err) {
        if (!this.isDisposed && token === this._loadToken) {
          this._showStatus(
            `Failed to load structure.\n${errorMessage(err)}\n\n` +
              'The file may use an unsupported dialect; try opening it with the text editor.',
            true
          );
        }
        console.error('[jupyterlab-molstar] failed to load structure:', err);
      }
    });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    const viewer = this._viewer;
    this._viewer = null;
    this._loadToken++; // invalidate any queued load
    if (viewer) {
      try {
        viewer.dispose();
      } catch (err) {
        console.warn('[jupyterlab-molstar] viewer dispose failed:', err);
      }
    }
    super.dispose();
  }

  protected onAfterAttach(): void {
    void this._ensureViewer();
  }

  private async _ensureViewer(): Promise<IMolStarViewer | null> {
    if (this.isDisposed) {
      return null;
    }
    if (this._viewer) {
      return this._viewer;
    }
    if (!this._viewerPromise) {
      injectStyles();
      this._viewerPromise = (async () => {
        const molstar = await ensureMolStar();
        if (this.isDisposed || !this.isAttached) {
          return null;
        }
        const viewer = await molstar.Viewer.create(this._host, {
          layoutIsExpanded: false,
          layoutShowControls: true,
          layoutShowRemoteState: false,
          layoutShowSequence: true,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: true,
          viewportShowSettings: true,
          viewportShowSelectionMode: true,
          viewportShowAnimation: true,
          pdbProvider: 'rcsb',
          emdbProvider: 'rcsb',
        });
        if (this.isDisposed) {
          try {
            viewer.dispose();
          } catch {
            /* ignore */
          }
          return null;
        }
        this._viewer = viewer;
        return viewer;
      })();
      this._viewerPromise.catch(err => {
        this._showStatus(
          `Could not start Mol* viewer.\n${errorMessage(err)}`,
          true
        );
        console.error('[jupyterlab-molstar] viewer creation failed:', err);
      });
    }
    try {
      return await this._viewerPromise;
    } finally {
      this._viewerPromise = null;
    }
  }

  private _showStatus(message: string | null, isError: boolean): void {
    this._status.textContent = message ?? '';
    if (message) {
      this._status.dataset.error = String(isError);
      this._status.style.display = 'flex';
    } else {
      delete this._status.dataset.error;
      this._status.style.display = 'none';
    }
  }

  private _format: string;
  private _binary: boolean;
  private _label: string;
  private _host: HTMLElement;
  private _status: HTMLElement;
  private _viewer: IMolStarViewer | null = null;
  private _viewerPromise: Promise<IMolStarViewer | null> | null = null;
  private _queue: Promise<void> = Promise.resolve();
  private _loadToken = 0;
}

// ---------------------------------------------------------------------------
// Document widget + factory
// ---------------------------------------------------------------------------

class MolStarDocumentWidget extends DocumentWidget<MolStarPanel> {
  constructor(
    options: DocumentWidget.IOptions<MolStarPanel> & { spec: IFormatSpec }
  ) {
    super(options);
    const { spec, context } = options;
    this._spec = spec;

    this.toolbar.addItem(
      'reload',
      new ToolbarButton({
        icon: refreshIcon,
        label: 'Reload',
        tooltip: 'Reload structure from disk',
        onClick: () => void this.reload(),
      })
    );

    const push = (): void => {
      const data = spec.binary
        ? base64ToBytes(context.model.toString())
        : context.model.toString();
      this.content.setContent(data);
    };

    void context.ready.then(() => {
      push();
      // Reload when the file changes on disk (or is saved by the editor).
      context.model.contentChanged.connect(() => {
        if (this._reloadTimer !== null) {
          window.clearTimeout(this._reloadTimer);
        }
        this._reloadTimer = window.setTimeout(() => {
          this._reloadTimer = null;
          push();
        }, 400);
      });
    });
  }

  async reload(): Promise<void> {
    await this.context.revert();
    const spec = this._spec;
    const data = spec.binary
      ? base64ToBytes(this.context.model.toString())
      : this.context.model.toString();
    this.content.setContent(data);
  }

  private _spec: IFormatSpec;
  private _reloadTimer: number | null = null;
}

class MolStarWidgetFactory extends ABCWidgetFactory<MolStarDocumentWidget> {
  constructor(
    options: DocumentRegistry.IWidgetFactoryOptions<MolStarDocumentWidget> & {
      spec: IFormatSpec;
    }
  ) {
    super(options);
    this._spec = options.spec;
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): MolStarDocumentWidget {
    const spec = this._spec;
    const content = new MolStarPanel({
      format: spec.molstarFormat,
      binary: spec.binary,
      label: context.path.split('/').pop() ?? context.path,
    });
    return new MolStarDocumentWidget({ content, context, spec });
  }

  private _spec: IFormatSpec;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const plugin: JupyterFrontEndPlugin<void> = {
  id: `${PACKAGE_NAME}:viewer`,
  description:
    'View molecular structure files (PDB, mmCIF, BinaryCIF, GRO, PDBQT, PQR, XYZ, MOL, SDF, MOL2) with Mol*.',
  autoStart: true,
  activate: (app: JupyterFrontEnd): void => {
    for (const spec of FORMATS) {
      app.docRegistry.addFileType({
        name: spec.name,
        displayName: spec.displayName,
        mimeTypes: spec.mimeTypes,
        extensions: spec.extensions,
        fileFormat: spec.binary ? 'base64' : 'text',
        contentType: 'file',
      });

      app.docRegistry.addWidgetFactory(
        new MolStarWidgetFactory({
          name: `Mol*:${spec.name}`,
          label: VIEWER_LABEL,
          modelName: spec.binary ? 'base64' : 'text',
          fileTypes: [spec.name],
          defaultFor: [spec.name],
          readOnly: true,
          spec,
        })
      );
    }
  },
};

export default plugin;

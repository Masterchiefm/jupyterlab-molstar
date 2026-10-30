"""jupyterlab-molstar: view molecular structure files in JupyterLab with Mol*."""

__version__ = "0.1.0"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "jupyterlab-molstar"}]

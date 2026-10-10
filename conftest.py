import os
import sys
from pathlib import Path
import pytest

# Ensure Tcl/Tk libraries are located reliably across all test runs
_tcl_p = Path(sys.base_prefix) / "tcl"
if (_tcl_p / "tcl8.6").exists():
    os.environ.setdefault("TCL_LIBRARY", str(_tcl_p / "tcl8.6"))
if (_tcl_p / "tk8.6").exists():
    os.environ.setdefault("TK_LIBRARY", str(_tcl_p / "tk8.6"))


@pytest.fixture
def pump_ui():
    """Wait for real UI workers with a bounded event loop, never fixed sleeps."""
    import time

    def pump(app, timeout=15):
        view = app.workforce_dashboard_view
        deadline = time.monotonic() + timeout
        while True:
            app.update()
            pending = app.tk.splitlist(app.tk.call("after", "info"))
            debounce = view._filter_debounce_timer in pending
            busy = debounce or view._is_loading_metrics or view._is_loading_trend
            if not busy:
                return
            assert time.monotonic() < deadline, "UI workers did not settle"
    return pump


@pytest.fixture
def fresh_desktop_app(monkeypatch, tmp_path, pump_ui):
    """One Tcl interpreter/App per test; drain workers before clearing globals."""
    import gc
    import threading
    import time
    from app import App
    from storage import snapshot_service
    from workforce_intelligence.snapshot_bridge import workforce_bridge

    gc.collect()  # Release old Tk objects on the owner thread before a new root.
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    snapshot_service.clear()
    workforce_bridge.clear_cache()
    workers = []
    real_start = threading.Thread.start

    def track_start(thread, *args, **kwargs):
        workers.append(thread)
        return real_start(thread, *args, **kwargs)

    monkeypatch.setattr(threading.Thread, "start", track_start)
    app = App()
    app.withdraw()
    app.update()
    yield app
    try:
        deadline = time.monotonic() + 20
        while any(t.is_alive() for t in workers):
            app.update()
            for thread in list(workers):
                thread.join(timeout=0.001)
            assert time.monotonic() < deadline, "App workers survived teardown"
        # Cancel this interpreter's pending callbacks before destroying widgets.
        for callback in app.tk.splitlist(app.tk.call("after", "info")):
            app.tk.call("after", "cancel", callback)
    finally:
        app.destroy()
        snapshot_service.clear()
        workforce_bridge.clear_cache()
        gc.collect()


@pytest.fixture
def desktop_app(fresh_desktop_app):
    return fresh_desktop_app

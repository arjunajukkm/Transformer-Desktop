# Reproducing the Stage 2A Windows baseline

Use **CPython 3.14.2 x86-64 on Windows**. The legacy root `requirements.txt` is unchanged and is not the reproducible entry point. These locks preserve observed versions; they do not upgrade the application.

From the repository root, with an external writable directory of your choosing:

```powershell
python -m venv C:\temp\kra-stage2-venv
C:\temp\kra-stage2-venv\Scripts\python.exe -m pip install --require-hashes --only-binary=:all: -r requirements/full-win-py314.lock
C:\temp\kra-stage2-venv\Scripts\python.exe -m pip check
C:\temp\kra-stage2-venv\Scripts\python.exe scripts/run_stage2_baseline.py --work-dir C:\temp\kra-stage2-evidence --per-file
```

The tested bootstrap pip version is 25.3, provided with this Python environment. Pin it separately if your bootstrap differs. Do not reuse a populated environment to prove a clean install: already-satisfied dependencies may bypass wheel verification.

For an offline rerun, first download on the same platform:

```powershell
python -m pip download --require-hashes --only-binary=:all: -r requirements/full-win-py314.lock --dest C:\temp\kra-wheelhouse
C:\temp\kra-stage2-venv\Scripts\python.exe -m pip install --no-index --find-links C:\temp\kra-wheelhouse --require-hashes --only-binary=:all: -r requirements/full-win-py314.lock
```

The runner creates a new source-only copy and fake home for each module, blocks sockets/dotenv, disables third-party plugin autoload, records all collected IDs and preserves pytest's nonzero exit status. It never copies `.env`, `local_data`, output workbooks, build or dist. `--test tests/contracts --test tests/characterization` is a focused diagnostic; omit it for a complete run. `--collect-only` without `--per-file` collects only. Evidence and temporary data remain in the chosen external directory for review. This is not an OS security sandbox; use only reviewed tests.

Profiles:

- `core.in` / `core-win-py314.lock`: direct desktop/domain dependencies and their transitive closure. NumPy and pyarrow explicitly declared.
- `test.in` / `test-win-py314.lock`: core plus pytest; optional SciPy interpolation is absent here, so this is not the full visual environment.
- `optional.in`: SciPy chart interpolation and preserved OCR/image packages. rembg/onnx/OpenCV are legacy declarations, not proof every current workflow uses them.
- `build.in`: PyInstaller and optional watchdog development reload.
- `full.in` / `full-win-py314.lock`: complete observed baseline including optional/build/test dependencies; use for final gate evidence.

Locks pin each selected wheel hash and dependency, including extras. They are specific to this platform/interpreter; a different platform needs a separately reviewed lock. To update, edit direct `.in` intent, resolve/download into a new empty environment, inspect the dependency closure (including extras), generate hashes for all selected wheels, run `pip check`, then rerun complete tests and reconcile changed results. Do not automatically regenerate expected metric outputs or copy an unrelated global environment freeze.

Known limits: xlrd absent means `.xls` is unverified/unsupported; browser drivers and OCR/removal models are not bundled; full profile retains both OpenCV distributions through legacy/ddddocr dependencies, with shared `cv2` ownership risk. PyInstaller 6.19.0 runs under the selected Python, but no current executable build/startup acceptance was completed. Full suite currently exits nonzero; see the Stage 2A gate report.

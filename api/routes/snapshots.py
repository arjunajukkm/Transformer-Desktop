"""
api/routes/snapshots.py
────────────────────────
Snapshot lifecycle, dataset ingestion, and Parquet hypercube persistence endpoints.
"""

from datetime import date
from io import BytesIO
from pathlib import Path
import time
from typing import Optional
from fastapi import APIRouter, File, HTTPException, UploadFile
import pandas as pd

from api.schemas import ParquetExportResponse, SnapshotMetadataResponse
from storage.cache_manager import AnalyticalSnapshot, snapshot_cache
from storage.snapshot_service import create_snapshot
from workforce_intelligence.snapshot_bridge import workforce_bridge

router = APIRouter(prefix="/snapshots", tags=["Snapshots & Data Lifecycle"])


@router.get("/active", response_model=SnapshotMetadataResponse)
def get_active_snapshot_metadata():
    """Check active snapshot status and high-level dimensional metadata."""
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return SnapshotMetadataResponse(is_loaded=False)

    meta = snap.metadata or {}
    opts = snap.filter_options or {}

    return SnapshotMetadataResponse(
        is_loaded=True,
        dataset_id=snap.dataset_id,
        row_count=snap.row_count,
        employee_count=meta.get("employee_count", 0),
        date_range=meta.get("date_range"),
        min_date=meta.get("min_date"),
        max_date=meta.get("max_date"),
        business_units_count=len(opts.get("business_units", [])),
        departments_count=len(opts.get("departments", [])),
        managers_count=len(opts.get("managers", [])),
        source_name=meta.get("file_name", snap.raw_source),
    )


@router.post("/demo")
def load_enterprise_demo_snapshot():
    """
    Instantly ingest a realistic multi-month enterprise dataset (May, Jun, Jul 2026)
    with multi-BU hierarchy, attendance events, and approval cycles into active memory.
    """
    t0 = time.perf_counter()
    dates = [
        date(2026, 5, 10), date(2026, 5, 15), date(2026, 5, 20),
        date(2026, 6, 10), date(2026, 6, 15), date(2026, 6, 20),
        date(2026, 7, 10), date(2026, 7, 15), date(2026, 7, 20),
    ]
    bus = ["Engineering", "Lending", "Operations"]
    emp_ids = [101, 102, 103, 104, 105, 106, 107, 108, 109]

    records = []
    for d in dates:
        for idx, emp_id in enumerate(emp_ids):
            bu = bus[idx % 3]
            if bu == "Lending" and d.month == 7:
                att_type = "Single Swipe"
                in_t = "10:30"
                out_t = ""
                exc_flag = "Missing Out Punch"
            elif idx % 4 == 0:
                att_type = "Present"
                in_t = "09:30"
                out_t = "18:30"
                exc_flag = ""
            else:
                att_type = "Present"
                in_t = "09:00"
                out_t = "18:00"
                exc_flag = ""

            records.append({
                "Date": d,
                "Employee No": emp_id,
                "Employee Name": f"Employee {emp_id}",
                "Business Unit": bu,
                "Department": f"{bu} Core",
                "Reporting Manager": f"Manager {bu}",
                "Attendance Type": att_type,
                "Status": "P(MS)" if (bu == "Lending" and d.month == 7) else "P",
                "First In": in_t,
                "Last Out": out_t,
                "Total Duration": "09:00" if out_t else "04:00",
                "Exceptions": exc_flag,
                "Leave Type": "",
                "Leave Status": "",
            })

    df = pd.DataFrame(records)
    snap = create_snapshot(df, dataset_id="enterprise_demo_dataset")
    snapshot_cache.set_active_snapshot(snap)
    
    # Warm bridge foundation & cubes
    workforce_bridge.invalidate_cache()
    workforce_bridge.get_trend_intelligence("missing_swipe_rate")

    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "status": "success",
        "dataset_id": snap.dataset_id,
        "row_count": len(df),
        "execution_time_ms": t_elapsed,
        "message": "Enterprise demo dataset loaded successfully.",
    }


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Ingest, normalize, extract metadata, and precompute standard KPIs
    and multi-dimensional hypercubes from an uploaded CSV or Excel file.
    """
    filename = file.filename or "uploaded_dataset"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    t0 = time.perf_counter()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(BytesIO(content))
        elif filename.endswith(".parquet"):
            df = pd.read_parquet(BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .xlsx, .csv, or .parquet.")

        snap = create_snapshot(df, dataset_id=Path(filename).stem)
        snapshot_cache.set_active_snapshot(snap)

        # Invalidate cached bridge calculations
        workforce_bridge.invalidate_cache()
        workforce_bridge.get_trend_intelligence("missing_swipe_rate")
        
        t_elapsed = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status": "success",
            "dataset_id": snap.dataset_id,
            "row_count": len(df),
            "execution_time_ms": t_elapsed,
            "message": f"Successfully loaded {len(df)} rows from {filename}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")


@router.post("/export-cubes", response_model=ParquetExportResponse)
def export_parquet_cubes(export_dir: Optional[str] = None):
    """
    Materialize and persist analytical multidimensional hypercubes and dimension catalog
    to Apache Parquet files for cold-start restoration (< 20ms).
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        raise HTTPException(status_code=400, detail="No active snapshot loaded.")

    target_path = Path(export_dir) if export_dir else Path(".cache") / "cubes" / str(snap.dataset_id)
    saved = snap.export_cubes(target_path)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to export Parquet hypercubes.")

    return ParquetExportResponse(
        status="success",
        dataset_id=str(snap.dataset_id),
        exported_cubes=saved,
        export_dir=str(target_path),
    )

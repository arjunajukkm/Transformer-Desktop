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
        try:
            from workforce_intelligence.historical_sync import HistoricalSyncManager
            h = HistoricalSyncManager()
            df, summary = h.load_unified_history()
            if df is not None and not df.empty:
                snap = create_snapshot(df, dataset_id="workforce_sync_all")
                snapshot_cache.set_active_snapshot(snap)
                workforce_bridge.invalidate_cache()
        except Exception:
            pass

    if not snap or not snap.is_valid():
        return SnapshotMetadataResponse(is_loaded=False)

    meta = snap.metadata or {}
    opts = snap.filter_options or {}

    from storage.materialized_store import materialized_store
    mat_meta = materialized_store.get_metadata()

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


@router.post("/sync-and-recalculate")
def sync_and_recalculate_materialized_cache():
    """
    On-demand ad-hoc sync and full analytical precalculation.
    Pulls fresh historical/live records, precalculates all 15 metrics, overviews,
    and cascaded filter catalogs, and saves to the daily persistent disk cache.
    """
    from datetime import datetime
    from storage.materialized_store import materialized_store
    from workforce_intelligence.historical_sync import HistoricalSyncManager

    t0 = time.perf_counter()
    h = HistoricalSyncManager()
    df, summary = h.load_unified_history()
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No workforce attendance records found in archive.")

    ds_id = f"workforce_sync_all_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    snap = create_snapshot(df, dataset_id=ds_id)
    snapshot_cache.set_active_snapshot(snap)
    workforce_bridge.invalidate_cache()

    # Run full precalculation
    precalc_res = materialized_store.precalculate_all(snap=snap, force=True)
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "status": "success",
        "dataset_id": ds_id,
        "row_count": len(df),
        "execution_time_ms": duration_ms,
        "precalculation": precalc_res,
        "last_calculated_at": materialized_store.last_calculated_at,
        "message": f"Successfully synced {len(df):,} workforce records and refreshed daily materialized cache.",
    }


@router.post("/demo")
def load_enterprise_demo_snapshot():
    """
    Load real historical workforce archive dataset (July - October 2026).
    """
    from workforce_intelligence.historical_sync import HistoricalSyncManager
    h = HistoricalSyncManager()
    df, summary = h.load_unified_history()
    snap = create_snapshot(df, dataset_id="workforce_sync_all")
    snapshot_cache.set_active_snapshot(snap)
    workforce_bridge.invalidate_cache()
    return {
        "status": "success",
        "message": f"Historical workforce dataset loaded ({len(df):,} records across {df['Employee Number'].nunique() if 'Employee Number' in df.columns else df['_emp_num'].nunique()} employees).",
        "row_count": len(df),
    }
    bus = ["Engineering", "Lending", "Operations"]
    emp_configs = [
        {"id": "EMP101", "name": "Arjun Sharma", "bu": "Engineering", "dept": "Platform Eng", "mgr": "Vikram Malhotra"},
        {"id": "EMP102", "name": "Priya Nair", "bu": "Engineering", "dept": "Data Analytics", "mgr": "Vikram Malhotra"},
        {"id": "EMP103", "name": "Rohan Mehta", "bu": "Engineering", "dept": "Platform Eng", "mgr": "Vikram Malhotra"},
        {"id": "EMP104", "name": "Ananya Desai", "bu": "Engineering", "dept": "Data Analytics", "mgr": "Vikram Malhotra"},
        {"id": "EMP105", "name": "Rahul Verma", "bu": "Lending", "dept": "Credit Risk", "mgr": "Sneha Sen"},
        {"id": "EMP106", "name": "Kavita Rao", "bu": "Lending", "dept": "Underwriting", "mgr": "Sneha Sen"},
        {"id": "EMP107", "name": "Siddharth Jain", "bu": "Lending", "dept": "Credit Risk", "mgr": "Sneha Sen"},
        {"id": "EMP108", "name": "Pooja Hegde", "bu": "Lending", "dept": "Underwriting", "mgr": "Sneha Sen"},
        {"id": "EMP109", "name": "Aditya Roy", "bu": "Operations", "dept": "Customer Ops", "mgr": "Rajesh Kumar"},
        {"id": "EMP110", "name": "Meera Patel", "bu": "Operations", "dept": "Disbursements", "mgr": "Rajesh Kumar"},
        {"id": "EMP111", "name": "Gaurav Sen", "bu": "Operations", "dept": "Customer Ops", "mgr": "Rajesh Kumar"},
        {"id": "EMP112", "name": "Divya Krishnan", "bu": "Operations", "dept": "Disbursements", "mgr": "Rajesh Kumar"},
    ]

    records = []
    # Build a calendar from May 1 to July 31, 2026
    start_date = date(2026, 5, 1)
    end_date = date(2026, 7, 31)
    curr = start_date

    while curr <= end_date:
        is_sunday = (curr.weekday() == 6)
        is_saturday = (curr.weekday() == 5)
        is_holiday = (curr.month == 5 and curr.day == 1) # May Day
        day_num = curr.day

        for e_idx, emp in enumerate(emp_configs):
            if is_holiday:
                records.append({
                    "Date": curr,
                    "Employee No": emp["id"],
                    "Employee Name": emp["name"],
                    "Business Unit": emp["bu"],
                    "Department": emp["dept"],
                    "Reporting Manager": emp["mgr"],
                    "Attendance Type": "Holiday",
                    "Status": "H",
                    "Quantity": 1.0,
                    "First In": "",
                    "Last Out": "",
                    "Total Duration": "00:00",
                    "Exceptions": "",
                    "Applied On": "",
                })
            elif is_sunday or (is_saturday and day_num % 2 == 0):
                records.append({
                    "Date": curr,
                    "Employee No": emp["id"],
                    "Employee Name": emp["name"],
                    "Business Unit": emp["bu"],
                    "Department": emp["dept"],
                    "Reporting Manager": emp["mgr"],
                    "Attendance Type": "Week Off",
                    "Status": "WO",
                    "Quantity": 1.0,
                    "First In": "",
                    "Last Out": "",
                    "Total Duration": "00:00",
                    "Exceptions": "",
                    "Applied On": "",
                })
            else:
                # Working Day distribution: Present (80%), WFH (10%), Leave (5%), Absent (3%), OD (2%)
                hash_seed = (e_idx * 37 + curr.month * 17 + day_num * 7) % 100
                if emp["bu"] == "Lending" and curr.month == 7 and (e_idx % 2 == 0) and day_num in (10, 15, 20, 22):
                    # Single Swipe attendance exception pattern
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "Single Swipe",
                        "Status": "P(MS)",
                        "Quantity": 1.0,
                        "First In": "09:42",
                        "Last Out": "",
                        "Total Duration": "04:00",
                        "Exceptions": "Missing Out Punch",
                        "Applied On": curr - timedelta(days=1),
                    })
                elif hash_seed < 70:
                    # Regular Physical Attendance
                    in_min = 10 + (hash_seed % 30)
                    out_min = 15 + (hash_seed % 40)
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "Present",
                        "Status": "P",
                        "Quantity": 1.0,
                        "First In": f"09:{in_min:02d}",
                        "Last Out": f"18:{out_min:02d}",
                        "Total Duration": f"09:{abs(out_min - in_min):02d}",
                        "Exceptions": "",
                        "Applied On": "",
                    })
                elif hash_seed < 82:
                    # Work From Home
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "Work From Home",
                        "Status": "WFH",
                        "Quantity": 1.0,
                        "First In": "",
                        "Last Out": "",
                        "Total Duration": "08:30",
                        "Exceptions": "",
                        "Applied On": curr - timedelta(days=2),
                    })
                elif hash_seed < 90:
                    # Approved Leave
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "Casual Leave",
                        "Status": "CL",
                        "Quantity": 1.0,
                        "First In": "",
                        "Last Out": "",
                        "Total Duration": "00:00",
                        "Exceptions": "",
                        "Applied On": curr - timedelta(days=3),
                    })
                elif hash_seed < 95:
                    # On Duty
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "On Duty",
                        "Status": "OD",
                        "Quantity": 1.0,
                        "First In": "09:30",
                        "Last Out": "18:00",
                        "Total Duration": "08:30",
                        "Exceptions": "",
                        "Applied On": curr - timedelta(days=1),
                    })
                else:
                    # Absent
                    records.append({
                        "Date": curr,
                        "Employee No": emp["id"],
                        "Employee Name": emp["name"],
                        "Business Unit": emp["bu"],
                        "Department": emp["dept"],
                        "Reporting Manager": emp["mgr"],
                        "Attendance Type": "Absent",
                        "Status": "A",
                        "Quantity": 1.0,
                        "First In": "",
                        "Last Out": "",
                        "Total Duration": "00:00",
                        "Exceptions": "Unplanned Absence",
                        "Applied On": "",
                    })
        curr += timedelta(days=1)

    df = pd.DataFrame(records)
    snap = create_snapshot(df, dataset_id="enterprise_demo_dataset")
    snapshot_cache.set_active_snapshot(snap)
    
    # Warm bridge foundation & cubes
    workforce_bridge.invalidate_cache()
    workforce_bridge.get_workforce_metrics()
    workforce_bridge.get_trend_intelligence("missing_swipe_rate")

    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "status": "success",
        "dataset_id": snap.dataset_id,
        "row_count": len(df),
        "execution_time_ms": t_elapsed,
        "message": "Realistic enterprise workforce dataset loaded successfully across all attendance categories.",
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


@router.post("/sync-and-recalculate")
def sync_and_recalculate_pipeline():
    """
    On-demand user-triggered sync & recalculate:
    1. Connects to Keka API to fetch fresh revised data (including past month).
    2. Builds and sets the active multi-month snapshot.
    3. Invalidates workforce bridge cache.
    4. Executes comprehensive materialized precalculation across all 15 KPI metrics, BU slices, and cascaded filters.
    5. Persists the precalculated data to disk ('local_data/daily_materialized_cache.json').
    """
    from api.routes.connectors import execute_keka_sync_pipeline
    return execute_keka_sync_pipeline(month="all")


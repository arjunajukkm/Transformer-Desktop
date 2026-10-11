"""
api/schemas.py
──────────────
Pydantic V2 schemas for request and response models in the Workforce Intelligence Gateway.
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field


class MetricMetadata(BaseModel):
    id: str
    label: str
    category: str
    format: str
    direction: str
    description: str


class CascadedFilterRequest(BaseModel):
    business_unit: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None


class CascadedFilterResponse(BaseModel):
    business_units: List[str] = Field(default_factory=list)
    departments: List[str] = Field(default_factory=list)
    managers: List[str] = Field(default_factory=list)
    employees: List[str] = Field(default_factory=list)
    emp_pairs: List[Tuple[str, str]] = Field(default_factory=list)


class TrendQueryRequest(BaseModel):
    metric_id: str = "missing_swipe_rate"
    benchmark_type: str = "ORGANIZATION"
    business_unit: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    employee: Optional[str] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    analysis_as_of_date: Optional[date] = None


class EmployeeHierarchyResponse(BaseModel):
    emp_num: Optional[str] = None
    emp_name: Optional[str] = None
    dept: Optional[str] = None
    bu: Optional[str] = None
    manager: Optional[str] = None


class ManagerHierarchyResponse(BaseModel):
    mgr_name: Optional[str] = None
    dept: Optional[str] = None
    bu: Optional[str] = None


class SnapshotMetadataResponse(BaseModel):
    is_loaded: bool
    dataset_id: Optional[str] = None
    row_count: int = 0
    employee_count: int = 0
    date_range: Optional[str] = None
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    business_units_count: int = 0
    departments_count: int = 0
    managers_count: int = 0
    source_name: Optional[str] = None


class ParquetExportResponse(BaseModel):
    status: str
    dataset_id: str
    exported_cubes: Dict[str, str]
    export_dir: str

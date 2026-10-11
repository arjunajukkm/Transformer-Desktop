"""
api/auth.py
───────────
Enterprise Role-Based Access Control (RBAC) & Row-Level Security (RLS) Engine.
Models Palantir Foundry user governance with granular BU & Department boundaries.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional
from fastapi import Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("workforce_auth")


class UserPersona(BaseModel):
    id: str
    name: str
    email: str
    role: str  # "SUPER_ADMIN" | "BU_HEAD" | "MANAGER" | "AUDITOR"
    role_label: str
    title: str
    allowed_business_units: List[str]
    allowed_departments: List[str]
    allowed_managers: List[str]
    can_manage_connectors: bool
    can_simulate_policy: bool
    can_view_financials: bool
    avatar_initials: str


ENTERPRISE_PERSONAS: Dict[str, UserPersona] = {
    "admin": UserPersona(
        id="admin",
        name="Vikram Malhotra",
        email="vikram.malhotra@moshpit.com",
        role="SUPER_ADMIN",
        role_label="Super Admin (C-Suite)",
        title="Chief People Officer & Platform Owner",
        allowed_business_units=["All"],
        allowed_departments=["All"],
        allowed_managers=["All"],
        can_manage_connectors=True,
        can_simulate_policy=True,
        can_view_financials=True,
        avatar_initials="VM",
    ),
    "bu_head_lending": UserPersona(
        id="bu_head_lending",
        name="Aarti Sharma",
        email="aarti.sharma@moshpit.com",
        role="BU_HEAD",
        role_label="BU Head (Lending)",
        title="VP & Head of Lending Operations",
        allowed_business_units=["Lending"],
        allowed_departments=["Lending Core", "Lending Risk", "Underwriting"],
        allowed_managers=["Manager Lending"],
        can_manage_connectors=False,
        can_simulate_policy=True,
        can_view_financials=True,
        avatar_initials="AS",
    ),
    "manager_operations": UserPersona(
        id="manager_operations",
        name="Rajesh Varma",
        email="rajesh.varma@moshpit.com",
        role="MANAGER",
        role_label="People Lead (Operations)",
        title="Senior Delivery Manager — Operations",
        allowed_business_units=["Operations"],
        allowed_departments=["Operations Core"],
        allowed_managers=["Manager Operations"],
        can_manage_connectors=False,
        can_simulate_policy=False,
        can_view_financials=False,
        avatar_initials="RV",
    ),
    "auditor": UserPersona(
        id="auditor",
        name="Sunil Nambiar",
        email="sunil.nambiar@moshpit.com",
        role="AUDITOR",
        role_label="Compliance Auditor",
        title="Director of Organizational Governance",
        allowed_business_units=["All"],
        allowed_departments=["All"],
        allowed_managers=["All"],
        can_manage_connectors=False,
        can_simulate_policy=False,
        can_view_financials=False,
        avatar_initials="SN",
    ),
}

_ACTIVE_PERSONA_ID = "admin"


def get_active_persona() -> UserPersona:
    """Return the globally configured active persona (default: admin)."""
    global _ACTIVE_PERSONA_ID
    return ENTERPRISE_PERSONAS.get(_ACTIVE_PERSONA_ID, ENTERPRISE_PERSONAS["admin"])


def set_active_persona(persona_id: str) -> UserPersona:
    """Switch active persona."""
    global _ACTIVE_PERSONA_ID
    if persona_id not in ENTERPRISE_PERSONAS:
        raise HTTPException(status_code=400, detail=f"Invalid persona '{persona_id}'.")
    _ACTIVE_PERSONA_ID = persona_id
    logger.info(f"Switched active user persona to {_ACTIVE_PERSONA_ID} ({ENTERPRISE_PERSONAS[persona_id].name})")
    return ENTERPRISE_PERSONAS[_ACTIVE_PERSONA_ID]


def get_current_user(
    x_persona_id: Optional[str] = Header(None, alias="X-Persona-Id"),
) -> UserPersona:
    """FastAPI dependency resolving current user context and permissions."""
    if x_persona_id and x_persona_id in ENTERPRISE_PERSONAS:
        return ENTERPRISE_PERSONAS[x_persona_id]
    return get_active_persona()

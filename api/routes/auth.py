"""
api/routes/auth.py
──────────────────
Authentication & Persona Governance routes for Transformers 2.0.
"""

from typing import Dict, List
from fastapi import APIRouter, Depends
from api.auth import ENTERPRISE_PERSONAS, UserPersona, get_current_user, set_active_persona

router = APIRouter(prefix="/auth", tags=["Security & Governance"])


@router.get("/me", response_model=UserPersona)
def get_current_user_profile(user: UserPersona = Depends(get_current_user)):
    """Return currently active user persona and permissions."""
    return user


@router.get("/personas", response_model=List[UserPersona])
def list_available_personas():
    """List available enterprise personas for testing role boundaries."""
    return list(ENTERPRISE_PERSONAS.values())


@router.post("/switch/{persona_id}", response_model=UserPersona)
def switch_active_persona(persona_id: str):
    """Switch the platform's active persona to test multi-level permissions."""
    return set_active_persona(persona_id)

from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query_one, execute_command
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json

router = APIRouter()


class SheetData(BaseModel):
    cells: Dict[str, Any]
    dimensions: Optional[Dict[str, int]] = None
    settings: Optional[Dict[str, Any]] = None
    formatting: Optional[Dict[str, Any]] = None


class SheetResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: str
    updated_at: str
    data: Dict[str, Any]


@router.get("/sheets/{sheet_id}", response_model=SheetResponse)
async def get_sheet(
    sheet_id: str,
    user = Depends(get_workos_user)
):
    """Get a sheet by ID. Only returns if user owns it."""
    user_id = user["id"]
    
    row = await execute_query_one(
        "SELECT id, user_id, name, created_at, updated_at, data FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="Sheet not found")
    
    # Handle data field - codec should decode it, but handle string case
    data = row["data"]
    if isinstance(data, str):
        data = json.loads(data)
    elif data is None:
        data = {}
    
    return {
        "id": str(row["id"]),
        "user_id": row["user_id"],
        "name": row["name"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "data": data
    }


@router.put("/sheets/{sheet_id}")
async def save_sheet(
    sheet_id: str,
    sheet_data: SheetData,
    user = Depends(get_workos_user)
):
    """Save/update a sheet. Creates if doesn't exist, updates if it does."""
    user_id = user["id"]
    
    # Convert SheetData to JSONB format
    data_jsonb = {
        "cells": sheet_data.cells,
        "dimensions": sheet_data.dimensions or {"rows": 1000, "cols": 26},
        "settings": sheet_data.settings or {},
        "formatting": sheet_data.formatting or {}
    }
    
    # Check if sheet exists and user owns it
    existing = await execute_query_one(
        "SELECT id FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )
    
    if existing:
        # Update existing sheet
        await execute_command(
            """
            UPDATE sheets 
            SET data = $1::jsonb, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            """,
            data_jsonb, sheet_id, user_id
        )
    else:
        # Check if sheet exists but belongs to another user
        other_user = await execute_query_one(
            "SELECT id FROM sheets WHERE id = $1",
            sheet_id
        )
        if other_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Create new sheet
        await execute_command(
            """
            INSERT INTO sheets (id, user_id, name, data, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, NOW())
            """,
            sheet_id, user_id, "Untitled", data_jsonb
        )
    
    return {"status": "saved", "sheet_id": sheet_id}

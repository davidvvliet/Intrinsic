from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query, execute_query_one, execute_command
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json
import secrets

router = APIRouter()


class SheetData(BaseModel):
    cells: Dict[str, Any]
    dimensions: Optional[Dict[str, int]] = None
    settings: Optional[Dict[str, Any]] = None
    formatting: Optional[Dict[str, Any]] = None
    name: Optional[str] = None
    thumbnail: Optional[str] = None
    workspace_id: Optional[str] = None
    preview_data: Optional[Dict[str, Any]] = None


class SheetResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: str
    updated_at: str
    data: Dict[str, Any]
    list_ids: List[int] = []


@router.get("/sheets")
async def list_sheets(
    workspace_id: Optional[str] = None,
    user = Depends(get_workos_user)
):
    """List sheets for the user, optionally filtered by workspace."""
    user_id = user["id"]

    if workspace_id:
        rows = await execute_query(
            """SELECT id, name, created_at, updated_at, list_ids, thumbnail, workspace_id
               FROM sheets WHERE user_id = $1 AND workspace_id = $2
               ORDER BY created_at ASC""",
            user_id, workspace_id
        )
    else:
        rows = await execute_query(
            """SELECT id, name, created_at, updated_at, list_ids, thumbnail, workspace_id
               FROM sheets WHERE user_id = $1
               ORDER BY created_at ASC""",
            user_id
        )

    return [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "list_ids": row["list_ids"] or [],
            "thumbnail": row["thumbnail"],
            "workspace_id": row["workspace_id"]
        }
        for row in rows
    ]


@router.get("/sheets/{sheet_id}", response_model=SheetResponse)
async def get_sheet(
    sheet_id: str,
    user = Depends(get_workos_user)
):
    """Get a sheet by ID. Only returns if user owns it."""
    user_id = user["id"]
    
    row = await execute_query_one(
        "SELECT id, user_id, name, created_at, updated_at, data, list_ids FROM sheets WHERE id = $1 AND user_id = $2",
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
        "data": data,
        "list_ids": row["list_ids"] or []
    }


@router.post("/sheets")
async def create_sheet(
    sheet_data: SheetData,
    user = Depends(get_workos_user)
):
    """Create a new sheet. Returns the generated sheet ID."""
    user_id = user["id"]
    
    # Generate URL-safe base64 16-character ID
    sheet_id = secrets.token_urlsafe(12)  # 12 bytes = 16 base64 chars
    
    # Convert SheetData to JSONB format
    data_jsonb = {
        "cells": sheet_data.cells,
        "dimensions": sheet_data.dimensions or {"rows": 1000, "cols": 26},
        "settings": sheet_data.settings or {},
        "formatting": sheet_data.formatting or {}
    }
    
    # Create new sheet
    await execute_command(
        """
        INSERT INTO sheets (id, user_id, name, data, thumbnail, workspace_id, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
        """,
        sheet_id, user_id, sheet_data.name or "Untitled", data_jsonb, sheet_data.thumbnail, sheet_data.workspace_id
    )

    # Update workspace preview_data if provided
    if sheet_data.preview_data is not None and sheet_data.workspace_id:
        await execute_command(
            "UPDATE workspaces SET preview_data = $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3",
            sheet_data.preview_data, sheet_data.workspace_id, user_id
        )

    return {"status": "created", "id": sheet_id}


@router.put("/sheets/{sheet_id}")
async def save_sheet(
    sheet_id: str,
    sheet_data: SheetData,
    user = Depends(get_workos_user)
):
    """Update an existing sheet. Only updates if user owns it."""
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
        "SELECT id, workspace_id FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Update existing sheet (include name and thumbnail if provided)
    if sheet_data.name is not None:
        await execute_command(
            """
            UPDATE sheets
            SET data = $1::jsonb, name = $2, thumbnail = $3, updated_at = NOW()
            WHERE id = $4 AND user_id = $5
            """,
            data_jsonb, sheet_data.name, sheet_data.thumbnail, sheet_id, user_id
        )
    else:
        await execute_command(
            """
            UPDATE sheets
            SET data = $1::jsonb, thumbnail = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            """,
            data_jsonb, sheet_data.thumbnail, sheet_id, user_id
        )

    # Update workspace preview_data if provided
    if sheet_data.preview_data is not None and existing["workspace_id"]:
        await execute_command(
            "UPDATE workspaces SET preview_data = $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3",
            sheet_data.preview_data, existing["workspace_id"], user_id
        )

    return {"status": "saved", "id": sheet_id}


class RenameRequest(BaseModel):
    name: str


@router.patch("/sheets/{sheet_id}/name")
async def rename_sheet(
    sheet_id: str,
    body: RenameRequest,
    user = Depends(get_workos_user)
):
    """Rename a sheet. Only renames if user owns it."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Sheet not found")

    await execute_command(
        "UPDATE sheets SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
        body.name or "Untitled", sheet_id, user_id
    )

    return {"status": "renamed", "id": sheet_id}


@router.delete("/sheets/{sheet_id}")
async def delete_sheet(
    sheet_id: str,
    user = Depends(get_workos_user)
):
    """Delete a sheet. Only deletes if user owns it."""
    user_id = user["id"]
    
    # Check if sheet exists and user owns it
    existing = await execute_query_one(
        "SELECT id FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Sheet not found")
    
    # Delete the sheet
    await execute_command(
        "DELETE FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )
    
    return {"status": "deleted", "id": sheet_id}


class AssignListRequest(BaseModel):
    list_id: int


@router.patch("/sheets/{sheet_id}/list")
async def assign_sheet_to_list(
    sheet_id: str,
    body: AssignListRequest,
    user = Depends(get_workos_user)
):
    """Add a sheet to a list."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id, list_ids FROM sheets WHERE id = $1 AND user_id = $2",
        sheet_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Sheet not found")

    current_list_ids = existing["list_ids"] or []

    # Check if already in this list
    if body.list_id in current_list_ids:
        raise HTTPException(status_code=409, detail="Sheet is already in this list")

    # Verify user owns the list
    list_exists = await execute_query_one(
        "SELECT id FROM lists WHERE id = $1 AND user_id = $2",
        body.list_id, user_id
    )
    if not list_exists:
        raise HTTPException(status_code=404, detail="List not found")

    # Add list_id to array
    await execute_command(
        "UPDATE sheets SET list_ids = array_append(list_ids, $1), updated_at = NOW() WHERE id = $2 AND user_id = $3",
        body.list_id, sheet_id, user_id
    )

    return {"status": "updated", "id": sheet_id, "list_ids": current_list_ids + [body.list_id]}

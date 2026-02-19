import json
import secrets
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query, execute_query_one, execute_command
from pydantic import BaseModel
from typing import Optional, Dict, Any
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

router = APIRouter()

MAX_TEMPLATE_SIZE_BYTES = 1 * 1024 * 1024  # 1MB


def parse_xlsx(file_content: bytes) -> Dict[str, Any]:
    """Parse xlsx file and convert to our cell format."""
    workbook = load_workbook(filename=io.BytesIO(file_content), data_only=False)
    worksheet = workbook.active

    cells = {}
    max_row = 0
    max_col = 0

    for row in worksheet.iter_rows():
        for cell in row:
            # 0-indexed row and column
            row_idx = cell.row - 1
            col_idx = cell.column - 1

            # Track max dimensions
            max_row = max(max_row, row_idx)
            max_col = max(max_col, col_idx)

            key = f"{row_idx},{col_idx}"

            # Check for formula first (cell.data_type == 'f' or cell has formula)
            if cell.data_type == 'f' or (hasattr(cell, 'value') and isinstance(cell.value, str) and cell.value.startswith('=')):
                # Formula cell
                formula = cell.value if isinstance(cell.value, str) else f"={cell.value}"
                if not formula.startswith('='):
                    formula = f"={formula}"
                cells[key] = {"raw": formula, "type": "formula"}
            elif cell.value is not None and cell.value != '':
                # Value cell
                if isinstance(cell.value, (int, float)):
                    cells[key] = {"raw": str(cell.value), "type": "number"}
                else:
                    cells[key] = {"raw": str(cell.value), "type": "text"}

    return {
        "cells": cells,
        "dimensions": {
            "rows": max(max_row + 1, 100),
            "cols": max(max_col + 1, 26),
        },
    }


class CreateTemplateRequest(BaseModel):
    name: str
    data: Dict[str, Any]  # Same format as sheet data: {cells: {...}, dimensions: {...}}
    thumbnail_url: Optional[str] = None


@router.get("/templates")
async def get_templates(user = Depends(get_workos_user)):
    """Get all templates (defaults + user's own)."""
    user_id = user["id"]

    rows = await execute_query(
        """SELECT id, name, thumbnail_url, user_id, created_at
           FROM templates
           WHERE user_id IS NULL OR user_id = $1
           ORDER BY user_id NULLS FIRST, created_at DESC""",
        user_id
    )

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "thumbnail_url": row["thumbnail_url"],
            "is_default": row["user_id"] is None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]


@router.get("/templates/{template_id}")
async def get_template(
    template_id: int,
    user = Depends(get_workos_user)
):
    """Get a single template with its data."""
    user_id = user["id"]

    row = await execute_query_one(
        """SELECT id, name, thumbnail_url, data, user_id, created_at
           FROM templates
           WHERE id = $1 AND (user_id IS NULL OR user_id = $2)""",
        template_id, user_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    data = row["data"]
    if isinstance(data, str):
        data = json.loads(data)

    return {
        "id": row["id"],
        "name": row["name"],
        "thumbnail_url": row["thumbnail_url"],
        "data": data,
        "is_default": row["user_id"] is None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.post("/templates/{template_id}/use")
async def use_template(
    template_id: int,
    user = Depends(get_workos_user)
):
    """Create a new sheet from a template."""
    user_id = user["id"]

    # Fetch template
    row = await execute_query_one(
        """SELECT id, name, data
           FROM templates
           WHERE id = $1 AND (user_id IS NULL OR user_id = $2)""",
        template_id, user_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    data = row["data"]
    if isinstance(data, str):
        data = json.loads(data)

    # Generate sheet ID
    sheet_id = secrets.token_urlsafe(12)

    # Create sheet with template data
    await execute_command(
        """INSERT INTO sheets (id, user_id, name, data, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, NOW())""",
        sheet_id, user_id, row["name"], data
    )

    return {"id": sheet_id}


@router.post("/templates/upload")
async def upload_template(
    file: UploadFile = File(...),
    user = Depends(get_workos_user)
):
    """Upload and parse an xlsx file as a template."""
    user_id = user["id"]

    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_TEMPLATE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is 1MB, got {len(content) / 1024 / 1024:.2f}MB"
        )

    # Parse xlsx
    try:
        data = parse_xlsx(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse xlsx: {str(e)}")

    # Validate parsed data size
    data_size = len(json.dumps(data).encode('utf-8'))
    if data_size > MAX_TEMPLATE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Parsed data too large. Max size is 1MB, got {data_size / 1024 / 1024:.2f}MB"
        )

    # Extract name from filename
    name = file.filename.rsplit('.', 1)[0] if file.filename else "Untitled"

    # Insert into database
    row = await execute_query_one(
        """INSERT INTO templates (name, data, user_id)
           VALUES ($1, $2::jsonb, $3)
           RETURNING id, created_at""",
        name, data, user_id
    )

    return {
        "status": "created",
        "id": row["id"],
        "name": name,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.post("/templates")
async def create_template(
    body: CreateTemplateRequest,
    user = Depends(get_workos_user)
):
    """Create a new user template."""
    user_id = user["id"]

    # Validate size
    data_size = len(json.dumps(body.data).encode('utf-8'))
    if data_size > MAX_TEMPLATE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Template data too large. Max size is 1MB, got {data_size / 1024 / 1024:.2f}MB"
        )

    row = await execute_query_one(
        """INSERT INTO templates (name, data, thumbnail_url, user_id)
           VALUES ($1, $2::jsonb, $3, $4)
           RETURNING id, created_at""",
        body.name, body.data, body.thumbnail_url, user_id
    )

    return {
        "status": "created",
        "id": row["id"],
        "name": body.name,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    user = Depends(get_workos_user)
):
    """Delete a user template (cannot delete default templates)."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id, user_id FROM templates WHERE id = $1",
        template_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")

    if existing["user_id"] is None:
        raise HTTPException(status_code=403, detail="Cannot delete default templates")

    if existing["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your template")

    await execute_command(
        "DELETE FROM templates WHERE id = $1",
        template_id
    )

    return {"status": "deleted", "id": template_id}

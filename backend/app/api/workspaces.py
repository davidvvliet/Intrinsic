import secrets
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query, execute_query_one, execute_command
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CreateWorkspaceRequest(BaseModel):
    name: Optional[str] = "Untitled"


class RenameWorkspaceRequest(BaseModel):
    name: str


@router.get("/workspaces")
async def list_workspaces(user=Depends(get_workos_user)):
    """List all workspaces for the user."""
    user_id = user["id"]

    rows = await execute_query(
        """SELECT id, name, thumbnail_url, created_at, updated_at
           FROM workspaces
           WHERE user_id = $1
           ORDER BY updated_at DESC""",
        user_id
    )

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "thumbnail_url": row["thumbnail_url"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
        for row in rows
    ]


@router.post("/workspaces")
async def create_workspace(
    body: CreateWorkspaceRequest,
    user=Depends(get_workos_user)
):
    """Create a new workspace."""
    user_id = user["id"]
    workspace_id = secrets.token_urlsafe(12)

    row = await execute_query_one(
        """INSERT INTO workspaces (id, user_id, name)
           VALUES ($1, $2, $3)
           RETURNING id, name, created_at, updated_at""",
        workspace_id, user_id, body.name or "Untitled"
    )

    return {
        "id": row["id"],
        "name": row["name"],
        "thumbnail_url": None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.get("/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user=Depends(get_workos_user)
):
    """Get a workspace by ID."""
    user_id = user["id"]

    row = await execute_query_one(
        """SELECT id, name, thumbnail_url, created_at, updated_at
           FROM workspaces
           WHERE id = $1 AND user_id = $2""",
        workspace_id, user_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return {
        "id": row["id"],
        "name": row["name"],
        "thumbnail_url": row["thumbnail_url"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.patch("/workspaces/{workspace_id}/name")
async def rename_workspace(
    workspace_id: str,
    body: RenameWorkspaceRequest,
    user=Depends(get_workos_user)
):
    """Rename a workspace."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
        workspace_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Workspace not found")

    await execute_command(
        "UPDATE workspaces SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
        body.name or "Untitled", workspace_id, user_id
    )

    return {"status": "renamed", "id": workspace_id}


@router.delete("/workspaces/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    user=Depends(get_workos_user)
):
    """Delete a workspace and all its sheets."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
        workspace_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Delete all sheets in the workspace first
    await execute_command(
        "DELETE FROM sheets WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_id
    )

    # Delete the workspace
    await execute_command(
        "DELETE FROM workspaces WHERE id = $1 AND user_id = $2",
        workspace_id, user_id
    )

    return {"status": "deleted", "id": workspace_id}

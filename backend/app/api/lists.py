from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query, execute_query_one, execute_command
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CreateListRequest(BaseModel):
    name: str
    color: Optional[str] = "#6b7280"


class ListResponse(BaseModel):
    id: int
    name: str
    color: str
    created_at: str
    count: int


@router.get("/lists")
async def get_lists(user = Depends(get_workos_user)):
    """Get all lists for the user with sheet counts."""
    user_id = user["id"]

    rows = await execute_query(
        """SELECT l.id, l.name, l.color, l.created_at, COUNT(s.id) as count
           FROM lists l
           LEFT JOIN sheets s ON l.id = ANY(s.list_ids) AND s.user_id = $1
           WHERE l.user_id = $1
           GROUP BY l.id
           ORDER BY l.created_at ASC""",
        user_id
    )

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "color": row["color"],
            "created_at": row["created_at"].isoformat(),
            "count": row["count"]
        }
        for row in rows
    ]


@router.post("/lists")
async def create_list(
    body: CreateListRequest,
    user = Depends(get_workos_user)
):
    """Create a new list."""
    user_id = user["id"]

    # Check if user already has 5 lists
    count_row = await execute_query_one(
        "SELECT COUNT(*) as count FROM lists WHERE user_id = $1",
        user_id
    )
    if count_row["count"] >= 5:
        raise HTTPException(status_code=400, detail="Maximum of 5 lists allowed")

    # Check for duplicate name
    existing = await execute_query_one(
        "SELECT id FROM lists WHERE user_id = $1 AND name = $2",
        user_id, body.name
    )
    if existing:
        raise HTTPException(status_code=400, detail="A list with this name already exists")

    row = await execute_query_one(
        """INSERT INTO lists (user_id, name, color)
           VALUES ($1, $2, $3)
           RETURNING id, created_at""",
        user_id, body.name, body.color or "#6b7280"
    )

    return {
        "status": "created",
        "id": row["id"],
        "name": body.name,
        "color": body.color or "#6b7280",
        "created_at": row["created_at"].isoformat()
    }


@router.delete("/lists/{list_id}")
async def delete_list(
    list_id: int,
    user = Depends(get_workos_user)
):
    """Delete a list. Sheets in this list will have list_id set to null."""
    user_id = user["id"]

    existing = await execute_query_one(
        "SELECT id FROM lists WHERE id = $1 AND user_id = $2",
        list_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="List not found")

    await execute_command(
        "DELETE FROM lists WHERE id = $1 AND user_id = $2",
        list_id, user_id
    )

    return {"status": "deleted", "id": list_id}

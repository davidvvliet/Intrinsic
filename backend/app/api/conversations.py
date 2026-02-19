import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query, execute_query_one, execute_command
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class CreateConversationRequest(BaseModel):
    workspace_id: str
    title: Optional[str] = "New Chat"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    last_response_id: Optional[str] = None
    summary: Optional[str] = None
    message_count_at_last_compaction: Optional[int] = None


class CreateMessageRequest(BaseModel):
    role: str
    content: str


@router.get("/conversations")
async def list_conversations(
    workspace_id: str,
    user=Depends(get_workos_user)
):
    """List all conversations for a workspace."""
    user_id = user["id"]

    # Verify workspace belongs to user
    workspace = await execute_query_one(
        "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
        workspace_id, user_id
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    rows = await execute_query(
        """SELECT id, workspace_id, title, last_response_id, summary,
                  message_count_at_last_compaction, created_at, updated_at
           FROM conversations
           WHERE workspace_id = $1
           ORDER BY updated_at DESC""",
        workspace_id
    )

    return [
        {
            "id": str(row["id"]),
            "workspace_id": row["workspace_id"],
            "title": row["title"],
            "last_response_id": row["last_response_id"],
            "summary": row["summary"],
            "message_count_at_last_compaction": row["message_count_at_last_compaction"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
        for row in rows
    ]


@router.post("/conversations")
async def create_conversation(
    body: CreateConversationRequest,
    user=Depends(get_workos_user)
):
    """Create a new conversation in a workspace."""
    user_id = user["id"]

    # Verify workspace belongs to user
    workspace = await execute_query_one(
        "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
        body.workspace_id, user_id
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    conversation_id = str(uuid.uuid4())

    row = await execute_query_one(
        """INSERT INTO conversations (id, workspace_id, title)
           VALUES ($1, $2, $3)
           RETURNING id, workspace_id, title, last_response_id, summary,
                     message_count_at_last_compaction, created_at, updated_at""",
        conversation_id, body.workspace_id, body.title or "New Chat"
    )

    return {
        "id": str(row["id"]),
        "workspace_id": row["workspace_id"],
        "title": row["title"],
        "last_response_id": row["last_response_id"],
        "summary": row["summary"],
        "message_count_at_last_compaction": row["message_count_at_last_compaction"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user=Depends(get_workos_user)
):
    """Get a conversation with all its messages."""
    user_id = user["id"]

    # Get conversation and verify ownership through workspace
    row = await execute_query_one(
        """SELECT c.id, c.workspace_id, c.title, c.last_response_id, c.summary,
                  c.message_count_at_last_compaction, c.created_at, c.updated_at
           FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )

    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    messages = await execute_query(
        """SELECT id, role, content, created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC""",
        conversation_id
    )

    return {
        "id": str(row["id"]),
        "workspace_id": row["workspace_id"],
        "title": row["title"],
        "last_response_id": row["last_response_id"],
        "summary": row["summary"],
        "message_count_at_last_compaction": row["message_count_at_last_compaction"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "messages": [
            {
                "id": str(msg["id"]),
                "role": msg["role"],
                "content": msg["content"],
                "created_at": msg["created_at"].isoformat() if msg["created_at"] else None,
            }
            for msg in messages
        ]
    }


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    body: UpdateConversationRequest,
    user=Depends(get_workos_user)
):
    """Update conversation metadata (title, last_response_id, summary, etc.)."""
    user_id = user["id"]

    # Verify ownership through workspace
    existing = await execute_query_one(
        """SELECT c.id FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Build dynamic update query
    updates = []
    params = []
    param_idx = 1

    if body.title is not None:
        updates.append(f"title = ${param_idx}")
        params.append(body.title)
        param_idx += 1

    if body.last_response_id is not None:
        updates.append(f"last_response_id = ${param_idx}")
        params.append(body.last_response_id)
        param_idx += 1

    if body.summary is not None:
        updates.append(f"summary = ${param_idx}")
        params.append(body.summary)
        param_idx += 1

    if body.message_count_at_last_compaction is not None:
        updates.append(f"message_count_at_last_compaction = ${param_idx}")
        params.append(body.message_count_at_last_compaction)
        param_idx += 1

    if not updates:
        return {"status": "no changes", "id": conversation_id}

    updates.append("updated_at = NOW()")
    params.append(conversation_id)

    query = f"UPDATE conversations SET {', '.join(updates)} WHERE id = ${param_idx}"
    await execute_command(query, *params)

    return {"status": "updated", "id": conversation_id}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user=Depends(get_workos_user)
):
    """Delete a conversation and all its messages."""
    user_id = user["id"]

    # Verify ownership through workspace
    existing = await execute_query_one(
        """SELECT c.id FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Messages will be deleted by CASCADE
    await execute_command(
        "DELETE FROM conversations WHERE id = $1",
        conversation_id
    )

    return {"status": "deleted", "id": conversation_id}


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user=Depends(get_workos_user)
):
    """List all messages in a conversation."""
    user_id = user["id"]

    # Verify ownership through workspace
    existing = await execute_query_one(
        """SELECT c.id FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = await execute_query(
        """SELECT id, role, content, created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC""",
        conversation_id
    )

    return [
        {
            "id": str(msg["id"]),
            "role": msg["role"],
            "content": msg["content"],
            "created_at": msg["created_at"].isoformat() if msg["created_at"] else None,
        }
        for msg in messages
    ]


@router.post("/conversations/{conversation_id}/messages")
async def create_message(
    conversation_id: str,
    body: CreateMessageRequest,
    user=Depends(get_workos_user)
):
    """Add a message to a conversation."""
    user_id = user["id"]

    # Verify ownership through workspace
    existing = await execute_query_one(
        """SELECT c.id FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Validate role
    if body.role not in ('user', 'assistant'):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'assistant'")

    message_id = str(uuid.uuid4())

    row = await execute_query_one(
        """INSERT INTO messages (id, conversation_id, role, content)
           VALUES ($1, $2, $3, $4)
           RETURNING id, role, content, created_at""",
        message_id, conversation_id, body.role, body.content
    )

    # Update conversation's updated_at
    await execute_command(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        conversation_id
    )

    return {
        "id": str(row["id"]),
        "role": row["role"],
        "content": row["content"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }

from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query_one
from app.api.conversation_service import (
    create_conversation as svc_create,
    get_conversation as svc_get,
    list_conversations as svc_list,
    update_conversation as svc_update,
    delete_conversation as svc_delete,
    list_messages as svc_list_messages,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CreateConversationRequest(BaseModel):
    workspace_id: str
    title: Optional[str] = "New Chat"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    last_response_id: Optional[str] = None
    summary: Optional[str] = None
    message_count_at_last_compaction: Optional[int] = None


def _format_conversation(row):
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


def _format_message(msg):
    return {
        "id": str(msg["id"]),
        "role": msg["role"],
        "content": msg["content"],
        "created_at": msg["created_at"].isoformat() if msg["created_at"] else None,
    }


async def _verify_workspace(workspace_id: str, user_id: str):
    workspace = await execute_query_one(
        "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
        workspace_id, user_id
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")


async def _verify_conversation_ownership(conversation_id: str, user_id: str):
    existing = await execute_query_one(
        """SELECT c.id FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get("/conversations")
async def list_conversations(workspace_id: str, user=Depends(get_workos_user)):
    await _verify_workspace(workspace_id, user["id"])
    rows = await svc_list(workspace_id)
    return [_format_conversation(row) for row in rows]


@router.post("/conversations")
async def create_conversation(body: CreateConversationRequest, user=Depends(get_workos_user)):
    await _verify_workspace(body.workspace_id, user["id"])
    row = await svc_create(body.workspace_id, body.title or "New Chat")
    return _format_conversation(row)


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user=Depends(get_workos_user)):
    user_id = user["id"]
    row = await svc_get(conversation_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = await svc_list_messages(conversation_id)
    result = _format_conversation(row)
    result["messages"] = [_format_message(msg) for msg in messages]
    return result


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    body: UpdateConversationRequest,
    user=Depends(get_workos_user)
):
    await _verify_conversation_ownership(conversation_id, user["id"])

    kwargs = {}
    if body.title is not None:
        kwargs["title"] = body.title
    if body.last_response_id is not None:
        kwargs["last_response_id"] = body.last_response_id
    if body.summary is not None:
        kwargs["summary"] = body.summary
    if body.message_count_at_last_compaction is not None:
        kwargs["message_count_at_last_compaction"] = body.message_count_at_last_compaction

    if not kwargs:
        return {"status": "no changes", "id": conversation_id}

    await svc_update(conversation_id, **kwargs)
    return {"status": "updated", "id": conversation_id}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str, user=Depends(get_workos_user)):
    await _verify_conversation_ownership(conversation_id, user["id"])
    await svc_delete(conversation_id)
    return {"status": "deleted", "id": conversation_id}


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: str, user=Depends(get_workos_user)):
    await _verify_conversation_ownership(conversation_id, user["id"])
    messages = await svc_list_messages(conversation_id)
    return [_format_message(msg) for msg in messages]

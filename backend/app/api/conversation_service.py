import uuid
from app.storage.async_db import execute_query, execute_query_one, execute_command


async def create_conversation(workspace_id: str, title: str = "New Chat"):
    conversation_id = str(uuid.uuid4())
    row = await execute_query_one(
        """INSERT INTO conversations (id, workspace_id, title)
           VALUES ($1, $2, $3)
           RETURNING id, workspace_id, title, last_response_id, summary,
                     message_count_at_last_compaction, created_at, updated_at""",
        conversation_id, workspace_id, title
    )
    return row


async def get_conversation(conversation_id: str, user_id: str):
    return await execute_query_one(
        """SELECT c.id, c.workspace_id, c.title, c.last_response_id, c.summary,
                  c.message_count_at_last_compaction, c.created_at, c.updated_at
           FROM conversations c
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE c.id = $1 AND w.user_id = $2""",
        conversation_id, user_id
    )


async def list_conversations(workspace_id: str):
    return await execute_query(
        """SELECT id, workspace_id, title, last_response_id, summary,
                  message_count_at_last_compaction, created_at, updated_at
           FROM conversations
           WHERE workspace_id = $1
           ORDER BY created_at ASC""",
        workspace_id
    )


async def update_conversation(conversation_id: str, **kwargs):
    updates = []
    params = []
    param_idx = 1

    for key in ("title", "last_response_id", "summary", "message_count_at_last_compaction"):
        if key in kwargs:
            updates.append(f"{key} = ${param_idx}")
            params.append(kwargs[key])
            param_idx += 1

    if not updates:
        return

    updates.append("updated_at = NOW()")
    params.append(conversation_id)
    query = f"UPDATE conversations SET {', '.join(updates)} WHERE id = ${param_idx}"
    await execute_command(query, *params)


async def delete_conversation(conversation_id: str):
    await execute_command("DELETE FROM conversations WHERE id = $1", conversation_id)


async def list_messages(conversation_id: str):
    return await execute_query(
        """SELECT id, role, content, created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC""",
        conversation_id
    )


async def save_user_message(conversation_id: str, content: str):
    message_id = str(uuid.uuid4())
    row = await execute_query_one(
        """INSERT INTO messages (id, conversation_id, role, content, created_at)
           VALUES ($1, $2, 'user', $3, NOW())
           RETURNING id, role, content, created_at""",
        message_id, conversation_id, content
    )
    await execute_command(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        conversation_id
    )
    return row


async def save_assistant_turn(conversation_id: str, content: str, response_id: str):
    """Save assistant message and update last_response_id."""
    message_id = str(uuid.uuid4())
    await execute_query_one(
        """INSERT INTO messages (id, conversation_id, role, content)
           VALUES ($1, $2, 'assistant', $3)
           RETURNING id""",
        message_id, conversation_id, content
    )
    await update_conversation(conversation_id, last_response_id=response_id)


async def auto_title(conversation_id: str, user_message: str):
    """Set conversation title from first user message if still default."""
    row = await execute_query_one(
        "SELECT title FROM conversations WHERE id = $1",
        conversation_id
    )
    if row and row["title"] == "New Chat":
        title = user_message[:25] + ("..." if len(user_message) > 25 else "")
        await update_conversation(conversation_id, title=title)
        return title
    return None


async def get_message_count(conversation_id: str):
    row = await execute_query_one(
        "SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1",
        conversation_id
    )
    return row["count"] if row else 0

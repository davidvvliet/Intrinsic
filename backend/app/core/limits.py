from fastapi import HTTPException
from app.storage.async_db import execute_query_one

PLAN_LIMITS = {
    "free": {"workspaces": 1, "messages_per_2h": 50},
    "pro":  {"workspaces": None, "messages_per_2h": None},  # None = unlimited
}


async def get_plan(email: str) -> str:
    row = await execute_query_one(
        "SELECT plan FROM auth.user_access WHERE email = $1 AND status = 'active' LIMIT 1",
        email
    )
    return row["plan"] if row else "free"


async def enforce_message_limit(user_id: str, email: str):
    plan = await get_plan(email)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["messages_per_2h"]
    if limit is None:
        return
    row = await execute_query_one(
        """SELECT COUNT(*) as count, MIN(m.created_at) as oldest_at FROM messages m
           JOIN conversations c ON m.conversation_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE w.user_id = $1 AND m.role = 'user'
           AND m.created_at > NOW() - INTERVAL '2 hours'""",
        user_id
    )
    if row and row["count"] >= limit:
        reset_at = row["oldest_at"] + __import__("datetime").timedelta(hours=2)
        raise HTTPException(status_code=429, detail={
            "code": "rate_limit",
            "reset_at": reset_at.isoformat(),
        })


async def enforce_workspace_limit(user_id: str, email: str):
    plan = await get_plan(email)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["workspaces"]
    if limit is None:
        return
    row = await execute_query_one(
        "SELECT COUNT(*) as count FROM workspaces WHERE user_id = $1",
        user_id
    )
    if row and row["count"] >= limit:
        raise HTTPException(status_code=403, detail=f"Free plan is limited to {limit} workspace(s). Upgrade to Pro for unlimited workspaces.")

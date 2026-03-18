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
    import datetime
    row = await execute_query_one(
        "SELECT plan, msg_window_start, msg_count FROM auth.user_access WHERE email = $1 AND status = 'active' LIMIT 1",
        email
    )
    plan = (row["plan"] if row else None) or "free"
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["messages_per_2h"]
    if limit is None:
        return

    now = datetime.datetime.now(datetime.timezone.utc)
    window_start = row["msg_window_start"] if row else None
    msg_count = row["msg_count"] if row else 0

    window_expired = window_start is None or (now - window_start) >= datetime.timedelta(hours=2)

    if window_expired:
        await execute_query_one(
            "UPDATE auth.user_access SET msg_window_start = $1, msg_count = 1 WHERE email = $2",
            now, email
        )
        return

    if msg_count >= limit:
        reset_at = window_start + datetime.timedelta(hours=2)
        raise HTTPException(status_code=429, detail={
            "code": "rate_limit",
            "reset_at": reset_at.isoformat(),
        })

    await execute_query_one(
        "UPDATE auth.user_access SET msg_count = msg_count + 1 WHERE email = $1",
        email
    )


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

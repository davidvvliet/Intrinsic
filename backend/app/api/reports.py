import os
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.deps import get_workos_user
from app.storage.async_db import execute_query_one

router = APIRouter()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SUPPORT_EMAIL = "david@runintrinsic.com"
FROM_EMAIL = "Intrinsic <noreply@runintrinsic.com>"


class ReportRequest(BaseModel):
    company_name: str
    company_url: str
    reported_summary: str
    similarity_score: float
    user_message: str
    metadata: Optional[Dict[str, Any]] = None


@router.post("/reports/submit")
async def submit_report(
    body: ReportRequest,
    user=Depends(get_workos_user)
):
    user_id = user["id"]
    user_email = user.get("email", "unknown")

    row = await execute_query_one(
        """INSERT INTO feedback (user_id, user_message)
           VALUES ($1, $2)
           RETURNING id""",
        user_id, body.user_message,
    )
    report_id = row["id"]

    if RESEND_API_KEY:
        try:
            html_body = f"""
<p><strong>New feedback from {user_email}</strong></p>
<hr/>
<p>{body.user_message.replace(chr(10), '<br/>')}</p>
"""
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                    json={
                        "from": FROM_EMAIL,
                        "to": [SUPPORT_EMAIL],
                        "subject": f"Feedback from {user_email}",
                        "html": html_body,
                    },
                )
        except Exception as e:
            print(f"Failed to send feedback email: {e}")

    return {"success": True, "report_id": report_id}

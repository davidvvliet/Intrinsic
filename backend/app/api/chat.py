from fastapi import APIRouter
from app.api.schemas import ChatRequest

router = APIRouter()

@router.post("/chat")
async def chat_stream(request: ChatRequest):
    pass

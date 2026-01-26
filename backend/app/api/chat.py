from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.schemas import ChatRequest
from app.core.deps import get_workos_user
from openai import AsyncOpenAI
import json
import os

router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SYSTEM_PROMPT = """You are Intrinsic, an AI assistant designed to help users streamline fundamental analysis on securities to spot real value. Provide clear, concise, and actionable insights to help users make informed investment decisions.

Rules:
 - Always use English. Nothing else for now."""

async def generate_chat_stream(request: ChatRequest, user):

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    
    # Build message array
    messages = []
    if SYSTEM_PROMPT:
        messages.append({"role": "system", "content": SYSTEM_PROMPT})
    
    # Add conversation history if provided
    if request.conversation_history:
        messages.extend(request.conversation_history)
    
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    try:
        print(f"[CHAT] Calling OpenAI with {len(messages)} messages")
        # Call OpenAI API with streaming
        stream = await client.chat.completions.create(
            model="gpt-5.2",
            messages=messages,
            stream=True
        )
        print(f"[CHAT] Stream created successfully")
        
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                
                # Check for tool calls
                if delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        if tool_call.function:
                            yield f"data: {json.dumps({'tool_call_start': {'name': tool_call.function.name}})}\n\n"
                
                # Extract text content
                if delta.content:
                    content = delta.content
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
        # Send completion event
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        import traceback
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user = Depends(get_workos_user)
):
    return StreamingResponse(
        generate_chat_stream(request, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

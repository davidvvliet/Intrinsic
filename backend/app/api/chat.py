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
        stream = await client.responses.create(
            model="gpt-5.1",
            input=messages,
            stream=True,
            max_output_tokens=300
        )
        print(f"[CHAT] Stream created successfully", flush=True)
        
        # Stream responses using event-based format
        async for event in stream:
            # Handle tool call events
            if event.type == 'response.output_item.added':
                if hasattr(event, 'item'):
                    item = event.item
                    if hasattr(item, 'type') and item.type == 'function_call':
                        tool_name = getattr(item, 'name', '')
                        print(f"[CHAT] Tool call started: {tool_name}", flush=True)
                        yield f"data: {json.dumps({'tool_call_start': {'name': tool_name}})}\n\n"
            
            # Handle content/text output
            elif event.type == 'response.output_text.delta':
                if hasattr(event, 'delta'):
                    content = event.delta
                    print(f"[CHAT] Content chunk: {content[:50]}...", flush=True)
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
        print(f"[CHAT] Stream complete", flush=True)
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

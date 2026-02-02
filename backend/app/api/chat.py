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

You can edit the spreadsheet using tool calls when users request changes.

Rules:
 - Always use English.
 - Before making a tool call, briefly explain what you're doing (e.g., "I'll set cell A1 to 100" or "Setting the value in cell B2")."""

# Define tools for spreadsheet editing
SPREADSHEET_TOOLS = [
    {
        "type": "function",
        "name": "set_cell_value",
        "description": "Set the value of a single cell in the spreadsheet",
        "parameters": {
            "type": "object",
            "properties": {
                "cell": {
                    "type": "string",
                    "description": "Cell reference in A1 notation (e.g., 'A1', 'B2')"
                },
                "value": {
                    "type": "string",
                    "description": "The value to set. Can be text, number, or formula (starting with =)"
                }
            },
            "required": ["cell", "value"]
        }
    },
    {
        "type": "function",
        "name": "set_cell_range",
        "description": "Set values for multiple cells at once in a rectangular range",
        "parameters": {
            "type": "object",
            "properties": {
                "startCell": {
                    "type": "string",
                    "description": "Starting cell in A1 notation (e.g., 'A1')"
                },
                "endCell": {
                    "type": "string",
                    "description": "Ending cell in A1 notation (e.g., 'C3')"
                },
                "values": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "description": "2D array of values. Each inner array represents a row."
                }
            },
            "required": ["startCell", "endCell", "values"]
        }
    },
    {
        "type": "function",
        "name": "get_cell_range",
        "description": "Read values from a range of cells in the spreadsheet",
        "parameters": {
            "type": "object",
            "properties": {
                "startCell": {
                    "type": "string",
                    "description": "Starting cell in A1 notation (e.g., 'A1')"
                },
                "endCell": {
                    "type": "string",
                    "description": "Ending cell in A1 notation (e.g., 'C3')"
                }
            },
            "required": ["startCell", "endCell"]
        }
    },
    {
        "type": "function",
        "name": "format_cells",
        "description": "Apply formatting to one or more cells (bold, colors, number format, etc.)",
        "parameters": {
            "type": "object",
            "properties": {
                "cells": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Array of cell references in A1 notation"
                },
                "format": {
                    "type": "object",
                    "properties": {
                        "bold": {"type": "boolean"},
                        "italic": {"type": "boolean"},
                        "fillColor": {"type": "string", "description": "Hex color code (e.g., '#FF0000')"},
                        "textColor": {"type": "string", "description": "Hex color code (e.g., '#0000FF')"},
                        "numberFormat": {
                            "type": "string",
                            "description": "Number format type: 'currency', 'percent', 'number', 'date', etc."
                        }
                    }
                }
            },
            "required": ["cells", "format"]
        }
    }
]

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
            tools=SPREADSHEET_TOOLS,
            stream=True,
            max_output_tokens=300
        )
        print(f"[CHAT] Stream created successfully", flush=True)
        
        # Track tool calls and content during streaming
        final_tool_calls = {}
        accumulated_content = ""
        
        # Stream responses and accumulate tool calls
        async for event in stream:
            # Handle tool call events
            if event.type == 'response.output_item.added':
                if hasattr(event, 'item'):
                    item = event.item
                    if hasattr(item, 'type') and item.type == 'function_call':
                        # Store tool call in dict for accumulation
                        output_index = getattr(event, 'output_index', 0)
                        final_tool_calls[output_index] = {
                            "type": item.type,
                            "id": getattr(item, 'id', ''),
                            "call_id": getattr(item, 'call_id', ''),
                            "name": getattr(item, 'name', ''),
                            "arguments": getattr(item, 'arguments', '') or ''
                        }
                        print(f"[CHAT] Tool call started: {final_tool_calls[output_index]['name']} (index: {output_index})", flush=True)
            
            # Accumulate function call arguments from delta events
            elif event.type == 'response.function_call_arguments.delta':
                output_index = getattr(event, 'output_index', 0)
                if output_index in final_tool_calls:
                    if 'arguments' not in final_tool_calls[output_index]:
                        final_tool_calls[output_index]['arguments'] = ''
                    final_tool_calls[output_index]['arguments'] += event.delta
            
            # Handle function call arguments done - send complete tool call
            elif event.type == 'response.function_call_arguments.done':
                output_index = getattr(event, 'output_index', 0)
                if output_index in final_tool_calls:
                    # Use event.arguments if available, otherwise use accumulated
                    final_arguments = getattr(event, 'arguments', final_tool_calls[output_index]['arguments'])
                    final_tool_calls[output_index]['arguments'] = final_arguments
                    
                    tool_call = final_tool_calls[output_index]
                    tool_name = tool_call.get('name', '')
                    
                    # Parse arguments
                    try:
                        if isinstance(final_arguments, str):
                            parsed_arguments = json.loads(final_arguments)
                        else:
                            parsed_arguments = final_arguments
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"[CHAT] ERROR: Failed to parse tool arguments: {e}", flush=True)
                        parsed_arguments = {}
                    
                    print(f"[CHAT] Tool call complete: {tool_name} (call_id: {tool_call.get('call_id')}, arguments: {parsed_arguments})", flush=True)
                    
                    # Send complete tool call to frontend
                    tool_call_data = {'tool_call': {'name': tool_name, 'arguments': parsed_arguments}}
                    yield f"data: {json.dumps(tool_call_data)}\n\n"
            
            # Handle content/text output
            elif event.type == 'response.output_text.delta':
                if hasattr(event, 'delta'):
                    content = event.delta
                    accumulated_content += content
                    print(f"[CHAT] Content chunk: {content[:50]}...", flush=True)
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
        print(f"[CHAT] Stream complete", flush=True)
        # Send completion event
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        import traceback
        print(f"[CHAT] ERROR: Exception in generate_chat_stream: {e}", flush=True)
        print(f"[CHAT] ERROR: Traceback: {traceback.format_exc()}", flush=True)
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

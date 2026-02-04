from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.schemas import ChatRequest
from app.core.deps import get_workos_user
from openai import AsyncOpenAI
import json
import os

router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SYSTEM_PROMPT = """You are the user's assistant for Intrinsic, an AI-powered fundamental analysis tool to help users streamline investment analysis on securities to spot real value. Provide clear, concise, and actionable insights to help users make informed investment decisions.

Intrinsic has its own proprietary spreadsheet that you can edit using tool calls based on the user's requests. Note that the spreadsheet follows the same conventions as other spreadsheets.

Rules:
 - Always use English.
 - Stay concise, factual and helpful. Be proactive but ask for clarification if needed.
 - Always stay in character as the user's assistant for Intrinsic and maintain focus on your purpose: helping users with fundamental analysis and investment decisions.
 - Before making a tool call, briefly explain what you're doing (e.g., "I'll set cell A1 to 100" or "Setting the value in cell B2").
 - The default cell background color is #FFFFE3. Be aware of this when setting fill colors."""

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
        "description": "Apply formatting to one or more cells (bold, colors, number format, etc.). You **ONLY** need to include a style property that you are actually setting - omit unused properties to reduce token usage (e.g. {'cell': 'A1', 'bold': True} instead of {'cell': 'A1', 'bold': True, 'italic': False, 'fillColor': '#FFFFFF', 'textColor': '#000000', 'numberFormat': 'number'})",
        "parameters": {
            "type": "object",
            "properties": {
                "formats": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "cell": {"type": "string", "description": "Cell reference in A1 notation (e.g., 'A1', 'B2')"},
                            "bold": {"type": "boolean"},
                            "italic": {"type": "boolean"},
                            "fillColor": {"type": "string", "description": "Hex color code (e.g., '#FF0000')"},
                            "textColor": {"type": "string", "description": "Hex color code (e.g., '#0000FF')"},
                            "numberFormat": {
                                "type": "string",
                                "description": "Number format type: 'currency', 'percent', 'number', 'date', etc."
                            }
                        },
                        "required": ["cell"],
                        "additionalProperties": False
                    },
                    "description": "Array of cell format objects. Each cell can have different formatting."
                }
            },
            "required": ["formats"]
        }
    },
    {
        "type": "function",
        "name": "format_cell_range",
        "description": "Apply the same formatting to all cells in a rectangular range. Only include format properties you are actually setting - omit unused properties to reduce token usage.",
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
                "format": {
                    "type": "object",
                    "properties": {
                        "bold": {"type": "boolean", "description": "Set to true to make text bold. Omit if not setting."},
                        "italic": {"type": "boolean", "description": "Set to true to make text italic. Omit if not setting."},
                        "fillColor": {"type": "string", "description": "Hex color code for cell background (e.g., '#FF0000'). Omit if not setting."},
                        "textColor": {"type": "string", "description": "Hex color code for text (e.g., '#0000FF'). Omit if not setting."},
                        "numberFormat": {
                            "type": "string",
                            "description": "Number format type: 'currency', 'percent', 'number', 'date', etc. Omit if not setting."
                        }
                    },
                    "additionalProperties": False
                }
            },
            "required": ["startCell", "endCell", "format"]
        }
    }
]

async def generate_chat_stream(request: ChatRequest, user):

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    
    try:
        # If previous_response_id is provided, use Responses API continuation approach
        if request.previous_response_id:
            if request.function_call_outputs:
                # Tool call continuation
                stream = await client.responses.create(
                    model="gpt-5.1",
                    previous_response_id=request.previous_response_id,
                    input=request.function_call_outputs,
                    instructions=SYSTEM_PROMPT,
                    tools=SPREADSHEET_TOOLS,
                    stream=True,
                    max_output_tokens=3000
                )
            elif request.message:
                # New user message continuation
                user_message_input = [{"role": "user", "content": request.message}]
                stream = await client.responses.create(
                    model="gpt-5.1",
                    previous_response_id=request.previous_response_id,
                    input=user_message_input,
                    instructions=SYSTEM_PROMPT,
                    tools=SPREADSHEET_TOOLS,
                    stream=True,
                    max_output_tokens=3000
                )
            else:
                raise ValueError("previous_response_id provided but neither function_call_outputs nor message provided")
        else:
            # Build message array for initial request
            messages = []
            
            # Add current message
            if request.message:
                messages.append({"role": "user", "content": request.message})
            
            # Call OpenAI API with streaming
            stream = await client.responses.create(
                model="gpt-5.1",
                input=messages,
                instructions=SYSTEM_PROMPT,
                tools=SPREADSHEET_TOOLS,
                stream=True,
                max_output_tokens=3000
            )
        
        # Track tool calls and content during streaming
        final_tool_calls = {}
        accumulated_content = ""
        response_id = None
        
        # Stream responses and accumulate tool calls
        async for event in stream:
            # Capture response ID if available
            if hasattr(event, 'response_id'):
                response_id = event.response_id
            elif hasattr(event, 'response') and hasattr(event.response, 'id'):
                response_id = event.response.id
            elif event.type == 'response.created':
                if hasattr(event, 'response') and hasattr(event.response, 'id'):
                    response_id = event.response.id
            
            # Handle tool call events
            if event.type == 'response.output_item.added':
                if hasattr(event, 'item'):
                    item = event.item
                    if hasattr(item, 'type') and item.type == 'function_call':
                        # Extract both IDs separately
                        function_call_id = getattr(item, 'call_id', '')  # For tool outputs
                        output_item_id = getattr(item, 'id', '')  # For delta events
                        
                        if not output_item_id:
                            continue
                        
                        if not function_call_id:
                            function_call_id = output_item_id
                        
                        # Store tool call keyed by output_item_id (delta events use item_id which matches this)
                        final_tool_calls[output_item_id] = {
                            "type": item.type,
                            "output_item_id": output_item_id,
                            "function_call_id": function_call_id,
                            "call_id": function_call_id,  # Keep for API compatibility
                            "name": getattr(item, 'name', ''),
                            "arguments": getattr(item, 'arguments', '') or ''
                        }
            
            # Accumulate function call arguments from delta events
            elif event.type == 'response.function_call_arguments.delta':
                # Delta events use item_id which matches output_item_id
                output_item_id = getattr(event, 'item_id', None) or getattr(event, 'call_id', None)
                if not output_item_id or output_item_id not in final_tool_calls:
                    continue
                
                if 'arguments' not in final_tool_calls[output_item_id]:
                    final_tool_calls[output_item_id]['arguments'] = ''
                final_tool_calls[output_item_id]['arguments'] += event.delta
            
            # Handle function call arguments done - send complete tool call
            elif event.type == 'response.function_call_arguments.done':
                # Done events use item_id which matches output_item_id
                output_item_id = getattr(event, 'item_id', None) or getattr(event, 'call_id', None)
                if not output_item_id or output_item_id not in final_tool_calls:
                    continue
                
                # Use event.arguments if available, otherwise use accumulated
                final_arguments = getattr(event, 'arguments', final_tool_calls[output_item_id]['arguments'])
                final_tool_calls[output_item_id]['arguments'] = final_arguments
                
                tool_call = final_tool_calls[output_item_id]
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
                
                # Use function_call_id (call_id) for sending to frontend
                function_call_id = tool_call.get('function_call_id', '') or tool_call.get('call_id', '')
                if not function_call_id:
                    print(f"[CHAT] ERROR: Tool call missing function_call_id in stored data. Tool call: {tool_call}", flush=True)
                    continue
                
                print(f"[CHAT] Tool call complete: {tool_name} (function_call_id: {function_call_id}, output_item_id: {output_item_id}, arguments: {parsed_arguments})", flush=True)
                
                # Send complete tool call to frontend (use function_call_id as call_id for API compatibility)
                tool_call_data = {'tool_call': {'name': tool_name, 'arguments': parsed_arguments, 'call_id': function_call_id}}
                yield f"data: {json.dumps(tool_call_data)}\n\n"
            
            # Handle content/text output
            elif event.type == 'response.output_text.delta':
                if hasattr(event, 'delta'):
                    content = event.delta
                    accumulated_content += content
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
        print(f"[CHAT] Stream complete", flush=True)
        # Send completion event with response_id if available
        done_data = {'done': True}
        if response_id:
            done_data['response_id'] = response_id
            print(f"[CHAT] Response ID: {response_id}", flush=True)
        yield f"data: {json.dumps(done_data)}\n\n"
        
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

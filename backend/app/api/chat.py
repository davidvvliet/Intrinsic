from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.schemas import ChatRequest, CompactRequest, CompactResponse
from app.core.deps import get_workos_user
from app.core.limits import enforce_message_limit
from app.api.sec import get_financial_data
from app.api.market import get_stock_quote
from app.api.templates import apply_template_to_workspace
from app.api.conversation_service import save_user_message, save_assistant_turn, auto_title
from openai import AsyncOpenAI
import asyncio
import json
import os
from datetime import datetime

router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SYSTEM_PROMPT_TEMPLATE = """You are the user's assistant for Intrinsic, an AI-powered fundamental analysis tool to help users streamline investment analysis on securities to spot real value. Provide clear, concise, and actionable insights to help users make informed investment decisions.

Intrinsic has its own proprietary spreadsheet that you can edit using tool calls based on the user's requests. Note that the spreadsheet follows the same conventions as other spreadsheets.

Today's date is {current_date}.

{sheet_context}

## Current Sheet Data:
{sheet_data}

Rules:
 - Always use English.
 - Keep your answers short and concise — 200 words maximum. Do not exceed this limit unless the user explicitly asks for a detailed explanation. This word limit applies only to your text responses, not to tool call parameters.
 - Stay concise, factual and helpful. Be proactive but ask for clarification if needed.
 - Always stay in character as the user's assistant for Intrinsic and maintain focus on your purpose: helping users with fundamental analysis and investment decisions.
 - If it's not entirely obvious what the user is referring to, use the get_cell_range tool to read their selected cells for context.
 - For significant operations (fetching data, building a model, large edits), briefly state your intent. For routine edits, just do them.
 - After completing tool calls, provide a concise summary of what was changed rather than describing every individual cell edit (e.g., "Created a revenue projection table" instead of "Set A1 to Revenue, set A2 to 2023, set B2 to 100...").
 - The user can see the spreadsheet in real-time as you make changes. Do NOT read out or recite cell values, formulas, or data that you've written — the user can already see it. Instead, briefly describe what you did (e.g., "Added the revenue projections" not "I set A1 to Revenue, A2 to 2024, B2 to $5.2M..."). Similarly, when fetching financial data, don't narrate every number — just confirm the data was retrieved and point out key insights if relevant.
 - The default cell background color is #FFFFEF. Be aware of this when setting fill colors.
 - When using colors (fill or text), use pleasant bright pastel colors by default unless the user specifies the colors they want.
 - When asked to color or style a sheet without specific color instructions, first use get_cell_range to read the sheet contents so you can choose contextually appropriate colors (e.g., green for revenue/positive values, red for expenses/losses, blue for headers, etc.).
 - IMPORTANT: If the active sheet changes between messages and the user did not mention switching sheets, ask for clarification before making any edits. This prevents accidental edits to the wrong sheet.
 - When the user specifies a ticker symbol, ALWAYS use exactly what they provide. Never substitute a different ticker based on your own knowledge — ticker symbols change (e.g., SQ → XYZ for Block), and your training data may be outdated. The user's ticker is always more current than yours.
 - When building financial models or analyzing real companies, ALWAYS use the get_financial_data tool to fetch verified SEC data rather than relying on potentially outdated training knowledge. This ensures accuracy with audited 10-K/10-Q filings. (You can still make assumptions in subjective parameters like discount rates or anything else as long as you highlight that to the user.)
 - After making changes, use get_cell_range to read back what you wrote. Compare the actual values against your intent. If anything is wrong (wrong cell, typo, formula error, misaligned data), briefly acknowledge the mistake and fix it immediately before responding to the user.
 - IMPORTANT: Never tell the user to do something themselves. Instead, proactively do it for them using your available tools. Only explain how to do something manually if it's truly outside the scope of your tool capabilities.
 - When making multiple related edits, prefer set_cell_range over multiple set_cell_value calls to reduce latency.
 - IMPORTANT: Never call get_financial_data, get_stock_quote, or apply_template in the same turn as spreadsheet editing tools (set_cell_value, set_cell_range, get_cell_range, format_cells, format_cell_range). Always fetch data first, then edit the spreadsheet in a separate turn.
 - If a tool call fails or returns unexpected results, acknowledge the issue briefly and attempt a fix rather than repeating the same action.
 - Before making changes that affect more than ~50 cells, briefly confirm your approach with the user.
 - IMPORTANT: The get_financial_data tool returns values in raw dollars (e.g., revenue of 383285000000 means $383.285 billion). When writing these to the spreadsheet, divide by 1,000,000 ONCE to express in millions (e.g., 383285000000 → 383,285). Do NOT divide more than once. Default templates already label units as "$ in millions", so just fill in the values accordingly. Briefly mention the convention to the user when you first use it."""

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
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
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
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
                }
            },
            "required": ["startCell", "endCell", "values"]
        }
    },
    {
        "type": "function",
        "name": "get_cell_range",
        "description": "Read values from a range of cells in the spreadsheet. Returns a 2D array of { value } objects. 'value' is the computed display result. For formula cells, a 'raw' field is also included containing the underlying formula (starting with '='). If 'raw' is absent, the cell is a plain literal.",
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
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
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
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
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
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
                }
            },
            "required": ["startCell", "endCell", "format"]
        }
    },
    {
        "type": "function",
        "name": "get_financial_data",
        "description": "Get verified financial data from official SEC filings for a publicly traded company. Returns historical data for the requested metrics. Use this to get accurate, audited numbers for fundamental analysis.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., 'AAPL', 'META', 'MSFT')"
                },
                "metrics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of metrics to fetch. Statement shortcuts: 'income_statement', 'balance_sheet', 'cash_flow_statement'. Individual metrics: 'revenue', 'cost_of_revenue', 'gross_profit', 'operating_income', 'net_income', 'eps', 'eps_diluted', 'total_assets', 'current_assets', 'total_liabilities', 'current_liabilities', 'stockholders_equity', 'cash', 'total_debt', 'shares_outstanding', 'operating_cash_flow', 'capex', 'depreciation', 'free_cash_flow'. You can mix shortcuts with individual metrics."
                },
                "periods": {
                    "type": "string",
                    "enum": ["annual", "quarterly"],
                    "description": "Time period granularity. 'annual' for yearly 10-K data, 'quarterly' for 10-Q data. Defaults to 'annual'."
                },
                "limit_years": {
                    "type": "integer",
                    "description": "Maximum number of years/periods to return. Defaults to 5. Increase if user needs more historical data."
                }
            },
            "required": ["ticker", "metrics"]
        }
    },
    {
        "type": "function",
        "name": "get_stock_quote",
        "description": "Get current stock price and market data for a ticker. Returns real-time price, market cap, PE ratio, 52-week range, beta, and other valuation metrics. Use this when you need current market prices or valuation multiples.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., 'AAPL', 'TSLA', 'MSFT')"
                }
            },
            "required": ["ticker"]
        }
    },
    {
        "type": "function",
        "name": "apply_template",
        "description": "Load a spreadsheet template into the current workspace, appending its sheets as new tabs. Use this when the user asks to load, apply, or use a template. The available templates are listed in your instructions.",
        "parameters": {
            "type": "object",
            "properties": {
                "template_name": {
                    "type": "string",
                    "description": "The exact name of the template to apply (must match one of the available templates)"
                }
            },
            "required": ["template_name"]
        }
    }
]

async def generate_chat_stream(request: ChatRequest, user):

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    try:
        # Save user message to DB at the start (not for tool call continuations)
        if request.conversation_id and request.message and not request.function_call_outputs:
            await save_user_message(request.conversation_id, request.message)
            title = await auto_title(request.conversation_id, request.message)
            if title:
                yield f"data: {json.dumps({'title': title})}\n\n"

        # Get current date and build system prompt
        current_date = datetime.now().strftime("%B %d, %Y")

        # Build sheet context
        if request.sheet_id and request.sheet_name:
            sheet_context = f"The user is currently viewing sheet \"{request.sheet_name}\" (ID: {request.sheet_id}). The ID is the stable unique identifier; the name can be changed by the user."
        elif request.sheet_name:
            sheet_context = f"The user is currently viewing sheet: \"{request.sheet_name}\" (unsaved)"
        elif request.sheet_id:
            sheet_context = f"The user is currently viewing sheet ID: {request.sheet_id}"
        else:
            sheet_context = "The user is viewing an unnamed/unsaved sheet."

        # Use provided sheet data or indicate none available
        sheet_data = request.sheet_data or "(No sheet data provided - use get_cell_range if needed)"

        instructions = SYSTEM_PROMPT_TEMPLATE.format(current_date=current_date, sheet_context=sheet_context, sheet_data=sheet_data)

        # Add optional selected range context
        if request.selected_range:
            instructions += f"\n\nNote: The user currently has range {request.selected_range} selected. Use this as context if relevant to their request, but ignore it if the request is unrelated."

        # Add workspace and sheet names to context
        if request.workspace_name:
            instructions += f"\n\nThe user is working in workspace: \"{request.workspace_name}\"."
        if request.sheet_names:
            sheet_list = ", ".join(f'"{n}"' for n in request.sheet_names)
            instructions += f"\n\nAll sheets in this workspace: {sheet_list}. ALWAYS include the 'sheet' parameter in every spreadsheet tool call to specify which sheet you are targeting by name. Never omit it."

        # Add available templates from frontend
        user_id = user["id"]
        if request.template_names:
            template_list = ", ".join(f'"{n}"' for n in request.template_names)
            instructions += f"""

## Templates
Every user has access to a set of default templates: DCF_Template, LBO_Template, and Trading_Comps_Template. These are pre-built financial model structures with properly labeled rows, columns, sheets, and formulas. Users may also have their own custom templates.

Available templates (use apply_template tool with the exact name): {template_list}

When the user asks you to build a DCF, LBO model, or trading comps analysis: if there are no existing sheets in the workspace that already serve that purpose, apply the corresponding default template (DCF_Template, LBO_Template, or Trading_Comps_Template) using the apply_template tool, then populate it with real data using get_financial_data. If there are already sheets that look like they could be used for that purpose, ask the user whether they want to use the existing sheets or apply the default template. Only build a model from scratch if the user explicitly asks for a custom layout or says not to use a template.

After applying a template for a specific company, fill in the company name/ticker and today's date in the appropriate header cells of the template so the model is clearly labeled."""

        # Determine initial input based on request type
        prev_response_id = request.previous_response_id
        if request.previous_response_id:
            if request.function_call_outputs:
                input_data = request.function_call_outputs
            elif request.message:
                input_data = [{"role": "user", "content": request.message}]
            else:
                raise ValueError("previous_response_id provided but neither function_call_outputs nor message provided")
        else:
            input_data = []
            if request.message:
                input_data.append({"role": "user", "content": request.message})

        response_id = None
        accumulated_text = ""

        # True streaming loop with server-side tool interception
        while True:
            # Make STREAMING call
            stream = await client.responses.create(
                model="gpt-5.1",
                previous_response_id=prev_response_id,
                input=input_data,
                instructions=instructions,
                tools=SPREADSHEET_TOOLS,
                stream=True,
                max_output_tokens=3000
            )

            server_tools = []
            client_tool_ids = []

            # Process streaming events
            async for event in stream:
                event_type = getattr(event, 'type', None)

                # Capture response_id
                if event_type == 'response.created':
                    response_id = event.response.id

                # Stream text deltas IMMEDIATELY to client
                elif event_type == 'response.output_text.delta':
                    if hasattr(event, 'delta'):
                        accumulated_text += event.delta
                        yield f"data: {json.dumps({'content': event.delta})}\n\n"

                # Handle completed output items
                elif event_type == 'response.output_item.done':
                    item = event.item
                    if item.type == 'function_call':
                        if item.name in ['get_financial_data', 'get_stock_quote', 'apply_template']:
                            # Server-side tool - collect for later, don't yield
                            server_tools.append(item)
                        else:
                            # Client-side tool - yield immediately
                            try:
                                args = json.loads(item.arguments) if isinstance(item.arguments, str) else item.arguments
                            except (json.JSONDecodeError, TypeError):
                                args = {}

                            tool_call_data = {
                                'tool_call': {
                                    'name': item.name,
                                    'arguments': args,
                                    'call_id': item.call_id
                                }
                            }
                            yield f"data: {json.dumps(tool_call_data)}\n\n"
                            client_tool_ids.append(item.call_id)

                # Capture response_id from response.completed as fallback
                elif event_type == 'response.completed':
                    if hasattr(event, 'response') and hasattr(event.response, 'id'):
                        response_id = event.response.id

            # Stream finished - check if we need to execute server-side tools
            if not server_tools:
                print(f"[chat] No server tools, ending stream")
                break  # No server tools, we're done

            print(f"[chat] Executing {len(server_tools)} server-side tools")
            # Execute server-side tools (SEC API)
            tool_outputs = []
            for tool in server_tools:
                try:
                    args = json.loads(tool.arguments) if isinstance(tool.arguments, str) else tool.arguments
                except (json.JSONDecodeError, TypeError):
                    args = {}

                try:
                    if tool.name == 'get_financial_data':
                        result = await get_financial_data(
                            ticker=args.get('ticker', ''),
                            metrics=args.get('metrics', []),
                            periods=args.get('periods', 'annual'),
                            limit_years=args.get('limit_years', 5)
                        )
                    elif tool.name == 'get_stock_quote':
                        result = get_stock_quote(args.get('ticker', ''))
                    elif tool.name == 'apply_template':
                        result = await apply_template_to_workspace(
                            template_name=args.get('template_name', ''),
                            workspace_id=request.workspace_id,
                            user_id=user_id,
                        )
                        if "error" not in result:
                            yield f"data: {json.dumps({'sheets_changed': True})}\n\n"
                    else:
                        result = {"error": f"Unknown tool: {tool.name}"}
                    result_json = json.dumps(result)
                except Exception as e:
                    result_json = json.dumps({"error": str(e)})

                tool_outputs.append({
                    "type": "function_call_output",
                    "call_id": tool.call_id,
                    "output": result_json
                })

            # Failsafe: include outputs for client-side tools that were yielded to frontend
            for call_id in client_tool_ids:
                tool_outputs.append({
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps({"status": "executed_on_client"})
                })

            # Continue loop with tool outputs - next iteration streams the continuation
            prev_response_id = response_id
            input_data = tool_outputs

        # Save assistant message + update last_response_id
        if request.conversation_id and accumulated_text and response_id:
            asyncio.create_task(save_assistant_turn(request.conversation_id, accumulated_text, response_id))

        # Send completion event with final response_id
        print(f"[chat] Stream complete, response_id={response_id}")
        done_data = {'done': True, 'response_id': response_id}
        yield f"data: {json.dumps(done_data)}\n\n"

    except Exception as e:
        print(f"[chat] ERROR: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    user = Depends(get_workos_user)
):
    await enforce_message_limit(user["id"], user.get("email"))
    return StreamingResponse(
        generate_chat_stream(request, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

COMPACT_PROMPT = """Summarize this conversation concisely for context continuity. Focus on:
- What the user was trying to accomplish
- Key actions taken on the spreadsheet (cells modified, formulas added, data fetched)
- Current state of the work
- Any ongoing tasks or context needed for continuation

Keep it under 400 words. Write in past tense, third person perspective (e.g., "The user requested...", "A DCF model was built...")."""

@router.post("/compact", response_model=CompactResponse)
async def compact_conversation(
    request: CompactRequest,
    user = Depends(get_workos_user)
):
    """Generate a summary of the conversation for context compaction."""
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    try:
        response = await client.responses.create(
            model="gpt-5-mini",
            previous_response_id=request.previous_response_id,
            input=[{"role": "user", "content": "Please summarize our conversation so far."}],
            instructions=COMPACT_PROMPT,
            max_output_tokens=800
        )

        # Extract text from response
        print(f"[compact] Response output: {response.output}")
        summary = ""
        for item in response.output:
            print(f"[compact] Item: type={type(item).__name__}, has_content={hasattr(item, 'content')}, content={getattr(item, 'content', 'NO_ATTR')}")
            if hasattr(item, 'content') and item.content:
                for content in item.content:
                    if hasattr(content, 'text'):
                        summary += content.text

        return CompactResponse(summary=summary.strip())

    except Exception as e:
        print(f"[compact] ERROR: {e}")
        raise

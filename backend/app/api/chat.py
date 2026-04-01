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

## Current Sheet Data (may be truncated — use get_cell_range or find_cells to read beyond what's shown):
{sheet_data}

## NEVER DO THIS — examples of unacceptable responses:

- "What happened: ... Why that's bad: ... What I should do next (if you agree): ..." — NO. Do not narrate the problem, explain why it's bad, or ask permission to fix your own mistake. Just read the cells, fix the issue, and confirm in one sentence.
- "Do you want me to restore X, or do you prefer Y?" — NO. Do not present options. You made the sheet — you know the intent. Fix it.
- "You're right to call that out" / "Great question" / "Let me explain" — NO. Skip all preamble. Act.
- "Here's what's wrong with the sheet: 1. ... 2. ... 3. ... How I suggest we proceed: ..." — NO. Do not write diagnostic essays listing every issue you found. If you see problems, fix them one by one using your tools. The user asked you to fix the sheet, not to write a report about it.
- "If you tell me whether you want X or Y, I'll do Z" — NO. Use your judgment. Pick the sensible default, do the work, and tell the user what you did in one sentence. If the choice truly matters, ask in one short sentence — not buried in a wall of text.

## CRITICAL RULES — violating these will break the user's work:

1. NEVER overwrite formulas. If a cell has type "formula" or starts with '=', do not replace it with a static value. Only overwrite if the user explicitly asks.

2. When writing formulas, verify the source cells first. Use get_cell_range or find_cells to confirm what's in the cells your formula will reference. Wrong references produce silently wrong results.

3. If the sheet data above doesn't show what you need, use get_cell_range or find_cells to read the sheet before editing. Don't guess cell positions.

4. Before writing to any cell, confirm the column header and row label match your intent. E.g. If you're unsure which column "LTM Revenue" is in, use find_cells to locate it first. Never assume column positions.

5. When writing cell references (e.g., in chat or in formulas), if a sheet name contains spaces, quote it: `"DCF Model"!C1` not `DCF Model!C1`.

6. When inserting charts: identify the exact populated cells from the data shown. Use `dataRanges` as comma-separated ranges of only those cells, excluding empty rows and columns (e.g., `"C9:I9,C12:I12"`). Always set `useFirstRowAsHeaders: true` when the first range is a labels row (e.g. years, quarters) — this makes those values become X-axis tick labels instead of a plotted series. `xAxisLabel`/`yAxisLabel` are axis *titles* (e.g. "Year", "Revenue ($mm)"), not tick labels — set both independently. Specify sheet if needed.

7. NEVER ask the user for data you can fetch. Need a stock price? Call get_stock_quote. Need financials? Call get_financial_data. Need to find something? Call find_cells.

8. NEVER tell the user to do something themselves. Do it for them with your tools.

9. When the user reports an error, read the problem area with get_cell_range, then fix it immediately. Do not explain options — just fix it.

10. Verify after writing. Use get_cell_range to check what you wrote. If anything is wrong, fix it immediately.

## IMPORTANT RULES — how to work correctly:

- Always use English.
- Just act. Be concise — no preamble, no "You're right", no "Let me be precise", no presenting choices. Do the work, confirm in one sentence.
- When answering analytical or opinion questions, give a direct, dense answer — not an essay. Hit the key points in a short paragraph. Do not write numbered multi-section breakdowns, do not repeat the same point in different words, and do not pad with "narrative translations" or "in plain English" restatements. Respect the user's time.
- The user sees the spreadsheet in real-time. Do NOT recite cell values, formulas, or data back to them. Just briefly describe what you did (e.g., "Added the revenue projections" not "I set A1 to Revenue, A2 to 2024...").
- If you don't know where something is in the sheet, use find_cells to search for it. Do not guess cell positions.
- If it's not obvious what the user is referring to, use get_cell_range to read their selected cells for context.
- When the user asks about values, results, or outputs in the sheet, always read the relevant cells first. Never guess or assume what a cell contains — read it, then answer.
- When the user specifies a ticker symbol, use exactly what they provide. Never substitute based on your training data — tickers change. More broadly, never use your training data to make assumptions about a company's status (public vs private, whether it has filings, etc.). If you know the ticker, call the tool and let the result tell you what's available. If you don't know the ticker, ask the user for it.
- Always use get_financial_data for real company data instead of your training knowledge. For subjective parameters (discount rate, growth rate, projection years), use sensible defaults (WACC ~8-10%, terminal growth ~2-3%, 5-year projection) and tell the user what you assumed at the end.
- get_financial_data returns values in raw dollars (e.g., 383285000000 = $383.285B). Divide by 1,000,000 ONCE to express in millions. Templates label units as "$ in millions".
- Fetch data first, then edit the spreadsheet in a separate turn. Do not call get_financial_data, get_stock_quote, or apply_template in the same turn as spreadsheet editing tools.
- Prefer set_cell_range over multiple set_cell_value calls to reduce latency.
- Before making changes that affect more than ~50 cells, briefly confirm your approach with the user.
- If a tool call fails, try to fix the issue rather than repeating the same action.
- If the active sheet changes between messages and the user didn't mention switching sheets, ask before editing.

## STYLE RULES:

- Default cell background color is #FFFFEF. Be aware of this when setting fill colors.
- When using colors, use pleasant bright pastels by default unless the user specifies colors.
- When styling a sheet without specific color instructions, read the contents first with get_cell_range to choose contextually appropriate colors (green for revenue, red for expenses, blue for headers, etc.).
- When inserting charts, always provide positionCell pointing to an empty area near the data — typically to the right of or below the data range. Do not overlap existing content."""

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
        "description": "Read values from a range of cells. Returns a flat array of {cell, value, raw?, type?} objects. 'cell' is the A1 reference (e.g. 'B12'). 'value' is the computed display result. For formula cells, 'raw' contains the formula and 'type' is 'formula' — these cells must not be overwritten with static values.",
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
        "name": "find_cells",
        "description": "Search for cells containing specific text. Returns matching cell references and values. Use this to locate data before reading or editing instead of scanning large ranges with get_cell_range.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Text to search for (case-insensitive)"
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to search the active sheet."
                }
            },
            "required": ["query"]
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
        "name": "insert_chart",
        "description": "Insert a chart into the spreadsheet. The chart visualizes data from the specified cell range. Works like Google Sheets chart insertion.",
        "parameters": {
            "type": "object",
            "properties": {
                "dataRanges": {
                    "type": "string",
                    "description": "Cell ranges to include in the chart, comma-separated (e.g., 'A1:H1,A3:H3'). Each entry must be a range with start:end notation — never a single cell. First range is typically headers, subsequent ranges are data series."
                },
                "type": {
                    "type": "string",
                    "enum": ["bar", "line", "pie", "doughnut", "scatter", "area"],
                    "description": "Chart type. Defaults to 'bar'."
                },
                "title": {
                    "type": "string",
                    "description": "Chart title. Optional."
                },
                "useFirstRowAsHeaders": {
                    "type": "boolean",
                    "description": "Whether the first row of the range contains series/column headers. Defaults to true."
                },
                "useFirstColAsLabels": {
                    "type": "boolean",
                    "description": "Whether the first column of the range contains category/row labels. Defaults to true."
                },
                "positionCell": {
                    "type": "string",
                    "description": "Cell reference (A1 notation) for the top-left corner of where the chart should appear on the sheet. Pick an empty area near the data. Defaults to the cell right of the data range's end column."
                },
                "sheet": {
                    "type": "string",
                    "description": "Target sheet name. Omit to use the active sheet."
                },
                "xAxisLabel": {
                    "type": "string",
                    "description": "Label for the X-axis. Optional."
                },
                "yAxisLabel": {
                    "type": "string",
                    "description": "Label for the Y-axis. Optional."
                }
            },
            "required": ["dataRanges"]
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

When the user asks you to build a DCF, LBO model, or trading comps analysis: if there are no existing sheets in the workspace that already serve that purpose, apply the corresponding default template (DCF_Template, LBO_Template, or Trading_Comps_Template) using the apply_template tool, then populate it with real data using get_financial_data. If there are already sheets that look like they could be used for that purpose, use them directly — do not ask the user whether to use the existing sheets or apply a new template. Only build a model from scratch if the user explicitly asks for a custom layout or says not to use a template.

**Critical rule when working with templates:** Before writing any values, carefully read the template structure to understand which cells are inputs, labels, and formulas. Only write to input cells — these are identified by a background fill color of #E2EFDA. Do not modify any other cells: do not overwrite formulas, do not change labels or headers, do not reformat or restructure anything. The template is pre-built and correct — your job is only to populate the designated input cells with real data. Only deviate from this if the user explicitly instructs you to change something outside the input cells.

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

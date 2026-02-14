from pydantic import BaseModel
from typing import List, Dict, Optional

class ChatRequest(BaseModel):
    message: Optional[str] = None
    previous_response_id: Optional[str] = None
    function_call_outputs: Optional[List[Dict]] = None
    selected_range: Optional[str] = None
    sheet_id: Optional[str] = None
    sheet_name: Optional[str] = None
    sheet_data: Optional[str] = None

class CompactRequest(BaseModel):
    previous_response_id: str

class CompactResponse(BaseModel):
    summary: str
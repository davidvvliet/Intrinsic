from pydantic import BaseModel
from typing import List, Dict

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict]

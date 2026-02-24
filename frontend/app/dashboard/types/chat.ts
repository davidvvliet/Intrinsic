export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseChatStreamReturn {
  streamingText: string;
  isStreaming: boolean;
  isToolCalling: boolean;
  sendMessage: (
    message: string | null,
    conversationHistory: ChatMessage[] | null,
    previousResponseId?: string,
    functionCallOutputs?: Array<{type: string, call_id: string, output: string}>,
    selectedRange?: string | null,
    sheetId?: string | null,
    sheetName?: string | null,
    summaryContext?: string | null,
    sheetData?: string | null,
    workspaceId?: string | null,
    templateNames?: string[] | null
  ) => Promise<void>;
  error: string | null;
}

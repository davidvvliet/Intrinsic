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
    accessToken: string | null,
    previousResponseId?: string,
    functionCallOutputs?: Array<{type: string, call_id: string, output: string}>,
    selectedRange?: string | null,
    sheetId?: string | null,
    sheetName?: string | null,
    summaryContext?: string | null
  ) => Promise<void>;
  error: string | null;
}

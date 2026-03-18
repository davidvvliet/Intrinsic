export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendMessageOptions {
  message?: string | null;
  previousResponseId?: string;
  functionCallOutputs?: Array<{type: string, call_id: string, output: string}>;
  selectedRange?: string | null;
  sheetId?: string | null;
  sheetName?: string | null;
  summaryContext?: string | null;
  sheetData?: string | null;
  workspaceId?: string | null;
  templateNames?: string[] | null;
  sheetNames?: string[] | null;
  workspaceName?: string | null;
  conversationId?: string | null;
}

export interface UseChatStreamReturn {
  streamingText: string;
  isStreaming: boolean;
  isToolCalling: boolean;
  sendMessage: (options: SendMessageOptions) => Promise<void>;
  error: string | null;
  rateLimitResetAt: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseChatStreamReturn {
  streamingText: string;
  isStreaming: boolean;
  isToolCalling: boolean;
  sendMessage: (message: string, conversationHistory: ChatMessage[]) => Promise<void>;
  error: string | null;
}

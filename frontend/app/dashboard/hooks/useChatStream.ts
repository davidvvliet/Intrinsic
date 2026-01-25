import { useState, useCallback } from 'react';
import { ChatMessage, UseChatStreamReturn } from '../types/chat';

export function useChatStream(
  onMessageComplete: (message: string) => void
): UseChatStreamReturn {
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isToolCalling, setIsToolCalling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string, conversationHistory: ChatMessage[]) => {
    setIsStreaming(true);
    setIsToolCalling(false);
    setStreamingText('');
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullMessage = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setIsStreaming(false);
              setIsToolCalling(false);
              onMessageComplete(fullMessage);
              setStreamingText('');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.text) {
                fullMessage += parsed.text;
                setStreamingText(fullMessage);
              }

              if (parsed.is_tool_calling !== undefined) {
                setIsToolCalling(parsed.is_tool_calling);
              }
            } catch (e) {
              // If not JSON, treat as plain text
              fullMessage += data;
              setStreamingText(fullMessage);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsStreaming(false);
      setIsToolCalling(false);
    }
  }, [onMessageComplete]);

  return {
    streamingText,
    isStreaming,
    isToolCalling,
    sendMessage,
    error,
  };
}

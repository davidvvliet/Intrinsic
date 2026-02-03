import { useState, useCallback } from 'react';
import { ChatMessage, UseChatStreamReturn } from '../types/chat';

export interface ToolCall {
  name: string;
  args: any;
  call_id: string;
}

export function useChatStream(
  onMessageComplete: (message: string, toolCalls?: ToolCall[], responseId?: string) => void,
  onToolCall?: (name: string, args: any) => void
): UseChatStreamReturn {
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isToolCalling, setIsToolCalling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    message: string | null, 
    conversationHistory: ChatMessage[] | null, 
    accessToken: string | null,
    previousResponseId?: string,
    functionCallOutputs?: Array<{type: string, call_id: string, output: string}>
  ) => {
    setIsStreaming(true);
    setIsToolCalling(false);
    setStreamingText('');
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const body: any = {};
      if (previousResponseId) {
        body.previous_response_id = previousResponseId;
        if (functionCallOutputs) {
          // Tool call continuation
          body.function_call_outputs = functionCallOutputs;
        } else if (message) {
          // New user message continuation
          body.message = message;
        }
      } else {
        // Initial request
        body.message = message || '';
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullMessage = '';
      const toolCalls: ToolCall[] = [];

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
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.content) {
                fullMessage += parsed.content;
                setStreamingText(fullMessage);
              }

              if (parsed.tool_call) {
                setIsToolCalling(true);
                
                // Track tool call
                toolCalls.push({
                  name: parsed.tool_call.name,
                  args: parsed.tool_call.arguments,
                  call_id: parsed.tool_call.call_id || ''
                });
                
                // Execute tool call immediately
                if (onToolCall) {
                  onToolCall(parsed.tool_call.name, parsed.tool_call.arguments);
                }
              }

              if (parsed.tool_call_start) {
                setIsToolCalling(true);
              }

              if (parsed.done) {
                setStreamingText('');
                setIsStreaming(false);
                setIsToolCalling(false);
                onMessageComplete(fullMessage, toolCalls.length > 0 ? toolCalls : undefined, parsed.response_id);
                return;
              }

              if (parsed.error) {
                setError(parsed.error);
                setIsStreaming(false);
                setIsToolCalling(false);
                return;
              }
            } catch (e) {
              // If not JSON, treat as plain text
              fullMessage += data;
              setStreamingText(fullMessage);
            }
          }
        }
      }

      // Reset state if stream ended without explicit 'done' event
      setIsStreaming(false);
      setIsToolCalling(false);
      setStreamingText('');
      onMessageComplete(fullMessage, toolCalls.length > 0 ? toolCalls : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsStreaming(false);
      setIsToolCalling(false);
    }
  }, [onMessageComplete, onToolCall]);

  return {
    streamingText,
    isStreaming,
    isToolCalling,
    sendMessage,
    error,
  };
}

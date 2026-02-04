"use client";

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import ChatDisplay from './components/ChatDisplay';
import SearchInput from './components/SearchInput';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import { useChatStream, ToolCall } from './hooks/useChatStream';
import { useChatMessages } from './hooks/useChatMessages';
import { ChatMessage } from './types/chat';
import styles from './page.module.css';

const Spreadsheet = dynamic(
  () => import('./components/Spreadsheet/index'),
  { ssr: false }
);

export default function Dashboard() {
  const columnMinimize = useColumnMinimize();
  const { accessToken } = useAccessToken();
  
  const [chatMessages, setChatMessages] = useChatMessages();
  const [query, setQuery] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const toolCallHandlerRef = useRef<((name: string, args: any) => any) | null>(null);
  const lastResponseIdRef = useRef<string | null>(null);
  const iterationCountRef = useRef<number>(0);
  const maxIterations = 10;
  const sendMessageRef = useRef<((
    message: string | null, 
    conversationHistory: ChatMessage[] | null, 
    accessToken: string | null,
    previousResponseId?: string,
    functionCallOutputs?: Array<{type: string, call_id: string, output: string}>,
    selectedRange?: string | null
  ) => Promise<void>) | null>(null);

  const handleMessageComplete = useCallback(async (message: string, toolCalls?: ToolCall[], responseId?: string) => {
    // Store response_id for subsequent requests
    if (responseId) {
      lastResponseIdRef.current = responseId;
    }

    // Add text content to chat messages (keep it visible)
    if (message) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }

    // If there are tool calls, execute them and continue the loop
    if (toolCalls && toolCalls.length > 0 && iterationCountRef.current < maxIterations && sendMessageRef.current && responseId) {
      iterationCountRef.current++;
      
      // Execute tool calls and collect results
      const toolResults: Array<{call_id: string, result: any}> = [];
      for (const toolCall of toolCalls) {
        if (toolCallHandlerRef.current) {
          const result = toolCallHandlerRef.current(toolCall.name, toolCall.args);
          toolResults.push({
            call_id: toolCall.call_id,
            result: result !== undefined ? result : { status: 'success' }
          });
        }
      }

      // Build function_call_output items (convert results to JSON strings)
      const functionCallOutputs = toolResults.map(tr => {
        let output: string;
        if (Array.isArray(tr.result)) {
          output = JSON.stringify(tr.result);
        } else if (tr.result && typeof tr.result === 'object' && tr.result.data && Array.isArray(tr.result.data)) {
          output = JSON.stringify(tr.result.data);
        } else if (typeof tr.result === 'string') {
          output = tr.result;
        } else {
          output = JSON.stringify(tr.result);
        }
        return {
          type: 'function_call_output',
          call_id: tr.call_id,
          output: output
        };
      });

      // Make another API call using previous_response_id approach
      if (sendMessageRef.current) {
        sendMessageRef.current(null, null, accessToken ?? null, responseId, functionCallOutputs, selectedRange);
      }
    } else {
      // No tool calls - reset iteration count
      iterationCountRef.current = 0;
    }
  }, [accessToken]);

  const handleToolCall = useCallback((name: string, args: any) => {
    if (toolCallHandlerRef.current) {
      toolCallHandlerRef.current(name, args);
    }
  }, []);

  const handleRegisterToolHandler = useCallback((handler: (name: string, args: any) => any) => {
    toolCallHandlerRef.current = handler;
  }, []);

  const { streamingText, isStreaming, isToolCalling, sendMessage } = useChatStream(handleMessageComplete, handleToolCall);
  sendMessageRef.current = sendMessage;

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    // Reset iteration count for new conversation
    iterationCountRef.current = 0;

    const messageText = query.trim();
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setChatMessages(prev => [...prev, userMessage]);
    setQuery('');
    
    // If we have a previous response_id, use it for continuation
    // Otherwise, make an initial request
    if (lastResponseIdRef.current && sendMessageRef.current) {
      sendMessageRef.current(messageText, null, accessToken ?? null, lastResponseIdRef.current, undefined, selectedRange);
    } else {
      sendMessage(messageText, null, accessToken ?? null, undefined, undefined, selectedRange);
    }
  }, [query, selectedRange, sendMessage, accessToken]);

  return (
    <div className={styles.dashboard}>
      <DashboardNavbar />
      <div 
        className={styles.dashboardContainer}
        style={{ gridTemplateColumns: columnMinimize.getGridTemplateColumns() }}
      >
        <div 
          className={`${styles.leftColumn} ${columnMinimize.leftMinimized ? styles.hidden : ''}`}
        >
          {/* <div className={styles.globeContainer}>
            <Globe size={250} color="#000000" speed={0.003} />
          </div> */}
        </div>
        <div className={styles.middleColumn}>
          <Spreadsheet 
            onToolCall={handleRegisterToolHandler} 
            onSelectionChange={setSelectedRange}
          />
        </div>
        <div 
          className={`${styles.rightColumn} ${columnMinimize.rightMinimized ? styles.hidden : ''}`}
        >
          <div className={styles.rightColumnContent}>
            {chatMessages.length > 0 && (
              <ChatDisplay
                messages={chatMessages}
                streamingText={streamingText}
                isStreaming={isStreaming}
                isToolCalling={isToolCalling}
              />
            )}
            <div className={styles.searchInputWrapper}>
              {selectedRange && (
                <div className={styles.selectedRangeDisplay}>
                  <span>{selectedRange}</span>
                  <button
                    className={styles.clearRangeButton}
                    onClick={() => setSelectedRange(null)}
                    aria-label="Clear selection"
                  >
                    ×
                  </button>
                </div>
              )}
              <SearchInput
                query={query}
                setQuery={setQuery}
                onSearch={handleSearch}
                loading={isStreaming || isToolCalling}
              />
            </div>
          </div>
        </div>
        <button
          className={`${styles.minimizeButton} ${
            columnMinimize.leftMinimized 
              ? styles.minimizeButtonLeftMinimized 
              : styles.minimizeButtonLeft
          }`}
          onClick={columnMinimize.toggleLeftColumn}
        >
          {columnMinimize.leftMinimized ? '+' : '−'}
        </button>
        <button
          className={`${styles.minimizeButton} ${
            columnMinimize.rightMinimized 
              ? styles.minimizeButtonRightMinimized 
              : styles.minimizeButtonRight
          }`}
          onClick={columnMinimize.toggleRightColumn}
        >
          {columnMinimize.rightMinimized ? '+' : '−'}
        </button>
      </div>
    </div>
  );
}

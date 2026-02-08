"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import ChatDisplay from './components/ChatDisplay';
import SearchInput from './components/SearchInput';
import TabBar from './components/TabBar';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import { useChatStream, ToolCall } from './hooks/useChatStream';
import { ChatMessage } from './types/chat';
import { useSpreadsheetStore } from './stores/spreadsheetStore';
import { useConversationsStore } from './stores/conversationsStore';
import styles from './page.module.css';

const Spreadsheet = dynamic(
  () => import('./components/Spreadsheet/index'),
  { ssr: false }
);

export default function Dashboard() {
  const columnMinimize = useColumnMinimize();
  const { accessToken } = useAccessToken();

  // Get active sheet info from store
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
  const sheetId = activeSheet?.fetchId || null;
  const sheetName = activeSheet?.name || null;

  // Conversations store
  const conversations = useConversationsStore(state => state.conversations);
  const activeConversationId = useConversationsStore(state => state.activeConversationId);
  const createConversation = useConversationsStore(state => state.createConversation);
  const deleteConversation = useConversationsStore(state => state.deleteConversation);
  const setActiveConversation = useConversationsStore(state => state.setActiveConversation);
  const addMessage = useConversationsStore(state => state.addMessage);
  const setLastResponseId = useConversationsStore(state => state.setLastResponseId);

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const chatMessages = activeConversation?.messages ?? [];
  const lastResponseId = activeConversation?.lastResponseId ?? null;

  // Map conversations to tabs format
  const tabs = conversations.map(c => ({ id: c.id, title: c.title }));

  // Ensure there's always an active conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, setActiveConversation]);

  const [query, setQuery] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const toolCallHandlerRef = useRef<((name: string, args: any) => any) | null>(null);
  const iterationCountRef = useRef<number>(0);
  const maxIterations = 50;

  // Use refs to always get latest values (avoids stale closure issues)
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken ?? null;
  const sheetIdRef = useRef<string | null>(null);
  sheetIdRef.current = sheetId;
  const sheetNameRef = useRef<string | null>(null);
  sheetNameRef.current = sheetName;

  const sendMessageRef = useRef<((
    message: string | null,
    conversationHistory: ChatMessage[] | null,
    accessToken: string | null,
    previousResponseId?: string,
    functionCallOutputs?: Array<{type: string, call_id: string, output: string}>,
    selectedRange?: string | null,
    sheetId?: string | null,
    sheetName?: string | null
  ) => Promise<void>) | null>(null);

  const handleMessageComplete = useCallback(async (message: string, toolCalls?: ToolCall[], responseId?: string) => {
    const convId = useConversationsStore.getState().activeConversationId;
    if (!convId) return;

    // Store response_id for subsequent requests
    if (responseId) {
      setLastResponseId(convId, responseId);
    }

    // Add text content to chat messages (keep it visible)
    if (message) {
      addMessage(convId, { role: 'assistant', content: message });
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
        sendMessageRef.current(null, null, accessTokenRef.current, responseId, functionCallOutputs, selectedRange, sheetIdRef.current, sheetNameRef.current);
      }
    } else if (toolCalls && toolCalls.length > 0 && iterationCountRef.current >= maxIterations) {
      // Hit iteration limit - add warning message
      console.warn(`Hit max iterations (${maxIterations}) for tool calls`);
      addMessage(convId, {
        role: 'assistant',
        content: 'I made many changes but had to stop due to iteration limits. Let me know if you need me to continue.'
      });
      iterationCountRef.current = 0;
    } else {
      // No tool calls - reset iteration count
      iterationCountRef.current = 0;
    }
  }, [addMessage, setLastResponseId]);

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
    if (!activeConversationId) return;

    // Reset iteration count for new conversation
    iterationCountRef.current = 0;

    const messageText = query.trim();
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    addMessage(activeConversationId, userMessage);
    setQuery('');

    // If we have a previous response_id, use it for continuation
    // Otherwise, make an initial request
    if (lastResponseId && sendMessageRef.current) {
      sendMessageRef.current(messageText, null, accessTokenRef.current, lastResponseId, undefined, selectedRange, sheetIdRef.current, sheetNameRef.current);
    } else {
      sendMessage(messageText, null, accessTokenRef.current, undefined, undefined, selectedRange, sheetIdRef.current, sheetNameRef.current);
    }
  }, [query, selectedRange, sendMessage, activeConversationId, lastResponseId, addMessage]);

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
            <TabBar
              tabs={tabs}
              activeTabId={activeConversationId}
              onTabClick={setActiveConversation}
              onTabClose={deleteConversation}
              onNewTab={createConversation}
              disabled={isStreaming || isToolCalling}
            />
            {chatMessages.length > 0 && (
              <ChatDisplay
                messages={chatMessages}
                streamingText={streamingText}
                isStreaming={isStreaming}
                isToolCalling={isToolCalling}
              />
            )}
            <div className={styles.searchInputWrapper}>
              {selectedRange && chatMessages.length > 0 && (
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
              {selectedRange && chatMessages.length === 0 && (
                <div className={styles.selectedRangeDisplayBelow}>
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

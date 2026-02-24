"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import DashboardNavbar from '../../components/DashboardNavbar';
import Globe from '../../components/Globe';
import ChatDisplay from '../../components/ChatDisplay';
import SearchInput from '../../components/SearchInput';
import TabBar from '../../components/TabBar';
import { useColumnMinimize } from '../../hooks/useColumnMinimize';
import { useChatStream, ToolCall } from '../../hooks/useChatStream';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { ChatMessage } from '../../types/chat';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useConversations } from '../../hooks/useConversations';
import { useConversationsStore } from '../../stores/conversationsStore';
import { getSheetContextForLLM } from '../../components/Spreadsheet/serializeUtils';
import styles from './page.module.css';

const Spreadsheet = dynamic(
  () => import('../../components/Spreadsheet/index'),
  { ssr: false }
);

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const columnMinimize = useColumnMinimize();
  const { fetchWithAuth } = useAuthFetch();

  // Get active sheet info from store
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const setWorkspaceId = useSpreadsheetStore(state => state.setWorkspaceId);
  const setSheets = useSpreadsheetStore(state => state.setSheets);
  const setActiveSheetId = useSpreadsheetStore(state => state.setActiveSheetId);
  const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
  const sheetId = activeSheet?.fetchId || null;
  const sheetName = activeSheet?.name || null;

  // Fetch sheets for this workspace on mount
  useEffect(() => {
    setWorkspaceId(workspaceId);

    const loadWorkspaceSheets = async () => {
      try {
        const response = await fetchWithAuth(`/api/sheets?workspace_id=${workspaceId}`);
        if (!response.ok) {
          console.error('Failed to fetch sheets:', response.status);
          return;
        }

        const data = await response.json();

        if (data.length > 0) {
          // Convert API response to SheetMetadata format
          const sheetMetadata = data.map((sheet: any) => ({
            sheetId: sheet.id, // Use backend id as sheetId
            fetchId: sheet.id,
            name: sheet.name || 'Untitled',
            createdAt: sheet.created_at || new Date().toISOString(),
          }));

          setSheets(sheetMetadata);
          setActiveSheetId(sheetMetadata[0].sheetId);
        } else {
          // No sheets - create an empty one
          const newSheetId = Date.now().toString();
          setSheets([{
            sheetId: newSheetId,
            fetchId: null,
            name: 'Sheet 1',
            createdAt: new Date().toISOString(),
          }]);
          setActiveSheetId(newSheetId);
        }
      } catch (err) {
        console.error('Error loading workspace sheets:', err);
      }
    };

    loadWorkspaceSheets();

    // Clear store data when leaving workspace to prevent flash of stale content
    return () => {
      setWorkspaceId(null);
    };
  }, [workspaceId, fetchWithAuth, setWorkspaceId, setSheets, setActiveSheetId]);

  // Conversations hook
  const {
    conversations,
    loading: conversationsLoading,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    addMessage,
    updateLastResponseId,
    clearLastResponseId,
    setSummary,
  } = useConversations(workspaceId);

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const chatMessages = activeConversation?.messages ?? [];
  const lastResponseId = activeConversation?.lastResponseId ?? null;
  const summary = activeConversation?.summary ?? null;
  const messageCountAtLastCompaction = activeConversation?.messageCountAtLastCompaction ?? 0;

  // Map conversations to tabs format
  const tabs = conversations.map(c => ({ id: c.id, title: c.title }));

  // Fetch template names on mount for LLM context
  const templateNamesRef = useRef<string[]>([]);
  useEffect(() => {
    fetchWithAuth('/api/templates').then(res => {
      if (res.ok) return res.json();
    }).then(data => {
      if (data) templateNamesRef.current = data.map((t: any) => t.name);
    }).catch(() => {});
  }, [fetchWithAuth]);

  const [query, setQuery] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [isCompacting, setIsCompacting] = useState<boolean>(false);
  const toolCallHandlerRef = useRef<((name: string, args: any) => any) | null>(null);
  const iterationCountRef = useRef<number>(0);
  const maxIterations = 50;

  // Use refs to always get latest values (avoids stale closure issues)
  const sheetIdRef = useRef<string | null>(null);
  sheetIdRef.current = sheetId;
  const sheetNameRef = useRef<string | null>(null);
  sheetNameRef.current = sheetName;

  const sendMessageRef = useRef<((
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
  ) => Promise<void>) | null>(null);

  const handleMessageComplete = useCallback(async (message: string, toolCalls?: ToolCall[], responseId?: string) => {
    const convId = useConversationsStore.getState().activeConversationId;
    if (!convId) return;

    // Store response_id for subsequent requests
    if (responseId) {
      updateLastResponseId(convId, responseId);
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
        sendMessageRef.current(null, null, responseId, functionCallOutputs, selectedRange, sheetIdRef.current, sheetNameRef.current, undefined, undefined, workspaceId, templateNamesRef.current);
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
  }, [addMessage, updateLastResponseId]);

  const handleToolCall = useCallback((name: string, args: any) => {
    if (toolCallHandlerRef.current) {
      toolCallHandlerRef.current(name, args);
    }
  }, []);

  const handleRegisterToolHandler = useCallback((handler: (name: string, args: any) => any) => {
    toolCallHandlerRef.current = handler;
  }, []);

  const handleSheetsChanged = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/sheets?workspace_id=${workspaceId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.length > 0) {
        setSheets(data.map((sheet: any) => ({
          sheetId: sheet.id,
          fetchId: sheet.id,
          name: sheet.name || 'Untitled',
          createdAt: sheet.created_at || new Date().toISOString(),
        })));
      }
    } catch (err) {
      console.error('Error reloading sheets:', err);
    }
  }, [workspaceId, fetchWithAuth, setSheets]);

  const { streamingText, isStreaming, isToolCalling, sendMessage } = useChatStream(handleMessageComplete, handleToolCall, handleSheetsChanged);
  sendMessageRef.current = sendMessage;

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (!activeConversationId) return;

    // Reset iteration count for new conversation
    iterationCountRef.current = 0;

    const messageText = query.trim();
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    addMessage(activeConversationId, userMessage);
    setQuery('');

    // Check if we need to compact (25+ user messages since last compaction)
    const userMessageCount = chatMessages.filter(m => m.role === 'user').length + 1; // +1 for the message we just added
    const messagesSinceCompaction = userMessageCount - messageCountAtLastCompaction;
    let currentSummary = summary;
    let currentResponseId = lastResponseId;

    if (messagesSinceCompaction >= 25 && lastResponseId) {
      try {
        setIsCompacting(true);
        console.log('[compact] Triggering compaction at', messagesSinceCompaction, 'messages since last compaction');
        const response = await fetchWithAuth('/api/compact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previous_response_id: lastResponseId }),
        });

        if (response.ok) {
          const data = await response.json();
          setSummary(activeConversationId, data.summary, userMessageCount);
          currentSummary = data.summary;
          currentResponseId = null;
          console.log('[compact] Compaction complete, starting fresh chain with summary');
        }
      } catch (err) {
        console.error('[compact] Compaction failed, continuing with existing chain:', err);
      } finally {
        setIsCompacting(false);
      }
    }

    // Compute sheet data for LLM context
    const sheetData = getSheetContextForLLM(
      useSpreadsheetStore.getState().cellData,
      useSpreadsheetStore.getState().getDisplayValue
    );

    // Send message with appropriate context
    if (currentResponseId && sendMessageRef.current) {
      // Continue existing chain
      sendMessageRef.current(messageText, null, currentResponseId, undefined, selectedRange, sheetIdRef.current, sheetNameRef.current, undefined, sheetData, workspaceId, templateNamesRef.current);
    } else {
      // Start fresh chain (possibly with summary context)
      sendMessage(messageText, null, undefined, undefined, selectedRange, sheetIdRef.current, sheetNameRef.current, currentSummary, sheetData, workspaceId, templateNamesRef.current);
    }
  }, [query, selectedRange, sendMessage, activeConversationId, lastResponseId, addMessage, chatMessages, summary, setSummary, fetchWithAuth]);

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
              disabled={isStreaming || isToolCalling || isCompacting}
            />
            {chatMessages.length > 0 && (
              <ChatDisplay
                messages={chatMessages}
                streamingText={streamingText}
                isStreaming={isStreaming}
                isToolCalling={isToolCalling}
                isCompacting={isCompacting}
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

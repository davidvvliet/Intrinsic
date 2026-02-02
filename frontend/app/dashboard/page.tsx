"use client";

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import ChatDisplay from './components/ChatDisplay';
import SearchInput from './components/SearchInput';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import { useChatStream } from './hooks/useChatStream';
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
  const toolCallHandlerRef = useRef<((name: string, args: any) => void) | null>(null);

  const handleMessageComplete = useCallback((message: string) => {
    setChatMessages(prev => [...prev, { role: 'assistant', content: message }]);
  }, []);

  const handleToolCall = useCallback((name: string, args: any) => {
    if (toolCallHandlerRef.current) {
      toolCallHandlerRef.current(name, args);
    }
  }, []);

  const handleRegisterToolHandler = useCallback((handler: (name: string, args: any) => void) => {
    toolCallHandlerRef.current = handler;
  }, []);

  const { streamingText, isStreaming, isToolCalling, sendMessage } = useChatStream(handleMessageComplete, handleToolCall);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: query.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setQuery('');
    sendMessage(query.trim(), updatedMessages, accessToken ?? null);
  }, [query, chatMessages, sendMessage, accessToken]);

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
          <Spreadsheet onToolCall={handleRegisterToolHandler} />
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

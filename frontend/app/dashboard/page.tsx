"use client";

import React, { useState, useCallback } from 'react';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import ChatDisplay from './components/ChatDisplay';
import SearchInput from './components/SearchInput';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import { useChatStream } from './hooks/useChatStream';
import { ChatMessage } from './types/chat';
import styles from './page.module.css';

export default function Dashboard() {
  const columnMinimize = useColumnMinimize();
  const { accessToken } = useAccessToken();
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState<string>('');

  const handleMessageComplete = useCallback((message: string) => {
    setChatMessages(prev => [...prev, { role: 'assistant', content: message }]);
  }, []);

  const { streamingText, isStreaming, isToolCalling, sendMessage } = useChatStream(handleMessageComplete);

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
        ></div>
        <div className={styles.middleColumn}>
          <div className={styles.globeContainer}>
            <Globe size={650} color="#000000" speed={0.003} />
          </div>
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

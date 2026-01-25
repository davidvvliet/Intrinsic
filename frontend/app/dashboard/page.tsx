"use client";

import React, { useState } from 'react';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import ChatDisplay from './components/ChatDisplay';
import SearchInput from './components/SearchInput';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import styles from './page.module.css';

export default function Dashboard() {
  const columnMinimize = useColumnMinimize();
  
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isToolCalling, setIsToolCalling] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');

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
                onSearch={() => {}}
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

"use client";

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import DotGridLoader from './DotGridLoader';
import styles from './ChatDisplay.module.css';

interface ChatDisplayProps {
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  streamingText: string;
  isStreaming: boolean;
  isToolCalling: boolean;
  isCompacting?: boolean;
}

export default function ChatDisplay({
  messages,
  streamingText,
  isStreaming,
  isToolCalling,
  isCompacting
}: ChatDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      isNearBottom.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  // Render content with tool call markers styled separately
  const renderContent = (text: string) => {
    const parts = text.split(/(\|\|\|TOOL\|\|\|.*?\|\|\|\/TOOL\|\|\|)/);
    return parts.map((part, i) => {
      if (part.startsWith('|||TOOL|||')) {
        const content = part.replace('|||TOOL|||', '').replace('|||/TOOL|||', '');
        return <span key={i} className={styles.toolCallMessage}>{content}</span>;
      }
      if (!part) return null;
      return <ReactMarkdown key={i}>{part}</ReactMarkdown>;
    });
  };

  useEffect(() => {
    if (containerRef.current && isNearBottom.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingText, isStreaming, isToolCalling]);

  return (
    <div ref={containerRef} className={styles.chatContainer} onScroll={handleScroll}>
      {messages.map((message, index) => (
        <div 
          key={index} 
          data-message-index={index}
          className={message.role === 'user' ? styles.userMessage : styles.message}
        >
          <div className={styles.messageContent}>
            {message.role === 'assistant' ? (
              renderContent(message.content)
            ) : (
              message.content
            )}
          </div>
        </div>
      ))}
      {isCompacting && (
        <div data-streaming="true" className={styles.message}>
          <div className={styles.messageContent}>
            <span className={styles.loadingText}>Summarizing context...</span>
          </div>
        </div>
      )}
      {isStreaming && streamingText && (
        <div data-streaming="true" className={styles.message}>
          <div className={styles.messageContent}>
            {renderContent(streamingText)}
          </div>
        </div>
      )}
      {isStreaming && !streamingText.trim() && !isToolCalling && !isCompacting && (
        <div data-streaming="true" className={styles.message}>
          <div className={styles.messageContent}>
            <span className={styles.loadingText}>Planning next moves</span>
          </div>
        </div>
      )}
      {isToolCalling && (
        <div data-streaming="true" className={styles.message}>
          <div className={styles.messageContent}>
            <div className={styles.loadingContainer}>
              <DotGridLoader />
              <span className={styles.loadingText}>Editing...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
}

export default function ChatDisplay({
  messages,
  streamingText,
  isStreaming,
  isToolCalling
}: ChatDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-process markdown to make text after numbered patterns bold
  const processMarkdown = (text: string): string => {
    // Match patterns like "1) Text" or "1. Text" and make the text after bold
    return text.replace(/^(\d+[).])\s+(.+)$/gm, (match, number, text) => {
      return `${number} **${text}**`;
    });
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
      return <ReactMarkdown key={i}>{processMarkdown(part)}</ReactMarkdown>;
    });
  };

  // Auto-scroll to position newest message at top
  useEffect(() => {
    if (containerRef.current && (messages.length > 0 || isStreaming || isToolCalling)) {
      // Wait for DOM to update, then scroll
      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const messageElements = container.querySelectorAll('[data-message-index]');
          const lastMessageIndex = messages.length - 1;
          const lastMessageElement = container.querySelector(`[data-message-index="${lastMessageIndex}"]`) as HTMLElement;
          
          if (lastMessageElement) {
            container.scrollTop = lastMessageElement.offsetTop;
          } else if (isStreaming) {
            // If streaming, scroll to show streaming message
            const streamingElement = container.querySelector('[data-streaming="true"]') as HTMLElement;
            if (streamingElement) {
              container.scrollTop = streamingElement.offsetTop;
            }
          }
        }
      }, 0);
    }
  }, [messages, streamingText, isStreaming, isToolCalling]);

  return (
    <div ref={containerRef} className={styles.chatContainer}>
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
      {isStreaming && streamingText && (
        <div data-streaming="true" className={styles.message}>
          <div className={styles.messageContent}>
            {renderContent(streamingText)}
          </div>
        </div>
      )}
      {isStreaming && !streamingText.trim() && !isToolCalling && (
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
              <span className={styles.loadingText}>Searching...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import DotGridLoader from './DotGridLoader';
import styles from './ChatDisplay.module.css';

interface ChatDisplayProps {
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  streamingText: string;
  isStreaming: boolean;
  isToolCalling: boolean;
  isCompacting?: boolean;
  onCellRefClick?: (cellRef: string) => void;
}

// Matches: A1, B5:D10, $A$1, Sheet1!C1, "DCF Model"!B5:B20, Assumptions!C46
const CELL_REF_REGEX = /(?:(?:"([^"]+)"|([A-Za-z][A-Za-z0-9_]+))!)?(\$?[A-Z]{1,3}\$?\d{1,5})(?::(\$?[A-Z]{1,3}\$?\d{1,5}))?\b/g;

function CellRefText({ text, onCellRefClick }: { text: string; onCellRefClick?: (ref: string) => void }) {
  if (!onCellRefClick) return <>{text}</>;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  CELL_REF_REGEX.lastIndex = 0;

  while ((match = CELL_REF_REGEX.exec(text)) !== null) {
    const sheetName = match[1] || match[2] || null;
    const cellRef = match[3];
    const rangeEnd = match[4] || null;
    const fullMatch = match[0];

    const clean = cellRef.replace(/\$/g, '');
    const col = clean.replace(/\d+/g, '');
    const row = parseInt(clean.replace(/[A-Z]/g, ''));
    if (col.length > 2 || row > 1000 || row < 1) continue;

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const cleanEnd = rangeEnd?.replace(/\$/g, '');
    const cellPart = cleanEnd ? `${clean}:${cleanEnd}` : clean;
    const clickRef = sheetName ? `${sheetName}!${cellPart}` : cellPart;
    parts.push(
      <span
        key={match.index}
        className={styles.cellRef}
        onClick={() => onCellRefClick(clickRef)}
      >
        {fullMatch}
      </span>
    );
    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return <>{text}</>;
  return <>{parts}</>;
}

export default function ChatDisplay({
  messages,
  streamingText,
  isStreaming,
  isToolCalling,
  isCompacting,
  onCellRefClick
}: ChatDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      isNearBottom.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  // Custom ReactMarkdown components to intercept text and make cell refs clickable
  const markdownComponents = useCallback(() => ({
    p: ({ children, ...props }: any) => <p {...props}>{processChildren(children)}</p>,
    li: ({ children, ...props }: any) => <li {...props}>{processChildren(children)}</li>,
    strong: ({ children, ...props }: any) => <strong {...props}>{processChildren(children)}</strong>,
    em: ({ children, ...props }: any) => <em {...props}>{processChildren(children)}</em>,
    td: ({ children, ...props }: any) => <td {...props}>{processChildren(children)}</td>,
    th: ({ children, ...props }: any) => <th {...props}>{processChildren(children)}</th>,
  }), [onCellRefClick]);

  function processChildren(children: any): any {
    if (!children) return children;
    if (typeof children === 'string') {
      return <CellRefText text={children} onCellRefClick={onCellRefClick} />;
    }
    if (Array.isArray(children)) {
      return children.map((child, i) => {
        if (typeof child === 'string') {
          return <CellRefText key={i} text={child} onCellRefClick={onCellRefClick} />;
        }
        return child;
      });
    }
    return children;
  }

  // Render content with tool call markers styled separately
  const renderContent = (text: string) => {
    const parts = text.split(/(\|\|\|TOOL\|\|\|.*?\|\|\|\/TOOL\|\|\|)/);
    return parts.map((part, i) => {
      if (part.startsWith('|||TOOL|||')) {
        const content = part.replace('|||TOOL|||', '').replace('|||/TOOL|||', '');
        return <span key={i} className={styles.toolCallMessage}>{content}</span>;
      }
      if (!part) return null;
      return <ReactMarkdown key={i} components={markdownComponents()}>{part}</ReactMarkdown>;
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

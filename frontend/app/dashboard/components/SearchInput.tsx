"use client";

import { useRef, useEffect, useState } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: () => void;
  onCancel?: () => void;
  loading: boolean;
  placeholder?: string;
}

export default function SearchInput({
  query,
  setQuery,
  onSearch,
  onCancel,
  loading,
  placeholder = "Ask Intrinsic"
}: SearchInputProps) {
  const queryRef = useRef<HTMLTextAreaElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const autosize = () => {
    const el = queryRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  
  useEffect(() => { autosize(); }, [query]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSearch();
    }
  };

  const handleButtonClick = () => {
    if (loading && isHovered && onCancel) {
      onCancel();
    } else {
      onSearch();
    }
  };

  // Determine button className based on state
  const getButtonClassName = () => {
    if (!query.trim()) {
      return styles.buttonCircleEmpty;
    }
    if (loading) {
      return styles.buttonCircleLoading;
    }
    return styles.buttonCircle;
  };

  return (
    <div className={styles.searchInputContainer}>
      <div className={styles.textareaWrapper}>
        <textarea
          ref={queryRef}
          value={query}
          rows={1}
          onChange={(e) => { setQuery(e.target.value); autosize(); }}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className={styles.textarea}
          disabled={loading}
        />
        
        {/* Arrow circle button */}
        <button
          onClick={handleButtonClick}
          disabled={!loading && (!query.trim())}
          className={getButtonClassName()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {loading && isHovered ? (
            <svg 
              className={styles.icon}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#000000" 
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : loading ? (
            <div className={!query.trim() ? styles.spinnerGray : styles.spinner} />
          ) : (
            <svg 
              className={styles.icon}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke={!query.trim() ? '#999999' : '#000000'} 
              strokeWidth="2"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
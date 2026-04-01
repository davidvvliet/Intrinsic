"use client";

import { useState, useEffect, useCallback } from 'react';

const DEFAULT_RIGHT_WIDTH = 300;
const MIN_RIGHT_WIDTH = 250;
const MAX_RIGHT_WIDTH = 600;

interface UseColumnMinimizeReturn {
  leftMinimized: boolean;
  rightMinimized: boolean;
  rightWidth: number;
  toggleLeftColumn: () => void;
  toggleRightColumn: () => void;
  setRightWidth: (width: number) => void;
  getGridTemplateColumns: () => string;
}

export function useColumnMinimize(): UseColumnMinimizeReturn {
  const [leftMinimized, setLeftMinimized] = useState(true);
  const [rightMinimized, setRightMinimized] = useState(false);
  const [rightWidth, setRightWidthState] = useState(DEFAULT_RIGHT_WIDTH);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedLeft = localStorage.getItem('dashboard-left-minimized');
    const savedRight = localStorage.getItem('dashboard-right-minimized');
    const savedWidth = localStorage.getItem('dashboard-right-width');

    if (savedLeft !== null) {
      setLeftMinimized(savedLeft === 'true');
    }
    if (savedRight !== null) {
      setRightMinimized(savedRight === 'true');
    }
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_RIGHT_WIDTH && parsed <= MAX_RIGHT_WIDTH) {
        setRightWidthState(parsed);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-left-minimized', String(leftMinimized));
  }, [leftMinimized]);

  useEffect(() => {
    localStorage.setItem('dashboard-right-minimized', String(rightMinimized));
  }, [rightMinimized]);

  useEffect(() => {
    localStorage.setItem('dashboard-right-width', String(rightWidth));
  }, [rightWidth]);

  const toggleLeftColumn = useCallback(() => {
    setLeftMinimized(prev => !prev);
  }, []);

  const toggleRightColumn = useCallback(() => {
    setRightMinimized(prev => !prev);
  }, []);

  const setRightWidth = useCallback((width: number) => {
    const clamped = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, width));
    setRightWidthState(clamped);
  }, []);

  const getGridTemplateColumns = useCallback((): string => {
    const left = leftMinimized ? '0px' : '200px';
    const right = rightMinimized ? '0px' : `${rightWidth}px`;
    return `${left} 1fr ${right}`;
  }, [leftMinimized, rightMinimized, rightWidth]);

  return {
    leftMinimized,
    rightMinimized,
    rightWidth,
    toggleLeftColumn,
    toggleRightColumn,
    setRightWidth,
    getGridTemplateColumns,
  };
}

"use client";

import { useState, useEffect, useCallback } from 'react';

interface UseColumnMinimizeReturn {
  leftMinimized: boolean;
  rightMinimized: boolean;
  toggleLeftColumn: () => void;
  toggleRightColumn: () => void;
  getGridTemplateColumns: () => string;
}

export function useColumnMinimize(): UseColumnMinimizeReturn {
  const [leftMinimized, setLeftMinimized] = useState(true);
  const [rightMinimized, setRightMinimized] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedLeft = localStorage.getItem('dashboard-left-minimized');
    const savedRight = localStorage.getItem('dashboard-right-minimized');
    
    if (savedLeft !== null) {
      setLeftMinimized(savedLeft === 'true');
    }
    if (savedRight !== null) {
      setRightMinimized(savedRight === 'true');
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboard-left-minimized', String(leftMinimized));
  }, [leftMinimized]);

  useEffect(() => {
    localStorage.setItem('dashboard-right-minimized', String(rightMinimized));
  }, [rightMinimized]);

  const toggleLeftColumn = useCallback(() => {
    setLeftMinimized(prev => !prev);
  }, []);

  const toggleRightColumn = useCallback(() => {
    setRightMinimized(prev => !prev);
  }, []);

  const getGridTemplateColumns = useCallback((): string => {
    if (leftMinimized && rightMinimized) {
      return '0px 1fr 0px';
    } else if (leftMinimized) {
      return '0px 1fr 300px';
    } else if (rightMinimized) {
      return '200px 1fr 0px';
    } else {
      return '200px 1fr 300px';
    }
  }, [leftMinimized, rightMinimized]);

  return {
    leftMinimized,
    rightMinimized,
    toggleLeftColumn,
    toggleRightColumn,
    getGridTemplateColumns,
  };
}

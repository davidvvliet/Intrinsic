"use client";

import { createContext, useContext, useRef, type RefObject } from 'react';

type RefContextType = {
  inputRef: RefObject<HTMLInputElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
};

const RefContext = createContext<RefContextType | null>(null);

export function RefProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <RefContext.Provider value={{ inputRef, containerRef }}>
      {children}
    </RefContext.Provider>
  );
}

export function useRefContext() {
  const context = useContext(RefContext);
  if (!context) {
    throw new Error('useRefContext must be used within RefProvider');
  }
  return context;
}

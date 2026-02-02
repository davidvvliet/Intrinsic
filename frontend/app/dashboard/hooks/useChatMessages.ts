"use client";

import { useState, useEffect } from 'react';
import { ChatMessage } from '../types/chat';

const STORAGE_KEY = 'intrinsic_chat_messages';

export function useChatMessages(): [ChatMessage[], React.Dispatch<React.SetStateAction<ChatMessage[]>>] {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setChatMessages(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load chat messages from localStorage:', err);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatMessages));
    } catch (err) {
      console.error('Failed to save chat messages to localStorage:', err);
    }
  }, [chatMessages]);

  return [chatMessages, setChatMessages];
}

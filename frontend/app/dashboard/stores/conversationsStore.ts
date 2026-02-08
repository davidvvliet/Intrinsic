import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from '../types/chat';

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastResponseId: string | null;
  createdAt: number;
}

interface ConversationsState {
  conversations: Conversation[];
  activeConversationId: string | null;
}

interface ConversationsActions {
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setLastResponseId: (conversationId: string, responseId: string) => void;
  updateTitle: (conversationId: string, title: string) => void;
}

type ConversationsStore = ConversationsState & ConversationsActions;

const createDefaultConversation = (): Conversation => ({
  id: String(Date.now()),
  title: 'New Chat',
  messages: [],
  lastResponseId: null,
  createdAt: Date.now(),
});

export const useConversationsStore = create<ConversationsStore>()(
  persist(
    (set, get) => ({
      conversations: [createDefaultConversation()],
      activeConversationId: null,

      createConversation: () => {
        const newConversation = createDefaultConversation();
        set(state => ({
          conversations: [...state.conversations, newConversation],
          activeConversationId: newConversation.id,
        }));
        return newConversation.id;
      },

      deleteConversation: (id: string) => {
        const state = get();
        const filtered = state.conversations.filter(c => c.id !== id);

        if (filtered.length === 0) {
          const newConversation = createDefaultConversation();
          set({
            conversations: [newConversation],
            activeConversationId: newConversation.id,
          });
          return;
        }

        let newActiveId = state.activeConversationId;
        if (state.activeConversationId === id) {
          const deletedIndex = state.conversations.findIndex(c => c.id === id);
          if (deletedIndex < filtered.length) {
            newActiveId = filtered[deletedIndex].id;
          } else {
            newActiveId = filtered[filtered.length - 1].id;
          }
        }

        set({
          conversations: filtered,
          activeConversationId: newActiveId,
        });
      },

      setActiveConversation: (id: string) => {
        set({ activeConversationId: id });
      },

      addMessage: (conversationId: string, message: ChatMessage) => {
        set(state => {
          const conversations = state.conversations.map(conv => {
            if (conv.id !== conversationId) return conv;

            const updatedConv = {
              ...conv,
              messages: [...conv.messages, message],
            };

            // Auto-title on first user message
            if (conv.messages.length === 0 && message.role === 'user') {
              const title = message.content.slice(0, 25) + (message.content.length > 25 ? '...' : '');
              updatedConv.title = title;
            }

            return updatedConv;
          });

          return { conversations };
        });
      },

      setLastResponseId: (conversationId: string, responseId: string) => {
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, lastResponseId: responseId }
              : conv
          ),
        }));
      },

      updateTitle: (conversationId: string, title: string) => {
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? { ...conv, title }
              : conv
          ),
        }));
      },
    }),
{ name: 'intrinsic_conversations' }
  )
);

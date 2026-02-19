import { create } from 'zustand';
import { ChatMessage } from '../types/chat';

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  messages: ChatMessage[];
  lastResponseId: string | null;
  summary: string | null;
  messageCountAtLastCompaction: number;
  createdAt: string;
}

interface ConversationsState {
  workspaceId: string | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
}

interface ConversationsActions {
  setWorkspaceId: (workspaceId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setLoading: (loading: boolean) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  setLastResponseId: (conversationId: string, responseId: string) => void;
  clearLastResponseId: (conversationId: string) => void;
  setSummary: (conversationId: string, summary: string, messageCount: number) => void;
  updateTitle: (conversationId: string, title: string) => void;
  reset: () => void;
}

type ConversationsStore = ConversationsState & ConversationsActions;

const initialState: ConversationsState = {
  workspaceId: null,
  conversations: [],
  activeConversationId: null,
  loading: true,
};

export const useConversationsStore = create<ConversationsStore>()((set, get) => ({
  ...initialState,

  setWorkspaceId: (workspaceId: string) => {
    const state = get();
    if (state.workspaceId !== workspaceId) {
      set({
        workspaceId,
        conversations: [],
        activeConversationId: null,
        loading: true,
      });
    }
  },

  setConversations: (conversations: Conversation[]) => {
    set({
      conversations,
      activeConversationId: conversations[0]?.id || null,
      loading: false,
    });
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  addConversation: (conversation: Conversation) => {
    const state = get();
    if (state.conversations.length >= 8) return;
    set({
      conversations: [...state.conversations, conversation],
      activeConversationId: conversation.id,
    });
  },

  removeConversation: (id: string) => {
    const state = get();
    const filtered = state.conversations.filter(c => c.id !== id);

    let newActiveId = state.activeConversationId;
    if (state.activeConversationId === id) {
      const deletedIndex = state.conversations.findIndex(c => c.id === id);
      if (filtered.length === 0) {
        newActiveId = null;
      } else if (deletedIndex < filtered.length) {
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
        return {
          ...conv,
          messages: [...conv.messages, message],
        };
      });
      return { conversations };
    });
  },

  setMessages: (conversationId: string, messages: ChatMessage[]) => {
    set(state => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages }
          : conv
      ),
    }));
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

  clearLastResponseId: (conversationId: string) => {
    set(state => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, lastResponseId: null }
          : conv
      ),
    }));
  },

  setSummary: (conversationId: string, summary: string, messageCount: number) => {
    set(state => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, summary, messageCountAtLastCompaction: messageCount }
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

  reset: () => {
    set(initialState);
  },
}));

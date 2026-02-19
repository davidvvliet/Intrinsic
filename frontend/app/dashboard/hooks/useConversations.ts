import { useEffect, useCallback, useRef } from 'react';
import { useAuthFetch } from './useAuthFetch';
import { useConversationsStore, Conversation } from '../stores/conversationsStore';
import { ChatMessage } from '../types/chat';

export function useConversations(workspaceId: string) {
  const { fetchWithAuth } = useAuthFetch();
  const hasLoadedRef = useRef(false);

  const conversations = useConversationsStore(state => state.conversations);
  const loading = useConversationsStore(state => state.loading);
  const activeConversationId = useConversationsStore(state =>
    state.conversations.some(c => c.id === state.activeConversationId)
      ? state.activeConversationId
      : state.conversations[0]?.id ?? null
  );

  const setWorkspaceId = useConversationsStore(state => state.setWorkspaceId);
  const setConversations = useConversationsStore(state => state.setConversations);
  const setLoading = useConversationsStore(state => state.setLoading);
  const addConversationToStore = useConversationsStore(state => state.addConversation);
  const removeConversationFromStore = useConversationsStore(state => state.removeConversation);
  const setActiveConversation = useConversationsStore(state => state.setActiveConversation);
  const addMessageToStore = useConversationsStore(state => state.addMessage);
  const setLastResponseId = useConversationsStore(state => state.setLastResponseId);
  const clearLastResponseId = useConversationsStore(state => state.clearLastResponseId);
  const setSummaryInStore = useConversationsStore(state => state.setSummary);
  const updateTitleInStore = useConversationsStore(state => state.updateTitle);

  // Load conversations on mount
  useEffect(() => {
    const currentWorkspaceId = useConversationsStore.getState().workspaceId;
    if (currentWorkspaceId === workspaceId && hasLoadedRef.current) {
      return;
    }

    setWorkspaceId(workspaceId);
    hasLoadedRef.current = false;

    const loadConversations = async () => {
      try {
        const response = await fetchWithAuth(`/api/conversations?workspace_id=${workspaceId}`);
        if (!response.ok) {
          console.error('Failed to fetch conversations:', response.status);
          setConversations([]);
          return;
        }

        const data = await response.json();

        if (data.length > 0) {
          const conversationsWithMessages = await Promise.all(
            data.map(async (conv: any) => {
              const messagesRes = await fetchWithAuth(`/api/conversations/${conv.id}/messages`);
              const messages = messagesRes.ok ? await messagesRes.json() : [];
              return {
                id: conv.id,
                workspaceId: conv.workspace_id,
                title: conv.title,
                messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
                lastResponseId: conv.last_response_id,
                summary: conv.summary,
                messageCountAtLastCompaction: conv.message_count_at_last_compaction,
                createdAt: conv.created_at,
              };
            })
          );
          setConversations(conversationsWithMessages);
        } else {
          // No conversations - create one
          const createRes = await fetchWithAuth('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id: workspaceId, title: 'New Chat' }),
          });
          if (createRes.ok) {
            const newConv = await createRes.json();
            setConversations([{
              id: newConv.id,
              workspaceId: newConv.workspace_id,
              title: newConv.title,
              messages: [],
              lastResponseId: null,
              summary: null,
              messageCountAtLastCompaction: 0,
              createdAt: newConv.created_at,
            }]);
          } else {
            setConversations([]);
          }
        }
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading conversations:', err);
        setConversations([]);
      }
    };

    loadConversations();
  }, [workspaceId, fetchWithAuth, setWorkspaceId, setConversations]);

  const createConversation = useCallback(async (): Promise<Conversation | null> => {
    if (conversations.length >= 8) return null;
    try {
      const response = await fetchWithAuth('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, title: 'New Chat' }),
      });
      if (response.ok) {
        const newConv = await response.json();
        const conversation: Conversation = {
          id: newConv.id,
          workspaceId: newConv.workspace_id,
          title: newConv.title,
          messages: [],
          lastResponseId: null,
          summary: null,
          messageCountAtLastCompaction: 0,
          createdAt: newConv.created_at,
        };
        addConversationToStore(conversation);
        return conversation;
      } else {
        alert('Failed to create chat');
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
      alert('Failed to create chat');
    }
    return null;
  }, [workspaceId, conversations.length, fetchWithAuth, addConversationToStore]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const response = await fetchWithAuth(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        removeConversationFromStore(id);
        // If this was the last conversation, create a new one
        const remaining = useConversationsStore.getState().conversations;
        if (remaining.length === 0) {
          await createConversation();
        }
      } else {
        alert('Failed to delete chat');
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Failed to delete chat');
    }
  }, [fetchWithAuth, removeConversationFromStore, createConversation]);

  const addMessage = useCallback(async (conversationId: string, message: ChatMessage) => {
    // Add to store immediately for UI
    addMessageToStore(conversationId, message);

    // Auto-title on first user message
    const conv = useConversationsStore.getState().conversations.find(c => c.id === conversationId);
    if (conv && conv.messages.length === 1 && message.role === 'user') {
      const title = message.content.slice(0, 25) + (message.content.length > 25 ? '...' : '');
      updateTitleInStore(conversationId, title);
      // Update title in backend
      fetchWithAuth(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(err => console.error('Failed to update title:', err));
    }

    // Persist to backend
    try {
      const res = await fetchWithAuth(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: message.role, content: message.content }),
      });
      if (!res.ok) {
        alert('Failed to save message');
      }
    } catch (err) {
      console.error('Failed to save message:', err);
      alert('Failed to save message');
    }
  }, [fetchWithAuth, addMessageToStore, updateTitleInStore]);

  const updateLastResponseId = useCallback(async (conversationId: string, responseId: string) => {
    setLastResponseId(conversationId, responseId);
    try {
      const res = await fetchWithAuth(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_response_id: responseId }),
      });
      if (!res.ok) {
        console.error('Failed to sync conversation state');
      }
    } catch (err) {
      console.error('Failed to update last_response_id:', err);
    }
  }, [fetchWithAuth, setLastResponseId]);

  const setSummary = useCallback(async (conversationId: string, summary: string, messageCount: number) => {
    setSummaryInStore(conversationId, summary, messageCount);
    clearLastResponseId(conversationId);
    try {
      const res = await fetchWithAuth(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          message_count_at_last_compaction: messageCount,
          last_response_id: null,
        }),
      });
      if (!res.ok) {
        console.error('Failed to sync compaction state');
      }
    } catch (err) {
      console.error('Failed to update summary:', err);
    }
  }, [fetchWithAuth, setSummaryInStore, clearLastResponseId]);

  return {
    conversations,
    loading,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    addMessage,
    updateLastResponseId,
    clearLastResponseId,
    setSummary,
  };
}

'use client';

import { useCallback } from 'react';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export function useAuthFetch() {
  const { getAccessToken, loading } = useAccessToken();

  // Wait for auth to be ready and get token
  const waitForToken = useCallback(async (maxWaitMs = 5000): Promise<string | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const token = await getAccessToken();
      if (token) return token;

      // Wait 100ms before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null; // Timeout - real auth error
  }, [getAccessToken]);

  const fetchWithAuth = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await waitForToken();

    if (!token) {
      return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  }, [waitForToken]);

  return { fetchWithAuth, getAccessToken, loading };
}

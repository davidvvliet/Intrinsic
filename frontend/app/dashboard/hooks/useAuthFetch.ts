'use client';

import { useCallback } from 'react';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export function useAuthFetch() {
  const { getAccessToken } = useAccessToken();

  const fetchWithAuth = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await getAccessToken();

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
  }, [getAccessToken]);

  return { fetchWithAuth, getAccessToken };
}

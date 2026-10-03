import { useState, useEffect, useCallback } from 'react';
import type { QueueEntry } from '../client/types.gen';

export interface QueueLiveState {
  items: QueueEntry[];
  totalCount: number;
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook to manage a Server-Sent Events (SSE) connection to the clinician live queue.
 * Adheres strictly to backend QueueEntry contracts and authenticates via query token (?token=).
 */
export function useQueueLive(endpoint = '/api/clinician/queue/live') {
  const [state, setState] = useState<QueueLiveState>({
    items: [],
    totalCount: 0,
    isConnected: false,
    error: null,
  });

  const connect = useCallback(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('medikiosk_token') || 'dev-token'
        : 'dev-token';
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithAuth = token
      ? `${endpoint}${separator}token=${encodeURIComponent(token)}`
      : endpoint;

    const eventSource = new EventSource(urlWithAuth);

    eventSource.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'queue_state' && Array.isArray(data.entries)) {
          setState((prev) => ({
            ...prev,
            items: data.entries,
            totalCount:
              typeof data.total_count === 'number' ? data.total_count : data.entries.length,
          }));
        } else if (Array.isArray(data)) {
          setState((prev) => ({
            ...prev,
            items: data,
            totalCount: data.length,
          }));
        } else if (data && typeof data === 'object' && 'session_id' in data) {
          const singleEntry = data as QueueEntry;
          setState((prev) => ({
            ...prev,
            items: [...prev.items, singleEntry],
            totalCount: prev.totalCount + 1,
          }));
        }
      } catch (err) {
        console.error('Failed to parse SSE message data:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error : new Error('SSE connection encountered an error.'),
      }));
    };

    return eventSource;
  }, [endpoint]);

  useEffect(() => {
    const eventSource = connect();

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setState((prev) => ({ ...prev, isConnected: false }));
    };
  }, [connect]);

  return state;
}

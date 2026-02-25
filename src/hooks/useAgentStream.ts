import { useState, useCallback, useRef } from 'react';
import type { StreamState, ToolResult } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const initialState: StreamState = {
  status: 'idle',
  thought: '',
  steps: [],
  finalAnswer: '',
  downloads: [],
  error: null,
  taskId: null
};

export function useAgentStream() {
  const [state, setState] = useState<StreamState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeTask = useCallback(async (task: string) => {
    // 重置状态
    setState(initialState);
    setIsLoading(true);

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`${API_URL}/agent/execute-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent: string | null = null;

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine.startsWith('event:')) {
            currentEvent = trimmedLine.slice(6).trim();
          } else if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.slice(5).trim();

            try {
              const data = JSON.parse(dataStr);

              setState(prev => {
                const newState = { ...prev };

                switch (currentEvent) {
                  case 'init':
                    newState.taskId = data.taskId;
                    newState.status = 'planning';
                    break;

                  case 'thought':
                    newState.status = data.status as StreamState['status'];
                    newState.thought = data.message || '';
                    break;

                  case 'tool_start':
                    newState.status = 'executing';
                    newState.steps = [...prev.steps, {
                      id: data.callId,
                      tool: data.tool,
                      status: 'running'
                    }];
                    break;

                  case 'tool_result': {
                    const toolResult = data as ToolResult;
                    newState.steps = prev.steps.map(step =>
                      step.id === toolResult.callId
                        ? {
                            ...step,
                            status: toolResult.status,
                            result: toolResult.result,
                            error: toolResult.error
                          }
                        : step
                    );
                    break;
                  }

                  case 'final':
                    newState.status = 'completed';
                    newState.finalAnswer = data.answer || '';
                    newState.downloads = data.downloads || [];
                    break;

                  case 'error':
                    newState.status = 'error';
                    newState.error = data.message || 'Unknown error';
                    break;
                }

                return newState;
              });
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Execute task error:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelTask = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setState(prev => ({
      ...prev,
      status: 'idle'
    }));
  }, []);

  const resetState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(initialState);
    setIsLoading(false);
  }, []);

  return {
    state,
    isLoading,
    executeTask,
    cancelTask,
    resetState
  };
}

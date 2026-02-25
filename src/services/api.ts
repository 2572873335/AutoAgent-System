// API Service - Backend communication

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ==================== KIMI API ====================

export async function generateAgentWithKimi(taskDescription: string, agentType: string, requirements: string[] = []) {
  return fetchApi('/kimi/generate-agent', {
    method: 'POST',
    body: JSON.stringify({ taskDescription, agentType, requirements }),
  });
}

export async function decomposeTaskWithKimi(taskDescription: string) {
  return fetchApi('/kimi/decompose-task', {
    method: 'POST',
    body: JSON.stringify({ taskDescription }),
  });
}

export async function executeWithKimi(agentCode: string, subTaskDescription: string, input: unknown, context: unknown) {
  return fetchApi('/kimi/execute', {
    method: 'POST',
    body: JSON.stringify({ agentCode, subTaskDescription, input, context }),
  });
}

// ==================== CODE SANDBOX ====================

export async function executeInSandbox(code: string, timeout = 30000) {
  return fetchApi('/sandbox/execute', {
    method: 'POST',
    body: JSON.stringify({ code, timeout }),
  });
}

export async function getExecutionResult(executionId: string) {
  return fetchApi(`/sandbox/execution/${executionId}`);
}

// ==================== PDF ====================

export async function generatePDF(content: string, filename: string) {
  return fetchApi('/generate-pdf', {
    method: 'POST',
    body: JSON.stringify({ content, filename }),
  });
}

// ==================== AUTH ====================

export async function register(username: string, password: string, email: string) {
  const result = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email }),
  });
  
  if (result.token) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
  }
  
  return result;
}

export async function login(username: string, password: string) {
  const result = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  if (result.token) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
  }
  
  return result;
}

export async function getCurrentUser() {
  return fetchApi('/auth/me');
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}

// ==================== TASKS ====================

export async function createTask(description: string, subtasks: unknown[] = [], agents: unknown[] = []) {
  return fetchApi('/tasks', {
    method: 'POST',
    body: JSON.stringify({ description, subtasks, agents }),
  });
}

export async function getTasks() {
  return fetchApi('/tasks');
}

export async function getTask(id: string) {
  return fetchApi(`/tasks/${id}`);
}

export async function updateTask(id: string, updates: Record<string, unknown>) {
  return fetchApi(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string) {
  return fetchApi(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

// ==================== HEALTH ====================

export async function checkHealth() {
  return fetchApi('/health');
}

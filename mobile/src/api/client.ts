import { API_URL } from '../config/env';
import { sessionStorage } from './storage';

type ApiResponse<T> = {
  data: T;
  status: number;
};

type ApiErrorPayload = {
  response: {
    status: number;
    data: unknown;
  };
};

const TIMEOUT_MS = 10000;
let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

const normalizeUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
};

const parseResponseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = await sessionStorage.getToken();
    const hasToken = Boolean(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(normalizeUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await parseResponseBody(response);
    if (!response.ok) {
      if (response.status === 401 && hasToken) {
        await sessionStorage.clear();
        unauthorizedHandler?.();
      }
      const error = new Error(`Request failed with status code ${response.status}`) as Error & ApiErrorPayload;
      error.response = {
        status: response.status,
        data,
      };
      throw error;
    }

    return {
      data: data as T,
      status: response.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

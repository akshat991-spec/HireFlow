import { ApiResponse } from '../types/index.js';

export interface RequestOptions extends RequestInit {
  silent?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('hireflow_token') : null;
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json().catch(() => ({
        success: false,
        data: null as unknown as T,
        error: {
          code: 'INVALID_JSON',
          message: 'Received invalid response payload from server',
        },
      }));

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage) as Error & { code?: string; status?: number; details?: unknown };
        error.code = data.error?.code || 'HTTP_ERROR';
        error.status = response.status;
        error.details = data.error?.details;

        if (!options.silent && typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast(errorMessage, 'error');
        }

        throw error;
      }

      return data;
    } catch (error: any) {
      if (!error.status && !options.silent && typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('Network connection error', 'error');
      }
      throw error;
    }
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body: body as any });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body: body as any });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

const apiBaseUrl = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
export const api = new ApiClient(apiBaseUrl);

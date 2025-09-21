import {
  CORRELATION_HEADER,
  generateCorrelationId,
} from '@bassnotion/contracts';

export interface ApiClientOptions {
  correlationId?: string;
  headers?: Record<string, string>;
}

/**
 * Enhanced fetch client with correlation ID support
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = '') {
    this.baseUrl =
      baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & ApiClientOptions = {},
  ): Promise<T> {
    const { correlationId, headers: customHeaders, ...fetchOptions } = options;

    // Generate or use provided correlation ID
    const requestCorrelationId = correlationId || generateCorrelationId();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers: {
        ...this.defaultHeaders,
        ...customHeaders,
        [CORRELATION_HEADER]: requestCorrelationId,
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiClientOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiClientOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

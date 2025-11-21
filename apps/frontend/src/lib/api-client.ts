/**
 * API Client for making HTTP requests
 * Designed to work seamlessly with React Query
 */

import {
  CORRELATION_HEADER,
  generateCorrelationId,
  createStructuredLogger,
} from '@bassnotion/contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
}

interface RequestOptions extends RequestInit {
  correlationId?: string;
}

const logger = createStructuredLogger('ApiClient');

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  // Request deduplication cache: prevents duplicate simultaneous requests
  private pendingRequests = new Map<string, Promise<any>>();

  constructor(options: ApiClientOptions = {}) {
    this.baseURL =
      options.baseURL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3000';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Extract correlationId from options
    const { correlationId, ...requestOptions } = options;

    // Generate or use provided correlation ID
    const requestCorrelationId = correlationId || generateCorrelationId();

    // Create cache key for GET requests (only deduplicate read operations)
    const method = requestOptions.method || 'GET';
    const cacheKey = method === 'GET' ? `${method}:${url}` : null;

    // Check if identical GET request is already in flight
    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      logger.debug('Deduplicating request (reusing in-flight request)', {
        url,
        method,
        correlationId: requestCorrelationId,
      });
      return this.pendingRequests.get(cacheKey)!;
    }

    // For DELETE requests without a body, don't send Content-Type header
    const headers = { ...this.defaultHeaders };
    if (requestOptions.method === 'DELETE' && !requestOptions.body) {
      delete headers['Content-Type'];
    }

    const config: RequestInit = {
      ...requestOptions,
      headers: {
        ...headers,
        [CORRELATION_HEADER]: requestCorrelationId,
        ...requestOptions.headers,
      },
    };

    logger.debug('Making API request', {
      url,
      method: config.method || 'GET',
      hasAuth: !!config.headers?.['Authorization'],
      correlationId: requestCorrelationId,
    });

    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        const response = await fetch(url, config);

      logger.debug('Response received', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });

      // TODO: Review non-null assertion - consider null safety
      if (!response.ok) {
        let errorData: any = {};
        const contentType = response.headers.get('content-type');

        try {
          if (contentType?.includes('application/json')) {
            errorData = await response.json();
          } else {
            // If not JSON, get text content
            const textError = await response.text();
            errorData = { message: textError || response.statusText };
          }
        } catch (parseError) {
          errorData = { message: response.statusText };
        }

        // Use warn for client errors (4xx - validation, auth, etc), error for server errors (5xx)
        const logMethod = response.status >= 500 ? 'error' : 'warn';
        logger[logMethod]('API request failed', {
          url,
          status: response.status,
          statusText: response.statusText,
          contentType,
          error: errorData,
        });

        throw new ApiError(
          errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData,
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        logger.debug('JSON response data', {
          url,
          dataKeys: data ? Object.keys(data) : null,
          dataType: typeof data,
        });
        return data;
      }

        return response.text() as unknown as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        // Network or other errors
        throw new ApiError(
          error instanceof Error ? error.message : 'An unknown error occurred',
          0,
        );
      }
    })();

    // Cache the promise for GET requests
    if (cacheKey) {
      this.pendingRequests.set(cacheKey, fetchPromise);

      // Clean up after request completes (success or failure)
      fetchPromise.finally(() => {
        this.pendingRequests.delete(cacheKey);
      });
    }

    return fetchPromise;
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async head(endpoint: string, options?: RequestOptions): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;
    const { correlationId, ...requestOptions } = options || {};
    const requestCorrelationId = correlationId || generateCorrelationId();

    const config: RequestInit = {
      ...requestOptions,
      method: 'HEAD',
      headers: {
        ...this.defaultHeaders,
        [CORRELATION_HEADER]: requestCorrelationId,
        ...requestOptions?.headers,
      },
    };

    return fetch(url, config);
  }

  // Method to set authorization header
  setAuthToken(token: string) {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  // Method to remove authorization header
  clearAuthToken() {
    delete this.defaultHeaders.Authorization;
  }

  // Method to check if auth token is set
  hasAuthToken(): boolean {
    return !!this.defaultHeaders.Authorization;
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export the class for creating custom instances if needed
export { ApiClient };

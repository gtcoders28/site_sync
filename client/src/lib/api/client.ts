export interface ApiResult<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  metadata?: Record<string, unknown>;
}

interface ApiFailure {
  success: false;
  statusCode: number;
  errorCode?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly errorCode?: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; skipRefresh?: boolean };
const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

const parseBody = async <T>(response: Response): Promise<T> => {
  if ((response.headers.get('content-type') || '').includes('application/json')) return response.json() as Promise<T>;
  return {} as T;
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${baseUrl}/auth/refresh-token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'include',
    }).then(async (response) => {
      const result = await parseBody<ApiResult<{ accessToken: string }>>(response);
      if (!response.ok || !result.success || !result.data?.accessToken) throw new Error('Session refresh failed');
      accessToken = result.data.accessToken;
      return accessToken;
    }).catch(() => {
      accessToken = null;
      onSessionExpired?.();
      return null;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const request = async <T>(path: string, options: RequestOptions = {}, retried = false): Promise<ApiResult<T>> => {
  const { body, headers, skipRefresh = false, ...init } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include',
  });
  const result = await parseBody<ApiResult<T> | ApiFailure>(response);
  if (response.status === 401 && !skipRefresh && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
  }
  if (!response.ok || !result.success) {
    const error = result as ApiFailure;
    throw new ApiError(error.message || 'The request could not be completed.', response.status, error.errorCode, error.details);
  }
  return result as ApiResult<T>;
};

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  setAccessToken: (token: string | null) => { accessToken = token; },
  refreshAccessToken,
  setSessionExpiredHandler: (handler: (() => void) | null) => { onSessionExpired = handler; },
};

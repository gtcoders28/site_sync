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

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; skipRefresh?: boolean; params?: Record<string, unknown> };
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'sitesync_access_token';
const REFRESH_TOKEN_KEY = 'sitesync_refresh_token';

let accessToken: string | null = null;
try {
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
} catch {}

let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

const parseBody = async <T>(response: Response): Promise<T> => {
  if ((response.headers.get('content-type') || '').includes('application/json')) return response.json() as Promise<T>;
  return {} as T;
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    let storedRefresh: string | null = null;
    try {
      storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {}

    refreshPromise = fetch(`${baseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefresh || undefined }),
      credentials: 'include',
    }).then(async (response) => {
      const result = await parseBody<ApiResult<{ accessToken: string; refreshToken?: string }>>(response);
      if (!response.ok || !result.success || !result.data?.accessToken) throw new Error('Session refresh failed');
      accessToken = result.data.accessToken;
      try {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (result.data.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, result.data.refreshToken);
        }
      } catch {}
      return accessToken;
    }).catch(() => {
      accessToken = null;
      try {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {}
      onSessionExpired?.();
      return null;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const request = async <T>(path: string, options: RequestOptions = {}, retried = false): Promise<ApiResult<T>> => {
  const { body, headers, skipRefresh = false, params, ...init } = options;

  if (!accessToken) {
    try {
      accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {}
  }

  // If no accessToken available and this is a protected endpoint, attempt refresh first
  if (!accessToken && !path.startsWith('/auth/') && !skipRefresh && !retried) {
    let storedRefresh: string | null = null;
    try {
      storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {}
    if (storedRefresh) {
      await refreshAccessToken();
    }
  }

  let url = `${baseUrl}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') searchParams.append(k, String(v));
    });
    const qs = searchParams.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const response = await fetch(url, {
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
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  setAccessToken: (token: string | null) => {
    accessToken = token;
    try {
      if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    } catch {}
  },
  refreshAccessToken,
  setSessionExpiredHandler: (handler: (() => void) | null) => { onSessionExpired = handler; },
};

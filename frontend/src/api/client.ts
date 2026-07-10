import { API_BASE_URL } from './config';

// The auth store registers a getter here so every request can attach the token
// without the api layer depending on the store (avoids a circular import).
let tokenGetter: () => string | null = () => null;

export function setAuthTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

// The auth store registers a handler so an expired session can bounce the user
// to the login screen instead of surfacing a bare 401 on every screen.
let unauthorizedHandler: () => void = () => {};

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// A hung request should surface as an error, not a screen that spins forever.
// Uploads get longer: audio and photos travel over the agent's mobile uplink.
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Pass a FormData instance for multipart uploads (e.g. audio). */
  formData?: FormData;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData } = options;
  const timeoutMs = options.timeoutMs ?? (formData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: string | FormData | undefined;
  if (formData) {
    // Let fetch set the multipart boundary automatically.
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('The request took too long. Please try again.', 0);
    }
    throw new ApiError('Network error. Is the backend running?', 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  // A gateway timeout or cold-start page is HTML, not JSON. Parsing it blind
  // threw a raw SyntaxError that escaped every `catch (e: ApiError)` in the app.
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new ApiError('The server sent an unreadable response.', response.status);
      }
      // Fall through: `data` stays null and the status drives the message below.
    }
  }

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler();
    const message =
      (data && data.error) ||
      (response.status >= 500
        ? 'The server is having trouble. Please try again in a moment.'
        : `Request failed (${response.status})`);
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

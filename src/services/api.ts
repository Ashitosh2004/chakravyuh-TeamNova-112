/**
 * Central HTTP client for the (future) Zcode backend.
 * Endpoints are provisional contracts — see docs/API_CONTRACT.md.
 * Auth uses httpOnly cookies set by the backend (credentials: "include");
 * no tokens are ever stored in browser storage.
 */

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const isBackendConfigured = () => API_BASE_URL.length > 0;

export const ENDPOINTS = {
  auth: {
    register: "/api/v1/auth/register",
    login: "/api/v1/auth/login",
    logout: "/api/v1/auth/logout",
    forgot: "/api/v1/auth/forgot-password",
    me: "/api/v1/auth/me",
    refresh: "/api/v1/auth/refresh",
  },
  courses: "/api/v1/courses",
  ai: { chat: "/api/v1/ai/chat" },
  challenges: {
    list: "/api/v1/challenges",
    one: (id: string) => `/api/v1/challenges/${id}`,
    run: (id: string) => `/api/v1/challenges/${id}/run`,
    submit: (id: string) => `/api/v1/challenges/${id}/submit`,
  },
  quizzes: {
    list: "/api/v1/quizzes",
    one: (id: string) => `/api/v1/quizzes/${id}`,
    submit: (id: string) => `/api/v1/quizzes/${id}/submit`,
  },
  progress: { summary: "/api/v1/progress", activity: "/api/v1/progress/activity", activities: "/api/v1/activities" },
  achievements: "/api/v1/achievements",
  profile: "/api/v1/users/me",
  search: "/api/v1/search",
} as const;

export type ApiErrorKind = "not_configured" | "network" | "timeout" | "rate_limited" | "unauthorized" | "validation" | "not_found" | "server" | "aborted";

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number, public details?: unknown) {
    super(message);
  }
  get retryable() {
    return ["network", "timeout", "rate_limited", "server"].includes(this.kind);
  }
}

export function errorFromStatus(status: number, body: unknown): ApiError {
  const msg = typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : undefined;
  if (status === 401 || status === 403) return new ApiError("unauthorized", msg ?? "Your session has expired. Please sign in again.", status, body);
  if (status === 404) return new ApiError("not_found", msg ?? "The requested resource was not found.", status, body);
  if (status === 422 || status === 400) return new ApiError("validation", msg ?? "Some of the submitted information is invalid.", status, body);
  if (status === 429) return new ApiError("rate_limited", msg ?? "Too many requests. Please wait a moment and try again.", status, body);
  return new ApiError("server", msg ?? `The server responded with an error (${status}).`, status, body);
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = opts.baseUrl ?? API_BASE_URL;
  if (!base) throw new ApiError("not_configured", "The CHAKRAVYUH backend is not connected yet.");
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? 20_000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: unknown = undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
    if (!res.ok) {
      const err = errorFromStatus(res.status, data);
      if (err.kind === "unauthorized" && onUnauthorized && !path.startsWith("/api/v1/auth/login")) onUnauthorized();
      throw err;
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (timedOut) throw new ApiError("timeout", "The request took too long. Please try again.");
    if (opts.signal?.aborted) throw new ApiError("aborted", "Request cancelled.");
    throw new ApiError("network", "Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

// ---------- Typed contracts ----------
export interface User { id: string; email: string; displayName: string; level: "beginner" | "intermediate" | "advanced" }
export interface AuthResponse { user: User }
export interface ChatRequest {
  conversationId?: string;
  message: string;
  level: "beginner" | "intermediate" | "advanced";
  context?: { courseId?: string; lessonId?: string; simulationId?: string; challengeId?: string; code?: string; quizQuestionId?: string };
}
export interface ChatResponse { conversationId: string; messageId: string; content: string; suggestions?: { label: string; href: string }[] }

export const authApi = {
  login: (b: { email: string; password: string }) => apiRequest<AuthResponse>(ENDPOINTS.auth.login, { body: b }),
  register: (b: { displayName: string; email: string; password: string }) => apiRequest<AuthResponse>(ENDPOINTS.auth.register, { body: b }),
  logout: () => apiRequest<void>(ENDPOINTS.auth.logout, { method: "POST" }),
  forgot: (b: { email: string }) => apiRequest<{ message: string }>(ENDPOINTS.auth.forgot, { body: b }),
  me: () => apiRequest<AuthResponse>(ENDPOINTS.auth.me),
  refresh: () => apiRequest<AuthResponse>(ENDPOINTS.auth.refresh, { method: "POST" }),
};

export const aiApi = {
  chat: (b: ChatRequest, signal?: AbortSignal) => apiRequest<ChatResponse>(ENDPOINTS.ai.chat, { body: b, signal, timeoutMs: 60_000 }),
};

export const challengeApi = {
  submit: (id: string, code: string) => apiRequest<{ passed: number; total: number; score: number }>(ENDPOINTS.challenges.submit(id), { body: { code } }),
};

export const quizApi = {
  submit: (id: string, answers: unknown, timeTakenSec: number) => apiRequest<{ attemptId: string; score: number }>(ENDPOINTS.quizzes.submit(id), { body: { answers, timeTakenSec } }),
};

export const progressApi = {
  record: (event: unknown) => apiRequest<{ id: string }>(ENDPOINTS.progress.activities, { body: event }),
};

export const profileApi = {
  update: (b: Partial<User>) => apiRequest<User>(ENDPOINTS.profile, { method: "PATCH", body: b }),
};

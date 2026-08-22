export function apiErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return String(item);
        })
        .join("; ");
    }
  }
  return "Request failed";
}

/** Read response body once; non-JSON payloads become `{ detail: text }`. */
export async function readResponseBody(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { detail: text.trim() };
  }
}

export async function readResponseJson<T>(resp: Response): Promise<T> {
  const body = await readResponseBody(resp);
  if (body === null) {
    throw new Error(`Empty response (${resp.status})`);
  }
  return body as T;
}

export async function apiErrorFromResponse(resp: Response): Promise<string> {
  const body = await readResponseBody(resp);
  const message = apiErrorMessage(body);
  if (message !== "Request failed") return message;
  if (resp.status >= 500) {
    return "Backend API unavailable. Check that minikb API is running.";
  }
  return `Request failed (${resp.status})`;
}

let accessToken: string | null = null;

export type SessionUser = {
  sub: string;
  displayName: string;
  email?: string;
};

let sessionUser: SessionUser | null = null;

export function getSessionUser(): SessionUser | null {
  return sessionUser;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (!token) sessionUser = null;
}

export async function loadSessionToken(): Promise<boolean> {
  const resp = await fetch("/api/auth/session", { credentials: "include" });
  const data = (await resp.json()) as {
    authenticated?: boolean;
    accessToken?: string;
    sub?: string;
    displayName?: string;
    email?: string;
  };
  if (!data.authenticated || !data.accessToken) {
    setAccessToken(null);
    return false;
  }
  setAccessToken(data.accessToken);
  sessionUser = {
    sub: data.sub ?? "",
    displayName: data.displayName?.trim() || data.sub || "User",
    email: data.email,
  };
  return true;
}

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let resp = await fetch(path, { ...init, headers, credentials: "include" });
  if (resp.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      await loadSessionToken();
      const retryHeaders = new Headers(init.headers);
      if (accessToken) retryHeaders.set("Authorization", `Bearer ${accessToken}`);
      resp = await fetch(path, { ...init, headers: retryHeaders, credentials: "include" });
    }
  }
  return resp;
}

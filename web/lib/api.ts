export function apiErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return "Request failed";
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function loadSessionToken(): Promise<boolean> {
  const resp = await fetch("/api/auth/session", { credentials: "include" });
  const data = (await resp.json()) as { authenticated?: boolean; accessToken?: string };
  if (!data.authenticated || !data.accessToken) {
    setAccessToken(null);
    return false;
  }
  setAccessToken(data.accessToken);
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

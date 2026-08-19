function firstHeader(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function hostName(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end);
  }
  return host.split(":")[0] ?? host;
}

function isUnusableHost(host: string): boolean {
  const name = hostName(host);
  return name === "0.0.0.0" || name === "::" || name === "";
}

export function publicOrigin(input: {
  headers: Headers;
  url: string;
}): string {
  const forwardedHost = firstHeader(input.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeader(input.headers.get("host"));
  const proto =
    firstHeader(input.headers.get("x-forwarded-proto")) ||
    (process.env.NODE_ENV === "production" ? "https" : new URL(input.url).protocol.replace(":", ""));

  if (host && !isUnusableHost(host)) {
    return `${proto}://${host}`;
  }

  const configured = process.env.MINIKB_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  const fallback = new URL(input.url).origin;
  if (!isUnusableHost(new URL(fallback).host)) {
    return fallback;
  }

  return "https://kb.liuyidi.me";
}

export function publicUrl(input: { headers: Headers; url: string }, path: string): URL {
  return new URL(path, `${publicOrigin(input)}/`);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publicUrl } from "@/lib/origin";

const PUBLIC = [
  /^\/api\/health$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/session$/,
  /^\/api\/auth\/refresh$/,
  /^\/api\/auth\/logout$/,
  /^\/login\/callback$/,
];

export function middleware(request: NextRequest) {
  if (process.env.MINIKB_AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (!request.cookies.get("minikb_session")?.value) {
    return NextResponse.redirect(
      publicUrl(request, `/api/auth/login?next=${encodeURIComponent(pathname)}`),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

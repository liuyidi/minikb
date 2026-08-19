import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/origin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(publicUrl(request, "/"));
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}

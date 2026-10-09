import type { NextRequest } from "next/server";
import { updateSession } from "./lib/p0a/supabase-middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images|robots.txt|sitemap.xml).*)"] };

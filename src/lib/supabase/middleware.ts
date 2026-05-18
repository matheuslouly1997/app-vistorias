import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !key) {
    if (path === "/diagnostico") return NextResponse.next({ request });
    const u = request.nextUrl.clone();
    u.pathname = "/diagnostico";
    return NextResponse.redirect(u);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic =
    path === "/login" ||
    path === "/diagnostico" ||
    path.startsWith("/auth/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon");

  if (!user && !isPublic) {
    const u = request.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("redirect", path);
    return NextResponse.redirect(u);
  }
  if (user && path === "/login") {
    const u = request.nextUrl.clone();
    u.pathname = "/";
    return NextResponse.redirect(u);
  }
  return response;
}

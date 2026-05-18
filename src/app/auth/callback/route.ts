import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Usado por magic link / OAuth (nao essencial para email+senha, mas deixamos pronto).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=callback`);
}

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { exigirEnv, lerEnvStatus } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

let avisado = false;

export function createClient() {
  const { url, key } = exigirEnv();

  if (!avisado && process.env.NODE_ENV !== "production") {
    const s = lerEnvStatus();
    // eslint-disable-next-line no-console
    console.info(
      "[supabase] cliente server inicializado\n",
      `  URL dominio: ${s.urlDominio}\n`,
      `  Key formato: ${s.keyFormato}\n`,
      `  Key mascara: ${s.keyMascarada}`
    );
    avisado = true;
  }

  const cookieStore = cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components puros nao escrevem cookies; middleware atualiza antes.
        }
      }
    }
  });
}

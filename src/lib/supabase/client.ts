"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
import { exigirEnv, lerEnvStatus } from "@/lib/env";

let avisado = false;

export function createClient() {
  const { url, key } = exigirEnv();

  if (!avisado && process.env.NODE_ENV !== "production") {
    const s = lerEnvStatus();
    // eslint-disable-next-line no-console
    console.info(
      "[supabase] cliente browser inicializado\n",
      `  URL dominio: ${s.urlDominio}\n`,
      `  Key formato: ${s.keyFormato}\n`,
      `  Key mascara: ${s.keyMascarada}`
    );
    avisado = true;
  }

  return createBrowserClient<Database>(url, key);
}

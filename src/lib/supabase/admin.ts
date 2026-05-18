import "server-only";
import { createClient as createNativeClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Cliente Supabase com SERVICE_ROLE (server-only).
 * Use APENAS para operacoes administrativas:
 *   - admin.auth.admin.createUser
 *   - admin.auth.admin.deleteUser
 *   - admin.auth.admin.updateUserById (resetar senha, banir)
 *   - inserir/editar em perfis e perfis_obras quando precisar bypassar RLS
 *
 * NUNCA importar este modulo em codigo client. A diretiva `server-only`
 * acima derruba o build se algum componente client tentar importar.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente. Configure essa variavel APENAS no servidor (Vercel: aba Environment Variables, sem prefixo NEXT_PUBLIC_)."
    );
  }
  return createNativeClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

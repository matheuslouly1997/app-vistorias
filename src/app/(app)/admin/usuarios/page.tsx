import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UsuariosUI from "./usuarios-ui";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: caller } = await sb.from("perfis")
    .select("papel, ativo").eq("id", user.id).maybeSingle();
  const c = caller as any;
  if (!c || !c.ativo || c.papel !== "administrador") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm">
          <div className="font-medium text-amber-900">Acesso restrito</div>
          <p className="text-amber-800 mt-1">
            Esta tela é apenas para administradores globais. Seu papel atual é <code>{c?.papel ?? "(sem perfil)"}</code>.
          </p>
        </div>
      </div>
    );
  }

  // Busca dados via admin client (bypassa RLS e tem acesso a auth.users)
  const admin = createAdminClient();

  const { data: perfis } = await admin
    .from("perfis")
    .select("id, nome, email, papel, ativo, created_at, ultimo_login")
    .order("nome");

  const { data: vinculos } = await admin
    .from("perfis_obras")
    .select("perfil_id, obra_id, papel_obra");

  const { data: obras } = await admin
    .from("obras")
    .select("id, nome")
    .order("nome");

  // Lista paginada de usuarios em auth para pegar last_sign_in_at
  // (limite 1000 — suficiente pra equipe operacional)
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ultimoLoginMap = new Map<string, string | null>();
  for (const u of authList?.users ?? []) ultimoLoginMap.set(u.id, u.last_sign_in_at ?? null);

  const usuarios = (perfis ?? []).map((p: any) => ({
    ...p,
    ultimo_login: p.ultimo_login ?? ultimoLoginMap.get(p.id) ?? null
  }));

  return (
    <UsuariosUI
      meuUserId={user.id}
      usuarios={usuarios}
      vinculos={(vinculos ?? []) as any}
      obras={(obras ?? []) as any}
    />
  );
}

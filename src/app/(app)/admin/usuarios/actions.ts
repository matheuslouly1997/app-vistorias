"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Resp<T = {}> = { ok?: true; erro?: string } & T;

/** Garante que o caller esta autenticado e e administrador global. */
async function exigirAdminGlobal(): Promise<{ uid: string } | { erro: string }> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { erro: "Nao autenticado." };
  const { data: perfil } = await sb.from("perfis")
    .select("papel, ativo").eq("id", user.id).maybeSingle();
  const p = perfil as any;
  if (!p || !p.ativo || p.papel !== "administrador") {
    return { erro: "Apenas administradores globais podem gerenciar usuarios." };
  }
  return { uid: user.id };
}

/** Cria um novo usuario completo: auth.users + perfis + perfis_obras */
export async function criarUsuario(input: {
  nome: string;
  email: string;
  senha: string;
  papel: string;
  vinculos: { obra_id: string; papel_obra: string }[];
}): Promise<Resp<{ user_id?: string }>> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };

  if (!input.nome?.trim()) return { erro: "Informe o nome." };
  if (!input.email?.trim() || !input.email.includes("@")) return { erro: "Email invalido." };
  if (!input.senha || input.senha.length < 6) return { erro: "Senha deve ter pelo menos 6 caracteres." };
  if (!input.papel) return { erro: "Selecione o papel global." };

  const admin = createAdminClient();

  // 1) auth.users
  const { data: created, error: e1 } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.senha,
    email_confirm: true,
    user_metadata: { nome: input.nome.trim() }
  });
  if (e1 || !created?.user) return { erro: e1?.message ?? "Falha ao criar usuario." };
  const newId = created.user.id;

  // 2) perfis
  const { error: e2 } = await admin.from("perfis").insert({
    id: newId,
    nome: input.nome.trim(),
    email: input.email.trim(),
    papel: input.papel,
    ativo: true
  } as any);
  if (e2) {
    await admin.auth.admin.deleteUser(newId);
    return { erro: `Auth criado mas perfil falhou: ${e2.message}` };
  }

  // 3) perfis_obras
  if (input.vinculos.length > 0) {
    const rows = input.vinculos.map((v) => ({
      perfil_id: newId,
      obra_id: v.obra_id,
      papel_obra: v.papel_obra
    }));
    const { error: e3 } = await admin.from("perfis_obras").insert(rows as any);
    if (e3) return { erro: `Usuario criado mas vinculos falharam: ${e3.message}` };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, user_id: newId };
}

/** Edita nome, papel e ativo de um perfil. */
export async function editarUsuario(input: {
  id: string;
  nome?: string;
  papel?: string;
  ativo?: boolean;
}): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.nome != null) patch.nome = input.nome.trim();
  if (input.papel != null) patch.papel = input.papel;
  if (input.ativo != null) patch.ativo = input.ativo;
  if (Object.keys(patch).length === 0) return { erro: "Nada a alterar." };
  const { error } = await admin.from("perfis").update(patch).eq("id", input.id);
  if (error) return { erro: error.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Ativa/desativa um usuario (banimento via auth + flag em perfis). */
export async function definirAtivoUsuario(userId: string, ativo: boolean): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  const admin = createAdminClient();
  // ban_duration: "none" = sem ban; "876000h" (100 anos) = banido
  const banAttr = ativo ? "none" : "876000h";
  const { error: e1 } = await admin.auth.admin.updateUserById(userId, { ban_duration: banAttr } as any);
  if (e1) return { erro: e1.message };
  const { error: e2 } = await admin.from("perfis").update({ ativo }).eq("id", userId);
  if (e2) return { erro: e2.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Reseta a senha de um usuario para uma nova senha temporaria. */
export async function resetarSenhaUsuario(userId: string, novaSenha: string): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  if (!novaSenha || novaSenha.length < 6) return { erro: "Senha deve ter pelo menos 6 caracteres." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: novaSenha });
  if (error) return { erro: error.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Adiciona vinculo perfis_obras. */
export async function adicionarVinculoObra(userId: string, obraId: string, papelObra: string): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  const admin = createAdminClient();
  const { error } = await admin.from("perfis_obras")
    .upsert({ perfil_id: userId, obra_id: obraId, papel_obra: papelObra } as any, { onConflict: "perfil_id,obra_id" });
  if (error) return { erro: error.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Atualiza o papel de um vinculo existente. */
export async function atualizarPapelObra(userId: string, obraId: string, papelObra: string): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  const admin = createAdminClient();
  const { error } = await admin.from("perfis_obras")
    .update({ papel_obra: papelObra } as any)
    .eq("perfil_id", userId).eq("obra_id", obraId);
  if (error) return { erro: error.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Remove vinculo perfis_obras. */
export async function removerVinculoObra(userId: string, obraId: string): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  const admin = createAdminClient();
  const { error } = await admin.from("perfis_obras")
    .delete().eq("perfil_id", userId).eq("obra_id", obraId);
  if (error) return { erro: error.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Excluir usuario completamente (auth + perfis + perfis_obras cascade). */
export async function excluirUsuario(userId: string): Promise<Resp> {
  const auth = await exigirAdminGlobal();
  if ("erro" in auth) return { erro: auth.erro };
  if (auth.uid === userId) return { erro: "Voce nao pode excluir a propria conta." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { erro: error.message };
  // perfis e perfis_obras tem cascade no FK para auth.users
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarTorre(formData: FormData) {
  const supabase = createClient();
  const obra_id = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const qtd_pavimentos = Number(formData.get("qtd_pavimentos") ?? 0);
  const ordem = Number(formData.get("ordem") ?? 0);
  let layout_codigos: string[] = [];
  try { layout_codigos = JSON.parse(String(formData.get("layout_codigos") ?? "[]")); }
  catch { return { erro: "Layout de codigos invalido." }; }

  if (!obra_id || !nome) return { erro: "Dados incompletos." };
  if (qtd_pavimentos < 1) return { erro: "Pavimentos deve ser >= 1." };
  if (layout_codigos.length === 0) return { erro: "Informe ao menos um codigo de unidade." };

  const { error } = await supabase.from("torres").insert({
    obra_id, nome, qtd_pavimentos, layout_codigos, ordem
  });
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obra_id}/torres`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  return { ok: true };
}

/**
 * Edita uma torre.
 *
 * IMPORTANTE:
 *  - O UPDATE sempre inclui layout_codigos, o que dispara o trigger
 *    tr_torres_after_update -> gerar_unidades_da_torre. Isso ADICIONA
 *    unidades novas (crescimento) e RE-SINCRONIZA os identificadores
 *    (necessario quando o nome muda, pois o identificador embute o nome).
 *  - A regeneracao NUNCA apaga unidades. Ao reduzir pavimentos ou remover
 *    codigos, as unidades que ficam fora do novo layout viram "orfas".
 *    So removemos orfas SEM atividade; se alguma tiver atividade
 *    (status != em_obra, cliente, agenda ou termo), a operacao e bloqueada.
 */
export async function editarTorre(formData: FormData) {
  const supabase = createClient();
  const torre_id = String(formData.get("torre_id") ?? "");
  const obra_id = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const qtd_pavimentos = Number(formData.get("qtd_pavimentos") ?? 0);
  const ordem = Number(formData.get("ordem") ?? 0);
  let layout_codigos: string[] = [];
  try { layout_codigos = JSON.parse(String(formData.get("layout_codigos") ?? "[]")); }
  catch { return { erro: "Layout de codigos invalido." }; }

  if (!torre_id || !obra_id || !nome) return { erro: "Dados incompletos." };
  if (qtd_pavimentos < 1) return { erro: "Pavimentos deve ser >= 1." };
  if (layout_codigos.length === 0) return { erro: "Informe ao menos um codigo de unidade." };

  // Unidades que ficariam fora do novo layout (orfas)
  const { data: atuais } = await supabase
    .from("unidades")
    .select("id, identificador, status, cliente_atual_id, pavimento, codigo_unidade")
    .eq("torre_id", torre_id);
  const foraDoLayout = (atuais ?? []).filter(
    (u: any) => u.pavimento > qtd_pavimentos || !layout_codigos.includes(u.codigo_unidade)
  );

  let orfaIds: string[] = [];
  if (foraDoLayout.length > 0) {
    const comAtividade = foraDoLayout.filter(
      (u: any) => u.status !== "em_obra" || u.cliente_atual_id
    );
    if (comAtividade.length > 0) {
      return { erro: `Reducao apagaria ${comAtividade.length} unidade(s) que ja tem atividade (ex: ${comAtividade[0].identificador}). Ajuste o layout ou mantenha essas unidades.` };
    }
    orfaIds = foraDoLayout.map((u: any) => u.id);
    const [{ count: nAg }, { count: nTermo }] = await Promise.all([
      supabase.from("agenda").select("id", { count: "exact", head: true }).in("unidade_id", orfaIds),
      supabase.from("termos_unidade").select("id", { count: "exact", head: true }).in("unidade_id", orfaIds),
    ]);
    if ((nAg ?? 0) > 0 || (nTermo ?? 0) > 0) {
      return { erro: "Reducao apagaria unidades com agenda ou termo vinculado. Operacao bloqueada." };
    }
  }

  // layout_codigos sempre no SET -> dispara o trigger de regeneracao/re-sync
  const { error: errU } = await supabase
    .from("torres")
    .update({ nome, qtd_pavimentos, layout_codigos, ordem })
    .eq("id", torre_id);
  if (errU) return { erro: errU.message };

  if (orfaIds.length > 0) {
    await supabase.from("unidades").delete().in("id", orfaIds);
  }

  revalidatePath(`/obras/${obra_id}/torres`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  return { ok: true };
}

/**
 * Exclui uma torre. Bloqueia se houver atividade nas unidades
 * (status != em_obra, cliente vinculado, agenda ou termo), pois o
 * DELETE e CASCADE e apagaria unidades + agenda + historico + termos.
 */
export async function excluirTorre(torreId: string, obraId: string) {
  const supabase = createClient();

  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, identificador, status, cliente_atual_id")
    .eq("torre_id", torreId);
  const us = unidades ?? [];

  const comAtividade = us.filter(
    (u: any) => u.status !== "em_obra" || u.cliente_atual_id
  );
  if (comAtividade.length > 0) {
    return { erro: `Torre possui ${comAtividade.length} unidade(s) com atividade (ex: ${comAtividade[0].identificador}). Exclusao bloqueada.` };
  }

  const ids = us.map((u: any) => u.id);
  if (ids.length > 0) {
    const [{ count: nAg }, { count: nTermo }] = await Promise.all([
      supabase.from("agenda").select("id", { count: "exact", head: true }).in("unidade_id", ids),
      supabase.from("termos_unidade").select("id", { count: "exact", head: true }).in("unidade_id", ids),
    ]);
    if ((nAg ?? 0) > 0 || (nTermo ?? 0) > 0) {
      return { erro: "Torre possui agenda ou termos vinculados. Exclusao bloqueada." };
    }
  }

  const { error } = await supabase.from("torres").delete().eq("id", torreId);
  if (error) return { erro: error.message };

  revalidatePath(`/obras/${obraId}/torres`);
  revalidatePath(`/obras/${obraId}/mapa`);
  return { ok: true };
}

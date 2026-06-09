"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StatusUnidade } from "@/lib/types/database";

type Resp = { ok?: true; erro?: string };

async function agendaAtivaDaUnidade(supabase: ReturnType<typeof createClient>, unidadeId: string) {
  const { data } = await supabase.from("agenda")
    .select("id, tipo, data_agendada, status_agenda").eq("unidade_id", unidadeId)
    .eq("status_agenda", "agendada").order("data_agendada", { ascending: true }).limit(1);
  return data?.[0] ?? null;
}

async function mudarStatusSimples(unidadeId: string, de: StatusUnidade, para: StatusUnidade): Promise<Resp> {
  const supabase = createClient();
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== de) return { erro: `Esperado status '${de}', encontrado '${u.status}'.` };
  const { error } = await supabase.from("unidades").update({ status: para }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function marcarEmCorrecao(unidadeId: string): Promise<Resp> {
  return mudarStatusSimples(unidadeId, "em_obra", "em_correcao");
}
export async function voltarEmObra(unidadeId: string): Promise<Resp> {
  return mudarStatusSimples(unidadeId, "em_correcao", "em_obra");
}
export async function liberarParaVistoria(unidadeId: string): Promise<Resp> {
  const supabase = createClient();
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "em_obra" && u.status !== "em_correcao")
    return { erro: `Liberar so para unidades em obra. Status atual: ${u.status}.` };
  const { error } = await supabase.from("unidades").update({ status: "finalizada_obra" }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function marcarVistoria(input: {
  unidadeId: string; data_agendada: string; cliente_id?: string | null;
  duracao_min?: number; observacoes?: string | null;
}): Promise<Resp> {
  const supabase = createClient();
  const { unidadeId, data_agendada, cliente_id, duracao_min = 60, observacoes = null } = input;
  const { data: u } = await supabase.from("unidades").select("status, obra_id").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "finalizada_obra") return { erro: `Marcar vistoria so em finalizada_obra. Atual: ${u.status}.` };
  if (!data_agendada) return { erro: "Informe data e horario." };
  const { data: ag, error: errAg } = await supabase.from("agenda")
    .insert({ obra_id: u.obra_id, unidade_id: unidadeId, cliente_id: cliente_id ?? null,
      tipo: "vistoria_1a", data_agendada, duracao_min, observacoes } as any)
    .select("id").single();
  if (errAg) return { erro: errAg.message };
  const { error: errU } = await supabase.from("unidades")
    .update({ status: "agendado", cliente_atual_id: cliente_id ?? undefined }).eq("id", unidadeId);
  if (errU) { await supabase.from("agenda").delete().eq("id", ag.id); return { erro: errU.message }; }
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function aprovarUnidade(unidadeId: string): Promise<Resp> {
  const supabase = createClient();
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  let novo: StatusUnidade;
  if (u.status === "agendado") novo = "aprovada_1a";
  else if (u.status === "revistoria") novo = "aprovada_2a_mais";
  else return { erro: `Aprovar so em agendado ou revistoria. Atual: ${u.status}.` };
  const agenda = await agendaAtivaDaUnidade(supabase, unidadeId);
  if (agenda) await supabase.from("agenda").update({ status_agenda: "concluida", resultado: "aprovada" }).eq("id", agenda.id);
  const { error } = await supabase.from("unidades").update({ status: novo }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function reprovarUnidade(unidadeId: string): Promise<Resp> {
  const supabase = createClient();
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "agendado" && u.status !== "revistoria")
    return { erro: `Reprovar so em agendado ou revistoria. Atual: ${u.status}.` };
  const agenda = await agendaAtivaDaUnidade(supabase, unidadeId);
  if (agenda) await supabase.from("agenda").update({ status_agenda: "concluida", resultado: "reprovada" }).eq("id", agenda.id);
  const { error } = await supabase.from("unidades").update({ status: "reprovada" }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function reagendarUnidade(input: {
  unidadeId: string; data_agendada: string; duracao_min?: number; observacoes?: string | null;
}): Promise<Resp> {
  const supabase = createClient();
  const { unidadeId, data_agendada, duracao_min = 60, observacoes = null } = input;
  const { data: u } = await supabase.from("unidades").select("status, obra_id, cliente_atual_id").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "reprovada") return { erro: `Reagendar so em reprovada. Atual: ${u.status}.` };
  if (!data_agendada) return { erro: "Informe data e horario." };
  const { data: ag, error: errAg } = await supabase.from("agenda")
    .insert({ obra_id: u.obra_id, unidade_id: unidadeId, cliente_id: u.cliente_atual_id,
      tipo: "revistoria", data_agendada, duracao_min, observacoes } as any)
    .select("id").single();
  if (errAg) return { erro: errAg.message };
  const { error: errU } = await supabase.from("unidades").update({ status: "revistoria" }).eq("id", unidadeId);
  if (errU) { await supabase.from("agenda").delete().eq("id", ag.id); return { erro: errU.message }; }
  revalidatePath("/obras", "layout");
  return { ok: true };
}

// Novo fluxo pos-reprovacao
export async function enviarParaCorrecao(unidadeId: string): Promise<Resp> {
  return mudarStatusSimples(unidadeId, "reprovada", "em_correcao_pos_reprovacao");
}
export async function liberarParaRevistoria(unidadeId: string): Promise<Resp> {
  return mudarStatusSimples(unidadeId, "em_correcao_pos_reprovacao", "pronta_revistoria");
}
export async function agendarRevistoria(input: {
  unidadeId: string; data_agendada: string; duracao_min?: number; observacoes?: string | null;
}): Promise<Resp> {
  const supabase = createClient();
  const { unidadeId, data_agendada, duracao_min = 60, observacoes = null } = input;
  const { data: u } = await supabase.from("unidades").select("status, obra_id, cliente_atual_id").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "pronta_revistoria")
    return { erro: `Agendar revistoria so em pronta_revistoria. Atual: ${u.status}.` };
  if (!data_agendada) return { erro: "Informe data e horario." };
  const { data: ag, error: errAg } = await supabase.from("agenda")
    .insert({ obra_id: u.obra_id, unidade_id: unidadeId, cliente_id: u.cliente_atual_id,
      tipo: "revistoria", data_agendada, duracao_min,
      observacoes: observacoes ?? "Revistoria apos correcao pos-reprovacao" } as any)
    .select("id").single();
  if (errAg) return { erro: errAg.message };
  const { error: errU } = await supabase.from("unidades").update({ status: "revistoria" }).eq("id", unidadeId);
  if (errU) { await supabase.from("agenda").delete().eq("id", ag.id); return { erro: errU.message }; }
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function marcarEntregue(unidadeId: string): Promise<Resp> {
  const supabase = createClient();
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status !== "aprovada_1a" && u.status !== "aprovada_2a_mais")
    return { erro: `So entrega de unidades aprovadas. Atual: ${u.status}.` };
  const { error } = await supabase.from("unidades").update({ status: "entregue" }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function atualizarObservacoesUnidade(unidadeId: string, observacoes: string): Promise<Resp> {
  const supabase = createClient();
  const { error } = await supabase.from("unidades").update({ observacoes }).eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

/**
 * Reset operacional: cancela agendas em aberto e volta status para em_obra.
 * NAO desvincula o cliente da unidade. Vinculo contratual e preservado.
 */
export async function resetarUnidade(unidadeId: string, motivo?: string | null): Promise<Resp> {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)("resetar_operacional", {
    p_unidade_id: unidadeId,
    p_motivo: motivo ?? null,
  });
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

/**
 * Alteracao manual de etapa: bypassa state machine. Permitido para
 * corrigir erros operacionais. Quando e regressao, o front exige motivo.
 */
export async function alterarEtapaManualmente(
  unidadeId: string,
  novoStatus: StatusUnidade,
  motivo?: string | null
): Promise<Resp> {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)("alterar_status_manual", {
    p_unidade_id: unidadeId,
    p_novo_status: novoStatus,
    p_motivo: motivo ?? null,
  });
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

/**
 * Reverte unidade para um ponto especifico da timeline (qualquer evento,
 * nao apenas o ultimo). Volta para status_anterior daquele evento.
 */
export async function reverterParaEvento(
  unidadeId: string,
  historicoId: number,
  motivo?: string | null
): Promise<Resp & { para?: StatusUnidade }> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)("reverter_para_evento", {
    p_unidade_id: unidadeId,
    p_historico_id: historicoId,
    p_motivo: motivo ?? null,
  });
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true, para: data as StatusUnidade };
}

export async function desfazerUltimaAlteracao(unidadeId: string): Promise<Resp & { para?: StatusUnidade }> {
  const supabase = createClient();
  const { data: evento, error: errH } = await supabase
    .from("historico_status").select("status_anterior, status_novo, alterado_em")
    .eq("unidade_id", unidadeId).not("status_anterior", "is", null)
    .order("alterado_em", { ascending: false }).limit(1).maybeSingle();
  if (errH) return { erro: errH.message };
  if (!evento) return { erro: "Nao ha alteracao anterior para desfazer." };

  const alvo = evento.status_anterior as StatusUnidade;
  const { data: u } = await supabase.from("unidades").select("status").eq("id", unidadeId).maybeSingle();
  if (!u) return { erro: "Unidade nao encontrada" };
  if (u.status === alvo) return { erro: "Status atual ja e o do ultimo passo." };

  const { error: errU } = await supabase.from("unidades").update({ status: alvo }).eq("id", unidadeId);
  if (errU) return { erro: errU.message };

  if (alvo === "agendado" || alvo === "revistoria") {
    const { data: ag } = await supabase.from("agenda").select("id")
      .eq("unidade_id", unidadeId).eq("status_agenda", "concluida")
      .order("data_agendada", { ascending: false }).limit(1);
    if (ag?.[0]) await supabase.from("agenda").update({ status_agenda: "agendada", resultado: null }).eq("id", ag[0].id);
  }

  revalidatePath("/obras", "layout");
  return { ok: true, para: alvo };
}

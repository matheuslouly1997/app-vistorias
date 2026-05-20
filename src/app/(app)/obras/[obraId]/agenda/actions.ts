"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StatusUnidade } from "@/lib/types/database";

/**
 * Agenda uma vistoria.
 * Regras:
 *   tipo=vistoria_1a   -> unidade deve estar em finalizada_obra -> vira agendado
 *   tipo=revistoria    -> unidade deve estar em reprovada       -> vira revistoria
 *   tipo=vistoria_extra -> aceita qualquer status, NAO muda status (eventos avulsos)
 */
export async function agendarVistoria(formData: FormData) {
  const supabase = createClient();
  const obra_id = String(formData.get("obra_id") ?? "");
  const unidade_id = String(formData.get("unidade_id") ?? "");
  const cliente_id = String(formData.get("cliente_id") ?? "") || null;
  const tipo = String(formData.get("tipo") ?? "");
  const data_agendada = String(formData.get("data_agendada") ?? "");
  const duracao_min = Number(formData.get("duracao_min") ?? 60);
  const observacoes = String(formData.get("observacoes") ?? "") || null;
  if (!obra_id || !unidade_id || !tipo || !data_agendada)
    return { erro: "Dados incompletos." };

  // Le status atual
  const { data: u } = await supabase
    .from("unidades")
    .select("status, obra_id")
    .eq("id", unidade_id)
    .maybeSingle();
  if (!u || u.obra_id !== obra_id) return { erro: "Unidade nao encontrada nesta obra." };

  let novoStatus: StatusUnidade | null = null;
  if (tipo === "vistoria_1a") {
    if (u.status !== "finalizada_obra")
      return { erro: "1a vistoria so para unidades em finalizada_obra." };
    novoStatus = "agendado";
  } else if (tipo === "revistoria") {
    // Aceita reprovada (fluxo antigo) ou pronta_revistoria (fluxo novo pos-reprovacao)
    if (u.status !== "reprovada" && u.status !== "pronta_revistoria")
      return { erro: "Revistoria so para unidades reprovadas ou prontas para revistoria." };
    novoStatus = "revistoria";
  } else if (tipo !== "vistoria_extra") {
    return { erro: "Tipo invalido." };
  }

  // Cria agenda
  const { data: novaAgenda, error: errAg } = await supabase
    .from("agenda")
    .insert({
      obra_id, unidade_id, cliente_id, tipo,
      data_agendada, duracao_min, observacoes
    } as any)
    .select("id")
    .single();
  if (errAg) return { erro: errAg.message };

  // Atualiza status se aplicavel
  if (novoStatus) {
    const { error: errU } = await supabase
      .from("unidades")
      .update({ status: novoStatus, cliente_atual_id: cliente_id })
      .eq("id", unidade_id);
    if (errU) {
      // rollback manual da agenda
      await supabase.from("agenda").delete().eq("id", novaAgenda.id);
      return { erro: errU.message };
    }
  } else if (cliente_id) {
    // vistoria_extra: ao menos guarda o cliente atual se nao tinha
    await supabase.from("unidades").update({ cliente_atual_id: cliente_id }).eq("id", unidade_id);
  }

  revalidatePath(`/obras/${obra_id}/agenda`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  return { ok: true };
}

/** Conclui uma vistoria: marca agenda como concluida + atualiza status da unidade */
export async function concluirVistoria(agendaId: string, resultado: "aprovada" | "reprovada") {
  const supabase = createClient();
  const { data: ag } = await supabase
    .from("agenda")
    .select("id, obra_id, unidade_id, tipo, status_agenda")
    .eq("id", agendaId)
    .maybeSingle();
  if (!ag) return { erro: "Agenda nao encontrada." };
  if (ag.status_agenda !== "agendada") return { erro: "Agenda nao esta em aberto." };

  let novoStatus: StatusUnidade | null = null;
  if (ag.tipo === "vistoria_1a") {
    novoStatus = resultado === "aprovada" ? "aprovada_1a" : "reprovada";
  } else if (ag.tipo === "revistoria") {
    novoStatus = resultado === "aprovada" ? "aprovada_2a_mais" : "reprovada";
  }
  // vistoria_extra nao mexe no status

  const { error: errAg } = await supabase
    .from("agenda")
    .update({ status_agenda: "concluida", resultado })
    .eq("id", agendaId);
  if (errAg) return { erro: errAg.message };

  if (novoStatus) {
    const { error: errU } = await supabase
      .from("unidades")
      .update({ status: novoStatus })
      .eq("id", ag.unidade_id);
    if (errU) return { erro: errU.message };
  }

  revalidatePath(`/obras/${ag.obra_id}/agenda`);
  revalidatePath(`/obras/${ag.obra_id}/mapa`);
  return { ok: true };
}

/** Cancela uma agenda em aberto. Volta a unidade ao status anterior (best-effort via historico). */
export async function cancelarAgenda(agendaId: string) {
  const supabase = createClient();
  const { data: ag } = await supabase
    .from("agenda")
    .select("id, obra_id, unidade_id, tipo, status_agenda")
    .eq("id", agendaId)
    .maybeSingle();
  if (!ag) return { erro: "Agenda nao encontrada." };
  if (ag.status_agenda !== "agendada") return { erro: "Agenda nao esta em aberto." };

  // Reverte status
  let statusRevert: StatusUnidade | null = null;
  if (ag.tipo === "vistoria_1a") statusRevert = "finalizada_obra";
  else if (ag.tipo === "revistoria") {
    // Tenta reverter para o status anterior via historico
    const { data: hist } = await supabase
      .from("historico_status")
      .select("status_anterior")
      .eq("unidade_id", ag.unidade_id)
      .not("status_anterior", "is", null)
      .order("alterado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const anterior = hist?.status_anterior as string | null;
    // Se veio de pronta_revistoria, volta para la; senao volta para reprovada (fluxo antigo)
    statusRevert = (anterior === "pronta_revistoria" ? "pronta_revistoria" : "reprovada") as import("@/lib/types/database").StatusUnidade;
  }

  const { error: errAg } = await supabase
    .from("agenda")
    .update({ status_agenda: "cancelada" })
    .eq("id", agendaId);
  if (errAg) return { erro: errAg.message };

  if (statusRevert) {
    await supabase.from("unidades").update({ status: statusRevert }).eq("id", ag.unidade_id);
  }

  revalidatePath(`/obras/${ag.obra_id}/agenda`);
  revalidatePath(`/obras/${ag.obra_id}/mapa`);
  return { ok: true };
}

/** Editar horario de uma agenda em aberto. Nao muda nada alem da data/duracao. */
export async function editarHorarioAgenda(agendaId: string, novaDataIso: string, duracaoMin?: number) {
  const supabase = createClient();
  const { data: ag } = await supabase
    .from("agenda")
    .select("id, obra_id, status_agenda")
    .eq("id", agendaId)
    .maybeSingle();
  if (!ag) return { erro: "Agenda nao encontrada." };
  if (ag.status_agenda !== "agendada") return { erro: "So edita agenda em aberto." };
  if (!novaDataIso) return { erro: "Informe a nova data e hora." };

  const patch: Record<string, unknown> = { data_agendada: novaDataIso };
  if (typeof duracaoMin === "number" && duracaoMin > 0) patch.duracao_min = duracaoMin;

  const { error } = await supabase.from("agenda").update(patch).eq("id", agendaId);
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${ag.obra_id}/agenda`);
  revalidatePath(`/obras/${ag.obra_id}/mapa`);
  return { ok: true };
}

/** Trocar o cliente de uma agenda em aberto (e tambem cliente_atual da unidade). */
export async function trocarClienteAgenda(agendaId: string, novoClienteId: string | null) {
  const supabase = createClient();
  const { data: ag } = await supabase
    .from("agenda")
    .select("id, obra_id, unidade_id, status_agenda")
    .eq("id", agendaId)
    .maybeSingle();
  if (!ag) return { erro: "Agenda nao encontrada." };
  if (ag.status_agenda !== "agendada") return { erro: "So altera cliente de agenda em aberto." };

  const { error: errAg } = await supabase
    .from("agenda")
    .update({ cliente_id: novoClienteId })
    .eq("id", agendaId);
  if (errAg) return { erro: errAg.message };

  await supabase.from("unidades")
    .update({ cliente_atual_id: novoClienteId })
    .eq("id", ag.unidade_id);

  revalidatePath(`/obras/${ag.obra_id}/agenda`);
  revalidatePath(`/obras/${ag.obra_id}/mapa`);
  return { ok: true };
}

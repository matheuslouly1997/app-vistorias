import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ControleTermos, { type FilaTermo } from "./controle-termos";
import type { StatusUnidade } from "@/lib/types/database";

type RawTermo = {
  id: string; unidade_id: string; agenda_id: string | null;
  resultado: string; arquivo_path: string; anexado_em: string; data_assinatura: string | null;
};
type RawUnidade = { id: string; identificador: string; status: string; torre_id: string };
type RawTorre = { id: string; nome: string };
type RawAgenda = { id: string; unidade_id: string; data_agendada: string; status_agenda: string; resultado: string | null };
type RawHistorico = { unidade_id: string; status_novo: string; alterado_em: string };

export default async function TermosPage({ params }: { params: { obraId: string } }) {
  const { obraId } = params;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: obraRaw }, { data: unidadesRaw }, { data: torresRaw }] = await Promise.all([
    supabase.from("obras").select("id, nome").eq("id", obraId).maybeSingle(),
    supabase.from("unidades").select("id, identificador, status, torre_id").eq("obra_id", obraId).order("identificador") as any,
    supabase.from("torres").select("id, nome").eq("obra_id", obraId).order("nome") as any,
  ]);

  if (!obraRaw) notFound();

  const unidades = (unidadesRaw ?? []) as RawUnidade[];
  const torres = (torresRaw ?? []) as RawTorre[];
  const torreMap = new Map(torres.map((t) => [t.id, t.nome]));
  const unidadeIds = unidades.map((u) => u.id);

  if (unidadeIds.length === 0) {
    return <ControleTermos filas={[]} obraId={obraId} torres={[]} />;
  }

  const [{ data: termosRaw }, { data: agendasRaw }, { data: historicoRaw }] = await Promise.all([
    supabase
      .from("termos_unidade")
      .select("id, unidade_id, agenda_id, resultado, arquivo_path, anexado_em, data_assinatura")
      .in("unidade_id", unidadeIds)
      .order("anexado_em", { ascending: false }) as any,
    supabase
      .from("agenda")
      .select("id, unidade_id, data_agendada, status_agenda, resultado")
      .eq("obra_id", obraId)
      .order("data_agendada", { ascending: false }) as any,
    supabase
      .from("historico_status")
      .select("unidade_id, status_novo, alterado_em")
      .eq("obra_id", obraId)
      .in("status_novo", ["aprovada_1a", "aprovada_2a_mais"])
      .order("alterado_em", { ascending: false }) as any,
  ]);

  const termos = (termosRaw ?? []) as RawTermo[];
  const agendas = (agendasRaw ?? []) as RawAgenda[];
  const historico = (historicoRaw ?? []) as RawHistorico[];

  // Most recent term per unit
  const termoMap = new Map<string, RawTermo>();
  for (const t of termos) {
    if (!termoMap.has(t.unidade_id)) termoMap.set(t.unidade_id, t);
  }

  // Last concluded agenda per unit
  const ultimaAgendaMap = new Map<string, RawAgenda>();
  for (const a of agendas) {
    if (!ultimaAgendaMap.has(a.unidade_id) && a.status_agenda === "concluida") {
      ultimaAgendaMap.set(a.unidade_id, a);
    }
  }

  // All agendas by id for direct lookup via agenda_id
  const agendaById = new Map(agendas.map((a) => [a.id, a]));

  // Latest approval timestamp per unit
  const aprovacaoMap = new Map<string, string>();
  for (const h of historico) {
    if (!aprovacaoMap.has(h.unidade_id)) aprovacaoMap.set(h.unidade_id, h.alterado_em);
  }

  const filas: FilaTermo[] = unidades.map((u) => {
    const termo = termoMap.get(u.id) ?? null;

    const agendaVinculada = termo?.agenda_id ? agendaById.get(termo.agenda_id) ?? null : null;
    const agendaRef = agendaVinculada ?? ultimaAgendaMap.get(u.id) ?? null;

    const dataAssinatura = termo?.data_assinatura ?? null;
    const dataAgendamento = agendaRef?.data_agendada ?? null;

    const termoDateStr = dataAssinatura
      ? dataAssinatura.slice(0, 10)
      : termo?.anexado_em?.slice(0, 10) ?? null;
    const agendaDateStr = dataAgendamento?.slice(0, 10) ?? null;
    const divergente = !!(termoDateStr && agendaDateStr && termoDateStr !== agendaDateStr);

    const nomeArquivo = termo
      ? decodeURIComponent(termo.arquivo_path.split("/").pop() ?? termo.arquivo_path)
      : null;

    return {
      unidadeId: u.id,
      identificador: u.identificador,
      torreNome: torreMap.get(u.torre_id) ?? "",
      status: u.status as StatusUnidade,
      dataAgendamento,
      dataAprovacao: aprovacaoMap.get(u.id) ?? null,
      temTermo: !!termo,
      termoId: termo?.id ?? null,
      termoArquivoPath: termo?.arquivo_path ?? null,
      termoArquivoNome: nomeArquivo,
      termoDataAnexado: termo?.anexado_em ?? null,
      termoDataAssinatura: dataAssinatura,
      termoDivergente: divergente,
      agendaId: agendaRef?.id ?? null,
    };
  });

  return <ControleTermos filas={filas} obraId={obraId} torres={torres} />;
}

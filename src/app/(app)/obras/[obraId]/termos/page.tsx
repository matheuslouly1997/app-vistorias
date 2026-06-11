import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ControleTermos, { type FilaTermo } from "./controle-termos";
import type { StatusUnidade } from "@/lib/types/database";

type RawTermo = {
  id: string; unidade_id: string; agenda_id: string | null;
  resultado: string; arquivo_path: string; anexado_em: string;
  data_assinatura: string | null;
  data_agendamento_real: string | null;
};
type RawUnidade  = { id: string; identificador: string; status: string; torre_id: string };
type RawTorre    = { id: string; nome: string };
type RawAgenda   = { id: string; unidade_id: string; data_agendada: string; status_agenda: string; resultado: string | null };

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
  const torres   = (torresRaw  ?? []) as RawTorre[];
  const torreMap = new Map(torres.map((t) => [t.id, t.nome]));
  const unidadeIds = unidades.map((u) => u.id);

  if (unidadeIds.length === 0) {
    return <ControleTermos filas={[]} obraId={obraId} torres={[]} />;
  }

  const [{ data: termosRaw }, { data: agendasRaw }] = await Promise.all([
    supabase
      .from("termos_unidade")
      .select("id, unidade_id, agenda_id, resultado, arquivo_path, anexado_em, data_assinatura, data_agendamento_real")
      .in("unidade_id", unidadeIds)
      .order("anexado_em", { ascending: false }) as any,
    supabase
      .from("agenda")
      .select("id, unidade_id, data_agendada, status_agenda, resultado")
      .eq("obra_id", obraId)
      .order("data_agendada", { ascending: false }) as any,
  ]);

  const termos  = (termosRaw  ?? []) as RawTermo[];
  const agendas = (agendasRaw ?? []) as RawAgenda[];

  // Termo mais recente por unidade
  const termoMap = new Map<string, RawTermo>();
  for (const t of termos) {
    if (!termoMap.has(t.unidade_id)) termoMap.set(t.unidade_id, t);
  }

  // Última agenda concluída por unidade (referência para data de agendamento)
  const ultimaAgendaMap = new Map<string, RawAgenda>();
  for (const a of agendas) {
    if (!ultimaAgendaMap.has(a.unidade_id) && a.status_agenda === "concluida") {
      ultimaAgendaMap.set(a.unidade_id, a);
    }
  }
  const agendaById = new Map(agendas.map((a) => [a.id, a]));

  const filas: FilaTermo[] = unidades.map((u) => {
    const termo = termoMap.get(u.id) ?? null;

    const agendaVinculada = termo?.agenda_id ? agendaById.get(termo.agenda_id) ?? null : null;
    const agendaRef       = agendaVinculada ?? ultimaAgendaMap.get(u.id) ?? null;

    // Data de agendamento: override manual tem prioridade, senão usa agenda real
    const dataAgendamentoOriginal = agendaRef?.data_agendada ?? null;
    const dataAgendamentoReal     = termo?.data_agendamento_real ?? null;
    const dataAgendamentoEfetiva  = dataAgendamentoReal ?? dataAgendamentoOriginal;

    // Data de assinatura/aprovação: só o que o usuário preencheu (sem fallback)
    const dataAssinatura = termo?.data_assinatura ?? null;

    // Divergência: ambas precisam estar preenchidas e serem diferentes no dia
    const divergente = !!(
      dataAssinatura &&
      dataAgendamentoEfetiva &&
      dataAssinatura.slice(0, 10) !== dataAgendamentoEfetiva.slice(0, 10)
    );

    const nomeArquivo = termo
      ? decodeURIComponent(termo.arquivo_path.split("/").pop() ?? termo.arquivo_path)
      : null;

    return {
      unidadeId:               u.id,
      identificador:           u.identificador,
      torreNome:               torreMap.get(u.torre_id) ?? "",
      status:                  u.status as StatusUnidade,
      dataAgendamentoOriginal,
      dataAgendamentoReal,
      dataAssinatura,
      termoDivergente:         divergente,
      temTermo:                !!termo,
      termoId:                 termo?.id ?? null,
      termoArquivoPath:        termo?.arquivo_path ?? null,
      termoArquivoNome:        nomeArquivo,
      agendaId:                agendaRef?.id ?? null,
    };
  });

  return <ControleTermos filas={filas} obraId={obraId} torres={torres} />;
}

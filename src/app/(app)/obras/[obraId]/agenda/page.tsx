import { createClient } from "@/lib/supabase/server";
import AgendaCalendario from "./agenda-calendario";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();

  const [{ data: agenda }, { data: unidades }, { data: clientes }] = await Promise.all([
    supabase
      .from("agenda")
      .select(`
        id, tipo, data_agendada, duracao_min, status_agenda, resultado, observacoes,
        unidade_id, cliente_id, created_at
      `)
      .eq("obra_id", params.obraId)
      .order("data_agendada", { ascending: true }),
    supabase
      .from("unidades")
      .select("id, identificador, status")
      .eq("obra_id", params.obraId),
    supabase
      .from("clientes")
      .select("id, nome, telefone, email")
      .eq("obra_id", params.obraId)
      .order("nome")
  ]);

  const unidadesAgendaveis = (unidades ?? []).filter(
    (u) => u.status === "finalizada_obra" || u.status === "reprovada"
  );

  return (
    <AgendaCalendario
      obraId={params.obraId}
      agendaInicial={agenda ?? []}
      unidades={unidades ?? []}
      unidadesAgendaveis={unidadesAgendaveis}
      clientes={clientes ?? []}
    />
  );
}

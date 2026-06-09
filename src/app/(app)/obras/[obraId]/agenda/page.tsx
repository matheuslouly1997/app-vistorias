import { createClient } from "@/lib/supabase/server";
import { getPapelAtual, ehSomenteLeitura } from "@/lib/supabase/papel";
import AgendaCalendario from "./agenda-calendario";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();
  const papel = await getPapelAtual();
  const somenteLeitura = ehSomenteLeitura(papel);

  const [{ data: agenda }, { data: unidades }, { data: clientes }, { data: torres }] = await Promise.all([
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
      .select("id, identificador, status, torre_id")
      .eq("obra_id", params.obraId),
    supabase
      .from("clientes")
      .select("id, nome, telefone, email")
      .eq("obra_id", params.obraId)
      .order("nome"),
    supabase
      .from("torres")
      .select("id, nome")
      .eq("obra_id", params.obraId)
      .order("ordem")
  ]);

  const unidadesAgendaveis = (unidades ?? []).filter(
    (u) => u.status === "finalizada_obra" || u.status === "reprovada"
  );

  return (
    <AgendaCalendario
      somenteLeitura={somenteLeitura}
      obraId={params.obraId}
      agendaInicial={agenda ?? []}
      unidades={unidades ?? []}
      unidadesAgendaveis={unidadesAgendaveis}
      clientes={clientes ?? []}
      torres={torres ?? []}
    />
  );
}

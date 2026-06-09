import { createClient } from "@/lib/supabase/server";
import DashboardUI from "./dashboard-ui";
import DashboardRealtime from "./dashboard-realtime";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();

  const hoje = new Date();
  const inicioHoje = new Date(hoje); inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date(hoje); fimHoje.setHours(23, 59, 59, 999);

  const inicio8sem = new Date(inicioHoje);
  inicio8sem.setDate(inicio8sem.getDate() - 8 * 7);

  const [
    { data: central },
    { data: contagensStatus },
    { data: agendasHoje },
    { data: histHoje },
    { data: hist8sem }
  ] = await Promise.all([
    supabase.from("vw_central_aprovacao" as any).select("*").eq("obra_id", params.obraId).maybeSingle(),
    supabase.from("unidades").select("status").eq("obra_id", params.obraId),
    supabase.from("agenda").select("id, status_agenda, resultado, data_agendada")
      .eq("obra_id", params.obraId)
      .gte("data_agendada", inicioHoje.toISOString())
      .lte("data_agendada", fimHoje.toISOString()),
    supabase.from("historico_status").select("status_novo, alterado_em")
      .eq("obra_id", params.obraId)
      .gte("alterado_em", inicioHoje.toISOString())
      .lte("alterado_em", fimHoje.toISOString()),
    supabase.from("historico_status").select("status_novo, alterado_em")
      .eq("obra_id", params.obraId)
      .gte("alterado_em", inicio8sem.toISOString())
      .order("alterado_em", { ascending: true })
  ]);

  return (
    <>
      <DashboardRealtime obraId={params.obraId} />
      <DashboardUI
        central={(central ?? null) as any}
        contagensStatus={contagensStatus ?? []}
        agendasHoje={agendasHoje ?? []}
        historicoHoje={histHoje ?? []}
        historico8semanas={hist8sem ?? []}
      />
    </>
  );
}

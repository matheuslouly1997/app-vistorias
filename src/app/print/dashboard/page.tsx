import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrintDashboard({ searchParams }: { searchParams: { obraId?: string } }) {
  const obraId = searchParams.obraId;
  if (!obraId) return <div>obraId obrigatorio</div>;
  const supabase = createClient();
  const [{ data: obra }, { data: central }, { data: unidades }] = await Promise.all([
    supabase.from("obras").select("nome, status, data_inicio").eq("id", obraId).maybeSingle(),
    supabase.from("vw_central_aprovacao" as any).select("*").eq("obra_id", obraId).maybeSingle(),
    supabase.from("unidades").select("status").eq("obra_id", obraId)
  ]);
  if (!obra) return <div>Obra nao encontrada</div>;

  const k = (central ?? {}) as any;
  const total = unidades?.length ?? 0;
  const contagens: Record<string, number> = {};
  for (const u of unidades ?? []) contagens[u.status] = (contagens[u.status] ?? 0) + 1;
  const grupo = {
    em_obra: (contagens.em_obra ?? 0) + (contagens.em_correcao ?? 0),
    finalizada_obra: contagens.finalizada_obra ?? 0,
    agendadas: contagens.agendado ?? 0,
    aprovadas: (contagens.aprovada_1a ?? 0) + (contagens.aprovada_2a_mais ?? 0),
    reprovadas: contagens.reprovada ?? 0,
    reagendadas: contagens.revistoria ?? 0,
    entregues: contagens.entregue ?? 0
  };

  return (
    <div className="space-y-6">
      <header className="border-b pb-4">
        <div className="text-[10px] uppercase tracking-widest text-gray-500">Relatório operacional</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{obra.nome}</h1>
        <div className="text-xs text-gray-600 mt-1">
          Status da obra: {obra.status} · Início: {obra.data_inicio ?? "—"} · Gerado em {new Date().toLocaleString("pt-BR")}
        </div>
      </header>

      <section className="bg-gray-50 border rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-widest text-gray-500">KPI oficial — taxa de aprovação na 1ª vistoria</div>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="text-5xl font-semibold">{k.taxa_aprovacao_1a_oficial ?? 0}%</div>
          <div className="text-xs text-gray-600">histórico (de {k.total_1a_vistoriadas_hist ?? 0} 1ª executadas)</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs mt-3">
          <div><div className="text-gray-500">Aprovadas 1ª</div><div className="text-base font-medium">{k.aprovadas_1a_hist ?? 0}</div></div>
          <div><div className="text-gray-500">Reprovadas 1ª</div><div className="text-base font-medium">{k.reprovadas_1a_hist ?? 0}</div></div>
          <div><div className="text-gray-500">Total</div><div className="text-base font-medium">{(k.aprovadas_1a_hist ?? 0) + (k.reprovadas_1a_hist ?? 0)}</div></div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-2">Distribuição atual das unidades</h2>
        <div className="grid grid-cols-4 gap-2">
          <Kpi label="Total"           v={total} />
          <Kpi label="Em obra"         v={grupo.em_obra} />
          <Kpi label="Aguardando agend." v={grupo.finalizada_obra} />
          <Kpi label="Agendadas"       v={grupo.agendadas} />
          <Kpi label="Aprovadas"       v={grupo.aprovadas} />
          <Kpi label="Reprovadas"      v={grupo.reprovadas} />
          <Kpi label="Reagendadas"     v={grupo.reagendadas} />
          <Kpi label="Entregues"       v={grupo.entregues} />
        </div>
      </section>

      <footer className="text-[10px] text-gray-400 pt-6 border-t">
        App Vistorias — relatório operacional gerado em {new Date().toLocaleString("pt-BR")}.
      </footer>
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: number }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{v}</div>
    </div>
  );
}

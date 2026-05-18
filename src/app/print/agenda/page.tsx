import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LABEL_PERIODO: Record<string, string> = {
  hoje: "hoje", amanha: "amanhã", semana: "esta semana", proximos7: "próximos 7 dias", todos: "todos"
};

export default async function PrintAgenda({ searchParams }: { searchParams: { obraId?: string; periodo?: string } }) {
  const obraId = searchParams.obraId;
  const periodo = searchParams.periodo ?? "semana";
  if (!obraId) return <div>obraId obrigatorio</div>;
  const supabase = createClient();
  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).maybeSingle();
  if (!obra) return <div>Obra nao encontrada</div>;

  const { ini, fim } = rangePeriodo(periodo);
  let q = supabase.from("agenda")
    .select(`id, tipo, data_agendada, duracao_min, status_agenda, resultado, observacoes,
             unidade_id, cliente_id`)
    .eq("obra_id", obraId)
    .order("data_agendada", { ascending: true });
  if (ini) q = q.gte("data_agendada", ini.toISOString());
  if (fim) q = q.lte("data_agendada", fim.toISOString());
  const { data: agenda } = await q;

  const { data: unidades } = await supabase.from("unidades").select("id, identificador").eq("obra_id", obraId);
  const { data: clientes } = await supabase.from("clientes").select("id, nome, telefone").eq("obra_id", obraId);
  const uMap = new Map((unidades ?? []).map((u: any) => [u.id, u]));
  const cMap = new Map((clientes ?? []).map((c: any) => [c.id, c]));

  // agrupa por data
  const porData = new Map<string, any[]>();
  for (const a of agenda ?? []) {
    const k = new Date(a.data_agendada).toLocaleDateString("pt-BR");
    if (!porData.has(k)) porData.set(k, []);
    porData.get(k)!.push(a);
  }

  return (
    <div className="space-y-5">
      <header className="border-b pb-4">
        <div className="text-[10px] uppercase tracking-widest text-gray-500">Agenda de vistorias</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{obra.nome}</h1>
        <div className="text-xs text-gray-600 mt-1">
          Período: <b>{LABEL_PERIODO[periodo] ?? periodo}</b> · Total: <b>{agenda?.length ?? 0}</b> vistoria{(agenda?.length ?? 0) !== 1 ? "s" : ""} · Gerado em {new Date().toLocaleString("pt-BR")}
        </div>
      </header>

      {[...porData.entries()].map(([data, lista]) => (
        <section key={data} className="space-y-1.5 break-inside-avoid">
          <div className="text-sm font-semibold text-gray-700">{data}</div>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="text-left px-2 py-1 border">Horário</th>
                <th className="text-left px-2 py-1 border">Unidade</th>
                <th className="text-left px-2 py-1 border">Cliente</th>
                <th className="text-left px-2 py-1 border">Telefone</th>
                <th className="text-left px-2 py-1 border">Tipo</th>
                <th className="text-left px-2 py-1 border">Status</th>
                <th className="text-left px-2 py-1 border">Observações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a: any) => {
                const d = new Date(a.data_agendada);
                const c = a.cliente_id ? cMap.get(a.cliente_id) : null;
                return (
                  <tr key={a.id} className="even:bg-gray-50">
                    <td className="px-2 py-1 border">{d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</td>
                    <td className="px-2 py-1 border font-medium">{uMap.get(a.unidade_id)?.identificador ?? "?"}</td>
                    <td className="px-2 py-1 border">{c?.nome ?? "—"}</td>
                    <td className="px-2 py-1 border">{c?.telefone ?? ""}</td>
                    <td className="px-2 py-1 border">{a.tipo.replace("_"," ")}</td>
                    <td className="px-2 py-1 border">
                      {a.status_agenda === "concluida" ? (a.resultado ?? "concluida") : a.status_agenda}
                    </td>
                    <td className="px-2 py-1 border text-gray-600">{a.observacoes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {(agenda?.length ?? 0) === 0 && (
        <div className="text-sm text-gray-500 py-8 text-center border rounded">Nenhuma vistoria no período.</div>
      )}

      <footer className="text-[10px] text-gray-400 pt-6 border-t">
        App Vistorias — agenda gerada em {new Date().toLocaleString("pt-BR")}.
      </footer>
    </div>
  );
}

function rangePeriodo(periodo: string): { ini: Date | null; fim: Date | null } {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (periodo === "hoje") {
    const fim = new Date(hoje); fim.setHours(23,59,59,999);
    return { ini: hoje, fim };
  }
  if (periodo === "amanha") {
    const ini = new Date(hoje); ini.setDate(ini.getDate()+1);
    const fim = new Date(ini); fim.setHours(23,59,59,999);
    return { ini, fim };
  }
  if (periodo === "semana" || periodo === "proximos7") {
    const fim = new Date(hoje); fim.setDate(fim.getDate()+6); fim.setHours(23,59,59,999);
    return { ini: hoje, fim };
  }
  return { ini: null, fim: null };
}

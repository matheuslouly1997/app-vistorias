import { createClient } from "@/lib/supabase/server";
import { dbParaUI, STATUS_COLORS_UI, STATUS_LABELS_UI, STATUS_ORDER_UI } from "@/lib/constants/status";
import type { StatusUI } from "@/lib/constants/status";
import type { StatusUnidade } from "@/lib/types/database";
import { codigoUnidade } from "@/lib/format/unidade";

export const dynamic = "force-dynamic";

type Torre = {
  id: string;
  nome: string;
  qtd_pavimentos: number;
  layout_codigos: string[];
  ordem: number;
};

type Unidade = {
  id: string;
  torre_id: string;
  pavimento: number;
  codigo_unidade: string;
  identificador: string;
  status: StatusUnidade;
};

export default async function PrintMapa({
  searchParams,
}: {
  searchParams: { obraId?: string; torreId?: string; statuses?: string };
}) {
  const { obraId, torreId, statuses: statusesParam } = searchParams;
  if (!obraId) return <div>obraId obrigatório</div>;

  const supabase = createClient();
  const [{ data: obraRaw }, { data: torresRaw }, { data: unidadesRaw }] = await Promise.all([
    supabase.from("obras").select("nome, status").eq("id", obraId).maybeSingle(),
    supabase.from("torres" as any).select("id, nome, qtd_pavimentos, layout_codigos, ordem").eq("obra_id", obraId).order("ordem"),
    supabase.from("unidades").select("id, torre_id, pavimento, codigo_unidade, identificador, status").eq("obra_id", obraId),
  ]);

  const obra = obraRaw as { nome: string; status: string } | null;
  if (!obra) return <div>Obra não encontrada</div>;

  const allTorres: Torre[] = ((torresRaw as any[]) ?? []);
  const allUnidades: Unidade[] = ((unidadesRaw as any[]) ?? []);

  const torresVisiveis = torreId && torreId !== "todas"
    ? allTorres.filter((t) => t.id === torreId)
    : allTorres;

  const statusesFiltro: StatusUI[] = statusesParam
    ? (statusesParam.split(",").filter(Boolean) as StatusUI[])
    : [];
  const hasFilter = statusesFiltro.length > 0;

  // Lookup map: torre → pavimento → codigo_unidade → Unidade
  const porTorrePavCodigo = new Map<string, Map<number, Map<string, Unidade>>>();
  for (const u of allUnidades) {
    if (!porTorrePavCodigo.has(u.torre_id)) porTorrePavCodigo.set(u.torre_id, new Map());
    const t = porTorrePavCodigo.get(u.torre_id)!;
    if (!t.has(u.pavimento)) t.set(u.pavimento, new Map());
    t.get(u.pavimento)!.set(u.codigo_unidade, u);
  }

  const unidadesVisiveis = torresVisiveis.flatMap((t) =>
    allUnidades.filter((u) => u.torre_id === t.id)
  );
  const unidadesFiltradas = hasFilter
    ? unidadesVisiveis.filter((u) => statusesFiltro.includes(dbParaUI(u.status)))
    : unidadesVisiveis;

  const contagem: Record<string, number> = {};
  for (const u of unidadesFiltradas) {
    const ui = dbParaUI(u.status);
    contagem[ui] = (contagem[ui] ?? 0) + 1;
  }

  const torreFiltroNome = torreId && torreId !== "todas"
    ? allTorres.find((t) => t.id === torreId)?.nome
    : undefined;

  const filtroLabel = hasFilter
    ? statusesFiltro.map((s) => STATUS_LABELS_UI[s]).join(", ")
    : "Todos os status";

  return (
    <div className="space-y-5">
      <header className="border-b pb-3">
        <div className="text-[10px] uppercase tracking-widest text-gray-500">Mapa de Vistorias</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{obra.nome}</h1>
        <div className="text-xs text-gray-500 mt-1 space-x-2">
          <span>Torre: {torreFiltroNome ? `Torre ${torreFiltroNome}` : "Todas"}</span>
          <span>·</span>
          <span>Filtro: {filtroLabel}</span>
          <span>·</span>
          <span>Gerado em {new Date().toLocaleString("pt-BR")}</span>
        </div>
      </header>

      {/* Legenda */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_ORDER_UI.filter((s) => !hasFilter || statusesFiltro.includes(s)).map((s) => (
          <span
            key={s}
            className={`text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS_UI[s].chip}`}
          >
            {STATUS_LABELS_UI[s]}
            {contagem[s] != null && (
              <span className="opacity-70"> · {contagem[s]}</span>
            )}
          </span>
        ))}
        {hasFilter && (
          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
            Fora do filtro (cinza) · {unidadesVisiveis.length - unidadesFiltradas.length}
          </span>
        )}
      </div>

      {/* Grade por torre */}
      <div className="space-y-6">
        {torresVisiveis.map((torre) => {
          const pavs = Array.from({ length: torre.qtd_pavimentos }, (_, i) => torre.qtd_pavimentos - i);
          return (
            <section key={torre.id} className="border rounded-lg p-3 break-inside-avoid">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold">Torre {torre.nome}</h2>
                <span className="text-[10px] text-gray-400">
                  {torre.qtd_pavimentos} pav × {torre.layout_codigos.length} un = {torre.qtd_pavimentos * torre.layout_codigos.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-y-px"
                  style={{
                    gridTemplateColumns: `36px repeat(${torre.layout_codigos.length}, minmax(44px, 1fr))`,
                  }}
                >
                  <div />
                  {torre.layout_codigos.map((c) => (
                    <div key={c} className="text-[9px] font-semibold text-center text-gray-400 pb-0.5">
                      {c}
                    </div>
                  ))}
                  {pavs.map((pav) => (
                    <PrintRow
                      key={pav}
                      pavimento={pav}
                      layoutCodigos={torre.layout_codigos}
                      unidadesDoPav={porTorrePavCodigo.get(torre.id)?.get(pav)}
                      statusesFiltro={statusesFiltro}
                      hasFilter={hasFilter}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Tabela de unidades filtradas */}
      {hasFilter && unidadesFiltradas.length > 0 && (
        <section className="border-t pt-4">
          <h2 className="text-sm font-semibold mb-2">
            Unidades com filtro aplicado ({unidadesFiltradas.length})
          </h2>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-1 px-2 font-semibold">Unidade</th>
                <th className="text-left py-1 px-2 font-semibold">Torre</th>
                <th className="text-center py-1 px-2 font-semibold">Pav.</th>
                <th className="text-left py-1 px-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {unidadesFiltradas
                .sort((a, b) => a.identificador.localeCompare(b.identificador))
                .map((u) => {
                  const ui = dbParaUI(u.status);
                  const nomeT = allTorres.find((t) => t.id === u.torre_id)?.nome ?? "";
                  return (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="py-1 px-2 font-medium">{u.identificador}</td>
                      <td className="py-1 px-2">{nomeT}</td>
                      <td className="py-1 px-2 text-center">{u.pavimento}</td>
                      <td className="py-1 px-2">{STATUS_LABELS_UI[ui]}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="text-[9px] text-gray-400 pt-4 border-t">
        App Vistorias — Mapa de vistorias gerado em {new Date().toLocaleString("pt-BR")}.
      </footer>
    </div>
  );
}

function PrintRow({
  pavimento,
  layoutCodigos,
  unidadesDoPav,
  statusesFiltro,
  hasFilter,
}: {
  pavimento: number;
  layoutCodigos: string[];
  unidadesDoPav: Map<string, Unidade> | undefined;
  statusesFiltro: StatusUI[];
  hasFilter: boolean;
}) {
  return (
    <>
      <div className="text-[9px] font-medium text-gray-400 flex items-center justify-end pr-1.5">
        {String(pavimento).padStart(2, "0")}
      </div>
      {layoutCodigos.map((codigo) => {
        const u = unidadesDoPav?.get(codigo);
        if (!u) {
          return (
            <div
              key={codigo}
              className="m-px h-7 rounded bg-gray-100 border border-dashed border-gray-200"
            />
          );
        }
        const ui = dbParaUI(u.status);
        const isActive = !hasFilter || statusesFiltro.includes(ui);
        const c = STATUS_COLORS_UI[ui];
        return (
          <div
            key={codigo}
            className={`m-px h-7 rounded text-[9px] font-semibold flex items-center justify-center ${
              isActive ? `${c.bg} ${c.text}` : "bg-gray-100 text-gray-300"
            }`}
            title={`${u.identificador} — ${STATUS_LABELS_UI[ui]}`}
          >
            {codigoUnidade(u.identificador)}
          </div>
        );
      })}
    </>
  );
}

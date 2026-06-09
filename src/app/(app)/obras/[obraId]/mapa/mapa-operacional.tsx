"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STATUS_COLORS_UI, STATUS_LABELS_UI, STATUS_ORDER_UI, dbParaUI } from "@/lib/constants/status";
import type { StatusUnidade } from "@/lib/types/database";
import UnidadePainel from "./unidade-painel";
import { formatarUnidade, unidadeCompacta } from "@/lib/format/unidade";
import FiltroTorre from "@/components/filtro-torre";

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
  cliente_atual_id: string | null;
  observacoes?: string | null;
};
type ClienteMin = { id: string; nome: string; telefone: string | null; email: string | null };

export default function MapaOperacional({
  obraId,
  torres,
  unidadesIniciais,
  clientes: clientesIniciais,
  somenteLeitura = false,
}: {
  obraId: string;
  torres: Torre[];
  unidadesIniciais: Unidade[];
  clientes: ClienteMin[];
  somenteLeitura?: boolean;
}) {
  const [unidades, setUnidades] = useState<Unidade[]>(unidadesIniciais);
  const [clientes, setClientes] = useState<ClienteMin[]>(clientesIniciais);
  const [selecionada, setSelecionada] = useState<Unidade | null>(null);
  const [torreFiltro, setTorreFiltro] = useState<string>("todas");

  // Realtime: unidades — INSERT, UPDATE e DELETE
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`mapa_unidades_${obraId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "unidades", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const nova = payload.new as Unidade;
          setUnidades((prev) =>
            prev.some((u) => u.id === nova.id) ? prev : [...prev, nova]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "unidades", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const nova = payload.new as Unidade;
          setUnidades((prev) => prev.map((u) => (u.id === nova.id ? { ...u, ...nova } : u)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "unidades", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const id = (payload.old as Partial<Unidade>).id;
          if (id) {
            setUnidades((prev) => prev.filter((u) => u.id !== id));
            setSelecionada((sel) => (sel?.id === id ? null : sel));
          }
        }
      )
      .subscribe();

    // Realtime: clientes — INSERT e UPDATE (para o dropdown do painel)
    const chCli = supabase
      .channel(`mapa_clientes_${obraId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const novo = payload.new as ClienteMin;
          setClientes((prev) =>
            prev.some((c) => c.id === novo.id) ? prev : [...prev, novo]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const atualizado = payload.new as ClienteMin;
          setClientes((prev) =>
            prev.map((c) => (c.id === atualizado.id ? { ...c, ...atualizado } : c))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` },
        (payload) => {
          const id = (payload.old as Partial<ClienteMin>).id;
          if (id) setClientes((prev) => prev.filter((c) => c.id !== id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(chCli);
    };
  }, [obraId]);

  // Garante que ao selecionar uma unidade, ela reflita o ultimo estado
  const selecionadaAtual = selecionada
    ? unidades.find((u) => u.id === selecionada.id) ?? selecionada
    : null;

  // { torre_id -> { pavimento -> { codigo -> unidade } } }
  const porTorrePavCodigo = useMemo(() => {
    const m = new Map<string, Map<number, Map<string, Unidade>>>();
    for (const u of unidades) {
      if (!m.has(u.torre_id)) m.set(u.torre_id, new Map());
      const t = m.get(u.torre_id)!;
      if (!t.has(u.pavimento)) t.set(u.pavimento, new Map());
      t.get(u.pavimento)!.set(u.codigo_unidade, u);
    }
    return m;
  }, [unidades]);

  // Aplica filtro de torre nas torres renderizadas e na legenda.
  const torresVisiveis = useMemo(
    () => torreFiltro === "todas" ? torres : torres.filter((t) => t.id === torreFiltro),
    [torres, torreFiltro]
  );
  const unidadesVisiveis = useMemo(
    () => torreFiltro === "todas" ? unidades : unidades.filter((u) => u.torre_id === torreFiltro),
    [unidades, torreFiltro]
  );

  // Contagem por status UI (legenda) — respeita o filtro de torre.
  const contagem = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER_UI.map((s) => [s, 0])) as Record<string, number>;
    for (const u of unidadesVisiveis) c[dbParaUI(u.status)]++;
    return c;
  }, [unidadesVisiveis]);

  const torreSelecionada = selecionadaAtual
    ? torres.find((t) => t.id === selecionadaAtual.torre_id)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FiltroTorre torres={torres} valor={torreFiltro} onChange={setTorreFiltro} />
        <span className="text-xs text-gray-500">
          {unidadesVisiveis.length} unidade(s) · {torresVisiveis.length} torre(s)
        </span>
      </div>

      {/* Legenda — chips clean */}
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER_UI.map((s) => (
          <span
            key={s}
            className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLORS_UI[s].chip}`}
            title={STATUS_LABELS_UI[s]}
          >
            {STATUS_LABELS_UI[s]} <span className="opacity-70">· {contagem[s] ?? 0}</span>
          </span>
        ))}
      </div>

      {/* Torres */}
      <div className="grid gap-6">
        {torresVisiveis.map((t) => {
          const pavs = Array.from({ length: t.qtd_pavimentos }, (_, i) => t.qtd_pavimentos - i);
          return (
            <section key={t.id} className="bg-white border rounded-xl p-4 shadow-sm overflow-x-auto">
              <header className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold tracking-tight">Torre {t.nome}</h2>
                <span className="text-xs text-gray-500">
                  {t.qtd_pavimentos} pavs × {t.layout_codigos.length} unidades = {t.qtd_pavimentos * t.layout_codigos.length}
                </span>
              </header>
              <div className="inline-block min-w-full">
                <div
                  className="grid gap-y-0.5"
                  style={{ gridTemplateColumns: `50px repeat(${t.layout_codigos.length}, minmax(58px, 1fr))` }}
                >
                  <div></div>
                  {t.layout_codigos.map((c) => (
                    <div key={c} className="text-[11px] font-semibold text-center text-gray-400 pb-1">{c}</div>
                  ))}
                  {pavs.map((pav) => (
                    <RowPavimento
                      key={pav}
                      torre={t}
                      pavimento={pav}
                      unidadesDoPav={porTorrePavCodigo.get(t.id)?.get(pav)}
                      onClick={(u) => setSelecionada(u)}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {selecionadaAtual && (
        <UnidadePainel
          unidade={selecionadaAtual}
          torreNome={torreSelecionada?.nome}
          obraId={obraId}
          clientes={clientes}
          somenteLeitura={somenteLeitura}
          onClose={() => setSelecionada(null)}
          onChanged={(novo) =>
            setUnidades((prev) => prev.map((u) => (u.id === novo.id ? novo : u)))
          }
        />
      )}
    </div>
  );
}

function RowPavimento({
  torre, pavimento, unidadesDoPav, onClick
}: {
  torre: Torre;
  pavimento: number;
  unidadesDoPav: Map<string, Unidade> | undefined;
  onClick: (u: Unidade) => void;
}) {
  return (
    <>
      <div className="text-xs font-medium text-gray-500 flex items-center justify-end pr-2">
        {String(pavimento).padStart(2, "0")}
      </div>
      {torre.layout_codigos.map((codigo) => {
        const u = unidadesDoPav?.get(codigo);
        if (!u) {
          return <div key={codigo} className="m-0.5 h-9 rounded bg-gray-100 border border-dashed border-gray-300" />;
        }
        const ui = dbParaUI(u.status);
        const c = STATUS_COLORS_UI[ui];
        return (
          <button
            key={codigo}
            type="button"
            onClick={() => onClick(u)}
            className={`m-0.5 h-9 rounded text-[11px] font-semibold flex items-center justify-center transition active:scale-95 hover:brightness-110 hover:ring-2 ring-offset-1 ${c.bg} ${c.text} ${c.ring}`}
            title={`${formatarUnidade(u.identificador)} — ${STATUS_LABELS_UI[ui]}`}
          >
            {unidadeCompacta(u.identificador)}
          </button>
        );
      })}
    </>
  );
}

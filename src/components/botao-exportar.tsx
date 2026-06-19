"use client";
import { useState, useTransition, useEffect } from "react";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";

type Formato = "excel" | "pdf";
type Tipo = "agenda" | "clientes" | "unidades" | "kpi" | "dashboard" | "termos" | "mapa";
type Periodo = "hoje" | "amanha" | "semana" | "proximos7" | "todos";
type StatusUI = "em_obra" | "finalizada_obra" | "agendada" | "aprovada" | "reprovada" | "reagendada" | "entregue" | "em_correcao_pos_reprovacao" | "pronta_revistoria";

const STATUS_MAPA_OPCOES: { value: StatusUI; label: string }[] = [
  { value: "aprovada",                   label: "Aprovada" },
  { value: "reprovada",                  label: "Reprovada" },
  { value: "finalizada_obra",            label: "Finalizada (obra)" },
  { value: "em_correcao_pos_reprovacao", label: "Em correção pós-reprovação" },
  { value: "pronta_revistoria",          label: "Pronta para revistoria" },
  { value: "em_obra",                    label: "Em obra" },
  { value: "agendada",                   label: "Agendada" },
  { value: "reagendada",                 label: "Revistoria" },
  { value: "entregue",                   label: "Entregue" },
];

const TODOS_STATUSES = STATUS_MAPA_OPCOES.map((o) => o.value);

const COMBOS: { formato: Formato; tipo: Tipo; label: string; precisaPeriodo?: boolean; precisaMapa?: boolean }[] = [
  { formato: "pdf",   tipo: "dashboard", label: "PDF — Dashboard / KPIs" },
  { formato: "pdf",   tipo: "agenda",    label: "PDF — Agenda",            precisaPeriodo: true },
  { formato: "pdf",   tipo: "mapa",      label: "PDF — Mapa (por torre)",  precisaMapa: true },
  { formato: "excel", tipo: "agenda",    label: "Excel — Agenda",           precisaPeriodo: true },
  { formato: "excel", tipo: "clientes",  label: "Excel — Clientes" },
  { formato: "excel", tipo: "unidades",  label: "Excel — Unidades" },
  { formato: "excel", tipo: "kpi",       label: "Excel — KPIs" },
  { formato: "excel", tipo: "termos",    label: "Excel — Controle de Termos" }
];

type TorreMin = { id: string; nome: string };

export default function BotaoExportar({ obraId }: { obraId: string }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [combo, setCombo] = useState(0);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [pending, start] = useTransition();

  const [torres, setTorres] = useState<TorreMin[]>([]);
  const [carregandoTorres, setCarregandoTorres] = useState(false);
  const [torreId, setTorreId] = useState<string>("todas");
  const [statusesSelecionados, setStatusesSelecionados] = useState<Set<StatusUI>>(new Set(TODOS_STATUSES));

  useEffect(() => {
    if (COMBOS[combo]?.precisaMapa && torres.length === 0 && !carregandoTorres) {
      setCarregandoTorres(true);
      createClient()
        .from("torres")
        .select("id, nome")
        .eq("obra_id", obraId)
        .order("ordem")
        .then(({ data }) => {
          setTorres(data ?? []);
          setCarregandoTorres(false);
        });
    }
  }, [combo, obraId, torres.length, carregandoTorres]);

  function toggleStatus(s: StatusUI) {
    setStatusesSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function toggleTodos() {
    setStatusesSelecionados((prev) =>
      prev.size === TODOS_STATUSES.length ? new Set() : new Set(TODOS_STATUSES)
    );
  }

  function baixar() {
    const c = COMBOS[combo];
    let url: string;

    if (c.tipo === "mapa") {
      const allSelected = statusesSelecionados.size === TODOS_STATUSES.length;
      const statusesParam = allSelected ? "" : Array.from(statusesSelecionados).join(",");
      url = `/api/export/mapa-pdf?obraId=${obraId}`;
      if (torreId !== "todas") url += `&torreId=${torreId}`;
      if (statusesParam) url += `&statuses=${encodeURIComponent(statusesParam)}`;
    } else {
      url = c.formato === "excel"
        ? `/api/export/excel?tipo=${c.tipo}&obraId=${obraId}${c.precisaPeriodo ? `&periodo=${periodo}` : ""}`
        : `/api/export/pdf?tipo=${c.tipo}&obraId=${obraId}${c.precisaPeriodo ? `&periodo=${periodo}` : ""}`;
    }

    start(async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          const txt = await resp.text();
          toast.erro(`Falha ao gerar relatório: ${resp.status} — ${txt.slice(0, 200)}`);
          return;
        }
        const blob = await resp.blob();
        const cd = resp.headers.get("Content-Disposition") || "";
        const m = cd.match(/filename="([^"]+)"/);
        const fname = m?.[1] ?? `export.${c.formato === "excel" ? "xlsx" : "pdf"}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
        toast.sucesso(`${fname} baixado`);
        setAberto(false);
      } catch (e: any) {
        toast.erro(`Erro: ${e?.message ?? e}`);
      }
    });
  }

  const ehMapa = COMBOS[combo]?.precisaMapa;
  const podeBaixar = !ehMapa || statusesSelecionados.size > 0;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="text-sm px-3 py-1.5 rounded-md border hover:bg-gray-50"
        title="Exportar PDF ou Excel"
      >
        ↓ Exportar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={() => !pending && setAberto(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 animate-[slidein_.15s_ease-out] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Exportar relatório</div>
              <button disabled={pending} onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-600 block">Relatório</label>
              <div className="grid gap-1">
                {COMBOS.map((c, i) => (
                  <label key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md border cursor-pointer ${combo === i ? "bg-blue-50 border-blue-500" : "hover:bg-gray-50"}`}>
                    <input type="radio" name="combo" checked={combo === i} onChange={() => setCombo(i)} />
                    <span className="flex-1">{c.label}</span>
                    <span className="text-[10px] uppercase text-gray-500">{c.formato}</span>
                  </label>
                ))}
              </div>
            </div>

            {COMBOS[combo].precisaPeriodo && (
              <div className="space-y-2">
                <label className="text-xs text-gray-600 block">Período</label>
                <div className="flex flex-wrap gap-1 text-xs">
                  {(["hoje","amanha","semana","proximos7","todos"] as Periodo[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriodo(p)}
                      className={`px-2 py-1 rounded-md border ${periodo === p ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50"}`}
                    >
                      {p === "hoje" ? "Hoje" : p === "amanha" ? "Amanhã" : p === "semana" ? "Esta semana" : p === "proximos7" ? "Próximos 7d" : "Todos"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ehMapa && (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 block">Torre</label>
                  {carregandoTorres ? (
                    <div className="text-xs text-gray-400">Carregando torres...</div>
                  ) : (
                    <select
                      value={torreId}
                      onChange={(e) => setTorreId(e.target.value)}
                      className="w-full text-sm border rounded-md px-2 py-1.5"
                    >
                      <option value="todas">Todas as torres</option>
                      {torres.map((t) => (
                        <option key={t.id} value={t.id}>Torre {t.nome}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Filtrar por status</label>
                    <button onClick={toggleTodos} className="text-[10px] text-blue-600 hover:underline">
                      {statusesSelecionados.size === TODOS_STATUSES.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUS_MAPA_OPCOES.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={statusesSelecionados.has(opt.value)}
                          onChange={() => toggleStatus(opt.value)}
                          className="rounded"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {statusesSelecionados.size === 0 && (
                    <p className="text-[11px] text-red-500">Selecione ao menos um status.</p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    Unidades fora do filtro aparecem em cinza no mapa.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button disabled={pending} onClick={() => setAberto(false)} className="text-sm px-3 py-2 rounded border">Cancelar</button>
              <button
                disabled={pending || !podeBaixar}
                onClick={baixar}
                className="text-sm px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                {pending ? "Gerando..." : "Gerar e baixar"}
              </button>
            </div>

            {pending && (
              <div className="text-xs text-gray-500">
                Gerando relatório... PDFs podem demorar alguns segundos (Puppeteer renderizando a página).
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

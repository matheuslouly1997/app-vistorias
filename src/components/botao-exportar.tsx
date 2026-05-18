"use client";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";

type Formato = "excel" | "pdf";
type Tipo = "agenda" | "clientes" | "unidades" | "kpi" | "dashboard";
type Periodo = "hoje" | "amanha" | "semana" | "proximos7" | "todos";

const COMBOS: { formato: Formato; tipo: Tipo; label: string; precisaPeriodo?: boolean }[] = [
  { formato: "pdf",   tipo: "dashboard", label: "PDF — Dashboard / KPIs" },
  { formato: "pdf",   tipo: "agenda",    label: "PDF — Agenda",            precisaPeriodo: true },
  { formato: "excel", tipo: "agenda",    label: "Excel — Agenda",           precisaPeriodo: true },
  { formato: "excel", tipo: "clientes",  label: "Excel — Clientes" },
  { formato: "excel", tipo: "unidades",  label: "Excel — Unidades" },
  { formato: "excel", tipo: "kpi",       label: "Excel — KPIs" }
];

export default function BotaoExportar({ obraId }: { obraId: string }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [combo, setCombo] = useState(0);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [pending, start] = useTransition();

  function baixar() {
    const c = COMBOS[combo];
    const url = c.formato === "excel"
      ? `/api/export/excel?tipo=${c.tipo}&obraId=${obraId}${c.precisaPeriodo ? `&periodo=${periodo}` : ""}`
      : `/api/export/pdf?tipo=${c.tipo}&obraId=${obraId}${c.precisaPeriodo ? `&periodo=${periodo}` : ""}`;
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
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 animate-[slidein_.15s_ease-out]">
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

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button disabled={pending} onClick={() => setAberto(false)} className="text-sm px-3 py-2 rounded border">Cancelar</button>
              <button disabled={pending} onClick={baixar} className="text-sm px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
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

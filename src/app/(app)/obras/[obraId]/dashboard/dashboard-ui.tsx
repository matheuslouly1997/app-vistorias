"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { STATUS_COLORS_UI, STATUS_LABELS_UI, dbParaUI, type StatusUI } from "@/lib/constants/status";

/* ============================================================
 * Tipos
 * ============================================================ */
type Central = {
  obra: string;
  em_obra: number; em_correcao: number; finalizada_obra: number;
  agendadas: number; aprovadas_1a_atual: number; reprovadas_atual: number;
  revistorias: number; aprovadas_2a_mais: number; entregues: number;
  vistoriadas: number;
  taxa_aprovacao_1a_oficial: number;
  aprovadas_1a_hist: number; reprovadas_1a_hist: number; total_1a_vistoriadas_hist: number;
} | null;

type ContagemRow = { status: string };
type AgendaHoje  = { id: string; status_agenda: string; resultado: string | null; data_agendada: string };
type HistEv      = { status_novo: string; alterado_em: string };

/* ============================================================
 * Componente principal
 * ============================================================ */
export default function DashboardUI({
  central, contagensStatus, agendasHoje, historicoHoje, historico8semanas
}: {
  central: Central;
  contagensStatus: ContagemRow[];
  agendasHoje: AgendaHoje[];
  historicoHoje: HistEv[];
  historico8semanas: HistEv[];
}) {
  /* ----- Hoje ----- */
  const hoje = useMemo(() => {
    const vistoriasHoje = agendasHoje.length;
    const concluidas = agendasHoje.filter((a) => a.status_agenda === "concluida");
    const aprovadas  = historicoHoje.filter((h) => h.status_novo === "aprovada_1a" || h.status_novo === "aprovada_2a_mais").length;
    const reprovadas = historicoHoje.filter((h) => h.status_novo === "reprovada").length;
    const reagendadas= historicoHoje.filter((h) => h.status_novo === "revistoria").length;
    const entregues  = historicoHoje.filter((h) => h.status_novo === "entregue").length;
    return { vistoriasHoje, concluidas: concluidas.length, aprovadas, reprovadas, reagendadas, entregues };
  }, [agendasHoje, historicoHoje]);

  /* ----- Geral (dos counts atuais + central) ----- */
  const geral = useMemo(() => {
    const c = Object.fromEntries(
      ["em_obra","em_correcao","finalizada_obra","agendado",
       "aprovada_1a","aprovada_2a_mais","reprovada","revistoria","entregue",
       "em_correcao_pos_reprovacao","pronta_revistoria"].map((s) => [s, 0])
    ) as Record<string, number>;
    for (const u of contagensStatus) c[u.status] = (c[u.status] ?? 0) + 1;
    const total = contagensStatus.length;
    const aprovadas = c.aprovada_1a + c.aprovada_2a_mais;
    const pctAprov1a = aprovadas ? Math.round((c.aprovada_1a / aprovadas) * 100) : 0;
    const pctAprov2a = aprovadas ? 100 - pctAprov1a : 0;
    // Pipeline pos-reprovacao: unidades ja reprovadas que ainda serao aprovadas na 2a vistoria
    const emRevistoria = c.reprovada + c.em_correcao_pos_reprovacao + c.pronta_revistoria + c.revistoria;
    return {
      total,
      em_obra:           c.em_obra + c.em_correcao,
      finalizada_obra:   c.finalizada_obra,
      agendadas:         c.agendado,
      aprovadas,
      aprovadas1a:       c.aprovada_1a,
      aprovadas2a:       c.aprovada_2a_mais,
      pctAprov1a,
      pctAprov2a,
      emRevistoria,
      emCorrecaoPos:     c.em_correcao_pos_reprovacao,
      prontaRevist:      c.pronta_revistoria,
      reprovadas:        c.reprovada,
      reagendadas:       c.revistoria,
      entregues:         c.entregue,
      taxaOficial:       central?.taxa_aprovacao_1a_oficial ?? 0,
      aprovHist:         central?.aprovadas_1a_hist ?? 0,
      reprovHist:        central?.reprovadas_1a_hist ?? 0
    };
  }, [contagensStatus, central]);

  /* ----- Series por semana (8 semanas) ----- */
  const seriesSemanais = useMemo(() => construirSeriesSemanais(historico8semanas), [historico8semanas]);

  /* ----- Distribuicao para pizza ----- */
  const distribuicaoPie = useMemo(() => {
    const acc: Record<StatusUI, number> = {
      em_obra: 0, finalizada_obra: 0, agendada: 0, aprovada: 0,
      reprovada: 0, reagendada: 0, entregue: 0
    };
    for (const u of contagensStatus) {
      const ui = dbParaUI(u.status as any);
      acc[ui] += 1;
    }
    return Object.entries(acc)
      .map(([s, value]) => ({ name: STATUS_LABELS_UI[s as StatusUI], value, status: s as StatusUI }))
      .filter((d) => d.value > 0);
  }, [contagensStatus]);

  /* ============================================================ */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* HOJE */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Hoje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <CardNumero label="Vistorias hoje" valor={hoje.vistoriasHoje} cor="bg-blue-50 text-blue-900" />
          <CardNumero label="Concluídas"     valor={hoje.concluidas}     cor="bg-slate-50 text-slate-900" />
          <CardNumero label="Aprovadas"      valor={hoje.aprovadas}      cor="bg-emerald-50 text-emerald-900" />
          <CardNumero label="Reprovadas"     valor={hoje.reprovadas}     cor="bg-red-50 text-red-900" />
          <CardNumero label="Reagendadas"    valor={hoje.reagendadas}    cor="bg-orange-50 text-orange-900" />
          <CardNumero label="Entregues"      valor={hoje.entregues}      cor="bg-slate-900 text-white" />
        </div>
      </section>

      {/* KPI OFICIAL */}
      <section className="rounded-xl border bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">KPI oficial (histórico)</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-5xl font-semibold tracking-tight">{geral.taxaOficial}%</div>
            <div className="text-sm text-gray-500">aprovação na 1ª vistoria</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs flex-1">
          <Mini label="Aprovadas 1ª" valor={geral.aprovHist} />
          <Mini label="Reprovadas 1ª" valor={geral.reprovHist} />
          <Mini label="Total 1ª executadas" valor={geral.aprovHist + geral.reprovHist} />
        </div>
      </section>

      {/* QUALIDADE — 1ª vez x revistoria (sobre as aprovadas atuais) + pipeline pos-reprovacao */}
      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Qualidade — aprovação de primeira</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-5xl font-semibold tracking-tight">{geral.pctAprov1a}%</div>
              <div className="text-sm text-gray-500">das {geral.aprovadas} aprovadas passaram de 1ª</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs flex-1">
            <Mini label="Aprovadas na 1ª"  valor={geral.aprovadas1a} sufixo={`${geral.pctAprov1a}%`} />
            <Mini label="Aprovadas na 2ª+" valor={geral.aprovadas2a} sufixo={`${geral.pctAprov2a}%`} />
            <Mini label="Total aprovadas"  valor={geral.aprovadas} />
          </div>
        </div>

        {/* Pipeline: ja reprovadas, ainda serao aprovadas na 2a vistoria */}
        <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="text-sm">
            <span className="text-2xl font-semibold text-red-600 align-middle">{geral.emRevistoria}</span>
            <span className="text-gray-500 ml-2">reprovadas em andamento — irão para a 2ª vistoria</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3 text-xs flex-1">
            <Mini label="Reprovada"          valor={geral.reprovadas} />
            <Mini label="Em correção"        valor={geral.emCorrecaoPos} />
            <Mini label="Pronta p/ revist."  valor={geral.prontaRevist} />
            <Mini label="Em revistoria"      valor={geral.reagendadas} />
          </div>
        </div>
      </section>

      {/* GERAL */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Geral — estado atual</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <CardNumero label="Total"           valor={geral.total}           cor="bg-white text-gray-900" />
          <CardNumero label="Em obra"         valor={geral.em_obra}         cor="bg-slate-100 text-slate-800" />
          <CardNumero label="Aguardando agendamento" valor={geral.finalizada_obra} cor="bg-sky-100 text-sky-900" />
          <CardNumero label="Agendadas"       valor={geral.agendadas}       cor="bg-blue-100 text-blue-900" />
          <CardNumero label="Aprovadas"       valor={geral.aprovadas}       cor="bg-emerald-100 text-emerald-900" />
          <CardNumero label="Reprovadas"      valor={geral.reprovadas}      cor="bg-red-100 text-red-900" />
          <CardNumero label="Entregues"       valor={geral.entregues}       cor="bg-slate-900 text-white" />
        </div>
      </section>

      {/* GRAFICOS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard titulo="Aprovações e reprovações — últimas 8 semanas">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={seriesSemanais}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="aprovadas"  fill="#10b981" name="Aprovadas"  radius={[4,4,0,0]} />
              <Bar dataKey="reprovadas" fill="#ef4444" name="Reprovadas" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard titulo="Entregas por semana">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={seriesSemanais}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="entregues" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} name="Entregues" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard titulo="Distribuição atual">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={distribuicaoPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {distribuicaoPie.map((d, i) => (
                  <Cell key={i} fill={CORES_HEX[d.status]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard titulo="Reagendadas por semana">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={seriesSemanais}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="reagendadas" fill="#f97316" name="Reagendadas" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/* ============================================================
 * Cards e helpers
 * ============================================================ */
function CardNumero({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={`${cor} rounded-xl border px-4 py-3 shadow-sm`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-0.5">{valor}</div>
    </div>
  );
}
function Mini({ label, valor, sufixo }: { label: string; valor: number; sufixo?: string }) {
  return (
    <div className="bg-gray-50 border rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <div className="text-xl font-semibold">{valor}</div>
        {sufixo && <div className="text-xs text-gray-500">{sufixo}</div>}
      </div>
    </div>
  );
}
function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <div className="text-sm font-medium mb-2">{titulo}</div>
      {children}
    </div>
  );
}

const CORES_HEX: Record<StatusUI, string> = {
  em_obra:         "#cbd5e1",
  finalizada_obra: "#bae6fd",
  agendada:        "#3b82f6",
  aprovada:        "#10b981",
  reprovada:       "#ef4444",
  reagendada:      "#f97316",
  entregue:        "#0f172a"
};

/* ============================================================
 * Agregacao por semana (segunda como inicio)
 * ============================================================ */
function inicioSemana(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const dia = x.getDay(); // 0=domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  x.setDate(x.getDate() + diff);
  return x;
}
function rotuloSemana(d: Date) {
  const fim = new Date(d); fim.setDate(fim.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(d)}`;
}
function construirSeriesSemanais(eventos: HistEv[]) {
  const hojeIni = inicioSemana(new Date());
  const semanas: { iniMs: number; semana: string; aprovadas: number; reprovadas: number; entregues: number; reagendadas: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const sem = new Date(hojeIni); sem.setDate(sem.getDate() - i * 7);
    semanas.push({ iniMs: sem.getTime(), semana: rotuloSemana(sem), aprovadas: 0, reprovadas: 0, entregues: 0, reagendadas: 0 });
  }
  for (const ev of eventos) {
    const d = new Date(ev.alterado_em);
    const ini = inicioSemana(d).getTime();
    const item = semanas.find((s) => s.iniMs === ini);
    if (!item) continue;
    if (ev.status_novo === "aprovada_1a" || ev.status_novo === "aprovada_2a_mais") item.aprovadas++;
    else if (ev.status_novo === "reprovada")  item.reprovadas++;
    else if (ev.status_novo === "entregue")   item.entregues++;
    else if (ev.status_novo === "revistoria") item.reagendadas++;
  }
  return semanas;
}

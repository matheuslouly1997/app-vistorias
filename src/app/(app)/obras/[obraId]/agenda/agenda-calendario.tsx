"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import {
  agendarVistoria, concluirVistoria, cancelarAgenda,
  editarHorarioAgenda, trocarClienteAgenda
} from "./actions";
import { desfazerUltimaAlteracao } from "../mapa/actions";

/* ============================================================
 * Tipos minimos
 * ============================================================ */
type Agenda = {
  id: string;
  tipo: "vistoria_1a" | "revistoria" | "vistoria_extra";
  data_agendada: string; // ISO
  duracao_min: number;
  status_agenda: "agendada" | "concluida" | "cancelada" | "remarcada";
  resultado: "aprovada" | "reprovada" | "pendente" | null;
  observacoes: string | null;
  unidade_id: string;
  cliente_id: string | null;
  created_at: string;
};
type UnidadeMin = { id: string; identificador: string; status: string };
type ClienteMin = { id: string; nome: string; telefone: string | null; email: string | null };

type View = "semana" | "dia" | "lista";
type Periodo = "hoje" | "amanha" | "semana" | "proximos7" | "todos";
type FiltroStatus =
  | "todas"
  | "agendadas"
  | "aprovadas"
  | "reprovadas"
  | "reagendadas"
  | "canceladas";

/* ============================================================
 * Helpers de data
 * ============================================================ */
function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
/** Segunda-feira como inicio. */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dia = x.getDay(); // 0=domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  return addDays(x, diff);
}
function formatDiaCurto(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatDiaSemana(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
function formatHorario(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ============================================================
 * Cor + label da agenda
 * ============================================================ */
function corAgenda(a: Agenda): { chip: string; barra: string; label: string } {
  if (a.status_agenda === "cancelada")
    return { chip: "bg-slate-200 text-slate-700", barra: "bg-slate-400", label: "Cancelada" };
  if (a.status_agenda === "remarcada")
    return { chip: "bg-orange-100 text-orange-800", barra: "bg-orange-500", label: "Remarcada" };
  if (a.status_agenda === "concluida") {
    if (a.resultado === "aprovada")
      return { chip: "bg-emerald-100 text-emerald-800", barra: "bg-emerald-500", label: "Aprovada" };
    if (a.resultado === "reprovada")
      return { chip: "bg-red-100 text-red-800", barra: "bg-red-500", label: "Reprovada" };
    return { chip: "bg-slate-100 text-slate-700", barra: "bg-slate-400", label: "Concluida" };
  }
  // status_agenda === "agendada"
  if (a.tipo === "revistoria")
    return { chip: "bg-orange-100 text-orange-800", barra: "bg-orange-500", label: "Reagendada" };
  return { chip: "bg-blue-100 text-blue-800", barra: "bg-blue-500", label: "Agendada" };
}

/* ============================================================
 * Componente principal
 * ============================================================ */
export default function AgendaCalendario({
  obraId, agendaInicial, unidades, unidadesAgendaveis, clientes
}: {
  obraId: string;
  agendaInicial: Agenda[];
  unidades: UnidadeMin[];
  unidadesAgendaveis: UnidadeMin[];
  clientes: ClienteMin[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [view, setView] = useState<View>("semana");
  const [dataRef, setDataRef] = useState<Date>(new Date());
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<Agenda | null>(null);
  const [novaAberto, setNovaAberto] = useState(false);

  const unidadeMap = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);
  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  // Periodo -> range
  const range = useMemo(() => {
    const hoje = startOfDay(new Date());
    if (periodo === "hoje") return { ini: hoje, fim: endOfDay(hoje) };
    if (periodo === "amanha") {
      const a = addDays(hoje, 1); return { ini: a, fim: endOfDay(a) };
    }
    if (periodo === "proximos7") return { ini: hoje, fim: endOfDay(addDays(hoje, 6)) };
    if (periodo === "semana") {
      const ini = startOfWeek(dataRef);
      return { ini, fim: endOfDay(addDays(ini, 6)) };
    }
    return { ini: new Date(0), fim: new Date(2200, 0, 1) }; // todos
  }, [periodo, dataRef]);

  // Filtro
  const agendaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return agendaInicial.filter((a) => {
      const d = new Date(a.data_agendada);
      if (d < range.ini || d > range.fim) return false;

      // status
      if (filtroStatus !== "todas") {
        const c = corAgenda(a).label.toLowerCase();
        const ok =
          (filtroStatus === "agendadas"   && c === "agendada") ||
          (filtroStatus === "aprovadas"   && c === "aprovada") ||
          (filtroStatus === "reprovadas"  && c === "reprovada") ||
          (filtroStatus === "reagendadas" && c === "reagendada") ||
          (filtroStatus === "canceladas"  && c === "cancelada");
        if (!ok) return false;
      }

      // busca
      if (q) {
        const u = unidadeMap.get(a.unidade_id);
        const cli = a.cliente_id ? clienteMap.get(a.cliente_id) : null;
        const blob = [
          u?.identificador ?? "",
          cli?.nome ?? "",
          cli?.telefone ?? "",
          cli?.email ?? ""
        ].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [agendaInicial, range, filtroStatus, busca, unidadeMap, clienteMap]);

  function navegar(delta: number) {
    if (view === "dia") setDataRef((d) => addDays(d, delta));
    else if (view === "semana") setDataRef((d) => addDays(d, 7 * delta));
  }

  // Diasi para view semanal
  const diasSemana = useMemo(() => {
    const ini = startOfWeek(dataRef);
    return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  }, [dataRef]);

  /* ----------- acoes ----------- */
  function aplicarAprovar(a: Agenda) {
    start(async () => {
      const r = await concluirVistoria(a.id, "aprovada");
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.sucesso(`${unidadeMap.get(a.unidade_id)?.identificador ?? "Unidade"}: aprovada`, {
        acaoLabel: "Desfazer",
        acao: async () => {
          const x = await desfazerUltimaAlteracao(a.unidade_id);
          if (x?.erro) return toast.erro(x.erro);
          router.refresh();
        }
      });
      setSelecionada(null);
    });
  }
  function aplicarReprovar(a: Agenda) {
    start(async () => {
      const r = await concluirVistoria(a.id, "reprovada");
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.sucesso(`${unidadeMap.get(a.unidade_id)?.identificador ?? "Unidade"}: reprovada`, {
        acaoLabel: "Desfazer",
        acao: async () => {
          const x = await desfazerUltimaAlteracao(a.unidade_id);
          if (x?.erro) return toast.erro(x.erro);
          router.refresh();
        }
      });
      setSelecionada(null);
    });
  }
  function aplicarCancelar(a: Agenda) {
    start(async () => {
      const r = await cancelarAgenda(a.id);
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.info("Vistoria cancelada");
      setSelecionada(null);
    });
  }
  function aplicarEditarHorario(a: Agenda, novaData: string) {
    start(async () => {
      const r = await editarHorarioAgenda(a.id, new Date(novaData).toISOString());
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.sucesso("Horario atualizado");
      setSelecionada(null);
    });
  }
  function aplicarTrocarCliente(a: Agenda, clienteId: string | null) {
    start(async () => {
      const r = await trocarClienteAgenda(a.id, clienteId);
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.sucesso("Cliente trocado");
      setSelecionada(null);
    });
  }

  function aplicarNovaVistoria(fd: FormData) {
    fd.set("obra_id", obraId);
    start(async () => {
      const r = await agendarVistoria(fd);
      if (r?.erro) return toast.erro(r.erro);
      router.refresh();
      toast.sucesso("Vistoria agendada");
      setNovaAberto(false);
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Toolbar */}
      <div className="bg-white border rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-1">
            {(["semana", "dia", "lista"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-sm px-3 py-1.5 rounded-md ${view === v ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
              >
                {v === "semana" ? "Semana" : v === "dia" ? "Dia" : "Lista"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(view === "semana" || view === "dia") && (
              <div className="flex items-center gap-1 border rounded-md">
                <button onClick={() => navegar(-1)} className="px-2 py-1.5 hover:bg-gray-100" aria-label="anterior">‹</button>
                <button onClick={() => setDataRef(new Date())} className="text-xs px-2 py-1.5 hover:bg-gray-100">hoje</button>
                <button onClick={() => navegar(+1)} className="px-2 py-1.5 hover:bg-gray-100" aria-label="proximo">›</button>
              </div>
            )}
            <div className="text-sm text-gray-700 font-medium">
              {view === "semana"
                ? `${formatDiaCurto(diasSemana[0])} – ${formatDiaCurto(diasSemana[6])}`
                : view === "dia"
                ? dataRef.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
                : "Lista completa"}
            </div>
          </div>

          <button
            onClick={() => setNovaAberto(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            + Nova vistoria
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Periodo:</span>
          {(["hoje", "amanha", "semana", "proximos7", "todos"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-2 py-1 rounded-md border ${periodo === p ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50"}`}
            >
              {p === "hoje" ? "Hoje" : p === "amanha" ? "Amanha" : p === "semana" ? "Esta semana" : p === "proximos7" ? "Proximos 7d" : "Todos"}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">Status:</span>
          {(["todas", "agendadas", "aprovadas", "reprovadas", "reagendadas", "canceladas"] as FiltroStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              className={`px-2 py-1 rounded-md border ${filtroStatus === f ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50"}`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar unidade, cliente, telefone..."
            className="text-sm border rounded-md px-3 py-1.5 w-64"
          />
          <span className="ml-auto text-xs text-gray-500">
            {agendaFiltrada.length} vistoria{agendaFiltrada.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Conteudo da view */}
      {view === "semana" && (
        <ViewSemana
          dias={diasSemana}
          agendas={agendaFiltrada}
          unidadeMap={unidadeMap}
          clienteMap={clienteMap}
          onClickCard={(a) => setSelecionada(a)}
        />
      )}
      {view === "dia" && (
        <ViewDia
          dia={dataRef}
          agendas={agendaFiltrada}
          unidadeMap={unidadeMap}
          clienteMap={clienteMap}
          onClickCard={(a) => setSelecionada(a)}
        />
      )}
      {view === "lista" && (
        <ViewLista
          agendas={agendaFiltrada}
          unidadeMap={unidadeMap}
          clienteMap={clienteMap}
          onClickCard={(a) => setSelecionada(a)}
        />
      )}

      {/* Painel de detalhes */}
      {selecionada && (
        <AgendaPainel
          agenda={selecionada}
          unidade={unidadeMap.get(selecionada.unidade_id)}
          cliente={selecionada.cliente_id ? clienteMap.get(selecionada.cliente_id) : null}
          clientes={clientes}
          pending={pending}
          onClose={() => setSelecionada(null)}
          onAprovar={() => aplicarAprovar(selecionada)}
          onReprovar={() => aplicarReprovar(selecionada)}
          onCancelar={() => aplicarCancelar(selecionada)}
          onEditarHorario={(nova) => aplicarEditarHorario(selecionada, nova)}
          onTrocarCliente={(id) => aplicarTrocarCliente(selecionada, id)}
        />
      )}

      {/* Modal nova vistoria */}
      {novaAberto && (
        <NovaVistoriaModal
          unidadesAgendaveis={unidadesAgendaveis}
          clientes={clientes}
          pending={pending}
          onClose={() => setNovaAberto(false)}
          onSubmit={aplicarNovaVistoria}
        />
      )}
    </div>
  );
}

/* ============================================================
 * Views
 * ============================================================ */
function ViewSemana({
  dias, agendas, unidadeMap, clienteMap, onClickCard
}: {
  dias: Date[];
  agendas: Agenda[];
  unidadeMap: Map<string, UnidadeMin>;
  clienteMap: Map<string, ClienteMin>;
  onClickCard: (a: Agenda) => void;
}) {
  const porDia = useMemo(() => {
    const m = new Map<string, Agenda[]>();
    dias.forEach((d) => m.set(chaveDia(d), []));
    for (const a of agendas) {
      const k = chaveDia(new Date(a.data_agendada));
      if (m.has(k)) m.get(k)!.push(a);
    }
    for (const arr of m.values()) arr.sort((x, y) => +new Date(x.data_agendada) - +new Date(y.data_agendada));
    return m;
  }, [dias, agendas]);

  return (
    <div className="bg-white border rounded-xl p-3 shadow-sm overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {dias.map((d) => {
          const k = chaveDia(d);
          const lista = porDia.get(k) ?? [];
          const ehHoje = mesmoDia(d, new Date());
          return (
            <div key={k} className="space-y-2">
              <div className={`text-center ${ehHoje ? "text-blue-700" : "text-gray-700"}`}>
                <div className="text-[10px] uppercase tracking-wide">{formatDiaSemana(d)}</div>
                <div className="text-sm font-semibold">{formatDiaCurto(d)}</div>
              </div>
              <div className="space-y-1.5 min-h-[120px]">
                {lista.length === 0 && (
                  <div className="text-[11px] text-gray-300 text-center py-4">—</div>
                )}
                {lista.map((a) => (
                  <AgendaCard
                    key={a.id}
                    agenda={a}
                    unidade={unidadeMap.get(a.unidade_id)}
                    cliente={a.cliente_id ? clienteMap.get(a.cliente_id) : null}
                    onClick={() => onClickCard(a)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewDia({
  dia, agendas, unidadeMap, clienteMap, onClickCard
}: {
  dia: Date;
  agendas: Agenda[];
  unidadeMap: Map<string, UnidadeMin>;
  clienteMap: Map<string, ClienteMin>;
  onClickCard: (a: Agenda) => void;
}) {
  const lista = useMemo(
    () => agendas
      .filter((a) => mesmoDia(new Date(a.data_agendada), dia))
      .sort((x, y) => +new Date(x.data_agendada) - +new Date(y.data_agendada)),
    [agendas, dia]
  );

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-2">
      {lista.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-8">Nenhuma vistoria nesse dia.</div>
      )}
      {lista.map((a) => {
        const cor = corAgenda(a);
        const u = unidadeMap.get(a.unidade_id);
        const c = a.cliente_id ? clienteMap.get(a.cliente_id) : null;
        const d = new Date(a.data_agendada);
        return (
          <button
            key={a.id}
            onClick={() => onClickCard(a)}
            className="w-full text-left flex gap-3 items-stretch bg-gray-50 hover:bg-gray-100 border rounded-lg p-3 transition"
          >
            <div className={`w-1.5 rounded ${cor.barra}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{u?.identificador ?? "?"}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${cor.chip}`}>{cor.label}</span>
              </div>
              <div className="text-sm text-gray-600">{c?.nome ?? "(sem cliente)"}</div>
              {c?.telefone && <a href={`tel:${c.telefone}`} className="text-xs text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>{c.telefone}</a>}
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{formatHorario(d)}</div>
              <div className="text-[11px] text-gray-500">{a.duracao_min}min</div>
              <div className="text-[10px] uppercase text-gray-400 mt-1">{a.tipo.replace("_", " ")}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ViewLista({
  agendas, unidadeMap, clienteMap, onClickCard
}: {
  agendas: Agenda[];
  unidadeMap: Map<string, UnidadeMin>;
  clienteMap: Map<string, ClienteMin>;
  onClickCard: (a: Agenda) => void;
}) {
  const porData = useMemo(() => {
    const m = new Map<string, Agenda[]>();
    for (const a of agendas) {
      const k = chaveDia(new Date(a.data_agendada));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a < b ? -1 : 1);
  }, [agendas]);

  return (
    <div className="bg-white border rounded-xl shadow-sm">
      {porData.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-12">Nenhuma vistoria.</div>
      )}
      {porData.map(([k, lista]) => (
        <div key={k}>
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 sticky top-0">
            {new Date(k).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
          {lista.map((a) => {
            const cor = corAgenda(a);
            const u = unidadeMap.get(a.unidade_id);
            const c = a.cliente_id ? clienteMap.get(a.cliente_id) : null;
            const d = new Date(a.data_agendada);
            return (
              <button
                key={a.id}
                onClick={() => onClickCard(a)}
                className="w-full text-left flex gap-3 items-center px-4 py-3 border-t hover:bg-gray-50 transition"
              >
                <div className={`w-2 h-8 rounded ${cor.barra}`} />
                <div className="w-16 text-sm font-medium">{formatHorario(d)}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{u?.identificador ?? "?"}</div>
                  <div className="text-xs text-gray-500">{c?.nome ?? "(sem cliente)"} {c?.telefone ? `· ${c.telefone}` : ""}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${cor.chip}`}>{cor.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 * Card de agenda (usado na view semanal)
 * ============================================================ */
function AgendaCard({
  agenda, unidade, cliente, onClick
}: {
  agenda: Agenda;
  unidade: UnidadeMin | undefined;
  cliente: ClienteMin | null | undefined;
  onClick: () => void;
}) {
  const cor = corAgenda(agenda);
  const d = new Date(agenda.data_agendada);
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs bg-white border rounded-md p-2 hover:shadow transition"
      title={`${unidade?.identificador} · ${cliente?.nome ?? "sem cliente"}`}
    >
      <div className="flex items-center gap-1.5">
        <div className={`w-1 h-3 rounded ${cor.barra}`} />
        <div className="font-medium">{formatHorario(d)}</div>
      </div>
      <div className="font-semibold truncate">{unidade?.identificador ?? "?"}</div>
      <div className="text-gray-500 truncate">{cliente?.nome ?? "(sem cliente)"}</div>
      <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded ${cor.chip}`}>{cor.label}</span>
    </button>
  );
}

/* ============================================================
 * Painel lateral com detalhes + acoes
 * ============================================================ */
function AgendaPainel({
  agenda, unidade, cliente, clientes, pending,
  onClose, onAprovar, onReprovar, onCancelar, onEditarHorario, onTrocarCliente
}: {
  agenda: Agenda;
  unidade: UnidadeMin | undefined;
  cliente: ClienteMin | null | undefined;
  clientes: ClienteMin[];
  pending: boolean;
  onClose: () => void;
  onAprovar: () => void;
  onReprovar: () => void;
  onCancelar: () => void;
  onEditarHorario: (novaIso: string) => void;
  onTrocarCliente: (id: string | null) => void;
}) {
  const cor = corAgenda(agenda);
  const ativa = agenda.status_agenda === "agendada";
  const [editandoHorario, setEditandoHorario] = useState(false);
  const [novoHorario, setNovoHorario] = useState<string>(toInputDateTime(new Date(agenda.data_agendada)));
  const [trocandoCliente, setTrocandoCliente] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState<string>(cliente?.id ?? "");

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <aside className="relative ml-auto w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-[slidein_.15s_ease-out]">
        <div className="px-5 py-4 border-b sticky top-0 bg-white z-10 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">Vistoria</div>
            <div className="text-xl font-semibold">{unidade?.identificador ?? "?"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-md ${cor.chip}`}>{cor.label}</span>
              <span className="text-[11px] text-gray-500">{agenda.tipo.replace("_", " ")} · {agenda.duracao_min}min</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Data/horario */}
          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Data e horario</div>
            {!editandoHorario ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">{new Date(agenda.data_agendada).toLocaleString("pt-BR")}</div>
                {ativa && (
                  <button onClick={() => setEditandoHorario(true)} className="text-xs text-blue-700 hover:underline">Editar</button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)}
                  className="flex-1 border rounded px-3 py-2 text-sm" />
                <button disabled={pending} onClick={() => onEditarHorario(novoHorario)} className="text-xs px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Salvar</button>
                <button onClick={() => setEditandoHorario(false)} className="text-xs px-3 py-2 rounded border">Cancelar</button>
              </div>
            )}
          </section>

          {/* Cliente */}
          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Cliente</div>
            {!trocandoCliente ? (
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm space-y-0.5">
                  <div className="font-medium">{cliente?.nome ?? "(sem cliente)"}</div>
                  {cliente?.telefone && <a href={`tel:${cliente.telefone}`} className="text-blue-700 hover:underline block">{cliente.telefone}</a>}
                  {cliente?.email && <a href={`mailto:${cliente.email}`} className="text-blue-700 hover:underline block">{cliente.email}</a>}
                </div>
                {ativa && (
                  <button onClick={() => setTrocandoCliente(true)} className="text-xs text-blue-700 hover:underline">Trocar</button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select value={novoClienteId} onChange={(e) => setNovoClienteId(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm bg-white">
                  <option value="">(sem cliente)</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button disabled={pending} onClick={() => onTrocarCliente(novoClienteId || null)} className="text-xs px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Salvar</button>
                <button onClick={() => setTrocandoCliente(false)} className="text-xs px-3 py-2 rounded border">Cancelar</button>
              </div>
            )}
          </section>

          {/* Observacoes */}
          {agenda.observacoes && (
            <section>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Observacoes</div>
              <div className="text-sm bg-gray-50 border rounded px-3 py-2 whitespace-pre-wrap">{agenda.observacoes}</div>
            </section>
          )}

          {/* Acoes */}
          {ativa && (
            <section>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Acoes</div>
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} onClick={onAprovar}
                  className="text-sm px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">Aprovar</button>
                <button disabled={pending} onClick={onReprovar}
                  className="text-sm px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">Reprovar</button>
                <button disabled={pending} onClick={onCancelar}
                  className="text-sm px-3 py-2 rounded-md border hover:bg-gray-50 disabled:opacity-50">Cancelar vistoria</button>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
 * Modal Nova Vistoria
 * ============================================================ */
function NovaVistoriaModal({
  unidadesAgendaveis, clientes, pending, onClose, onSubmit
}: {
  unidadesAgendaveis: UnidadeMin[];
  clientes: ClienteMin[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          // converte datetime-local -> ISO
          const dt = String(fd.get("data_agendada") ?? "");
          if (dt) fd.set("data_agendada", new Date(dt).toISOString());
          onSubmit(fd);
        }}
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-3 animate-[slidein_.15s_ease-out]"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Nova vistoria</div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600">Unidade *</label>
            <select name="unidade_id" required className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {unidadesAgendaveis.map((u) => (
                <option key={u.id} value={u.id}>{u.identificador} ({u.status})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Listadas: unidades em finalizada_obra ou reprovada.</p>
          </div>

          <div>
            <label className="text-xs text-gray-600">Tipo *</label>
            <select name="tipo" required defaultValue="vistoria_1a" className="w-full border rounded px-3 py-2 text-sm">
              <option value="vistoria_1a">1a vistoria</option>
              <option value="revistoria">Revistoria</option>
              <option value="vistoria_extra">Extra</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Cliente</label>
            <select name="cliente_id" className="w-full border rounded px-3 py-2 text-sm">
              <option value="">(sem cliente)</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Data e hora *</label>
              <input name="data_agendada" type="datetime-local" required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Duracao (min)</label>
              <input name="duracao_min" type="number" defaultValue={60} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600">Observacoes</label>
            <textarea name="observacoes" rows={2} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded border">Cancelar</button>
          <button type="submit" disabled={pending} className="text-sm px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
            {pending ? "Agendando..." : "Agendar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */
function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toInputDateTime(d: Date) {
  // formato esperado pelo <input type="datetime-local"> (sem timezone)
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

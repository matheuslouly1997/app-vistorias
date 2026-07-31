"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_COLORS_UI, STATUS_LABELS_UI, ACAO_LABELS, ACAO_COR,
  STATUS_LABELS, STATUS_ORDER,
  acoesPermitidas, dbParaUI, type AcaoUnidade
} from "@/lib/constants/status";
import type { StatusUnidade, HistoricoStatus, Cliente, Agenda, TermoUnidade } from "@/lib/types/database";
import { salvarTermo, excluirTermo } from "./termos-actions";
import { useToast } from "@/components/toast";
import {
  aprovarUnidade, reprovarUnidade, reagendarUnidade, marcarVistoria,
  marcarEntregue, liberarParaVistoria, marcarEmCorrecao, voltarEmObra,
  atualizarObservacoesUnidade, desfazerUltimaAlteracao, resetarUnidade,
  enviarParaCorrecao, liberarParaRevistoria, agendarRevistoria,
  alterarEtapaManualmente, reverterParaEvento, remarcarVistoriaAtiva,
} from "./actions";

// Ordem operacional do fluxo (do mais "obra" ao mais "entregue") usada
// para detectar regressao e exigir motivo.
const ORDEM_OPERACIONAL: StatusUnidade[] = [
  "em_obra", "em_correcao", "finalizada_obra", "agendado",
  "reprovada", "em_correcao_pos_reprovacao", "pronta_revistoria", "revistoria",
  "aprovada_1a", "aprovada_2a_mais", "entregue",
];
const ordemDe = (s: StatusUnidade) => ORDEM_OPERACIONAL.indexOf(s);
const ehRegressao = (atual: StatusUnidade, alvo: StatusUnidade) =>
  ordemDe(alvo) >= 0 && ordemDe(atual) >= 0 && ordemDe(alvo) < ordemDe(atual);

import { formatarUnidade } from "@/lib/format/unidade";

type Unidade = {
  id: string; torre_id: string; pavimento: number; codigo_unidade: string;
  identificador: string; status: StatusUnidade; cliente_atual_id: string | null;
  observacoes?: string | null;
};
type Props = {
  unidade: Unidade; torreNome?: string; obraId: string;
  clientes: Pick<Cliente, "id" | "nome" | "telefone" | "email">[];
  somenteLeitura?: boolean;
  onClose: () => void; onChanged: (u: Unidade) => void;
};
type FormAcaoTipo = "marcar_vistoria" | "reagendar" | "agendar_revistoria" | "remarcar_horario";

export default function UnidadePainel({ unidade, torreNome, obraId, clientes, somenteLeitura = false, onClose, onChanged }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [historico, setHistorico] = useState<HistoricoStatus[] | null>(null);
  const [perfisMap, setPerfisMap] = useState<Record<string, string>>({});
  const [agendas, setAgendas] = useState<Agenda[] | null>(null);
  const [termos, setTermos] = useState<TermoUnidade[] | null>(null);
  const [obs, setObs] = useState(unidade.observacoes ?? "");
  const [obsDirty, setObsDirty] = useState(false);
  const [formAcao, setFormAcao] = useState<null | FormAcaoTipo>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [motivoReset, setMotivoReset] = useState("");
  const [modalEtapa, setModalEtapa] = useState(false);

  useEffect(() => { setObs(unidade.observacoes ?? ""); setObsDirty(false); }, [unidade.id, unidade.observacoes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const [{ data: h }, { data: a }, { data: t }] = await Promise.all([
        supabase.from("historico_status").select("*").eq("unidade_id", unidade.id).order("alterado_em", { ascending: false }),
        supabase.from("agenda").select("*").eq("unidade_id", unidade.id).order("data_agendada", { ascending: false }),
        supabase.from("termos_unidade").select("*").eq("unidade_id", unidade.id).order("anexado_em", { ascending: false })
      ]);
      if (!alive) return;
      setHistorico(h ?? []); setAgendas(a ?? []); setTermos(t ?? []);
      const ids = [...new Set([
        ...(h ?? []).map((x: HistoricoStatus) => x.alterado_por),
        ...(a ?? []).map((x: Agenda) => x.created_by),
      ].filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: p } = await supabase.rpc("buscar_nomes_usuarios", { ids });
        if (alive) setPerfisMap(Object.fromEntries((p ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome])));
      }
    })();
    return () => { alive = false; };
  }, [unidade.id]);

  // Realtime: mantem timeline (historico e agenda) sincronizada enquanto
  // o painel esta aberto, para refletir mudancas feitas em outras telas.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`painel_unidade_${unidade.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "historico_status", filter: `unidade_id=eq.${unidade.id}` },
        async () => {
          const { data: h } = await supabase.from("historico_status")
            .select("*").eq("unidade_id", unidade.id)
            .order("alterado_em", { ascending: false });
          setHistorico(h ?? []);
          const ids = [...new Set((h ?? []).map((x: HistoricoStatus) => x.alterado_por).filter(Boolean))] as string[];
          if (ids.length > 0) {
            const { data: p } = await supabase.rpc("buscar_nomes_usuarios", { ids });
            setPerfisMap(Object.fromEntries((p ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome])));
          }
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "agenda", filter: `unidade_id=eq.${unidade.id}` },
        async () => {
          const { data: a } = await supabase.from("agenda")
            .select("*").eq("unidade_id", unidade.id)
            .order("data_agendada", { ascending: false });
          setAgendas(a ?? []);
          const ids = [...new Set((a ?? []).map((x: Agenda) => x.created_by).filter(Boolean))] as string[];
          if (ids.length > 0) {
            const { data: p } = await supabase.rpc("buscar_nomes_usuarios", { ids });
            setPerfisMap(prev => ({ ...prev, ...Object.fromEntries((p ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome])) }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [unidade.id]);

  const ui = dbParaUI(unidade.status);
  const cor = STATUS_COLORS_UI[ui];

  const acoes = useMemo<AcaoUnidade[]>(() => {
    const lista = acoesPermitidas(unidade.status);
    const temAlteracao = (historico ?? []).some((h) => h.status_anterior !== null);
    return temAlteracao ? [...lista, "desfazer"] : lista;
  }, [unidade.status, historico]);

  // Vistoria ATIVA (agendada), independente de estar no passado ou futuro.
  // A mais proxima no tempo e a que sera reagendada.
  const agendaAtiva = (agendas ?? [])
    .filter((a) => a.status_agenda === "agendada")
    .sort((a, b) => +new Date(a.data_agendada) - +new Date(b.data_agendada))[0];
  const agendaAtivaAtrasada = agendaAtiva ? new Date(agendaAtiva.data_agendada).getTime() < Date.now() : false;
  const ultimaAlteracao = (historico ?? [])[0];
  const clienteAtual = clientes.find((c) => c.id === unidade.cliente_atual_id);

  async function recarregar(): Promise<void> {
    await Promise.all([
      (async () => {
        const supabase = createClient();
        const { data: h } = await supabase.from("historico_status").select("*").eq("unidade_id", unidade.id).order("alterado_em", { ascending: false });
        setHistorico(h ?? []);
        const ids = [...new Set((h ?? []).map((x: HistoricoStatus) => x.alterado_por).filter(Boolean))] as string[];
        if (ids.length > 0) {
          const { data: p } = await supabase.rpc("buscar_nomes_usuarios", { ids });
          setPerfisMap(Object.fromEntries((p ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome])));
        }
      })(),
      (async () => {
        const supabase = createClient();
        const { data: a } = await supabase.from("agenda").select("*").eq("unidade_id", unidade.id).order("data_agendada", { ascending: false });
        setAgendas(a ?? []);
        const ids = [...new Set((a ?? []).map((x: Agenda) => x.created_by).filter(Boolean))] as string[];
        if (ids.length > 0) {
          const { data: p } = await supabase.rpc("buscar_nomes_usuarios", { ids });
          setPerfisMap(prev => ({ ...prev, ...Object.fromEntries((p ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome])) }));
        }
      })(),
      (async () => {
        const supabase = createClient();
        const { data: t } = await supabase.from("termos_unidade").select("*").eq("unidade_id", unidade.id).order("anexado_em", { ascending: false });
        setTermos(t ?? []);
      })()
    ]);
  }

  function aplicar(acao: AcaoUnidade, payload?: any) {
    start(async () => {
      let r: { ok?: true; erro?: string } | undefined;
      switch (acao) {
        case "marcar_em_correcao":      r = await marcarEmCorrecao(unidade.id);    break;
        case "voltar_em_obra":          r = await voltarEmObra(unidade.id);        break;
        case "liberar_para_vistoria":   r = await liberarParaVistoria(unidade.id); break;
        case "marcar_vistoria":         r = await marcarVistoria({ unidadeId: unidade.id, ...payload }); break;
        case "aprovar":                 r = await aprovarUnidade(unidade.id);      break;
        case "reprovar":                r = await reprovarUnidade(unidade.id);     break;
        case "reagendar":               r = await reagendarUnidade({ unidadeId: unidade.id, ...payload }); break;
        case "marcar_entregue":         r = await marcarEntregue(unidade.id);      break;
        case "enviar_para_correcao":    r = await enviarParaCorrecao(unidade.id);    break;
        case "liberar_para_revistoria": r = await liberarParaRevistoria(unidade.id); break;
        case "agendar_revistoria":      r = await agendarRevistoria({ unidadeId: unidade.id, ...payload }); break;
        case "desfazer": {
          const x = await desfazerUltimaAlteracao(unidade.id);
          if (x?.erro) { toast.erro(x.erro); return; }
          await recarregar();
          const supabase = createClient();
          const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
          if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
          toast.sucesso(`${formatarUnidade(unidade.identificador)}: alteracao desfeita`);
          return;
        }
      }
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      toast.sucesso(`${formatarUnidade(unidade.identificador)}: ${ACAO_LABELS[acao]} aplicada`, {
        duracaoMs: 10000, acaoLabel: "Desfazer",
        acao: async () => {
          const x = await desfazerUltimaAlteracao(unidade.id);
          if (x?.erro) { toast.erro(x.erro); return; }
          await recarregar();
          const supabase = createClient();
          const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
          if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
          toast.sucesso(`${formatarUnidade(unidade.identificador)}: alteracao desfeita`);
        }
      });
      setFormAcao(null);
    });
  }

  function aplicarResetar() {
    start(async () => {
      const r = await resetarUnidade(unidade.id, motivoReset || null);
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      setConfirmarReset(false);
      setMotivoReset("");
      toast.sucesso(`${formatarUnidade(unidade.identificador)} resetada para em obra`);
    });
  }

  function aplicarAlteracaoManual(novo: StatusUnidade, motivo: string) {
    start(async () => {
      const r = await alterarEtapaManualmente(unidade.id, novo, motivo || null);
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      setModalEtapa(false);
      toast.sucesso(`${formatarUnidade(unidade.identificador)}: etapa alterada para ${STATUS_LABELS[novo]}`);
    });
  }

  function aplicarReverter(historicoId: number, motivo: string) {
    start(async () => {
      const r = await reverterParaEvento(unidade.id, historicoId, motivo || null);
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      toast.sucesso(`${formatarUnidade(unidade.identificador)}: revertida para ${STATUS_LABELS[r.para as StatusUnidade]}`);
    });
  }

  function salvarObs() {
    start(async () => {
      const r = await atualizarObservacoesUnidade(unidade.id, obs);
      if (r?.erro) { toast.erro(r.erro); return; }
      setObsDirty(false);
      onChanged({ ...unidade, observacoes: obs });
      toast.sucesso("Observacoes salvas");
    });
  }

  function aplicarRemarcar(data_agendada: string) {
    start(async () => {
      const r = await remarcarVistoriaAtiva({ unidadeId: unidade.id, data_agendada });
      if (r?.erro) { toast.erro(r.erro); return; }
      await recarregar();
      setFormAcao(null);
      toast.sucesso(`${formatarUnidade(unidade.identificador)}: vistoria reagendada`);
    });
  }

  const timeline = useMemo(() => construirTimeline(historico ?? [], agendas ?? [], perfisMap), [historico, agendas, perfisMap]);
  const acoesComForm = new Set<AcaoUnidade>(["marcar_vistoria", "reagendar", "agendar_revistoria", "remarcar_horario"]);

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <aside className="relative ml-auto w-full sm:max-w-xl bg-white h-full overflow-y-auto shadow-2xl animate-[slidein_.15s_ease-out]">
        <div className="px-6 py-5 border-b sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">
                Pavimento {String(unidade.pavimento).padStart(2, "0")} · {unidade.identificador}
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {formatarUnidade(unidade.identificador)}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded ${cor.chip}`}>
                  {STATUS_LABELS_UI[ui]}
                </span>
                {(unidade.status === "em_correcao_pos_reprovacao" || unidade.status === "pronta_revistoria") && (
                  <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                    pos-reprovacao
                  </span>
                )}
                {ultimaAlteracao && (
                  <span className="text-[11px] text-gray-500">
                    Ultima alteracao: {new Date(ultimaAlteracao.alterado_em).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none" aria-label="Fechar">&times;</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section className="grid sm:grid-cols-2 gap-3">
            <Card titulo="Cliente vinculado">
              {clienteAtual ? (
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{clienteAtual.nome}</div>
                  {clienteAtual.telefone && (
                    <a href={`tel:${clienteAtual.telefone}`} className="text-blue-700 hover:underline block">{clienteAtual.telefone}</a>
                  )}
                  {clienteAtual.email && (
                    <a href={`mailto:${clienteAtual.email}`} className="text-blue-700 hover:underline block">{clienteAtual.email}</a>
                  )}
                </div>
              ) : <div className="text-sm text-gray-500">Sem cliente vinculado.</div>}
            </Card>
            <Card titulo="Vistoria em aberto">
              {agendaAtiva ? (
                <div className="text-sm">
                  <div className="font-medium">{new Date(agendaAtiva.data_agendada).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-gray-500">{agendaAtiva.tipo} · {agendaAtiva.duracao_min}min · {agendaAtiva.status_agenda}</div>
                  {agendaAtivaAtrasada && (
                    <div className="mt-1 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 inline-block">
                      data ja passou — use "Reagendar" para uma nova data
                    </div>
                  )}
                </div>
              ) : <div className="text-sm text-gray-500">Nenhuma vistoria em aberto.</div>}
            </Card>
          </section>

          {somenteLeitura && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              Modo leitura — visualizacao apenas.
            </div>
          )}

          {!somenteLeitura && <section>
            <div className="text-xs font-medium text-gray-600 mb-2">Acoes rapidas</div>
            {unidade.status === "reprovada" && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
                <strong>Unidade reprovada.</strong> Use <em>Enviar para correcao</em> para iniciar o fluxo controlado
                ou <em>Reagendar direto</em> para agendar revistoria imediatamente.
              </div>
            )}
            {unidade.status === "em_correcao_pos_reprovacao" && (
              <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-900">
                <strong>Em correcao pos-reprovacao.</strong> Quando a obra terminar, clique em <em>Liberar para revistoria</em>.
              </div>
            )}
            {unidade.status === "pronta_revistoria" && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                <strong>Pronta para revistoria.</strong> Agende a revistoria com o cliente.
              </div>
            )}
            {acoes.length === 0 && <div className="text-sm text-gray-500">Nenhuma acao disponivel neste status.</div>}
            <div className="flex flex-wrap gap-2">
              {acoes.map((a) => (
                <button key={a} disabled={pending}
                  onClick={() => { if (acoesComForm.has(a)) { setFormAcao(a as FormAcaoTipo); } else { aplicar(a); } }}
                  className={`text-sm px-3 py-2 rounded-md font-medium disabled:opacity-50 transition ${ACAO_COR[a]}`}>
                  {ACAO_LABELS[a]}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
              <button onClick={() => setModalEtapa(true)}
                className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50">
                Alterar etapa manualmente
              </button>
              {!confirmarReset ? (
                <button onClick={() => setConfirmarReset(true)}
                  className="text-xs px-3 py-1.5 rounded border text-red-700 hover:bg-red-50">
                  &#8634; Resetar operacional
                </button>
              ) : (
                <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium text-red-900">Resetar {unidade.identificador}?</div>
                  <ul className="text-xs text-red-900 list-disc list-inside space-y-0.5">
                    <li>Cancela agendas em aberto desta unidade</li>
                    <li>Volta o status para <b>em obra</b></li>
                    <li><b>Mantem</b> o cliente vinculado e os dados do imovel</li>
                    <li>O historico de auditoria <b>nao</b> e apagado</li>
                  </ul>
                  <input value={motivoReset} onChange={(e) => setMotivoReset(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="w-full text-xs border rounded px-2 py-1.5 bg-white" />
                  <div className="flex gap-2">
                    <button disabled={pending} onClick={aplicarResetar}
                      className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      {pending ? "Resetando..." : "Sim, resetar"}
                    </button>
                    <button onClick={() => { setConfirmarReset(false); setMotivoReset(""); }}
                      className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {formAcao && (
              <FormAgendaInline tipo={formAcao} clientes={clientes} clienteAtualId={unidade.cliente_atual_id}
                dataInicial={formAcao === "remarcar_horario" && agendaAtiva ? toLocalInput(agendaAtiva.data_agendada) : undefined}
                pending={pending} onCancel={() => setFormAcao(null)}
                onSubmit={(dados) => {
                  if (formAcao === "remarcar_horario") aplicarRemarcar(dados.data_agendada);
                  else aplicar(formAcao, dados);
                }} />
            )}
          </section>}

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-600">Observacoes operacionais</div>
              {obsDirty && !somenteLeitura && (
                <button disabled={pending} onClick={salvarObs}
                  className="text-xs px-2 py-1 rounded bg-gray-900 text-white disabled:opacity-50">Salvar</button>
              )}
            </div>
            <textarea rows={3} value={obs} onChange={(e) => { setObs(e.target.value); setObsDirty(true); }}
              placeholder="ex.: cliente pediu horario apos 18h"
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </section>

          <section>
            <div className="text-xs font-medium text-gray-600 mb-2">Termos de Recebimento</div>
            <TermosSection
              unidadeId={unidade.id}
              termos={termos ?? []}
              agendas={agendas ?? []}
              somenteLeitura={somenteLeitura}
              onAnexado={recarregar}
            />
          </section>

          <section>
            <div className="text-xs font-medium text-gray-600 mb-2">Timeline</div>
            <ol className="space-y-3">
              {timeline.length === 0 && <li className="text-sm text-gray-500">Sem eventos.</li>}
              {timeline.map((ev, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${ev.cor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{ev.titulo}</div>
                      {ev.podeReverter && ev.historicoId !== undefined && (
                        <button
                          disabled={pending}
                          onClick={() => {
                            const motivo = window.prompt("Motivo da reversao (opcional):") ?? "";
                            aplicarReverter(ev.historicoId!, motivo);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded border bg-white hover:bg-gray-50 whitespace-nowrap"
                          title="Reverter unidade para o estado anterior a este evento"
                        >
                          Reverter ate aqui
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {ev.quando}
                      {ev.origem && ev.origem !== "sistema" && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                          {ev.origem}
                        </span>
                      )}
                      {ev.usuario && <span className="ml-2">por {ev.usuario}</span>}
                    </div>
                    {ev.motivo && (
                      <div className="text-[11px] text-gray-700 mt-0.5 italic">"{ev.motivo}"</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {modalEtapa && (
          <ModalAlterarEtapa
            statusAtual={unidade.status}
            pending={pending}
            onCancel={() => setModalEtapa(false)}
            onConfirmar={aplicarAlteracaoManual}
          />
        )}
      </aside>
    </div>
  );
}

function ModalAlterarEtapa({
  statusAtual, pending, onCancel, onConfirmar,
}: {
  statusAtual: StatusUnidade;
  pending: boolean;
  onCancel: () => void;
  onConfirmar: (novo: StatusUnidade, motivo: string) => void;
}) {
  const [novo, setNovo] = useState<StatusUnidade>(statusAtual);
  const [motivo, setMotivo] = useState("");
  const regressao = ehRegressao(statusAtual, novo);
  const mesmoStatus = novo === statusAtual;
  const motivoFaltando = regressao && motivo.trim().length === 0;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-base font-semibold">Alterar etapa manualmente</div>
          <div className="text-xs text-gray-500">
            Etapa atual: <b>{STATUS_LABELS[statusAtual]}</b>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600">Nova etapa</label>
          <select value={novo} onChange={(e) => setNovo(e.target.value as StatusUnidade)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white">
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}{s === statusAtual ? " (atual)" : ""}</option>
            ))}
          </select>
        </div>

        {regressao && (
          <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-900">
            <b>Atencao:</b> voce esta voltando para uma etapa anterior do fluxo.
            Confirme apenas se for uma correcao operacional. Informe o motivo abaixo.
          </div>
        )}

        <div>
          <label className="text-xs text-gray-600">
            Motivo {regressao ? <span className="text-red-600">*</span> : "(opcional)"}
          </label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="ex.: equipe precisou retornar unidade para corrigir item"
            className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded border">Cancelar</button>
          <button
            disabled={pending || mesmoStatus || motivoFaltando}
            onClick={() => onConfirmar(novo, motivo.trim())}
            className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white disabled:opacity-50"
          >
            {pending ? "Aplicando..." : "Confirmar alteracao"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TermosSection({ unidadeId, termos, agendas, somenteLeitura = false, onAnexado }: {
  unidadeId: string;
  termos: TermoUnidade[];
  agendas: Agenda[];
  somenteLeitura?: boolean;
  onAnexado: () => Promise<void>;
}) {
  const toast = useToast();
  const [anexando, setAnexando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [agendaId, setAgendaId] = useState<string>("");
  const [resultadoManual, setResultadoManual] = useState<"aprovacao" | "reprovacao">("reprovacao");

  const agendasConcluidas = agendas.filter(
    (a) => a.status_agenda === "concluida" && a.resultado && a.resultado !== "pendente"
  );
  const agendaSelecionada = agendasConcluidas.find((a) => a.id === agendaId);
  const temAgenda = agendasConcluidas.length > 0;

  function abrirForm() {
    const primeira = agendasConcluidas[0];
    setAgendaId(primeira?.id ?? "");
    setArquivo(null);
    setAnexando(true);
  }

  const resultadoFinal: "aprovacao" | "reprovacao" = agendaSelecionada
    ? (agendaSelecionada.resultado === "aprovada" ? "aprovacao" : "reprovacao")
    : resultadoManual;

  async function handleUpload() {
    if (!arquivo) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = arquivo.name.split(".").pop() ?? "pdf";
      const path = `${unidadeId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("termos-unidade").upload(path, arquivo);
      if (upErr) { toast.erro(upErr.message); return; }
      const r = await salvarTermo({
        unidadeId,
        agendaId: agendaSelecionada?.id ?? null,
        resultado: resultadoFinal,
        arquivoPath: path,
      });
      if (r.erro) {
        await supabase.storage.from("termos-unidade").remove([path]);
        toast.erro(r.erro);
        return;
      }
      setAnexando(false);
      setArquivo(null);
      await onAnexado();
      toast.sucesso("Termo anexado");
    } finally {
      setUploading(false);
    }
  }

  async function handleBaixar(arquivoPath: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("termos-unidade").createSignedUrl(arquivoPath, 300);
    if (error || !data) { toast.erro("Erro ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleExcluir(termoId: string, arquivoPath: string) {
    const r = await excluirTermo(termoId, arquivoPath);
    if (r.erro) { toast.erro(r.erro); return; }
    await onAnexado();
    toast.sucesso("Termo removido");
  }

  return (
    <div className="space-y-2">
      {termos.length === 0 && !anexando && (
        <div className="text-sm text-gray-500">Nenhum termo anexado.</div>
      )}

      {termos.length > 0 && (
        <ul className="space-y-2">
          {termos.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2 bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  t.resultado === "aprovacao"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  {t.resultado === "aprovacao" ? "Aprovacao" : "Reprovacao"}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {new Date(t.anexado_em).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => handleBaixar(t.arquivo_path)}
                  className="text-xs px-2 py-1 rounded border text-blue-700 hover:bg-blue-50">
                  Baixar
                </button>
                {!somenteLeitura && (
                  <button
                    onClick={() => handleExcluir(t.id, t.arquivo_path)}
                    className="text-xs px-2 py-1 rounded border text-red-700 hover:bg-red-50">
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!anexando && !somenteLeitura && (
        <button
          onClick={abrirForm}
          className="w-full text-xs px-3 py-2 rounded border border-dashed border-gray-400 text-gray-700 hover:bg-gray-50">
          + Anexar Termo
        </button>
      )}

      {anexando && (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="text-xs font-medium text-gray-700">Anexar Termo de Recebimento</div>

          {temAgenda ? (
            <>
              <select
                value={agendaId}
                onChange={(e) => setAgendaId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="">— sem vistoria vinculada —</option>
                {agendasConcluidas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.data_agendada).toLocaleString("pt-BR")} — {a.tipo} — {a.resultado}
                  </option>
                ))}
              </select>
              {agendaSelecionada && (
                <div className="text-xs text-gray-600">
                  Resultado:{" "}
                  <span className={agendaSelecionada.resultado === "aprovada" ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                    {agendaSelecionada.resultado === "aprovada" ? "Aprovada" : "Reprovada"}
                  </span>
                </div>
              )}
              {!agendaSelecionada && (
                <select
                  value={resultadoManual}
                  onChange={(e) => setResultadoManual(e.target.value as "aprovacao" | "reprovacao")}
                  className="w-full border rounded px-3 py-2 text-sm bg-white">
                  <option value="reprovacao">Reprovacao</option>
                  <option value="aprovacao">Aprovacao</option>
                </select>
              )}
            </>
          ) : (
            <select
              value={resultadoManual}
              onChange={(e) => setResultadoManual(e.target.value as "aprovacao" | "reprovacao")}
              className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="reprovacao">Reprovacao</option>
              <option value="aprovacao">Aprovacao</option>
            </select>
          )}

          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="text-sm w-full" />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAnexando(false); setArquivo(null); }}
              className="text-xs px-3 py-1.5 rounded border">
              Cancelar
            </button>
            <button
              disabled={!arquivo || uploading}
              onClick={handleUpload}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">
              {uploading ? "Enviando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{titulo}</div>
      {children}
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function FormAgendaInline({ tipo, clientes, clienteAtualId, dataInicial, pending, onCancel, onSubmit }: {
  tipo: FormAcaoTipo; clientes: { id: string; nome: string }[]; clienteAtualId: string | null;
  dataInicial?: string;
  pending: boolean; onCancel: () => void;
  onSubmit: (dados: { data_agendada: string; cliente_id?: string; observacoes?: string }) => void;
}) {
  const [data, setData] = useState<string>(dataInicial ?? "");
  const [clienteId, setClienteId] = useState<string>(clienteAtualId ?? "");
  const [observacoes, setObservacoes] = useState<string>("");

  const ehRemarcar = tipo === "remarcar_horario";
  const titulo = tipo === "marcar_vistoria" ? "Agendar 1a vistoria"
    : tipo === "agendar_revistoria" ? "Agendar revistoria (pos-correcao)"
    : ehRemarcar ? "Reagendar vistoria (nova data/horario)"
    : "Agendar revistoria";

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!data) return;
      onSubmit({ data_agendada: new Date(data).toISOString(), cliente_id: clienteId || undefined, observacoes: observacoes || undefined });
    }} className="mt-3 bg-gray-50 border rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-gray-700">{titulo}</div>
      <div className={`grid gap-2 ${ehRemarcar ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        <input required type="datetime-local" value={data} onChange={(e) => setData(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm bg-white" />
        {!ehRemarcar && (
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white">
            <option value="">(sem cliente)</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>
      {!ehRemarcar && (
        <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
          placeholder="observacoes (opcional)" className="w-full border rounded px-3 py-2 text-sm bg-white" />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
        <button type="submit" disabled={pending} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">
          {pending ? "..." : "Confirmar"}
        </button>
      </div>
    </form>
  );
}

type EvTimeline = {
  titulo: string; quando: string; cor: string; tsMs: number;
  historicoId?: number; podeReverter?: boolean;
  motivo?: string | null; origem?: string | null; usuario?: string | null;
};
function construirTimeline(historico: HistoricoStatus[], agendas: Agenda[], perfisMap: Record<string, string>): EvTimeline[] {
  const evs: EvTimeline[] = [];
  for (const h of historico) {
    const ts = new Date(h.alterado_em).getTime();
    const ui = dbParaUI(h.status_novo as StatusUnidade);
    const titulo = h.status_anterior
      ? `Status: ${STATUS_LABELS_UI[dbParaUI(h.status_anterior as StatusUnidade)]} -> ${STATUS_LABELS_UI[ui]}`
      : `Status inicial: ${STATUS_LABELS_UI[ui]}`;
    const nomeUsuario = h.alterado_por ? (perfisMap[h.alterado_por] ?? h.alterado_por.slice(0, 8)) : null;
    evs.push({
      titulo,
      quando: new Date(h.alterado_em).toLocaleString("pt-BR"),
      cor: STATUS_COLORS_UI[ui].bg, tsMs: ts,
      historicoId: h.id, podeReverter: h.status_anterior !== null,
      motivo: h.motivo, origem: h.origem, usuario: nomeUsuario,
    });
  }
  for (const a of agendas) {
    const ts = new Date(a.data_agendada).getTime();
    const nomeAgendador = a.created_by ? (perfisMap[a.created_by] ?? a.created_by.slice(0, 8)) : null;
    evs.push({
      titulo: `Agenda ${a.tipo} - ${a.status_agenda}${a.resultado ? ` - ${a.resultado}` : ""}`,
      quando: new Date(a.data_agendada).toLocaleString("pt-BR"),
      cor: a.status_agenda === "cancelada" ? "bg-gray-400" : a.resultado === "aprovada" ? "bg-emerald-500" : a.resultado === "reprovada" ? "bg-red-500" : "bg-blue-500",
      tsMs: ts, usuario: nomeAgendador,
    });
  }
  evs.sort((a, b) => b.tsMs - a.tsMs);
  return evs;
}

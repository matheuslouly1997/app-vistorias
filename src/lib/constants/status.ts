/**
 * Status do banco (9 valores oficiais — schema v2):
 *   em_obra, em_correcao, finalizada_obra, agendado,
 *   aprovada_1a, reprovada, revistoria, aprovada_2a_mais, entregue
 *
 * Status da UI (7 valores simplificados — Fase 2 Onda 1):
 *   em_obra, finalizada_obra, agendada, aprovada, reprovada, reagendada, entregue
 *
 * Mapeamento UI -> banco:
 *   em_obra         <- em_obra | em_correcao
 *   finalizada_obra <- finalizada_obra
 *   agendada        <- agendado
 *   aprovada        <- aprovada_1a | aprovada_2a_mais
 *   reprovada       <- reprovada
 *   reagendada      <- revistoria
 *   entregue        <- entregue
 */
import type { StatusUnidade } from "@/lib/types/database";

export type StatusUI =
  | "em_obra"
  | "finalizada_obra"
  | "agendada"
  | "aprovada"
  | "reprovada"
  | "reagendada"
  | "entregue";

/** Reduz qualquer status do banco para o status da UI correspondente. */
export function dbParaUI(s: StatusUnidade): StatusUI {
  switch (s) {
    case "em_obra":
    case "em_correcao":      return "em_obra";
    case "finalizada_obra":  return "finalizada_obra";
    case "agendado":         return "agendada";
    case "aprovada_1a":
    case "aprovada_2a_mais": return "aprovada";
    case "reprovada":        return "reprovada";
    case "revistoria":       return "reagendada";
    case "entregue":         return "entregue";
  }
}

export const STATUS_LABELS_UI: Record<StatusUI, string> = {
  em_obra:         "Em obra",
  finalizada_obra: "Finalizada (obra)",
  agendada:        "Agendada",
  aprovada:        "Aprovada",
  reprovada:       "Reprovada",
  reagendada:      "Reagendada",
  entregue:        "Entregue"
};

export const STATUS_COLORS_UI: Record<StatusUI, { bg: string; text: string; ring: string; chip: string }> = {
  em_obra:         { bg: "bg-slate-200",    text: "text-slate-800",   ring: "ring-slate-400",   chip: "bg-slate-100 text-slate-700" },
  finalizada_obra: { bg: "bg-sky-200",      text: "text-sky-900",     ring: "ring-sky-500",     chip: "bg-sky-100 text-sky-800" },
  agendada:        { bg: "bg-blue-500",     text: "text-white",       ring: "ring-blue-700",    chip: "bg-blue-100 text-blue-800" },
  aprovada:        { bg: "bg-emerald-500",  text: "text-white",       ring: "ring-emerald-700", chip: "bg-emerald-100 text-emerald-800" },
  reprovada:       { bg: "bg-red-500",      text: "text-white",       ring: "ring-red-700",     chip: "bg-red-100 text-red-800" },
  reagendada:      { bg: "bg-orange-500",   text: "text-white",       ring: "ring-orange-700",  chip: "bg-orange-100 text-orange-800" },
  entregue:        { bg: "bg-slate-900",    text: "text-white",       ring: "ring-black",       chip: "bg-slate-900 text-white" }
};

export const STATUS_ORDER_UI: StatusUI[] = [
  "em_obra",
  "finalizada_obra",
  "agendada",
  "aprovada",
  "reprovada",
  "reagendada",
  "entregue"
];

// ============================================================
// Acoes operacionais — Onda 1
// ============================================================

export type AcaoUnidade =
  | "marcar_em_correcao"      // em_obra -> em_correcao
  | "voltar_em_obra"           // em_correcao -> em_obra
  | "liberar_para_vistoria"    // em_obra/em_correcao -> finalizada_obra
  | "marcar_vistoria"          // finalizada_obra -> agendado (cria agenda)
  | "aprovar"                  // agendado -> aprovada_1a; revistoria -> aprovada_2a_mais
  | "reprovar"                 // agendado/revistoria -> reprovada
  | "reagendar"                // reprovada -> revistoria (cria nova agenda)
  | "marcar_entregue"          // aprovada_* -> entregue
  | "desfazer";                // reverte ultima mudanca via historico_status

/** Acoes disponiveis a partir de um status do banco. */
export function acoesPermitidas(s: StatusUnidade): AcaoUnidade[] {
  switch (s) {
    case "em_obra":          return ["marcar_em_correcao", "liberar_para_vistoria"];
    case "em_correcao":      return ["voltar_em_obra",     "liberar_para_vistoria"];
    case "finalizada_obra":  return ["marcar_vistoria"];
    case "agendado":         return ["aprovar", "reprovar"];
    case "reprovada":        return ["reagendar"];
    case "revistoria":       return ["aprovar", "reprovar"];
    case "aprovada_1a":
    case "aprovada_2a_mais": return ["marcar_entregue"];
    case "entregue":         return [];
  }
}

export const ACAO_LABELS: Record<AcaoUnidade, string> = {
  marcar_em_correcao:    "Marcar correção",
  voltar_em_obra:        "Voltar para obra",
  liberar_para_vistoria: "Liberar para vistoria",
  marcar_vistoria:       "Marcar vistoria",
  aprovar:               "Aprovar",
  reprovar:              "Reprovar",
  reagendar:             "Reagendar",
  marcar_entregue:       "Marcar entregue",
  desfazer:              "Desfazer última"
};

export const ACAO_COR: Record<AcaoUnidade, string> = {
  marcar_em_correcao:    "bg-slate-700 hover:bg-slate-800 text-white",
  voltar_em_obra:        "bg-slate-700 hover:bg-slate-800 text-white",
  liberar_para_vistoria: "bg-sky-600 hover:bg-sky-700 text-white",
  marcar_vistoria:       "bg-blue-600 hover:bg-blue-700 text-white",
  aprovar:               "bg-emerald-600 hover:bg-emerald-700 text-white",
  reprovar:              "bg-red-600 hover:bg-red-700 text-white",
  reagendar:             "bg-orange-600 hover:bg-orange-700 text-white",
  marcar_entregue:       "bg-slate-900 hover:bg-black text-white",
  desfazer:              "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
};

// ============================================================
// Compat — exports antigos usados em outras telas (Onda 1 nao migra tudo)
// ============================================================
export const STATUS_LABELS: Record<StatusUnidade, string> = {
  em_obra:          "Em obra",
  em_correcao:      "Em correção",
  finalizada_obra:  "Finalizada (obra)",
  agendado:         "Agendada",
  aprovada_1a:      "Aprovada (1ª)",
  reprovada:        "Reprovada",
  revistoria:       "Reagendada",
  aprovada_2a_mais: "Aprovada (2ª+)",
  entregue:         "Entregue"
};
export const STATUS_COLORS: Record<StatusUnidade, { bg: string; text: string; ring: string }> = {
  em_obra:          STATUS_COLORS_UI.em_obra,
  em_correcao:      STATUS_COLORS_UI.em_obra,
  finalizada_obra:  STATUS_COLORS_UI.finalizada_obra,
  agendado:         STATUS_COLORS_UI.agendada,
  aprovada_1a:      STATUS_COLORS_UI.aprovada,
  reprovada:        STATUS_COLORS_UI.reprovada,
  revistoria:       STATUS_COLORS_UI.reagendada,
  aprovada_2a_mais: STATUS_COLORS_UI.aprovada,
  entregue:         STATUS_COLORS_UI.entregue
};
export const STATUS_ORDER: StatusUnidade[] = [
  "em_obra", "em_correcao", "finalizada_obra", "agendado",
  "aprovada_1a", "reprovada", "revistoria", "aprovada_2a_mais", "entregue"
];
export const TRANSICOES_OBRA: Record<StatusUnidade, StatusUnidade[]> = {
  em_obra:          ["em_correcao", "finalizada_obra"],
  em_correcao:      ["em_obra", "finalizada_obra"],
  finalizada_obra:  ["em_correcao"],
  agendado:         [],
  aprovada_1a:      ["entregue"],
  reprovada:        [],
  revistoria:       [],
  aprovada_2a_mais: ["entregue"],
  entregue:         []
};

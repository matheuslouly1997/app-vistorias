import type { StatusUnidade } from "@/lib/types/database";

export type StatusUI =
  | "em_obra" | "finalizada_obra" | "agendada" | "aprovada" | "reprovada"
  | "reagendada" | "entregue" | "em_correcao_pos_reprovacao" | "pronta_revistoria";

export function dbParaUI(s: StatusUnidade): StatusUI {
  switch (s) {
    case "em_obra":
    case "em_correcao":                return "em_obra";
    case "finalizada_obra":            return "finalizada_obra";
    case "agendado":                   return "agendada";
    case "aprovada_1a":
    case "aprovada_2a_mais":           return "aprovada";
    case "reprovada":                  return "reprovada";
    case "revistoria":                 return "reagendada";
    case "entregue":                   return "entregue";
    case "em_correcao_pos_reprovacao": return "em_correcao_pos_reprovacao";
    case "pronta_revistoria":          return "pronta_revistoria";
  }
}

export const STATUS_LABELS_UI: Record<StatusUI, string> = {
  em_obra:                    "Em obra",
  finalizada_obra:            "Finalizada (obra)",
  agendada:                   "Agendada",
  aprovada:                   "Aprovada",
  reprovada:                  "Reprovada",
  reagendada:                 "Revistoria",
  entregue:                   "Entregue",
  em_correcao_pos_reprovacao: "Em correcao pos-reprovacao",
  pronta_revistoria:          "Pronta para revistoria",
};

export const STATUS_COLORS_UI: Record<StatusUI, { bg: string; text: string; ring: string; chip: string }> = {
  em_obra:         { bg: "bg-slate-200",   text: "text-slate-800",   ring: "ring-slate-400",   chip: "bg-slate-100 text-slate-700" },
  finalizada_obra: { bg: "bg-sky-200",     text: "text-sky-900",     ring: "ring-sky-500",     chip: "bg-sky-100 text-sky-800" },
  agendada:        { bg: "bg-blue-500",    text: "text-white",       ring: "ring-blue-700",    chip: "bg-blue-100 text-blue-800" },
  aprovada:        { bg: "bg-emerald-500", text: "text-white",       ring: "ring-emerald-700", chip: "bg-emerald-100 text-emerald-800" },
  reprovada:       { bg: "bg-red-500",     text: "text-white",       ring: "ring-red-700",     chip: "bg-red-100 text-red-800" },
  reagendada:      { bg: "bg-orange-500",  text: "text-white",       ring: "ring-orange-700",  chip: "bg-orange-100 text-orange-800" },
  entregue:        { bg: "bg-slate-900",   text: "text-white",       ring: "ring-black",       chip: "bg-slate-900 text-white" },
  em_correcao_pos_reprovacao: { bg: "bg-purple-700", text: "text-white", ring: "ring-purple-900", chip: "bg-purple-100 text-purple-900" },
  pronta_revistoria:          { bg: "bg-amber-500",  text: "text-white", ring: "ring-amber-700",  chip: "bg-amber-100 text-amber-900" },
};

export const STATUS_ORDER_UI: StatusUI[] = [
  "em_obra", "finalizada_obra", "agendada", "aprovada", "reprovada",
  "em_correcao_pos_reprovacao", "pronta_revistoria", "reagendada", "entregue",
];

export type AcaoUnidade =
  | "marcar_em_correcao" | "voltar_em_obra" | "liberar_para_vistoria"
  | "marcar_vistoria" | "aprovar" | "reprovar" | "reagendar" | "remarcar_horario"
  | "marcar_entregue" | "desfazer"
  | "enviar_para_correcao" | "liberar_para_revistoria" | "agendar_revistoria";

export function acoesPermitidas(s: StatusUnidade): AcaoUnidade[] {
  switch (s) {
    case "em_obra":          return ["marcar_em_correcao", "liberar_para_vistoria"];
    case "em_correcao":      return ["voltar_em_obra", "liberar_para_vistoria"];
    case "finalizada_obra":  return ["marcar_vistoria"];
    case "agendado":         return ["aprovar", "reprovar", "remarcar_horario"];
    case "reprovada":        return ["enviar_para_correcao", "reagendar"];
    case "revistoria":       return ["aprovar", "reprovar", "remarcar_horario"];
    case "aprovada_1a":
    case "aprovada_2a_mais": return ["marcar_entregue"];
    case "entregue":         return [];
    case "em_correcao_pos_reprovacao": return ["liberar_para_revistoria"];
    case "pronta_revistoria":          return ["agendar_revistoria"];
  }
}

export const ACAO_LABELS: Record<AcaoUnidade, string> = {
  marcar_em_correcao:        "Marcar correcao",
  voltar_em_obra:            "Voltar para obra",
  liberar_para_vistoria:     "Liberar para vistoria",
  marcar_vistoria:           "Marcar vistoria",
  aprovar:                   "Aprovar",
  reprovar:                  "Reprovar",
  reagendar:                 "Reagendar direto",
  remarcar_horario:          "Reagendar",
  marcar_entregue:           "Marcar entregue",
  desfazer:                  "Desfazer ultima",
  enviar_para_correcao:      "Enviar para correcao",
  liberar_para_revistoria:   "Liberar para revistoria",
  agendar_revistoria:        "Agendar revistoria",
};

export const ACAO_COR: Record<AcaoUnidade, string> = {
  marcar_em_correcao:        "bg-slate-700 hover:bg-slate-800 text-white",
  voltar_em_obra:            "bg-slate-700 hover:bg-slate-800 text-white",
  liberar_para_vistoria:     "bg-sky-600 hover:bg-sky-700 text-white",
  marcar_vistoria:           "bg-blue-600 hover:bg-blue-700 text-white",
  aprovar:                   "bg-emerald-600 hover:bg-emerald-700 text-white",
  reprovar:                  "bg-red-600 hover:bg-red-700 text-white",
  reagendar:                 "bg-orange-600 hover:bg-orange-700 text-white",
  remarcar_horario:          "bg-orange-600 hover:bg-orange-700 text-white",
  marcar_entregue:           "bg-slate-900 hover:bg-black text-white",
  desfazer:                  "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
  enviar_para_correcao:      "bg-purple-700 hover:bg-purple-800 text-white",
  liberar_para_revistoria:   "bg-amber-500 hover:bg-amber-600 text-white",
  agendar_revistoria:        "bg-blue-600 hover:bg-blue-700 text-white",
};

// Compat exports usados em outras telas
export const STATUS_LABELS: Record<StatusUnidade, string> = {
  em_obra:                    "Em obra",
  em_correcao:                "Em correcao",
  finalizada_obra:            "Finalizada (obra)",
  agendado:                   "Agendada",
  aprovada_1a:                "Aprovada (1a)",
  reprovada:                  "Reprovada",
  revistoria:                 "Revistoria",
  aprovada_2a_mais:           "Aprovada (2a+)",
  entregue:                   "Entregue",
  em_correcao_pos_reprovacao: "Em correcao pos-reprovacao",
  pronta_revistoria:          "Pronta para revistoria",
};

export const STATUS_COLORS: Record<StatusUnidade, { bg: string; text: string; ring: string }> = {
  em_obra:                    STATUS_COLORS_UI.em_obra,
  em_correcao:                STATUS_COLORS_UI.em_obra,
  finalizada_obra:            STATUS_COLORS_UI.finalizada_obra,
  agendado:                   STATUS_COLORS_UI.agendada,
  aprovada_1a:                STATUS_COLORS_UI.aprovada,
  reprovada:                  STATUS_COLORS_UI.reprovada,
  revistoria:                 STATUS_COLORS_UI.reagendada,
  aprovada_2a_mais:           STATUS_COLORS_UI.aprovada,
  entregue:                   STATUS_COLORS_UI.entregue,
  em_correcao_pos_reprovacao: STATUS_COLORS_UI.em_correcao_pos_reprovacao,
  pronta_revistoria:          STATUS_COLORS_UI.pronta_revistoria,
};

export const STATUS_ORDER: StatusUnidade[] = [
  "em_obra", "em_correcao", "finalizada_obra", "agendado",
  "aprovada_1a", "reprovada",
  "em_correcao_pos_reprovacao", "pronta_revistoria",
  "revistoria", "aprovada_2a_mais", "entregue",
];

export const TRANSICOES_OBRA: Record<StatusUnidade, StatusUnidade[]> = {
  em_obra:                    ["em_correcao", "finalizada_obra"],
  em_correcao:                ["em_obra", "finalizada_obra"],
  finalizada_obra:            ["em_correcao"],
  agendado:                   [],
  aprovada_1a:                ["entregue"],
  reprovada:                  ["em_correcao_pos_reprovacao", "revistoria"],
  revistoria:                 [],
  aprovada_2a_mais:           ["entregue"],
  entregue:                   [],
  em_correcao_pos_reprovacao: ["pronta_revistoria"],
  pronta_revistoria:          ["revistoria"],
};

// Tipos do schema v2 + migration 006 — mantidos a mao.

export type StatusUnidade =
  | "em_obra" | "em_correcao" | "finalizada_obra" | "agendado"
  | "aprovada_1a" | "reprovada" | "revistoria" | "aprovada_2a_mais" | "entregue"
  | "em_correcao_pos_reprovacao" | "pronta_revistoria";

export type StatusObra = "planejamento" | "ativa" | "pausada" | "encerrada";
export type PapelGlobal = "administrador" | "escritorio" | "obra" | "visualizador";
export type PapelObra = PapelGlobal;
export type StatusAgenda = "agendada" | "concluida" | "cancelada" | "remarcada";
export type ResultadoAgenda = "aprovada" | "reprovada" | "pendente";
export type TipoAgenda = "vistoria_1a" | "revistoria" | "vistoria_extra";

export interface Obra {
  id: string; nome: string; endereco: string | null; status: StatusObra;
  data_inicio: string | null; observacoes: string | null; created_at: string; updated_at: string;
}
export interface Torre {
  id: string; obra_id: string; nome: string; qtd_pavimentos: number;
  layout_codigos: string[]; padrao_unidades: string | null; ordem: number; created_at: string;
}
export interface Cliente {
  id: string; obra_id: string; nome: string; cpf: string | null;
  email: string | null; telefone: string | null; observacoes: string | null; created_at: string;
}
export interface Unidade {
  id: string; obra_id: string; torre_id: string; pavimento: number;
  codigo_unidade: string; identificador: string; status: StatusUnidade;
  cliente_atual_id: string | null; observacoes: string | null; updated_at: string;
}
export interface Agenda {
  id: string; obra_id: string; unidade_id: string; cliente_id: string | null;
  tipo: TipoAgenda; data_agendada: string; duracao_min: number;
  status_agenda: StatusAgenda; resultado: ResultadoAgenda | null;
  responsavel_id: string | null; observacoes: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export interface TermoUnidade {
  id: string;
  unidade_id: string;
  agenda_id: string | null;
  resultado: "reprovacao" | "aprovacao";
  arquivo_path: string;
  anexado_por: string | null;
  anexado_em: string;
  data_assinatura: string | null;
  data_agendamento_real: string | null;
}
export type OrigemHistorico = "sistema" | "acao" | "manual" | "reset" | "desfazer" | "reverter";

export interface HistoricoStatus {
  id: number; unidade_id: string; obra_id: string;
  status_anterior: StatusUnidade | null; status_novo: StatusUnidade;
  agenda_id: string | null; motivo: string | null;
  alterado_por: string | null; alterado_em: string;
  origem: OrigemHistorico;
}
export interface Perfil {
  id: string; nome: string; email: string; papel: PapelGlobal; ativo: boolean; created_at: string;
}
export interface PerfilObra {
  perfil_id: string; obra_id: string; papel_obra: PapelObra | null;
}
export interface CentralAprovacao {
  obra_id: string; obra: string;
  em_obra: number; em_correcao: number; finalizada_obra: number;
  agendadas: number; aprovadas_1a_atual: number; reprovadas_atual: number;
  revistorias: number; aprovadas_2a_mais: number; entregues: number;
  vistoriadas: number; taxa_aprovacao_1a_atual: number;
  aprovadas_1a_hist: number; reprovadas_1a_hist: number;
  total_1a_vistoriadas_hist: number; taxa_aprovacao_1a_oficial: number;
}

type Tbl<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      obras:            Tbl<Obra>;
      torres:           Tbl<Torre>;
      clientes:         Tbl<Cliente>;
      unidades:         Tbl<Unidade>;
      agenda:           Tbl<Agenda>;
      historico_status: Tbl<HistoricoStatus>;
      termos_unidade:   Tbl<TermoUnidade>;
      perfis:           Tbl<Perfil>;
      perfis_obras:     Tbl<PerfilObra>;
      [key: string]:    { Row: any; Insert: any; Update: any; Relationships: any[] };
    };
    Views: {
      vw_central_aprovacao: { Row: CentralAprovacao; Relationships: [] };
      [key: string]: { Row: any; Relationships: any[] };
    };
    Functions:      { [key: string]: any };
    Enums:          { [key: string]: any };
    CompositeTypes: { [key: string]: any };
  };
};

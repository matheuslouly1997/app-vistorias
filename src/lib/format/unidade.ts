// Helpers de exibicao do identificador de unidade.
//
// O identificador armazenado segue o padrao "<TORRE>-<PAVIMENTO><NUMERO><LETRA>"
// (ex: "A-1002A", "B-0602A"). A primeira letra antes do "-" identifica a torre.
//
// Para a UI, o padrao operacional escolhido e:
//   "1002A - Torre A"
//
// Em superfícies muito densas (chips, células de tabela curtas) usar a
// variante compacta `unidadeCompacta` que retorna "1002A·A".

/** Quebra "A-1002A" em { torre: "A", codigo: "1002A" }. */
export function parseIdentificador(identificador: string): { torre: string; codigo: string } {
  const idx = identificador.indexOf("-");
  if (idx <= 0) return { torre: "", codigo: identificador };
  return { torre: identificador.slice(0, idx), codigo: identificador.slice(idx + 1) };
}

/** Formato padrao: "1002A - Torre A". */
export function formatarUnidade(identificador: string): string {
  const { torre, codigo } = parseIdentificador(identificador);
  return torre ? `${codigo} - Torre ${torre}` : codigo;
}

/** Variante para celulas densas: "1002A · A". */
export function unidadeCompacta(identificador: string): string {
  const { torre, codigo } = parseIdentificador(identificador);
  return torre ? `${codigo} · ${torre}` : codigo;
}

/** So o codigo da unidade (sem torre). Ex: "1002A". */
export function codigoUnidade(identificador: string): string {
  return parseIdentificador(identificador).codigo;
}

/** So a torre. Ex: "A". */
export function torreDoIdentificador(identificador: string): string {
  return parseIdentificador(identificador).torre;
}

// Lógica pura para apagar um projeto (tela de Configuração). Apagar é
// irreversível e sem desfazer — ver CLAUDE.md, "aproveite para resolver o
// problema imediato" e src/servidor/projetos.ts > `apagarProjeto`.
//
// `sugestao` é evidência do portão de aprovação (`ON DELETE RESTRICT`,
// comentário em db/migrations/001_schema_inicial.sql); apagar o projeto
// apaga as sugestões dele junto, numa transação — mas só depois que o dono
// viu quantas e confirmou de olho aberto. Este arquivo é o que decide se
// essa confirmação é válida; a Server Action e a camada de dados chamam
// `confirmacaoDeNomeValida`, não reimplementam a checagem.

export interface ContagemExclusaoProjeto {
  relatorios: number;
  sugestoes: number;
  contextos: number;
  tarefas: number;
}

/**
 * Digitar o nome do projeto é o padrão conhecido para ação destrutiva sem
 * volta (mesmo gesto do GitHub para apagar um repositório). Comparação exata
 * depois de `trim` nas duas pontas — sem normalizar caixa: um nome digitado
 * "às pressas" e ligeiramente diferente do real não deveria passar só porque
 * a caixa bateu por acaso.
 */
export function confirmacaoDeNomeValida(nomeDigitado: string, nomeProjeto: string): boolean {
  const digitado = nomeDigitado.trim();
  return digitado.length > 0 && digitado === nomeProjeto.trim();
}

/** Soma total de linhas que somem junto com o projeto — para o resumo da confirmação. */
export function totalApagado(contagem: ContagemExclusaoProjeto): number {
  return contagem.relatorios + contagem.sugestoes + contagem.contextos + contagem.tarefas;
}

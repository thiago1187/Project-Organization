// Resolução entre o padrão global de um agente (`agente_padrao`, migration
// 012, ainda NÃO aplicada) e a configuração por projeto (`projeto_agente`,
// 005) — a peça central do pedido do dono ("predefinir instruções e
// configurações" no agente, e não repetir por projeto).
//
// A regra que este arquivo existe para não deixar ninguém quebrar por
// engano: SOBRESCREVE, nunca SOMA. Um campo preenchido em `projeto_agente`
// vence o padrão inteiro, mesmo que o padrão tivesse mais texto — os dois
// nunca são concatenados. Duas instruções coladas viram texto contraditório
// que ninguém escreveu de propósito, e o agente rodando às 3h não tem a quem
// perguntar qual das duas vale.
//
// Lógica pura, sem import de banco — mesmo padrão de esteiraAgentes.ts.

import type { AgentePadrao } from "./tipos";

/** De onde veio o valor efetivo — usado só para exibição ("usando o padrão deste agente"). */
export type OrigemConfiguracaoAgente = "projeto" | "padrao" | "nenhuma";

export interface ConfiguracaoEfetivaAgente {
  instrucao: string | null;
  origemInstrucao: OrigemConfiguracaoAgente;
  tetoSugestoes: number | null;
  origemTeto: OrigemConfiguracaoAgente;
}

/**
 * O valor que de fato vale para um agente num projeto: o override do projeto
 * quando presente, senão o padrão global, senão nada. `undefined` é tratado
 * como `null` nos dois primeiros parâmetros — o agente pode nunca ter tido
 * uma linha em `projeto_agente` (ver `EsteiraVM.inativos`, entrada virtual).
 *
 * Isto é o que `GET /api/projects` manda para a routine (o valor que precisa
 * ser efetivo de verdade) — a esteira de cada projeto usa o mesmo cálculo só
 * para decidir o que mostrar como "valendo agora" quando o campo do projeto
 * está vazio (ver `src/dominio/esteiraAgentes.ts`).
 */
export function resolverConfiguracaoAgente(
  instrucaoProjeto: string | null | undefined,
  tetoProjeto: number | null | undefined,
  padrao: Pick<AgentePadrao, "instrucao" | "teto_sugestoes"> | null | undefined,
): ConfiguracaoEfetivaAgente {
  const instrucao = instrucaoProjeto ?? padrao?.instrucao ?? null;
  const origemInstrucao: OrigemConfiguracaoAgente =
    instrucaoProjeto != null ? "projeto" : padrao?.instrucao != null ? "padrao" : "nenhuma";

  const tetoSugestoes = tetoProjeto ?? padrao?.teto_sugestoes ?? null;
  const origemTeto: OrigemConfiguracaoAgente =
    tetoProjeto != null ? "projeto" : padrao?.teto_sugestoes != null ? "padrao" : "nenhuma";

  return { instrucao, origemInstrucao, tetoSugestoes, origemTeto };
}

/** `agente_padrao` indexado pelo nome do agente — conveniência para quem resolve muitas linhas de uma vez (a esteira de um projeto, GET /api/projects). */
export function mapaAgentesPadrao(lista: readonly AgentePadrao[]): Map<string, AgentePadrao> {
  return new Map(lista.map((p) => [p.agente, p]));
}

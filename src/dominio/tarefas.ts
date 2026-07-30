// Ordenação de `tarefa` — pura, sem banco, reaproveitada pela tela de
// detalhe (src/dominio/visao.ts), por `GET /api/projects` e pelo gerador de
// prompt (src/dominio/prompt.ts), para que os três concordem sobre "a ordem
// gravada" sem duplicar a regra de desempate. Mesmo padrão de
// `agentesAtivosOrdenados` em src/dominio/esteiraAgentes.ts.

import type { EstadoTarefa, Tarefa } from "./tipos";

/**
 * Todas as tarefas de um projeto, na ordem gravada. `ordem` não tem UNIQUE
 * de propósito (ver comentário da coluna em db/migrations/009_tarefa.sql) —
 * empate desempata por `criado_em`, mesma regra de `projeto_agente.ordem`.
 */
export function ordenarTarefas(tarefas: Tarefa[]): Tarefa[] {
  return tarefas
    .slice()
    .sort((a, b) => a.ordem - b.ordem || new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
}

const ESTADOS_EM_ABERTO: readonly EstadoTarefa[] = ["aberta", "fazendo"];

/**
 * Tarefas ainda não concluídas, na ordem gravada — o que `GET /api/projects`
 * manda para a rodada (docs/plano-gerenciador-de-projeto.md § 6.1: tarefa
 * concluída não vai, a rodada não tem o que fazer com ela) e o que o
 * gerador de prompt lista como "em aberto" fora da seleção.
 */
export function tarefasEmAberto(tarefas: Tarefa[]): Tarefa[] {
  return ordenarTarefas(tarefas).filter((t) => ESTADOS_EM_ABERTO.includes(t.estado));
}

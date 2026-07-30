"use server";

// Server Actions de `tarefa` (tela de detalhe do projeto) — mesmo padrão de
// src/servidor/acoes-agentes.ts: `exigirSessaoDoDono()` como primeira linha
// (Server Action é endpoint HTTP invocável), estado devolvido em vez de
// lançado, revalidação da tela de detalhe ao final. Chamadas só pelo painel
// — a routine nunca escreve tarefa (ver o comentário no topo de
// src/servidor/tarefas.ts).

import { revalidatePath } from "next/cache";
import { validarEstadoTarefa, validarOrdemTarefas, validarTituloTarefa } from "@/dominio/validacaoTarefa";
import {
  apagarTarefa,
  atualizarTituloTarefa,
  criarTarefa,
  moverEstadoTarefa,
  reordenarTarefas,
} from "./tarefas";
import { AcessoNegado, exigirSessaoDoDono } from "./acesso";

async function verificarAcesso(): Promise<string | null> {
  try {
    await exigirSessaoDoDono();
    return null;
  } catch (erro) {
    if (erro instanceof AcessoNegado) return "Acesso negado.";
    throw erro;
  }
}

function mensagemDeErro(erro: unknown, fallback: string): string {
  return erro instanceof Error ? erro.message : fallback;
}

function projetoValido(projetoId: unknown): projetoId is string {
  return typeof projetoId === "string" && projetoId.length > 0;
}

export interface ResultadoTarefa {
  ok: boolean;
  erro: string | null;
}

/** Cria uma tarefa nova — o formulário "+ adicionar tarefa" do painel "onde estamos". */
export async function criarTarefaAction(projetoId: string, titulo: string): Promise<ResultadoTarefa> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  const validado = validarTituloTarefa(titulo);
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await criarTarefa(projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível criar a tarefa.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/** Edita o título de uma tarefa existente — edição no lugar. */
export async function editarTituloTarefaAction(
  projetoId: string,
  tarefaId: string,
  titulo: string,
): Promise<ResultadoTarefa> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };
  if (typeof tarefaId !== "string" || tarefaId.length === 0) return { ok: false, erro: "Tarefa inválida." };

  const validado = validarTituloTarefa(titulo);
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await atualizarTituloTarefa(tarefaId, projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar o título.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/**
 * Move uma tarefa para outro estado — a caixinha de concluir, o botão de
 * "começar agora" (→ fazendo) e o de reabrir (→ aberta). `feita → aberta` é
 * uma transição legítima aqui, ver o comentário em `moverEstadoTarefa`.
 */
export async function moverEstadoTarefaAction(
  projetoId: string,
  tarefaId: string,
  estado: string,
): Promise<ResultadoTarefa> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };
  if (typeof tarefaId !== "string" || tarefaId.length === 0) return { ok: false, erro: "Tarefa inválida." };

  const validado = validarEstadoTarefa(estado);
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await moverEstadoTarefa(tarefaId, projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível atualizar esta tarefa.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/** Reescreve a ordem das tarefas de um projeto — soltar um card em outra posição. */
export async function reordenarTarefasAction(projetoId: string, idsEmOrdem: string[]): Promise<ResultadoTarefa> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  const validado = validarOrdemTarefas(idsEmOrdem);
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await reordenarTarefas(projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível reordenar as tarefas.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/** Apaga uma tarefa — worklist não é auditoria, apagar é um gesto normal. */
export async function apagarTarefaAction(projetoId: string, tarefaId: string): Promise<ResultadoTarefa> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };
  if (typeof tarefaId !== "string" || tarefaId.length === 0) return { ok: false, erro: "Tarefa inválida." };

  try {
    await apagarTarefa(tarefaId, projetoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível apagar esta tarefa.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

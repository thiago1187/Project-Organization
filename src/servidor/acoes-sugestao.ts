"use server";

// Server Actions de decisão sobre `sugestao` — aprovar, recusar e marcar como
// feita. As três são do dono agora: a routine só lê (docs/proximos-passos.md
// item 2 — "tirar a execução da routine"). Mesmo padrão de
// src/servidor/acoes-projeto.ts: `exigirAcesso()` como primeira linha (Server
// Action é endpoint HTTP invocável), estado devolvido em vez de lançado,
// revalidação da tela de detalhe do projeto ao final.

import { revalidatePath } from "next/cache";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "./sugestoes";
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

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export interface ResultadoDecisaoSugestao {
  ok: boolean;
  erro: string | null;
}

/** Aprova uma sugestão pendente. `projetoId` só serve para saber qual rota revalidar. */
export async function aprovarSugestaoAction(
  sugestaoId: string,
  projetoId: string,
): Promise<ResultadoDecisaoSugestao> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!idValido(sugestaoId) || !idValido(projetoId)) {
    return { ok: false, erro: "Sugestão inválida." };
  }

  try {
    await aprovarSugestao(sugestaoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível aprovar a sugestão.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/** Recusa uma sugestão pendente. `projetoId` só serve para saber qual rota revalidar. */
export async function recusarSugestaoAction(
  sugestaoId: string,
  projetoId: string,
): Promise<ResultadoDecisaoSugestao> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!idValido(sugestaoId) || !idValido(projetoId)) {
    return { ok: false, erro: "Sugestão inválida." };
  }

  try {
    await recusarSugestao(sugestaoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível recusar a sugestão.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/**
 * Marca uma sugestão aprovada como feita, depois do trabalho ter acontecido
 * (pelo prompt gerado — ver src/dominio/prompt.ts). `link` é o que o dono tem
 * para mostrar (pull request, commit) e é opcional: nem todo trabalho
 * supervisionado passa por PR (ver CLAUDE.md > Convenções de trabalho).
 * `projetoId` só serve para saber qual rota revalidar.
 */
export async function marcarFeitaAction(
  sugestaoId: string,
  projetoId: string,
  link: string | null,
): Promise<ResultadoDecisaoSugestao> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!idValido(sugestaoId) || !idValido(projetoId)) {
    return { ok: false, erro: "Sugestão inválida." };
  }
  if (link !== null && typeof link !== "string") {
    return { ok: false, erro: "Link inválido." };
  }

  try {
    await marcarSugestaoFeita(sugestaoId, link);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível marcar esta sugestão como feita.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

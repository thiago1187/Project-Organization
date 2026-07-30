"use server";

// Server Actions de decisão sobre `sugestao` — aprovar e recusar. É tudo que
// o painel faz nessa tabela (marcar como "feita" é da routine, ver
// src/servidor/sugestoes.ts). Mesmo padrão de src/servidor/acoes-projeto.ts:
// `exigirAcesso()` como primeira linha (Server Action é endpoint HTTP
// invocável), estado devolvido em vez de lançado, revalidação da tela de
// detalhe do projeto ao final.

import { revalidatePath } from "next/cache";
import { aprovarSugestao, recusarSugestao } from "./sugestoes";
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

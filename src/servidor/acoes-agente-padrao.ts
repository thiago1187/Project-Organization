"use server";

// Server Action do padrão global de agente — a ficha /agentes/[nome], não a
// esteira de um projeto (essa é src/servidor/acoes-agentes.ts). Mesma forma:
// `exigirSessaoDoDono()` primeiro (Server Action é endpoint HTTP, ver
// src/servidor/acesso.ts), estado devolvido em vez de lançado, revalidação da
// tela ao final. Só o dono escreve aqui — a routine nunca configura o que os
// agentes fazem, só lê o resultado em GET /api/projects.
//
// Reaproveita a validação de src/dominio/validacaoAgenteProjeto.ts
// (`validarInstrucaoAgente`): o padrão global tem exatamente a mesma forma
// (instrucao + teto_sugestoes) que a instrução por projeto — ver o
// comentário no topo daquele arquivo para o porquê de não duplicar a regra.

import { revalidatePath } from "next/cache";
import { validarInstrucaoAgente, validarNomeAgente } from "@/dominio/validacaoAgenteProjeto";
import { salvarAgentePadrao } from "./agentesPadrao";
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

export interface ResultadoAgentePadrao {
  ok: boolean;
  erro: string | null;
}

/**
 * Salva instrução e teto padrão de um agente — vale em todo projeto onde ele
 * for ligado, exceto onde `projeto_agente` sobrescrever (ver
 * src/dominio/agentePadrao.ts > `resolverConfiguracaoAgente`, "sobrescreve,
 * nunca soma"). Chamada por EditorAgentePadrao.tsx.
 *
 * `instrucao`/`tetoSugestoes` chegam como string porque vêm direto de campo
 * de formulário de cliente (mesmo padrão de `salvarInstrucaoAgenteAction`,
 * que usa `useActionState` com `FormData` — aqui não há `useActionState`
 * porque o editor salva ao perder o foco, mesmo padrão de
 * `salvarDescricaoProjetoAction`/`DescricaoProjeto.tsx`).
 */
export async function salvarAgentePadraoAction(
  agente: string,
  instrucao: string,
  tetoSugestoes: string,
): Promise<ResultadoAgentePadrao> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  const nomeValidado = validarNomeAgente(agente);
  if (!nomeValidado.ok) return { ok: false, erro: nomeValidado.erro };

  const validado = validarInstrucaoAgente({ instrucao, teto_sugestoes: tetoSugestoes });
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await salvarAgentePadrao(nomeValidado.dados, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar o padrão deste agente.") };
  }

  // Todo projeto onde este agente estiver ligado pode ter mudado o que
  // mostra como "usando o padrão" — mas revalidar cada /projeto/[id] exigiria
  // saber quais, e a lista de projetos ativos já é reconsultada a cada visita
  // (dynamic = "force-dynamic", ver src/app/projeto/[id]/page.tsx). Só as
  // telas que exibem o padrão em si precisam de revalidação explícita.
  revalidatePath(`/agentes/${nomeValidado.dados}`);
  revalidatePath("/agentes");

  return { ok: true, erro: null };
}

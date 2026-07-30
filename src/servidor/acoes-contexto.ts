"use server";

// Server Actions do editor de contexto (tela de detalhe do projeto) — mesmo
// padrão de src/servidor/acoes-sugestao.ts: `exigirSessaoDoDono()` como
// primeira linha (Server Action é endpoint HTTP invocável, mesmo raciocínio
// de src/servidor/acesso.ts), estado devolvido em vez de lançado, revalidação
// da tela de detalhe ao final. Chamadas só pelo painel — a routine nunca
// escreve contexto (regra 4 do CLAUDE.md, exceção deliberada).

import { revalidatePath } from "next/cache";
import { validarContexto } from "@/dominio/validacaoContexto";
import { deletarContexto, upsertContexto } from "./contextos";
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

export interface EstadoFormContexto {
  ok: boolean;
  erro: string | null;
  campos: { agente_destino?: string; tipo?: string; conteudo?: string; arquivo_url?: string };
}

const ESTADO_INICIAL_CAMPOS = { agente_destino: "", tipo: "", conteudo: "", arquivo_url: "" };

/**
 * Cria ou substitui um item de contexto — upsert por
 * `(projeto_id, agente_destino, tipo)` (ver `upsertContexto`,
 * src/servidor/contextos.ts). Usada tanto pelo formulário "+ adicionar
 * contexto" quanto pela edição no lugar de um item existente: os dois enviam
 * os mesmos quatro campos, e por isso é uma action só.
 */
export async function salvarContextoAction(
  _estadoAnterior: EstadoFormContexto,
  formData: FormData,
): Promise<EstadoFormContexto> {
  const projetoId = formData.get("projeto_id");
  const entrada = {
    agente_destino: formData.get("agente_destino"),
    tipo: formData.get("tipo"),
    conteudo: formData.get("conteudo"),
    arquivo_url: formData.get("arquivo_url"),
  };
  const campos = {
    agente_destino: typeof entrada.agente_destino === "string" ? entrada.agente_destino : "",
    tipo: typeof entrada.tipo === "string" ? entrada.tipo : "",
    conteudo: typeof entrada.conteudo === "string" ? entrada.conteudo : "",
    arquivo_url: typeof entrada.arquivo_url === "string" ? entrada.arquivo_url : "",
  };

  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado, campos };

  if (typeof projetoId !== "string" || projetoId.length === 0) {
    return { ok: false, erro: "Projeto inválido.", campos };
  }

  const validado = validarContexto(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  try {
    await upsertContexto(projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar o contexto."), campos };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null, campos: ESTADO_INICIAL_CAMPOS };
}

export interface ResultadoRemocaoContexto {
  ok: boolean;
  erro: string | null;
}

/** Remove um item de contexto. `projetoId` só serve para saber qual rota revalidar. */
export async function removerContextoAction(
  contextoId: string,
  projetoId: string,
): Promise<ResultadoRemocaoContexto> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (typeof contextoId !== "string" || contextoId.length === 0) {
    return { ok: false, erro: "Contexto inválido." };
  }
  if (typeof projetoId !== "string" || projetoId.length === 0) {
    return { ok: false, erro: "Projeto inválido." };
  }

  try {
    await deletarContexto(contextoId, projetoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível remover este item.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

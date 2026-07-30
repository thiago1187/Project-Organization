"use server";

// Server Actions do inventário de projeto (tela de detalhe) — mesmo padrão de
// src/servidor/acoes-contexto.ts e src/servidor/acoes-agentes.ts:
// `exigirSessaoDoDono()` como primeira linha (Server Action é endpoint HTTP
// invocável, ver src/servidor/acesso.ts), estado devolvido em vez de
// lançado, revalidação da tela de detalhe ao final. Chamadas só pelo painel
// — a routine não escreve inventário, só o dono sabe o que o projeto usa.

import { revalidatePath } from "next/cache";
import { validarServico, validarStack } from "@/dominio/validacaoInventario";
import {
  atualizarServico,
  atualizarStack,
  criarServico,
  criarStack,
  deletarServico,
  deletarStack,
} from "./inventario";
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

// ─────────────────────────────────────────────────────────────────────────
// stack
// ─────────────────────────────────────────────────────────────────────────

export interface EstadoFormStack {
  ok: boolean;
  erro: string | null;
  campos: { categoria?: string; nome?: string };
}

const ESTADO_INICIAL_CAMPOS_STACK = { categoria: "", nome: "" };

/**
 * Cria um item de `stack` novo, ou edita um já existente quando o formulário
 * traz `id` (campo oculto) — mesma ideia de "uma action serve os dois
 * formulários" de `salvarContextoAction`, adaptada porque aqui não há chave
 * natural para um upsert (ver comentário em src/servidor/inventario.ts).
 */
export async function salvarStackAction(
  _estadoAnterior: EstadoFormStack,
  formData: FormData,
): Promise<EstadoFormStack> {
  const projetoId = formData.get("projeto_id");
  const id = formData.get("id");
  const entrada = {
    categoria: formData.get("categoria"),
    nome: formData.get("nome"),
  };
  const campos = {
    categoria: typeof entrada.categoria === "string" ? entrada.categoria : "",
    nome: typeof entrada.nome === "string" ? entrada.nome : "",
  };

  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado, campos };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido.", campos };

  const validado = validarStack(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  try {
    if (typeof id === "string" && id.length > 0) {
      await atualizarStack(id, projetoId, validado.dados);
    } else {
      await criarStack(projetoId, validado.dados);
    }
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar este item de stack."), campos };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null, campos: ESTADO_INICIAL_CAMPOS_STACK };
}

export interface ResultadoInventario {
  ok: boolean;
  erro: string | null;
}

/** Remove um item de `stack`. `projetoId` só serve para saber qual rota revalidar. */
export async function removerStackAction(id: string, projetoId: string): Promise<ResultadoInventario> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (typeof id !== "string" || id.length === 0) return { ok: false, erro: "Item inválido." };
  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  try {
    await deletarStack(id, projetoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível remover este item.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

// ─────────────────────────────────────────────────────────────────────────
// servico
// ─────────────────────────────────────────────────────────────────────────

export interface EstadoFormServico {
  ok: boolean;
  erro: string | null;
  campos: { categoria?: string; nome?: string; conta?: string; papel?: string; administrado_url?: string };
}

const ESTADO_INICIAL_CAMPOS_SERVICO = { categoria: "", nome: "", conta: "", papel: "", administrado_url: "" };

/** Cria ou edita (com `id` no formulário) um item de `servico` — mesma ideia de `salvarStackAction`. */
export async function salvarServicoAction(
  _estadoAnterior: EstadoFormServico,
  formData: FormData,
): Promise<EstadoFormServico> {
  const projetoId = formData.get("projeto_id");
  const id = formData.get("id");
  const entrada = {
    categoria: formData.get("categoria"),
    nome: formData.get("nome"),
    conta: formData.get("conta"),
    papel: formData.get("papel"),
    administrado_url: formData.get("administrado_url"),
  };
  const campos = {
    categoria: typeof entrada.categoria === "string" ? entrada.categoria : "",
    nome: typeof entrada.nome === "string" ? entrada.nome : "",
    conta: typeof entrada.conta === "string" ? entrada.conta : "",
    papel: typeof entrada.papel === "string" ? entrada.papel : "",
    administrado_url: typeof entrada.administrado_url === "string" ? entrada.administrado_url : "",
  };

  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado, campos };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido.", campos };

  const validado = validarServico(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  try {
    if (typeof id === "string" && id.length > 0) {
      await atualizarServico(id, projetoId, validado.dados);
    } else {
      await criarServico(projetoId, validado.dados);
    }
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar este serviço."), campos };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null, campos: ESTADO_INICIAL_CAMPOS_SERVICO };
}

/** Remove um item de `servico`. `projetoId` só serve para saber qual rota revalidar. */
export async function removerServicoAction(id: string, projetoId: string): Promise<ResultadoInventario> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (typeof id !== "string" || id.length === 0) return { ok: false, erro: "Item inválido." };
  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  try {
    await deletarServico(id, projetoId);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível remover este serviço.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

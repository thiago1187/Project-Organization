"use server";

// Server Actions do CRUD de projeto — chamadas direto pelos componentes de
// cliente da tela de Configuração e pelo quadro de cadências da Visão Geral
// (não há rota de API para isto: as rotas de API são para a routine, ver
// CLAUDE.md "Como trabalhar"). Um arquivo "use server" só pode exportar
// função assíncrona em runtime — os `interface` abaixo são apagados na
// compilação e não contam para essa regra.

import { revalidatePath } from "next/cache";
import { ORDEM_FAIXAS, patchParaFaixa, type Faixa } from "@/dominio/cadencia";
import {
  validarDadosProjeto,
  validarDadosProjetoComFrequencia,
  validarDescricaoProjeto,
} from "@/dominio/validacaoProjeto";
import {
  atualizarCadenciaProjeto,
  atualizarDadosProjeto,
  atualizarDescricaoProjeto,
  criarProjeto,
} from "./projetos";
import { AcessoNegado, exigirSessaoDoDono } from "./acesso";

function revalidarTelasDeProjeto(projetoId?: string) {
  revalidatePath("/");
  revalidatePath("/configuracao");
  if (projetoId) revalidatePath(`/projeto/${projetoId}`);
}

/**
 * Guard de acesso (regra 4). Devolve a mensagem quando negado, ou `null` quando
 * liberado — as actions devolvem estado em vez de lançar, e um throw aqui
 * viraria tela de erro genérica em vez de recusa legível.
 */
async function verificarAcesso(): Promise<string | null> {
  try {
    // CRUD de projeto é do painel. A routine não cadastra nem edita projeto —
    // mudar o campo `repositorio` redirecionaria para onde a própria rodada
    // escreve contexto e abre PR.
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

export interface EstadoFormProjeto {
  ok: boolean;
  erro: string | null;
  campos: { nome?: string; repositorio?: string; frequencia?: string; descricao?: string };
}

/** Cadastra um projeto novo. Usada por `useActionState` no formulário da tela de Configuração. */
export async function criarProjetoAction(
  _estadoAnterior: EstadoFormProjeto,
  formData: FormData,
): Promise<EstadoFormProjeto> {
  const negado = await verificarAcesso();
  if (negado) {
    return { ok: false, erro: negado, campos: { nome: "", repositorio: "", frequencia: "", descricao: "" } };
  }

  const entrada = {
    nome: formData.get("nome"),
    repositorio: formData.get("repositorio"),
    frequencia: formData.get("frequencia"),
  };
  const campos = {
    nome: typeof entrada.nome === "string" ? entrada.nome : "",
    repositorio: typeof entrada.repositorio === "string" ? entrada.repositorio : "",
    frequencia: typeof entrada.frequencia === "string" ? entrada.frequencia : "",
    descricao: typeof formData.get("descricao") === "string" ? (formData.get("descricao") as string) : "",
  };

  const validado = validarDadosProjetoComFrequencia(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  const descricaoValidada = validarDescricaoProjeto(formData.get("descricao"));
  if (!descricaoValidada.ok) return { ok: false, erro: descricaoValidada.erro, campos };

  try {
    await criarProjeto({ ...validado.dados, descricao: descricaoValidada.dados });
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível cadastrar o projeto."), campos };
  }

  revalidarTelasDeProjeto();
  return { ok: true, erro: null, campos: {} };
}

export interface ResultadoDescricaoProjeto {
  ok: boolean;
  erro: string | null;
}

/**
 * Salva a descrição de um projeto já existente — o editor no lugar do
 * cabeçalho da tela de detalhe (docs/plano-gerenciador-de-projeto.md § 5.2).
 * Chamada direto com o valor atual do campo (sem `useActionState`/FormData):
 * é um único textarea que salva ao perder o foco, não um formulário com
 * vários campos.
 */
export async function salvarDescricaoProjetoAction(
  projetoId: string,
  descricao: string,
): Promise<ResultadoDescricaoProjeto> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (typeof projetoId !== "string" || projetoId.length === 0) {
    return { ok: false, erro: "Projeto inválido." };
  }

  const validado = validarDescricaoProjeto(descricao);
  if (!validado.ok) return { ok: false, erro: validado.erro };

  try {
    await atualizarDescricaoProjeto(projetoId, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar a descrição.") };
  }

  revalidarTelasDeProjeto(projetoId);
  return { ok: true, erro: null };
}

/** Edita nome e repositório de um projeto existente. Cadência não muda por aqui — ver `definirCadenciaAction`. */
export async function editarProjetoAction(
  _estadoAnterior: EstadoFormProjeto,
  formData: FormData,
): Promise<EstadoFormProjeto> {
  const id = formData.get("id");
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado, campos: {} };

  const entrada = { nome: formData.get("nome"), repositorio: formData.get("repositorio") };
  const campos = {
    nome: typeof entrada.nome === "string" ? entrada.nome : "",
    repositorio: typeof entrada.repositorio === "string" ? entrada.repositorio : "",
  };

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, erro: "Projeto inválido.", campos };
  }

  const validado = validarDadosProjeto(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  try {
    await atualizarDadosProjeto(id, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar as alterações."), campos };
  }

  revalidarTelasDeProjeto(id);
  return { ok: true, erro: null, campos: {} };
}

export interface ResultadoCadencia {
  ok: boolean;
  erro: string | null;
}

/**
 * Grava a cadência de um projeto a partir da faixa de destino — chamada
 * tanto ao soltar um card na home (QuadroCadencias/CardProjeto) quanto ao
 * escolher um botão na Configuração (LinhaConfiguracao). Os dois caminhos
 * passam pela mesma `patchParaFaixa` (src/dominio/cadencia.ts), então
 * produzem sempre o mesmo estado: soltar em "Pausado" só muda `ativo`;
 * soltar fora disso grava `ativo = true` e a frequência da faixa de destino.
 */
export async function definirCadenciaAction(projetoId: string, faixa: Faixa): Promise<ResultadoCadencia> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (typeof projetoId !== "string" || projetoId.length === 0) {
    return { ok: false, erro: "Projeto inválido." };
  }
  // Defesa em profundidade: o cliente só oferece estas quatro opções, mas a
  // action é uma superfície de rede — validar de novo aqui, não confiar só
  // no que a UI restringe.
  if (!ORDEM_FAIXAS.includes(faixa)) {
    return { ok: false, erro: "Cadência inválida." };
  }

  try {
    await atualizarCadenciaProjeto(projetoId, patchParaFaixa(faixa));
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível mudar a cadência.") };
  }

  revalidarTelasDeProjeto(projetoId);
  return { ok: true, erro: null };
}

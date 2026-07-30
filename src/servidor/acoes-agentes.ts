"use server";

// Server Actions da esteira de agentes (tela de detalhe do projeto) — mesmo
// padrão de src/servidor/acoes-contexto.ts: `exigirSessaoDoDono()` como
// primeira linha (Server Action é endpoint HTTP invocável, ver
// src/servidor/acesso.ts), estado devolvido em vez de lançado, revalidação
// da tela de detalhe ao final. Chamadas só pelo painel — a routine nunca
// escreve na esteira, só lê o resultado em GET /api/projects.
//
// Três ações, uma por gesto do plano (docs/plano-agentes-por-projeto.md § 2.3):
// - alternarAgenteAction: soltar um card dentro/fora da faixa de diagnóstico.
// - reordenarAgentesAction: soltar um card em outra posição dentro da faixa.
// - salvarInstrucaoAgenteAction: o formulário do card expandido.
//
// Nenhuma ação aqui — nem em nenhum arquivo deste app — decide quem executa
// uma sugestão aprovada. A esteira só configura quem diagnostica.

import { revalidatePath } from "next/cache";
import {
  validarInstrucaoAgente,
  validarNomeAgente,
  validarOrdemAgentes,
} from "@/dominio/validacaoAgenteProjeto";
import { agenteEhDeLeitura } from "@/dominio/esteiraAgentes";
import {
  alternarAgenteProjeto,
  reordenarAgentesProjeto,
  salvarInstrucaoAgenteProjeto,
} from "./agentesProjeto";
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

export interface ResultadoAgenteProjeto {
  ok: boolean;
  erro: string | null;
}

/**
 * Liga ou desliga um agente na esteira de diagnóstico de um projeto —
 * chamada pelo componente de cliente da esteira ao soltar (ou clicar em
 * "ligar"/"desligar") um card. Ver `alternarAgenteProjeto`,
 * src/servidor/agentesProjeto.ts, para o que acontece com a ordem e com a
 * instrução já gravada.
 */
export async function alternarAgenteAction(
  projetoId: string,
  agente: string,
  habilitado: boolean,
): Promise<ResultadoAgenteProjeto> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  const nomeValidado = validarNomeAgente(agente);
  if (!nomeValidado.ok) return { ok: false, erro: nomeValidado.erro };

  // Só agente de leitura entra na esteira. A rodada noturna aciona quem
  // estiver habilitado aqui, às 3h, sem ninguém para barrar — habilitar um
  // agente de escrita reabriria por arrastar de card o caminho de escrita
  // automática que o fim da execução fechou.
  //
  // A checagem mora aqui, e não só na tela, porque Server Action é endpoint
  // HTTP: filtro que existe só no componente não filtra nada.
  if (habilitado === true && !agenteEhDeLeitura(nomeValidado.dados)) {
    return {
      ok: false,
      erro: "Só agentes de diagnóstico entram na esteira — este altera código.",
    };
  }

  try {
    await alternarAgenteProjeto(projetoId, nomeValidado.dados, habilitado === true);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível atualizar este agente.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

/**
 * Reescreve a ordem dos agentes habilitados de um projeto — chamada depois
 * de soltar um card em nova posição dentro da faixa de diagnóstico.
 * `agentesEmOrdem` é a lista completa de agentes habilitados, já na ordem
 * que o componente de cliente calculou localmente.
 */
export async function reordenarAgentesAction(
  projetoId: string,
  agentesEmOrdem: string[],
): Promise<ResultadoAgenteProjeto> {
  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido." };

  const ordemValidada = validarOrdemAgentes(agentesEmOrdem);
  if (!ordemValidada.ok) return { ok: false, erro: ordemValidada.erro };

  try {
    await reordenarAgentesProjeto(projetoId, ordemValidada.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível reordenar os agentes.") };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null };
}

export interface EstadoFormAgente {
  ok: boolean;
  erro: string | null;
  campos: { instrucao?: string; teto_sugestoes?: string };
}

/**
 * Salva a instrução e o teto de sugestões de um agente já habilitado — o
 * formulário do card expandido da esteira. Usada por `useActionState` em
 * src/componentes/CartaoAgenteEsteira.tsx.
 */
export async function salvarInstrucaoAgenteAction(
  _estadoAnterior: EstadoFormAgente,
  formData: FormData,
): Promise<EstadoFormAgente> {
  const projetoId = formData.get("projeto_id");
  const agente = formData.get("agente");
  const entrada = {
    instrucao: formData.get("instrucao"),
    teto_sugestoes: formData.get("teto_sugestoes"),
  };
  const campos = {
    instrucao: typeof entrada.instrucao === "string" ? entrada.instrucao : "",
    teto_sugestoes: typeof entrada.teto_sugestoes === "string" ? entrada.teto_sugestoes : "",
  };

  const negado = await verificarAcesso();
  if (negado) return { ok: false, erro: negado, campos };

  if (!projetoValido(projetoId)) return { ok: false, erro: "Projeto inválido.", campos };

  const nomeValidado = validarNomeAgente(agente);
  if (!nomeValidado.ok) return { ok: false, erro: nomeValidado.erro, campos };

  const validado = validarInstrucaoAgente(entrada);
  if (!validado.ok) return { ok: false, erro: validado.erro, campos };

  try {
    await salvarInstrucaoAgenteProjeto(projetoId, nomeValidado.dados, validado.dados);
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro, "Não foi possível salvar a instrução."), campos };
  }

  revalidatePath(`/projeto/${projetoId}`);
  return { ok: true, erro: null, campos: { instrucao: "", teto_sugestoes: "" } };
}

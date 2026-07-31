import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { AgentePadrao } from "@/dominio/tipos";
import type { DadosAgenteProjetoValidados } from "@/dominio/validacaoAgenteProjeto";

// Camada de acesso a `agente_padrao` — espelha
// db/migrations/012_agente_padrao.sql (ainda NÃO aplicada). O padrão global
// de instrução/teto de um agente, editado na ficha /agentes/[nome] e
// reaproveitado em todo projeto onde ele for ligado, a menos que
// `projeto_agente` sobrescreva (src/dominio/agentePadrao.ts >
// resolverConfiguracaoAgente — sobrescreve, nunca soma).
//
// Toda escrita é só do painel, nunca da routine — mesma exceção deliberada à
// regra 4 do CLAUDE.md que já vale para `contexto` e `projeto_agente`: quem
// configura o que os agentes fazem é o dono, não o processo que roda à
// noite. `exigirSessaoDoDono()` mora aqui dentro, não só na Server Action que
// chama (src/servidor/acoes-agente-padrao.ts), mesmo raciocínio registrado em
// `salvarInstrucaoAgenteProjeto` (src/servidor/agentesProjeto.ts).

interface LinhaAgentePadrao {
  agente: string;
  instrucao: string | null;
  teto_sugestoes: number | null;
  criado_em: string | Date;
  atualizado_em: string | Date;
}

function linhaParaAgentePadrao(l: LinhaAgentePadrao): AgentePadrao {
  return {
    agente: l.agente,
    instrucao: l.instrucao,
    teto_sugestoes: l.teto_sugestoes,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
  };
}

/**
 * A migration 012 pode ainda não ter sido aplicada — mesma trava de schema
 * que vale para 002, 003, 005, 008 e 009. Sem isto, `agente_padrao`
 * inexistente devolve 42P01, o erro sobe e `GET /api/projects` responde 500 —
 * o que para a rodada noturna inteira em silêncio. Só 42P01 é engolido;
 * qualquer outro erro continua subindo.
 */
const TABELA_INEXISTENTE = "42P01";

function tabelaAindaNaoExiste(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === TABELA_INEXISTENTE;
}

/** Todos os padrões configurados — o que GET /api/projects e a esteira de cada projeto usam para resolver o valor efetivo. */
export async function listarAgentesPadrao(): Promise<AgentePadrao[]> {
  try {
    const linhas = (await sql()`
      SELECT agente, instrucao, teto_sugestoes, criado_em, atualizado_em
      FROM agente_padrao
    `) as unknown as LinhaAgentePadrao[];
    return linhas.map(linhaParaAgentePadrao);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return [];
    throw traduzirErroDeBanco(erro, "listarAgentesPadrao");
  }
}

/** O padrão de um único agente — a ficha /agentes/[nome]. `null` quando o agente nunca teve padrão configurado (ou a migration não foi aplicada). */
export async function obterAgentePadrao(agente: string): Promise<AgentePadrao | null> {
  try {
    const linhas = (await sql()`
      SELECT agente, instrucao, teto_sugestoes, criado_em, atualizado_em
      FROM agente_padrao
      WHERE agente = ${agente}
    `) as unknown as LinhaAgentePadrao[];
    return linhas[0] ? linhaParaAgentePadrao(linhas[0]) : null;
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return null;
    throw traduzirErroDeBanco(erro, "obterAgentePadrao");
  }
}

/**
 * Grava o padrão global de um agente — upsert por `agente` (a chave
 * primária da tabela). Chamada pelo editor da ficha (EditorAgentePadrao.tsx,
 * via src/servidor/acoes-agente-padrao.ts).
 */
export async function salvarAgentePadrao(
  agente: string,
  dados: DadosAgenteProjetoValidados,
): Promise<AgentePadrao> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      INSERT INTO agente_padrao (agente, instrucao, teto_sugestoes)
      VALUES (${agente}, ${dados.instrucao}, ${dados.teto_sugestoes})
      ON CONFLICT (agente)
      DO UPDATE SET instrucao = EXCLUDED.instrucao, teto_sugestoes = EXCLUDED.teto_sugestoes
      RETURNING agente, instrucao, teto_sugestoes, criado_em, atualizado_em
    `) as unknown as LinhaAgentePadrao[];
    return linhaParaAgentePadrao(linhas[0]);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) {
      throw new ErroDados(
        "A tabela de padrões de agente ainda não existe neste banco — peça para aplicar db/migrations/012_agente_padrao.sql antes de salvar.",
      );
    }
    throw traduzirErroDeBanco(erro, "salvarAgentePadrao");
  }
}

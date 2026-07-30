import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { EstadoSugestao, Esforco, Reversibilidade, Sugestao } from "@/dominio/tipos";
import type { DadosSugestaoValidados } from "@/dominio/validacaoSugestao";

// Camada de acesso a `sugestao`. A leitura serve tanto a fila de sugestões da
// tela de detalhe quanto `temPr`/`prUrl` (ver `detalheProjeto` em
// src/dominio/visao.ts) e `GET /api/projects` (routine). As escritas são:
// criar (routine, `POST /api/suggestions`), aprovar e recusar (dono, painel)
// e marcar como feita (routine, só a partir de "aprovada") — ver
// `PATCH /api/suggestions/:id` e CLAUDE.md > "protocolo de sugestões".
//
// As escritas que fazem transição de estado restringem o UPDATE ao estado de
// origem esperado de propósito: isso garante que a trigger
// `sugestao_validar_transicao` (db/migrations/001_schema_inicial.sql) só veja
// transições válidas, e dá uma mensagem clara (em vez de erro de trigger ou
// de linha não encontrada) quando a sugestão já foi decidida — em outra aba,
// ou por outro chamador — antes desta chamada chegar ao banco.

interface LinhaSugestao {
  id: string;
  projeto_id: string;
  agente: string;
  proposta: string;
  motivo: string;
  esforco: Esforco;
  risco: string;
  reversibilidade: Reversibilidade;
  estado: EstadoSugestao;
  criada_em: string | Date;
  aprovada_em: string | Date | null;
  recusada_em: string | Date | null;
  feita_em: string | Date | null;
  pr_url: string | null;
}

function dataOuNula(v: string | Date | null): string | null {
  return v === null ? null : new Date(v).toISOString();
}

function linhaParaSugestao(l: LinhaSugestao): Sugestao {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    agente: l.agente,
    proposta: l.proposta,
    motivo: l.motivo,
    esforco: l.esforco,
    risco: l.risco,
    reversibilidade: l.reversibilidade,
    estado: l.estado,
    criada_em: new Date(l.criada_em).toISOString(),
    aprovada_em: dataOuNula(l.aprovada_em),
    recusada_em: dataOuNula(l.recusada_em),
    feita_em: dataOuNula(l.feita_em),
    pr_url: l.pr_url,
  };
}

/**
 * Todas as sugestões, de todos os projetos — o que `GET /api/projects`
 * precisa para montar, por projeto ativo, as aprovadas (para a routine
 * executar) e o texto das pendentes/recusadas (para não repetir proposta).
 * Escala pessoal: sem paginação, mesmo padrão de `listarRelatorios`.
 */
export async function listarSugestoes(): Promise<Sugestao[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
             estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
      FROM sugestao
    `) as unknown as LinhaSugestao[];
    return linhas.map(linhaParaSugestao);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarSugestoes");
  }
}

/**
 * Todas as sugestões de um projeto, em qualquer estado — mesmo padrão de
 * acesso do índice `sugestao_projeto_estado_idx`.
 */
export async function listarSugestoesDoProjeto(projetoId: string): Promise<Sugestao[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
             estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
      FROM sugestao
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaSugestao[];
    return linhas.map(linhaParaSugestao);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarSugestoesDoProjeto");
  }
}

/**
 * pendente → aprovada. Lança `ErroDados` se a sugestão não existir mais ou já
 * não estiver pendente (decidida em outra aba, por exemplo).
 */
export async function aprovarSugestao(id: string): Promise<Sugestao> {
  // Só o dono decide. A regra mora aqui, e não em cada chamador, porque foi
  // exatamente a duplicação dela que abriu o furo: a rota PATCH recusava que a
  // routine se auto-aprovasse, a Server Action da fila não. Guardando na
  // camada de dados, qualquer porta nova já nasce fechada.
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE sugestao
      SET estado = 'aprovada', aprovada_em = now()
      WHERE id = ${id} AND estado = 'pendente'
      RETURNING id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
                estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
    `) as unknown as LinhaSugestao[];
    if (linhas.length === 0) {
      throw new ErroDados(
        "Esta sugestão não está mais pendente — pode já ter sido decidida em outra aba.",
      );
    }
    return linhaParaSugestao(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "aprovarSugestao");
  }
}

/**
 * pendente → recusada. Lança `ErroDados` se a sugestão não existir mais ou já
 * não estiver pendente (decidida em outra aba, por exemplo).
 */
export async function recusarSugestao(id: string): Promise<Sugestao> {
  // Só o dono decide. A regra mora aqui, e não em cada chamador, porque foi
  // exatamente a duplicação dela que abriu o furo: a rota PATCH recusava que a
  // routine se auto-aprovasse, a Server Action da fila não. Guardando na
  // camada de dados, qualquer porta nova já nasce fechada.
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE sugestao
      SET estado = 'recusada', recusada_em = now()
      WHERE id = ${id} AND estado = 'pendente'
      RETURNING id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
                estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
    `) as unknown as LinhaSugestao[];
    if (linhas.length === 0) {
      throw new ErroDados(
        "Esta sugestão não está mais pendente — pode já ter sido decidida em outra aba.",
      );
    }
    return linhaParaSugestao(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "recusarSugestao");
  }
}

/**
 * Registra uma proposta nova — chamada só por `POST /api/suggestions`
 * (routine). Nasce sempre "pendente": não há parâmetro de estado, e a coluna
 * tem esse valor como DEFAULT — aprovar é decisão do dono, nunca de quem
 * propõe. `dados` já chega validado por `validarSugestao`
 * (src/dominio/validacaoSugestao.ts).
 */
export async function criarSugestao(dados: DadosSugestaoValidados): Promise<Sugestao> {
  try {
    const linhas = (await sql()`
      INSERT INTO sugestao (projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade)
      VALUES (
        ${dados.projeto_id}, ${dados.agente}, ${dados.proposta}, ${dados.motivo},
        ${dados.esforco}, ${dados.risco}, ${dados.reversibilidade}
      )
      RETURNING id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
                estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
    `) as unknown as LinhaSugestao[];
    return linhaParaSugestao(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "criarSugestao");
  }
}

/**
 * aprovada → feita, com o link do PR. Chamada só por
 * `PATCH /api/suggestions/:id` quando quem chama tem o header de bypass (a
 * routine) — nunca a partir de sessão do dono (ver CLAUDE.md > "protocolo de
 * sugestões" e a trigger `sugestao_validar_transicao`, que só libera
 * aprovada→feita). Lança `ErroDados` se a sugestão não existir mais ou não
 * estiver aprovada (ainda pendente, já feita, ou recusada).
 */
export async function marcarSugestaoFeita(id: string, prUrl: string): Promise<Sugestao> {
  try {
    const linhas = (await sql()`
      UPDATE sugestao
      SET estado = 'feita', feita_em = now(), pr_url = ${prUrl}
      WHERE id = ${id} AND estado = 'aprovada'
      RETURNING id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
                estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
    `) as unknown as LinhaSugestao[];
    if (linhas.length === 0) {
      throw new ErroDados(
        "Esta sugestão não está aprovada — pode ainda estar pendente, já ter sido marcada como feita, ou ter sido recusada.",
      );
    }
    return linhaParaSugestao(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "marcarSugestaoFeita");
  }
}

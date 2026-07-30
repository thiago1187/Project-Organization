import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import type { EstadoSugestao, Esforco, Reversibilidade, Sugestao } from "@/dominio/tipos";

// Camada de acesso a `sugestao`. A leitura serve tanto a fila de sugestões da
// tela de detalhe quanto `temPr`/`prUrl` (ver `detalheProjeto` em
// src/dominio/visao.ts). As duas escritas — aprovar e recusar — são as únicas
// que o painel faz; marcar como "feita" é da routine e não existe aqui (ver
// CLAUDE.md > "O painel faz aprovar e recusar").
//
// As duas escritas restringem o UPDATE a `estado = 'pendente'` de propósito:
// isso garante que a trigger `sugestao_validar_transicao` (db/migrations/
// 001_schema_inicial.sql) só veja transições válidas partindo de pendente, e
// dá uma mensagem clara (em vez de erro de trigger) quando a sugestão já foi
// decidida em outra aba antes deste clique chegar ao banco.

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

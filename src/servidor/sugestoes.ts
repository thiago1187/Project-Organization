import "server-only";
import { sql } from "./db";
import { traduzirErroDeBanco } from "./erros";
import type { EstadoSugestao, Esforco, Reversibilidade, Sugestao } from "@/dominio/tipos";

// Camada de leitura de `sugestao` — só o necessário para a tela de detalhe
// derivar `temPr`/`prUrl` (ver `detalheProjeto` em src/dominio/visao.ts). A
// fila de sugestões com aprovar/recusar, e as rotas que a routine usa para
// criar e mudar estado, ficam para uma entrega própria (fora de escopo aqui
// — ver CLAUDE.md).

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

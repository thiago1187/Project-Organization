import "server-only";
import { sql } from "./db";
import { traduzirErroDeBanco } from "./erros";
import type { AchadoAgente, Relatorio, StatusRelatorio } from "@/dominio/tipos";

// Camada de leitura de `relatorio` — só SELECT. Criar relatório é
// `POST /api/reports`, chamado pela routine; fora do escopo desta entrega
// (ver CLAUDE.md, rotas de API).

interface LinhaRelatorio {
  id: string;
  projeto_id: string;
  executado_em: string | Date;
  status: StatusRelatorio;
  resumo: string;
  testes_passaram: boolean | null;
  achados_por_agente: AchadoAgente[];
}

function linhaParaRelatorio(l: LinhaRelatorio): Relatorio {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    executado_em: new Date(l.executado_em).toISOString(),
    status: l.status,
    resumo: l.resumo,
    testes_passaram: l.testes_passaram,
    achados_por_agente: l.achados_por_agente,
  };
}

/**
 * Todos os relatórios, de todos os projetos — o que a visão geral e a
 * configuração precisam (`cardsProjetos`, `totaisHome`, `linhasConfig` em
 * src/dominio/visao.ts recebem a lista inteira e filtram por projeto
 * internamente). Escala pessoal: sem índice dedicado a essa consulta, como
 * já documentado na migration.
 */
export async function listarRelatorios(): Promise<Relatorio[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente
      FROM relatorio
      ORDER BY executado_em DESC
    `) as unknown as LinhaRelatorio[];
    return linhas.map(linhaParaRelatorio);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarRelatorios");
  }
}

/**
 * Histórico de um projeto só, mais recente primeiro — o que a tela de
 * detalhe usa. Usa o mesmo padrão de acesso (projeto_id, executado_em DESC)
 * do índice `relatorio_projeto_executado_idx`.
 */
export async function listarRelatoriosDoProjeto(projetoId: string): Promise<Relatorio[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente
      FROM relatorio
      WHERE projeto_id = ${projetoId}
      ORDER BY executado_em DESC
    `) as unknown as LinhaRelatorio[];
    return linhas.map(linhaParaRelatorio);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarRelatoriosDoProjeto");
  }
}

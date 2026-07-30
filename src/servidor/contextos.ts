import "server-only";
import { sql } from "./db";
import { traduzirErroDeBanco } from "./erros";
import type { Contexto, OrigemContexto } from "@/dominio/tipos";

// Camada de leitura de `contexto` — só o necessário para a lista de
// documentos da tela de detalhe (itens com `arquivo_url`). O editor de
// contexto (escrever `conteudo`) é `PUT /api/context/:projeto`, fora do
// escopo desta entrega (ver CLAUDE.md).

interface LinhaContexto {
  id: string;
  projeto_id: string;
  agente_destino: string;
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
  origem: OrigemContexto;
  criado_em: string | Date;
  atualizado_em: string | Date;
}

function linhaParaContexto(l: LinhaContexto): Contexto {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    agente_destino: l.agente_destino,
    tipo: l.tipo,
    conteudo: l.conteudo,
    arquivo_url: l.arquivo_url,
    origem: l.origem,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
  };
}

/** Mesmo padrão de acesso do índice único de contexto (prefixo projeto_id). */
export async function listarContextosDoProjeto(projetoId: string): Promise<Contexto[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente_destino, tipo, conteudo, arquivo_url, origem, criado_em, atualizado_em
      FROM contexto
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaContexto[];
    return linhas.map(linhaParaContexto);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarContextosDoProjeto");
  }
}

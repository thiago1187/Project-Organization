import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { Contexto, OrigemContexto } from "@/dominio/tipos";
import type { DadosContextoValidados } from "@/dominio/validacaoContexto";

// Camada de acesso a `contexto`. A leitura serve a lista de documentos da
// tela de detalhe (itens com `arquivo_url`), `GET /api/projects` (routine) e
// `GET /api/context/:projeto`. A escrita (`upsertContexto`, `deletarContexto`)
// é só do editor de contexto da tela de detalhe, por `PUT`/`DELETE
// /api/context/:projeto` e pela Server Action `salvarContextoAction` /
// `removerContextoAction` (src/servidor/acoes-contexto.ts) — nunca pela
// routine (ver CLAUDE.md, regra 4, exceção deliberada, e o comentário da
// coluna `contexto.origem` na migration).
//
// `exigirSessaoDoDono()` mora aqui dentro, e não só na rota/action que chama
// — mesmo raciocínio do comentário em `aprovarSugestao`/`recusarSugestao`
// (src/servidor/sugestoes.ts): a regra "só o dono escreve contexto" precisa
// valer em todo caminho de escrita, mesmo um que apareça depois e esqueça de
// checar sozinho.

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

/**
 * Todo o contexto, de todos os projetos — o que `GET /api/projects` precisa
 * para anexar, a cada projeto ativo, o material que o dono forneceu. Escala
 * pessoal: sem paginação, mesmo padrão de `listarRelatorios`.
 */
export async function listarContextos(): Promise<Contexto[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente_destino, tipo, conteudo, arquivo_url, origem, criado_em, atualizado_em
      FROM contexto
    `) as unknown as LinhaContexto[];
    return linhas.map(linhaParaContexto);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarContextos");
  }
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

/**
 * Cria ou substitui um item de contexto — upsert por `(projeto_id,
 * agente_destino, tipo)`, a chave única da tabela (ver
 * `contexto_projeto_agente_tipo_key` na migration). É essa combinação que
 * identifica o "recurso" de um `PUT`: gravar de novo com o mesmo
 * agente_destino e tipo substitui `conteudo`/`arquivo_url`; gravar com
 * agente_destino ou tipo diferentes cria uma linha nova. `dados` já chega
 * validado por `validarContexto` (src/dominio/validacaoContexto.ts).
 * `origem` não é parâmetro: a coluna tem DEFAULT `'painel'` e o CHECK só
 * aceita esse valor — não há como esta função gravar outra coisa.
 */
export async function upsertContexto(
  projetoId: string,
  dados: DadosContextoValidados,
): Promise<Contexto> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      INSERT INTO contexto (projeto_id, agente_destino, tipo, conteudo, arquivo_url)
      VALUES (${projetoId}, ${dados.agente_destino}, ${dados.tipo}, ${dados.conteudo}, ${dados.arquivo_url})
      ON CONFLICT (projeto_id, agente_destino, tipo)
      DO UPDATE SET conteudo = EXCLUDED.conteudo, arquivo_url = EXCLUDED.arquivo_url
      RETURNING id, projeto_id, agente_destino, tipo, conteudo, arquivo_url, origem, criado_em, atualizado_em
    `) as unknown as LinhaContexto[];
    return linhaParaContexto(linhas[0]);
  } catch (erro) {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23503") {
      // foreign_key_violation em projeto_id — projeto apagado entre a checagem
      // da rota e esta escrita (não há rota de apagar projeto hoje, mas a
      // mensagem clara vale a defesa).
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "upsertContexto");
  }
}

/**
 * Remove um item de contexto. Escopado por `projeto_id` além de `id` — não
 * só por robustez (um `id` de outro projeto nunca deveria chegar aqui), mas
 * porque isso faz o "não encontrado" cobrir os dois casos reais sem duas
 * consultas: id inexistente, ou id de um projeto diferente do que a tela
 * estava editando.
 */
export async function deletarContexto(id: string, projetoId: string): Promise<void> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      DELETE FROM contexto WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id
    `) as unknown as { id: string }[];
    if (linhas.length === 0) {
      throw new ErroDados("Este item de contexto não existe mais — pode ter sido removido em outra aba.");
    }
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "deletarContexto");
  }
}

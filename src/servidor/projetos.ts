import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { Frequencia, Projeto } from "@/dominio/tipos";
import type { PatchCadencia } from "@/dominio/cadencia";

// Camada de acesso a dados de `projeto` — espelha db/migrations/001_schema_inicial.sql,
// com `descricao` acrescentada em db/migrations/008_projeto_descricao.sql.
// Toda consulta é parametrizada (tagged template do driver da Neon); nunca há
// concatenação de entrada em SQL.

interface LinhaProjeto {
  id: string;
  nome: string;
  repositorio: string | null;
  frequencia: Frequencia;
  ativo: boolean;
  criado_em: string | Date;
  descricao: string | null;
}

function linhaParaProjeto(l: LinhaProjeto): Projeto {
  return {
    id: l.id,
    nome: l.nome,
    repositorio: l.repositorio,
    frequencia: l.frequencia,
    ativo: l.ativo,
    criado_em: new Date(l.criado_em).toISOString(),
    descricao: l.descricao,
  };
}

/**
 * A migration 008 pode ainda não ter sido aplicada — mesma trava de schema e
 * mesmo raciocínio de degradação já registrados em
 * src/servidor/agentesProjeto.ts para a 005: sem isto, `descricao` inexistente
 * devolve 42703 (coluna inexistente) e para a tela inteira em silêncio, não
 * só o campo novo.
 */
const COLUNA_INEXISTENTE = "42703";

function colunaAindaNaoExiste(erro: unknown): boolean {
  return (
    typeof erro === "object" && erro !== null && "code" in erro && erro.code === COLUNA_INEXISTENTE
  );
}

/**
 * Todos os projetos, ativos e pausados — a visão geral e a configuração
 * precisam das duas categorias (pausado é uma faixa a mais no quadro, não
 * uma ausência). Escala pessoal: dezenas de linhas, sem paginação.
 */
export async function listarProjetos(): Promise<Projeto[]> {
  try {
    const linhas = (await sql()`
      SELECT id, nome, repositorio, frequencia, ativo, criado_em, descricao
      FROM projeto ORDER BY criado_em ASC
    `) as unknown as LinhaProjeto[];
    return linhas.map(linhaParaProjeto);
  } catch (erro) {
    if (colunaAindaNaoExiste(erro)) {
      const linhas = (await sql()`
        SELECT id, nome, repositorio, frequencia, ativo, criado_em
        FROM projeto ORDER BY criado_em ASC
      `) as unknown as Omit<LinhaProjeto, "descricao">[];
      return linhas.map((l) => linhaParaProjeto({ ...l, descricao: null }));
    }
    throw traduzirErroDeBanco(erro, "listarProjetos");
  }
}

export async function obterProjetoPorId(id: string): Promise<Projeto | null> {
  try {
    const linhas = (await sql()`
      SELECT id, nome, repositorio, frequencia, ativo, criado_em, descricao
      FROM projeto WHERE id = ${id}
    `) as unknown as LinhaProjeto[];
    return linhas[0] ? linhaParaProjeto(linhas[0]) : null;
  } catch (erro) {
    // uuid malformado (ex.: alguém digitou uma URL à mão) não é uma falha de
    // infraestrutura — é o mesmo caso de "não encontrado" para quem chama.
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "22P02") {
      return null;
    }
    if (colunaAindaNaoExiste(erro)) {
      const linhas = (await sql()`
        SELECT id, nome, repositorio, frequencia, ativo, criado_em
        FROM projeto WHERE id = ${id}
      `) as unknown as Omit<LinhaProjeto, "descricao">[];
      return linhas[0] ? linhaParaProjeto({ ...linhas[0], descricao: null }) : null;
    }
    throw traduzirErroDeBanco(erro, "obterProjetoPorId");
  }
}

export async function criarProjeto(dados: {
  nome: string;
  repositorio: string | null;
  frequencia: Frequencia;
  /** Opcional no cadastro — projeto criado às pressas não precisa de prosa ainda. */
  descricao?: string | null;
}): Promise<Projeto> {
  try {
    const linhas = (await sql()`
      INSERT INTO projeto (nome, repositorio, frequencia, descricao)
      VALUES (${dados.nome}, ${dados.repositorio}, ${dados.frequencia}, ${dados.descricao ?? null})
      RETURNING id, nome, repositorio, frequencia, ativo, criado_em, descricao
    `) as unknown as LinhaProjeto[];
    return linhaParaProjeto(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "criarProjeto");
  }
}

/**
 * Grava só `descricao` — o editor no lugar do cabeçalho da tela de detalhe
 * (plano § 5.2). Separada de `atualizarDadosProjeto` de propósito: os dois
 * editores da tela (nome/repositório na configuração, descrição no
 * cabeçalho) não devem pisar um no outro nem exigir que editar um mande o
 * valor atual do outro de volta.
 */
export async function atualizarDescricaoProjeto(id: string, descricao: string | null): Promise<Projeto> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE projeto SET descricao = ${descricao}
      WHERE id = ${id}
      RETURNING id, nome, repositorio, frequencia, ativo, criado_em, descricao
    `) as unknown as LinhaProjeto[];
    if (linhas.length === 0) {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    return linhaParaProjeto(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarDescricaoProjeto");
  }
}

/** Edita nome e repositório. Não muda frequência nem ativo — isso é sempre via `atualizarCadenciaProjeto`. */
export async function atualizarDadosProjeto(
  id: string,
  dados: { nome: string; repositorio: string | null },
): Promise<Projeto> {
  try {
    const linhas = (await sql()`
      UPDATE projeto SET nome = ${dados.nome}, repositorio = ${dados.repositorio}
      WHERE id = ${id}
      RETURNING id, nome, repositorio, frequencia, ativo, criado_em, descricao
    `) as unknown as LinhaProjeto[];
    if (linhas.length === 0) {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    return linhaParaProjeto(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarDadosProjeto");
  }
}

/**
 * Grava a cadência (frequencia + ativo) a partir de um `PatchCadencia` já
 * calculado por `patchParaFaixa` (src/dominio/cadencia.ts) — a única função
 * que decide o que uma faixa-alvo significa em termos de coluna. Usada pelo
 * drag and drop da home e pelos botões da configuração, sempre pelo mesmo
 * caminho.
 */
export async function atualizarCadenciaProjeto(id: string, patch: PatchCadencia): Promise<Projeto> {
  try {
    const linhas = (
      patch.ativo
        ? await sql()`
            UPDATE projeto SET ativo = true, frequencia = ${patch.frequencia}
            WHERE id = ${id}
            RETURNING id, nome, repositorio, frequencia, ativo, criado_em, descricao
          `
        : await sql()`
            UPDATE projeto SET ativo = false
            WHERE id = ${id}
            RETURNING id, nome, repositorio, frequencia, ativo, criado_em, descricao
          `
    ) as unknown as LinhaProjeto[];
    if (linhas.length === 0) {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    return linhaParaProjeto(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarCadenciaProjeto");
  }
}

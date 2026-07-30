import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { Servico, Stack } from "@/dominio/tipos";
import type { DadosServicoValidados, DadosStackValidados } from "@/dominio/validacaoInventario";

// Camada de acesso a `stack` e `servico` (db/migrations/002_inventario.sql) —
// o inventário de um projeto: linguagem/framework/runtime e serviços/contas
// externos, e onde cada um é administrado. Responde à pergunta 4 de
// docs/visao.md ("o que tem dentro deste projeto"). Nunca um valor de
// credencial — ver o comentário no topo da migration e CLAUDE.md, regra 1;
// esta camada não faz nada além do que os validadores de
// src/dominio/validacaoInventario.ts já deixaram passar.
//
// Toda escrita é só do painel, nunca da routine — mesma exceção deliberada à
// regra 4 do CLAUDE.md que já vale para `contexto` (src/servidor/contextos.ts)
// e `projeto_agente` (src/servidor/agentesProjeto.ts): quem sabe o que o
// projeto usa é o dono, a routine não descobre stack sozinha.
// `exigirSessaoDoDono()` mora aqui dentro, não só na Server Action que chama
// — mesmo raciocínio registrado em `upsertContexto`.
//
// Sem chave natural de upsert (diferente de `contexto`, que tem
// `(projeto_id, agente_destino, tipo)` único): nem `stack` nem `servico` têm
// `UNIQUE` além do `id` — o dono pode legitimamente ter duas linhas de
// `servico` com o mesmo nome e categorias diferentes de conta (ex.: "Neon"
// em "pessoal" e em "cliente x"). Por isso criar e editar são duas operações
// (`INSERT` / `UPDATE por id`), não um upsert por campo.

interface LinhaStack {
  id: string;
  projeto_id: string;
  categoria: string;
  nome: string;
  criado_em: string | Date;
  atualizado_em: string | Date;
}

function linhaParaStack(l: LinhaStack): Stack {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    categoria: l.categoria as Stack["categoria"],
    nome: l.nome,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
  };
}

interface LinhaServico {
  id: string;
  projeto_id: string;
  categoria: string;
  nome: string;
  conta: string;
  papel: string | null;
  administrado_url: string | null;
  criado_em: string | Date;
  atualizado_em: string | Date;
}

function linhaParaServico(l: LinhaServico): Servico {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    categoria: l.categoria as Servico["categoria"],
    nome: l.nome,
    conta: l.conta,
    papel: l.papel,
    administrado_url: l.administrado_url,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
  };
}

function foreignKeyViolation(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
}

// ─────────────────────────────────────────────────────────────────────────
// stack
// ─────────────────────────────────────────────────────────────────────────

/** Toda a stack de um projeto — tela de detalhe. Escala pessoal: sem paginação. */
export async function listarStackDoProjeto(projetoId: string): Promise<Stack[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, categoria, nome, criado_em, atualizado_em
      FROM stack
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaStack[];
    return linhas.map(linhaParaStack);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarStackDoProjeto");
  }
}

export async function criarStack(projetoId: string, dados: DadosStackValidados): Promise<Stack> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      INSERT INTO stack (projeto_id, categoria, nome)
      VALUES (${projetoId}, ${dados.categoria}, ${dados.nome})
      RETURNING id, projeto_id, categoria, nome, criado_em, atualizado_em
    `) as unknown as LinhaStack[];
    return linhaParaStack(linhas[0]);
  } catch (erro) {
    if (foreignKeyViolation(erro)) {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "criarStack");
  }
}

export async function atualizarStack(id: string, projetoId: string, dados: DadosStackValidados): Promise<Stack> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE stack SET categoria = ${dados.categoria}, nome = ${dados.nome}
      WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id, projeto_id, categoria, nome, criado_em, atualizado_em
    `) as unknown as LinhaStack[];
    if (linhas.length === 0) {
      throw new ErroDados("Este item de stack não existe mais — pode ter sido removido em outra aba.");
    }
    return linhaParaStack(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarStack");
  }
}

export async function deletarStack(id: string, projetoId: string): Promise<void> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      DELETE FROM stack WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id
    `) as unknown as { id: string }[];
    if (linhas.length === 0) {
      throw new ErroDados("Este item de stack não existe mais — pode ter sido removido em outra aba.");
    }
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "deletarStack");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// servico
// ─────────────────────────────────────────────────────────────────────────

/** Todo o inventário de serviços de um projeto — tela de detalhe. */
export async function listarServicoDoProjeto(projetoId: string): Promise<Servico[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, categoria, nome, conta, papel, administrado_url, criado_em, atualizado_em
      FROM servico
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaServico[];
    return linhas.map(linhaParaServico);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarServicoDoProjeto");
  }
}

export async function criarServico(projetoId: string, dados: DadosServicoValidados): Promise<Servico> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      INSERT INTO servico (projeto_id, categoria, nome, conta, papel, administrado_url)
      VALUES (${projetoId}, ${dados.categoria}, ${dados.nome}, ${dados.conta}, ${dados.papel}, ${dados.administrado_url})
      RETURNING id, projeto_id, categoria, nome, conta, papel, administrado_url, criado_em, atualizado_em
    `) as unknown as LinhaServico[];
    return linhaParaServico(linhas[0]);
  } catch (erro) {
    if (foreignKeyViolation(erro)) {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "criarServico");
  }
}

export async function atualizarServico(
  id: string,
  projetoId: string,
  dados: DadosServicoValidados,
): Promise<Servico> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE servico
      SET categoria = ${dados.categoria}, nome = ${dados.nome}, conta = ${dados.conta},
          papel = ${dados.papel}, administrado_url = ${dados.administrado_url}
      WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id, projeto_id, categoria, nome, conta, papel, administrado_url, criado_em, atualizado_em
    `) as unknown as LinhaServico[];
    if (linhas.length === 0) {
      throw new ErroDados("Este item de serviço não existe mais — pode ter sido removido em outra aba.");
    }
    return linhaParaServico(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarServico");
  }
}

export async function deletarServico(id: string, projetoId: string): Promise<void> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      DELETE FROM servico WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id
    `) as unknown as { id: string }[];
    if (linhas.length === 0) {
      throw new ErroDados("Este item de serviço não existe mais — pode ter sido removido em outra aba.");
    }
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "deletarServico");
  }
}

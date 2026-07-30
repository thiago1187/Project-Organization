import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { EstadoTarefa, Tarefa } from "@/dominio/tipos";

// Camada de acesso a `tarefa` — espelha db/migrations/009_tarefa.sql. A
// worklist do dono por projeto. Toda escrita é só do painel — a routine
// nunca cria nem edita tarefa (docs/plano-gerenciador-de-projeto.md § 8: "a
// rodada não escreve em lugar nenhum"; o caminho para ela colocar algo na
// mesa do dono já existe e se chama `sugestao`). `exigirSessaoDoDono()` mora
// aqui dentro, não só na Server Action que chama — mesmo raciocínio já
// registrado em `alternarAgenteProjeto` (src/servidor/agentesProjeto.ts).

interface LinhaTarefa {
  id: string;
  projeto_id: string;
  titulo: string;
  estado: EstadoTarefa;
  ordem: number;
  criado_em: string | Date;
  atualizado_em: string | Date;
  concluida_em: string | Date | null;
}

function linhaParaTarefa(l: LinhaTarefa): Tarefa {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    titulo: l.titulo,
    estado: l.estado,
    ordem: l.ordem,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
    concluida_em: l.concluida_em ? new Date(l.concluida_em).toISOString() : null,
  };
}

/**
 * A migration 009 pode ainda não ter sido aplicada — mesma trava de schema e
 * mesmo raciocínio de degradação de src/servidor/agentesProjeto.ts para a
 * 005: sem isto, `tarefa` inexistente devolve 42P01 e derruba a rota ou a
 * tela inteira em silêncio, em vez de só o bloco novo.
 */
const TABELA_INEXISTENTE = "42P01";

function tabelaAindaNaoExiste(erro: unknown): boolean {
  return (
    typeof erro === "object" && erro !== null && "code" in erro && erro.code === TABELA_INEXISTENTE
  );
}

/** Todas as tarefas, de todos os projetos — o que `GET /api/projects` precisa (mesmo padrão de `listarContextos`). */
export async function listarTarefas(): Promise<Tarefa[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, titulo, estado, ordem, criado_em, atualizado_em, concluida_em
      FROM tarefa
    `) as unknown as LinhaTarefa[];
    return linhas.map(linhaParaTarefa);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return [];
    throw traduzirErroDeBanco(erro, "listarTarefas");
  }
}

/** Todas as tarefas (qualquer estado) de um único projeto — tela de detalhe. */
export async function listarTarefasDoProjeto(projetoId: string): Promise<Tarefa[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, titulo, estado, ordem, criado_em, atualizado_em, concluida_em
      FROM tarefa
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaTarefa[];
    return linhas.map(linhaParaTarefa);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return [];
    throw traduzirErroDeBanco(erro, "listarTarefasDoProjeto");
  }
}

/** Cria uma tarefa nova, sempre `aberta`, no fim da ordem atual do projeto. */
export async function criarTarefa(projetoId: string, titulo: string): Promise<Tarefa> {
  await exigirSessaoDoDono();

  try {
    const proximas = (await sql()`
      SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM tarefa WHERE projeto_id = ${projetoId}
    `) as unknown as { proxima: number }[];
    const proximaOrdem = proximas[0]?.proxima ?? 0;

    const linhas = (await sql()`
      INSERT INTO tarefa (projeto_id, titulo, estado, ordem)
      VALUES (${projetoId}, ${titulo}, 'aberta', ${proximaOrdem})
      RETURNING id, projeto_id, titulo, estado, ordem, criado_em, atualizado_em, concluida_em
    `) as unknown as LinhaTarefa[];
    return linhaParaTarefa(linhas[0]);
  } catch (erro) {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23503") {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "criarTarefa");
  }
}

/** Edita só o título — o texto no lugar de um item da worklist. */
export async function atualizarTituloTarefa(id: string, projetoId: string, titulo: string): Promise<Tarefa> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      UPDATE tarefa SET titulo = ${titulo}
      WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id, projeto_id, titulo, estado, ordem, criado_em, atualizado_em, concluida_em
    `) as unknown as LinhaTarefa[];
    if (linhas.length === 0) {
      throw new ErroDados("Esta tarefa não existe mais — pode ter sido removida em outra aba.");
    }
    return linhaParaTarefa(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "atualizarTituloTarefa");
  }
}

/**
 * Move uma tarefa para outro estado — o clique de concluir, o de reabrir
 * ("feita → aberta" é uma transição legítima, ver o comentário da migration:
 * "voltei atrás"), e o de marcar como "fazendo agora". `concluida_em` é
 * gravado/limpo aqui, nunca pelo cliente — mesmo raciocínio de
 * `sugestao.aprovada_em` em src/servidor/sugestoes.ts.
 */
export async function moverEstadoTarefa(id: string, projetoId: string, estado: EstadoTarefa): Promise<Tarefa> {
  await exigirSessaoDoDono();

  try {
    // `concluida_em` via CASE dentro do próprio SQL, não calculado em JS e
    // passado como parâmetro: evita divergência entre o relógio do processo
    // que roda esta função e o do banco, e mantém a escrita inteira num único
    // parâmetro `estado` — sem um segundo valor implícito para manter em sincronia.
    const linhas = (await sql()`
      UPDATE tarefa
      SET estado = ${estado}, concluida_em = CASE WHEN ${estado} = 'feita' THEN now() ELSE NULL END
      WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id, projeto_id, titulo, estado, ordem, criado_em, atualizado_em, concluida_em
    `) as unknown as LinhaTarefa[];
    if (linhas.length === 0) {
      throw new ErroDados("Esta tarefa não existe mais — pode ter sido removida em outra aba.");
    }
    return linhaParaTarefa(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "moverEstadoTarefa");
  }
}

/**
 * Reescreve a ordem das tarefas de um projeto — o gesto de soltar um card em
 * outra posição. `idsEmOrdem` é a lista completa de ids do projeto, na nova
 * ordem; a ordem gravada é o índice de cada um. Mesma transação HTTP do
 * driver da Neon usada por `reordenarAgentesProjeto`, para que uma
 * reordenação nunca pare pela metade.
 */
export async function reordenarTarefas(projetoId: string, idsEmOrdem: string[]): Promise<void> {
  await exigirSessaoDoDono();

  if (idsEmOrdem.length === 0) return;

  try {
    const clienteSql = sql();
    const consultas = idsEmOrdem.map(
      (id, indice) => clienteSql`
        UPDATE tarefa SET ordem = ${indice} WHERE id = ${id} AND projeto_id = ${projetoId}
      `,
    );
    await clienteSql.transaction(consultas);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "reordenarTarefas");
  }
}

/** Apaga uma tarefa — worklist não é auditoria, apagar é um gesto normal (diferente de `sugestao`). */
export async function apagarTarefa(id: string, projetoId: string): Promise<void> {
  await exigirSessaoDoDono();

  try {
    const linhas = (await sql()`
      DELETE FROM tarefa WHERE id = ${id} AND projeto_id = ${projetoId}
      RETURNING id
    `) as unknown as { id: string }[];
    if (linhas.length === 0) {
      throw new ErroDados("Esta tarefa não existe mais — pode ter sido removida em outra aba.");
    }
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "apagarTarefa");
  }
}

import "server-only";
import { sql } from "./db";
import { ErroDados, traduzirErroDeBanco } from "./erros";
import { exigirSessaoDoDono } from "./acesso";
import type { ProjetoAgente } from "@/dominio/tipos";
import type { DadosAgenteProjetoValidados } from "@/dominio/validacaoAgenteProjeto";

// Camada de acesso a `projeto_agente` — espelha
// db/migrations/005_agentes_por_projeto.sql. A esteira de diagnóstico de um
// projeto: quais agentes rodam, em que ordem, e com que instrução. Toda
// escrita (`alternarAgenteProjeto`, `reordenarAgentesProjeto`,
// `salvarInstrucaoAgenteProjeto`) é só do painel, nunca da routine — mesma
// exceção deliberada à regra 4 do CLAUDE.md que já vale para `contexto`
// (src/servidor/contextos.ts): quem configura o diagnóstico de amanhã é o
// dono, não o processo que roda hoje à noite. `exigirSessaoDoDono()` mora
// aqui dentro, não só na Server Action que chama, pelo mesmo raciocínio
// registrado em `upsertContexto`.

interface LinhaAgenteProjeto {
  id: string;
  projeto_id: string;
  agente: string;
  habilitado: boolean;
  ordem: number;
  instrucao: string | null;
  teto_sugestoes: number | null;
  criado_em: string | Date;
  atualizado_em: string | Date;
}

function linhaParaAgenteProjeto(l: LinhaAgenteProjeto): ProjetoAgente {
  return {
    id: l.id,
    projeto_id: l.projeto_id,
    agente: l.agente,
    habilitado: l.habilitado,
    ordem: l.ordem,
    instrucao: l.instrucao,
    teto_sugestoes: l.teto_sugestoes,
    criado_em: new Date(l.criado_em).toISOString(),
    atualizado_em: new Date(l.atualizado_em).toISOString(),
  };
}

/**
 * Todas as linhas de `projeto_agente`, de todos os projetos — o que
 * `GET /api/projects` precisa para anexar, a cada projeto ativo, os agentes
 * habilitados na ordem gravada. Escala pessoal: sem paginação, mesmo padrão
 * de `listarContextos`.
 */

/**
 * A migration 005 pode ainda não ter sido aplicada — a trava de schema do
 * CLAUDE.md faz cada uma esperar aprovação do dono, e o app precisa continuar
 * de pé nesse intervalo.
 *
 * Sem isto, `projeto_agente` inexistente devolve 42P01, o erro sobe pela rota
 * e `GET /api/projects` responde 500 — o que para a rodada noturna inteira no
 * passo 0, em silêncio, e o dono só descobre pela ausência de relatório na
 * manhã seguinte. A degradação prometida nos comentários e no db/README.md
 * precisa existir no código, não só no texto.
 *
 * Só 42P01 é engolido. Qualquer outro erro continua subindo — engolir tudo
 * esconderia problema real.
 */
const TABELA_INEXISTENTE = "42P01";

function tabelaAindaNaoExiste(erro: unknown): boolean {
  return (
    typeof erro === "object" && erro !== null && "code" in erro && erro.code === TABELA_INEXISTENTE
  );
}

export async function listarAgentesProjeto(): Promise<ProjetoAgente[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes, criado_em, atualizado_em
      FROM projeto_agente
    `) as unknown as LinhaAgenteProjeto[];
    return linhas.map(linhaParaAgenteProjeto);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return [];
    throw traduzirErroDeBanco(erro, "listarAgentesProjeto");
  }
}

/** A esteira completa (habilitados e desligados) de um único projeto — tela de detalhe. */
export async function listarAgentesDoProjeto(projetoId: string): Promise<ProjetoAgente[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes, criado_em, atualizado_em
      FROM projeto_agente
      WHERE projeto_id = ${projetoId}
    `) as unknown as LinhaAgenteProjeto[];
    return linhas.map(linhaParaAgenteProjeto);
  } catch (erro) {
    if (tabelaAindaNaoExiste(erro)) return [];
    throw traduzirErroDeBanco(erro, "listarAgentesDoProjeto");
  }
}

/**
 * Liga ou desliga um agente na esteira — o gesto de soltar o card
 * dentro/fora da faixa "diagnóstico" (docs/plano-agentes-por-projeto.md
 * § 2.3). Ligar cria a linha se não existir (upsert por `(projeto_id,
 * agente)`, a chave única da tabela) e coloca o agente no fim da ordem atual
 * dos habilitados; quem chamou decide a posição exata com uma chamada
 * seguinte a `reordenarAgentesProjeto`, se precisar. Desligar preserva
 * `instrucao`/`teto_sugestoes` — reativar mais tarde não perde o que foi
 * escrito.
 */
export async function alternarAgenteProjeto(
  projetoId: string,
  agente: string,
  habilitado: boolean,
): Promise<ProjetoAgente> {
  await exigirSessaoDoDono();

  try {
    if (habilitado) {
      const proximas = (await sql()`
        SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima
        FROM projeto_agente
        WHERE projeto_id = ${projetoId} AND habilitado = true
      `) as unknown as { proxima: number }[];
      const proximaOrdem = proximas[0]?.proxima ?? 0;

      const linhas = (await sql()`
        INSERT INTO projeto_agente (projeto_id, agente, habilitado, ordem)
        VALUES (${projetoId}, ${agente}, true, ${proximaOrdem})
        ON CONFLICT (projeto_id, agente)
        DO UPDATE SET habilitado = true, ordem = ${proximaOrdem}
        RETURNING id, projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes, criado_em, atualizado_em
      `) as unknown as LinhaAgenteProjeto[];
      return linhaParaAgenteProjeto(linhas[0]);
    }

    // Upsert também no desligar, não só no ligar. Um UPDATE puro falharia para
    // agente que nunca teve linha — e esse é exatamente o caso do sugestor de
    // agentes: ele recomenda quem ainda não tem registro, e "dispensar" a
    // sugestão é justamente gravar `habilitado = false` na primeira vez.
    //
    // A linha desligada não é lixo: é a memória de que o dono já decidiu não
    // querer aquele agente aqui, e é ela que impede o sugestor de insistir.
    const linhas = (await sql()`
      INSERT INTO projeto_agente (projeto_id, agente, habilitado, ordem)
      VALUES (${projetoId}, ${agente}, false, 0)
      ON CONFLICT (projeto_id, agente)
      DO UPDATE SET habilitado = false
      RETURNING id, projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes, criado_em, atualizado_em
    `) as unknown as LinhaAgenteProjeto[];
    if (linhas.length === 0) {
      throw new ErroDados("Não foi possível desligar este agente.");
    }
    return linhaParaAgenteProjeto(linhas[0]);
  } catch (erro) {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23503") {
      // foreign_key_violation em projeto_id — projeto apagado entre a checagem
      // da action e esta escrita (não há rota de apagar projeto hoje).
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "alternarAgenteProjeto");
  }
}

/**
 * Reescreve a ordem dos agentes habilitados de um projeto — o gesto de
 * soltar um card em outra posição dentro da faixa "diagnóstico".
 * `agentesEmOrdem` é a lista completa de agentes habilitados, na nova ordem;
 * a ordem gravada é o índice de cada um no array. Só atualiza linhas já
 * habilitadas — um nome fora da esteira ativa deste projeto é ignorado, não
 * é erro (o cliente já filtra para a lista atual antes de chamar).
 *
 * As atualizações vão numa única transação HTTP do driver da Neon
 * (`sql.transaction`, ver o comentário em src/servidor/db.ts) para que uma
 * reordenação nunca pare pela metade com metade dos agentes na ordem nova e
 * metade na antiga.
 */
export async function reordenarAgentesProjeto(projetoId: string, agentesEmOrdem: string[]): Promise<void> {
  await exigirSessaoDoDono();

  if (agentesEmOrdem.length === 0) return;

  try {
    const clienteSql = sql();
    const consultas = agentesEmOrdem.map(
      (agente, indice) => clienteSql`
        UPDATE projeto_agente SET ordem = ${indice}
        WHERE projeto_id = ${projetoId} AND agente = ${agente} AND habilitado = true
      `,
    );
    await clienteSql.transaction(consultas);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "reordenarAgentesProjeto");
  }
}

/**
 * Salva instrução e teto de sugestões de um agente já habilitado — o card
 * expandido da esteira. Upsert por `(projeto_id, agente)`: se a linha ainda
 * não existir (agente nunca tocado neste projeto), é criada já habilitada —
 * esta função só é chamada a partir do card de um agente ativo (ver
 * src/componentes/CartaoAgenteEsteira.tsx), nunca do catálogo desligado.
 * `habilitado` de uma linha existente não é tocado por este upsert — editar
 * instrução não liga nem desliga o agente.
 */
export async function salvarInstrucaoAgenteProjeto(
  projetoId: string,
  agente: string,
  dados: DadosAgenteProjetoValidados,
): Promise<ProjetoAgente> {
  await exigirSessaoDoDono();

  try {
    const proximas = (await sql()`
      SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima
      FROM projeto_agente
      WHERE projeto_id = ${projetoId} AND habilitado = true
    `) as unknown as { proxima: number }[];
    const proximaOrdem = proximas[0]?.proxima ?? 0;

    const linhas = (await sql()`
      INSERT INTO projeto_agente (projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes)
      VALUES (${projetoId}, ${agente}, true, ${proximaOrdem}, ${dados.instrucao}, ${dados.teto_sugestoes})
      ON CONFLICT (projeto_id, agente)
      DO UPDATE SET instrucao = EXCLUDED.instrucao, teto_sugestoes = EXCLUDED.teto_sugestoes
      RETURNING id, projeto_id, agente, habilitado, ordem, instrucao, teto_sugestoes, criado_em, atualizado_em
    `) as unknown as LinhaAgenteProjeto[];
    return linhaParaAgenteProjeto(linhas[0]);
  } catch (erro) {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23503") {
      throw new ErroDados("Este projeto não existe mais — pode ter sido removido em outra aba.");
    }
    throw traduzirErroDeBanco(erro, "salvarInstrucaoAgenteProjeto");
  }
}

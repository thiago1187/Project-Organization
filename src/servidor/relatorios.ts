import "server-only";
import { sql } from "./db";
import { traduzirErroDeBanco } from "./erros";
import type { AchadoAgente, Relatorio, StatusRelatorio } from "@/dominio/tipos";
import type { DadosRelatorioValidados } from "@/dominio/validacaoRelatorio";

// Camada de acesso a `relatorio`. A leitura serve as telas; a escrita
// (`criarRelatorio`) é usada só por `POST /api/reports`, chamado pela
// routine — o painel nunca cria relatório.

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
 * Só o relatório mais recente de cada projeto — uma linha por projeto,
 * independentemente de quantas noites já rodaram.
 *
 * Existe porque `listarRelatorios()` carregava a tabela inteira para responder
 * exatamente esta pergunta, em dois lugares. Na Visão Geral isso custava
 * milissegundos que ninguém sente. Em `GET /api/reports` custava caro de um
 * jeito diferente: a rodada lê aquilo toda madrugada e usa **só** o mais
 * recente por projeto (docs/routine-noturna.md, passo 0.2), então o histórico
 * inteiro — com o `achados_por_agente` de cada noite desde o início — viajava
 * para dentro da janela de um modelo, para ser descartado.
 *
 * Medido hoje: 16 linhas, 19KB, ~4.900 tokens. Com um projeto ativo a
 * +1 linha por noite, ~111 mil tokens por ano, para sempre, e multiplicando
 * por projeto ativo. O painel existe para monitorar vários.
 *
 * `DISTINCT ON` é do Postgres e casa com o índice que já existe
 * (`relatorio_projeto_executado_idx`, `(projeto_id, executado_em DESC)`). O
 * `ORDER BY` precisa começar por `projeto_id` para o `DISTINCT ON` funcionar;
 * a ordenação que a tela quer é aplicada depois, em memória, sobre uma lista
 * que agora tem no máximo uma linha por projeto.
 */
export async function ultimoRelatorioPorProjeto(): Promise<Relatorio[]> {
  try {
    const linhas = (await sql()`
      SELECT DISTINCT ON (projeto_id)
             id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente
      FROM relatorio
      ORDER BY projeto_id, executado_em DESC
    `) as unknown as LinhaRelatorio[];
    return linhas.map(linhaParaRelatorio);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "ultimoRelatorioPorProjeto");
  }
}

/**
 * Teto para quem precisa mesmo de todas as rodadas. Alto o bastante para não
 * cortar na prática (uma rodada por noite dá ~27 anos) e baixo o bastante para
 * uma consulta com defeito não trazer a tabela inteira.
 */
export const SEM_LIMITE = 10_000;

/**
 * Histórico de um projeto, mais recente primeiro. Mesmo padrão de acesso
 * (projeto_id, executado_em DESC) do índice `relatorio_projeto_executado_idx`.
 *
 * `limite` é **obrigatório** por decisão, e não tem valor padrão.
 *
 * Isto não tinha teto: a tela do projeto montava o detalhe de toda rodada já
 * gravada, a cada abertura, e o custo cresce uma linha por noite para sempre.
 * O reflexo seria pôr um `LIMIT` fixo aqui — e seria um bug pior que o
 * original, porque o documento de andamento filtra por período em cima desta
 * lista: um teto silencioso faria "últimos 30 dias" perder rodadas sem avisar,
 * e esse documento vai para sócio e cliente.
 *
 * Sem valor padrão, o próximo chamador é obrigado a pensar em quantas precisa,
 * em vez de herdar um número que não serve para ele. Use `SEM_LIMITE` quando a
 * resposta for de fato "todas", e o parâmetro passa a documentar a escolha em
 * vez de escondê-la.
 */
export async function listarRelatoriosDoProjeto(
  projetoId: string,
  limite: number,
): Promise<Relatorio[]> {
  try {
    const linhas = (await sql()`
      SELECT id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente
      FROM relatorio
      WHERE projeto_id = ${projetoId}
      ORDER BY executado_em DESC
      LIMIT ${limite}
    `) as unknown as LinhaRelatorio[];
    return linhas.map(linhaParaRelatorio);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "listarRelatoriosDoProjeto");
  }
}

/**
 * Grava o diagnóstico de uma rodada — chamada só por `POST /api/reports`. O
 * `projeto_id` já foi conferido pela rota (o projeto existe) antes de chegar
 * aqui; um `projeto_id` que não existe mais ainda assim falharia pela FK, e
 * viraria `ErroDados` de "dados inválidos" via `traduzirErroDeBanco`.
 * `achados_por_agente` já chega validado item a item por
 * `validarRelatorio` (src/dominio/validacaoRelatorio.ts) — aqui só grava.
 */
export async function criarRelatorio(dados: DadosRelatorioValidados): Promise<Relatorio> {
  try {
    const linhas = (await sql()`
      INSERT INTO relatorio (projeto_id, status, resumo, testes_passaram, achados_por_agente)
      VALUES (
        ${dados.projeto_id},
        ${dados.status},
        ${dados.resumo},
        ${dados.testes_passaram},
        ${JSON.stringify(dados.achados_por_agente)}::jsonb
      )
      RETURNING id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente
    `) as unknown as LinhaRelatorio[];
    return linhaParaRelatorio(linhas[0]);
  } catch (erro) {
    throw traduzirErroDeBanco(erro, "criarRelatorio");
  }
}

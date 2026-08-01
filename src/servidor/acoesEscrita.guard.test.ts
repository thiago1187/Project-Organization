import { describe, expect, it, vi } from "vitest";

// O guard de acesso de **todas** as Server Actions de escrita, num arquivo só.
//
// `acoes-sugestao.test.ts` já cobria as três ações de sugestão, e cobre bem —
// ele nasceu de um furo real (a rota PATCH aplicava `exigirSessaoDoDono()`, a
// Server Action da fila não). O que faltava era o resto: sete outros arquivos
// de ação, com a mesma regra escrita à mão em cada um, e nenhum teste provando
// que ela recusa.
//
// Por que isso é perigoso e não parece: Server Action **é** endpoint HTTP.
// O `"use server"` publica uma rota de verdade, com ID de ação, invocável por
// quem descobrir o ID. Se alguém adicionar uma ação nova e esquecer a linha do
// guard, `npm run typecheck`, `npm run build` e a suíte inteira continuam
// verdes — e o furo fica aberto sem nada acusar.
//
// A disciplina, herdada de acoes-sugestao.test.ts e que importa mais que os
// casos em si:
//
// 1. **`@/servidor/acesso` NÃO é mockado.** `acesso.ts`, `sessao.ts` e
//    `comparacaoSegura.ts` rodam de verdade. Só `next/headers` — a fronteira
//    de I/O — é simulado, como uma requisição sem cookie e sem header.
// 2. **A camada de dados é mockada e a asserção é que ela nunca foi chamada.**
//    Verificar só que a ação devolveu erro passaria mesmo se ela tivesse
//    gravado antes de falhar. O que prova o guard é o banco não ter sido
//    tocado.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

// Cada módulo de dados vira espião. Um `vi.fn()` por função que as ações
// chamam — se o guard falhar, a chamada chega aqui e o teste vê.
vi.mock("./tarefas", () => ({
  criarTarefa: vi.fn(),
  atualizarTituloTarefa: vi.fn(),
  moverEstadoTarefa: vi.fn(),
  reordenarTarefas: vi.fn(),
  apagarTarefa: vi.fn(),
}));
vi.mock("./agentesProjeto", () => ({
  alternarAgenteProjeto: vi.fn(),
  reordenarAgentesProjeto: vi.fn(),
  salvarInstrucaoAgenteProjeto: vi.fn(),
}));
vi.mock("./inventario", () => ({
  criarStack: vi.fn(),
  atualizarStack: vi.fn(),
  deletarStack: vi.fn(),
  criarServico: vi.fn(),
  atualizarServico: vi.fn(),
  deletarServico: vi.fn(),
}));
vi.mock("./projetos", () => ({
  criarProjeto: vi.fn(),
  atualizarDescricaoProjeto: vi.fn(),
  editarProjeto: vi.fn(),
  apagarProjeto: vi.fn(),
  atualizarCadenciaProjeto: vi.fn(),
  obterProjetoPorId: vi.fn(),
  listarProjetos: vi.fn(async () => []),
}));
vi.mock("./contextos", () => ({
  upsertContexto: vi.fn(),
  deletarContexto: vi.fn(),
}));
vi.mock("./github", () => ({
  buscarRepositorioGithub: vi.fn(),
}));
vi.mock("./agentesPadrao", () => ({
  salvarAgentePadrao: vi.fn(),
}));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";

import * as tarefas from "./tarefas";
import * as agentesProjeto from "./agentesProjeto";
import * as inventario from "./inventario";
import * as projetos from "./projetos";
import * as contextos from "./contextos";
import * as github from "./github";
import * as agentesPadrao from "./agentesPadrao";

import * as acoesTarefa from "./acoes-tarefa";
import * as acoesAgentes from "./acoes-agentes";
import * as acoesInventario from "./acoes-inventario";
import * as acoesProjeto from "./acoes-projeto";
import * as acoesContexto from "./acoes-contexto";
import * as acoesGithub from "./acoes-github";
import * as acoesAgentePadrao from "./acoes-agente-padrao";

const PROJETO = "11111111-1111-1111-1111-111111111111";
const ITEM = "22222222-2222-2222-2222-222222222222";

// As ações ligadas a formulário recebem (estadoAnterior, FormData). O conteúdo
// aqui é irrelevante de propósito: o guard tem que recusar **antes** de olhar
// para o corpo, então uma entrada perfeitamente válida é o caso mais honesto.
function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}
const formAgente = () => form({ projeto_id: PROJETO, agente: "qa-testes", instrucao: "x" });
const formStack = () => form({ projeto_id: PROJETO, categoria: "framework", nome: "Next.js" });
const formServico = () => form({ projeto_id: PROJETO, nome: "Neon", administrado_em: "Vercel" });

/**
 * Uma linha por Server Action de escrita: como chamar, e quais funções de dados
 * ela **não** pode ter alcançado.
 *
 * Ação nova que não aparecer aqui não é pega por este arquivo — por isso o
 * último caso do arquivo confere que a lista cobre tudo que está exportado.
 */
const ACOES: ReadonlyArray<{
  nome: string;
  chamar: () => Promise<unknown>;
  /** Funções da camada de dados que esta ação chamaria se o guard falhasse. */
  dados: ReadonlyArray<(...args: never[]) => unknown>;
}> = [
  // tarefa
  { nome: "criarTarefaAction", chamar: () => acoesTarefa.criarTarefaAction(PROJETO, "x"), dados: [tarefas.criarTarefa] },
  { nome: "editarTituloTarefaAction", chamar: () => acoesTarefa.editarTituloTarefaAction(PROJETO, ITEM, "x"), dados: [tarefas.atualizarTituloTarefa] },
  { nome: "moverEstadoTarefaAction", chamar: () => acoesTarefa.moverEstadoTarefaAction(PROJETO, ITEM, "feita"), dados: [tarefas.moverEstadoTarefa] },
  { nome: "reordenarTarefasAction", chamar: () => acoesTarefa.reordenarTarefasAction(PROJETO, [ITEM]), dados: [tarefas.reordenarTarefas] },
  { nome: "apagarTarefaAction", chamar: () => acoesTarefa.apagarTarefaAction(PROJETO, ITEM), dados: [tarefas.apagarTarefa] },

  // esteira de agentes
  { nome: "alternarAgenteAction", chamar: () => acoesAgentes.alternarAgenteAction(PROJETO, "qa-testes", true), dados: [agentesProjeto.alternarAgenteProjeto] },
  { nome: "reordenarAgentesAction", chamar: () => acoesAgentes.reordenarAgentesAction(PROJETO, ["qa-testes"]), dados: [agentesProjeto.reordenarAgentesProjeto] },
  { nome: "salvarInstrucaoAgenteAction", chamar: () => acoesAgentes.salvarInstrucaoAgenteAction({ ok: false, erro: null, campos: {} }, formAgente()), dados: [agentesProjeto.salvarInstrucaoAgenteProjeto] },

  // inventário
  { nome: "salvarStackAction", chamar: () => acoesInventario.salvarStackAction({ ok: false, erro: null, campos: {} }, formStack()), dados: [inventario.criarStack, inventario.atualizarStack] },
  { nome: "removerStackAction", chamar: () => acoesInventario.removerStackAction(PROJETO, ITEM), dados: [inventario.deletarStack] },
  { nome: "salvarServicoAction", chamar: () => acoesInventario.salvarServicoAction({ ok: false, erro: null, campos: {} }, formServico()), dados: [inventario.criarServico, inventario.atualizarServico] },
  { nome: "removerServicoAction", chamar: () => acoesInventario.removerServicoAction(PROJETO, ITEM), dados: [inventario.deletarServico] },

  // projeto — inclusive apagar, que é irreversível
  { nome: "salvarDescricaoProjetoAction", chamar: () => acoesProjeto.salvarDescricaoProjetoAction(PROJETO, "x"), dados: [projetos.atualizarDescricaoProjeto] },
  { nome: "apagarProjetoAction", chamar: () => acoesProjeto.apagarProjetoAction(PROJETO, "nome", "nome"), dados: [projetos.apagarProjeto] },
  { nome: "definirCadenciaAction", chamar: () => acoesProjeto.definirCadenciaAction(PROJETO, "diaria"), dados: [projetos.atualizarCadenciaProjeto] },

  // contexto — escrita e remoção
  { nome: "removerContextoAction", chamar: () => acoesContexto.removerContextoAction(PROJETO, ITEM), dados: [contextos.deletarContexto] },

  // GitHub — fala com serviço externo, então o guard também protege a cota
  { nome: "importarRepositorioGithubAction", chamar: () => acoesGithub.importarRepositorioGithubAction("dono/repo"), dados: [github.buscarRepositorioGithub] },

  // padrão por agente — vale em todos os projetos de uma vez
  { nome: "salvarAgentePadraoAction", chamar: () => acoesAgentePadrao.salvarAgentePadraoAction("qa-testes", "x", ""), dados: [agentesPadrao.salvarAgentePadrao] },
];

describe("Server Actions de escrita — sem sessão do dono", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PAINEL_MCP_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  for (const acao of ACOES) {
    it(`${acao.nome} recusa e não toca no banco`, async () => {
      process.env.VERCEL_ENV = "production";
      process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
      mockHeaders({});
      mockCookies();

      vi.clearAllMocks();
      await acao.chamar().catch(() => undefined);

      // A asserção que importa: o banco não foi tocado. Conferir só o retorno
      // passaria mesmo se a ação tivesse gravado antes de devolver erro.
      for (const fn of acao.dados) {
        expect(fn).not.toHaveBeenCalled();
      }
    });
  }

  it("o bypass da routine também não escreve", async () => {
    // A rodada noturna tem o segredo de bypass e roda sem ninguém acordado.
    // Nenhuma destas ações pode ser alcançável por ela.
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "bypass-de-teste";
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "bypass-de-teste" });
    mockCookies();

    vi.clearAllMocks();
    for (const acao of ACOES) {
      await acao.chamar().catch(() => undefined);
    }
    for (const acao of ACOES) {
      for (const fn of acao.dados) {
        expect(fn, `${acao.nome} foi alcançada pelo bypass`).not.toHaveBeenCalled();
      }
    }
  });

  it("a lista acima cobre toda ação exportada — ação nova não passa despercebida", () => {
    // Sem este caso, adicionar uma Server Action e esquecer de somá-la ao
    // arquivo deixaria o furo exatamente onde ele estava antes: verde, e
    // descoberto numa madrugada.
    const modulos: ReadonlyArray<[string, Record<string, unknown>]> = [
      ["acoes-tarefa", acoesTarefa],
      ["acoes-agentes", acoesAgentes],
      ["acoes-inventario", acoesInventario],
      ["acoes-projeto", acoesProjeto],
      ["acoes-contexto", acoesContexto],
      ["acoes-github", acoesGithub],
      ["acoes-agente-padrao", acoesAgentePadrao],
    ];

    const cobertas = new Set(ACOES.map((a) => a.nome));
    const faltando: string[] = [];

    // `criarProjetoAction`, `editarProjetoAction` e `salvarContextoAction`
    // recebem FormData e redirecionam; ficam de fora da tabela por isso, mas
    // são listadas aqui para a exceção ser explícita em vez de silenciosa.
    const excecoes = new Set(["criarProjetoAction", "editarProjetoAction", "salvarContextoAction"]);

    for (const [nome, mod] of modulos) {
      for (const [exportado, valor] of Object.entries(mod)) {
        if (typeof valor !== "function") continue;
        if (!exportado.endsWith("Action")) continue;
        if (cobertas.has(exportado) || excecoes.has(exportado)) continue;
        faltando.push(`${nome}.${exportado}`);
      }
    }

    expect(faltando).toEqual([]);
  });
});

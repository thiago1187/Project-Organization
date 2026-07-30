import { describe, expect, it, vi } from "vitest";

// Continuação de src/servidor/acesso.test.ts para a origem `mcp`, que entrou
// com o servidor MCP (docs/mcp.md). Arquivo separado do original de propósito:
// ele precisa de `PAINEL_MCP_SECRET` no sandbox de ambiente, e a matriz de lá
// já está fechada em torno das duas origens antigas.
//
// Mesma disciplina daquele arquivo: só `next/headers` é mockado (a fronteira
// de I/O). A lógica de acesso.ts, sessao.ts e comparacaoSegura.ts roda de
// verdade, sem mock nenhum — estes casos provam o comportamento, não uma
// simulação dele.
//
// O que eles seguram, e por que cada um importa:
//
// - O bypass da routine **não** escreve contexto nem cadastra projeto. Essa é
//   a regra registrada em `PUT /api/context/:projeto`, e a razão dela (um
//   agente comprometido escreveria as próprias instruções para a rodada
//   seguinte) não mudou porque o MCP apareceu.
// - O segredo do MCP **não** vira sessão do dono. Aprovar, recusar e marcar
//   como feita continuam em `exigirSessaoDoDono()`, fora do alcance do MCP.
// - Sem `PAINEL_MCP_SECRET` configurada, a degradação é recusar, nunca
//   liberar — mesmo princípio de `cookieSessaoEhValido`.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { AcessoNegado, exigirAcesso, exigirDonoOuMcp, exigirSessaoDoDono } from "@/servidor/acesso";
import { NOME_COOKIE_SESSAO, gerarValorCookieSessao } from "@/servidor/sessao";

// Valores fabricados aqui, sem relação com nenhum ambiente real (regra 2 do
// CLAUDE.md: nenhum segredo de verdade entra em arquivo versionado).
const SEGREDO_MCP = "segredo-mcp-de-teste";
const SEGREDO_BYPASS = "segredo-bypass-de-teste";
const SEGREDO_SESSAO = "segredo-sessao-de-teste";

const CABECALHO_MCP = "x-painel-mcp-secret";
const CABECALHO_BYPASS = "x-vercel-protection-bypass";

describe("acesso — origem mcp", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PAINEL_MCP_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  it("segredo do MCP correto: exigirAcesso() e exigirDonoOuMcp() passam", () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    mockHeaders({ [CABECALHO_MCP]: SEGREDO_MCP });
    mockCookies();

    return Promise.all([
      expect(exigirAcesso()).resolves.toBeUndefined(),
      expect(exigirDonoOuMcp()).resolves.toBeUndefined(),
    ]);
  });

  it("segredo do MCP não vira sessão do dono — aprovar continua sendo dois cliques no painel", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    process.env.PAINEL_SESSAO_SECRET = SEGREDO_SESSAO;
    mockHeaders({ [CABECALHO_MCP]: SEGREDO_MCP });
    mockCookies();

    await expect(exigirSessaoDoDono()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("bypass da routine passa em exigirAcesso() mas é recusado em exigirDonoOuMcp()", async () => {
    // O coração da decisão: o MCP dá leitura à routine e nega escrita a ela.
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = SEGREDO_BYPASS;
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    mockHeaders({ [CABECALHO_BYPASS]: SEGREDO_BYPASS });
    mockCookies();

    await expect(exigirAcesso()).resolves.toBeUndefined();
    await expect(exigirDonoOuMcp()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("sessão do dono passa em exigirDonoOuMcp() sem precisar do segredo do MCP", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_SESSAO_SECRET = SEGREDO_SESSAO;
    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: gerarValorCookieSessao() });

    await expect(exigirDonoOuMcp()).resolves.toBeUndefined();
  });

  it("segredo do MCP errado: recusa, e não cai em nenhuma outra origem", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    mockHeaders({ [CABECALHO_MCP]: "valor-errado" });
    mockCookies();

    await expect(exigirAcesso()).rejects.toBeInstanceOf(AcessoNegado);
    await expect(exigirDonoOuMcp()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("PAINEL_MCP_SECRET ausente: header nenhum concede acesso (degradação é recusar)", async () => {
    process.env.VERCEL_ENV = "production";
    mockHeaders({ [CABECALHO_MCP]: "qualquer-valor" });
    mockCookies();

    await expect(exigirAcesso()).rejects.toBeInstanceOf(AcessoNegado);
    await expect(exigirDonoOuMcp()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("com os dois headers, o MCP ganha do bypass — o Claude Code manda os dois", async () => {
    // Sem esta precedência, quem manda o header de bypass para atravessar a
    // borda da Vercel seria classificado como a routine, e perderia a escrita.
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = SEGREDO_BYPASS;
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    mockHeaders({ [CABECALHO_BYPASS]: SEGREDO_BYPASS, [CABECALHO_MCP]: SEGREDO_MCP });
    mockCookies();

    await expect(exigirDonoOuMcp()).resolves.toBeUndefined();
  });

  it("não confunde os dois segredos: o valor do bypass no header do MCP não abre nada", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = SEGREDO_BYPASS;
    process.env.PAINEL_MCP_SECRET = SEGREDO_MCP;
    mockHeaders({ [CABECALHO_MCP]: SEGREDO_BYPASS });
    mockCookies();

    await expect(exigirDonoOuMcp()).rejects.toBeInstanceOf(AcessoNegado);
  });
});

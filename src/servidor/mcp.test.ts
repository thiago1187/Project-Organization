import { describe, expect, it, vi } from "vitest";

// Teste de fiação do servidor MCP: o transporte sobe, fala JSON-RPC de
// verdade e devolve o catálogo. Ele não exercita ferramenta que toca banco —
// isso é `src/dominio/mcp.test.ts` para a lógica e o banco de verdade para o
// resto (ver TESTES_PENDENTES_BANCO.todo).
//
// Por que este arquivo vale existir mesmo sendo curto: a parte do MCP que
// quebra sem avisar é a montagem — nome de módulo do SDK, modo sem estado,
// `Accept` que o transporte exige. Um erro aí não aparece em `tsc` e derruba a
// conexão inteira no cliente, com uma mensagem que não explica nada. Aqui
// aparece em 100 ms.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

import { atenderMcp } from "@/servidor/mcp";
import { NOMES_FERRAMENTAS_MCP } from "@/dominio/mcp";
import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";

// O transporte Streamable HTTP exige que o cliente aceite as duas formas de
// resposta; recusar um POST sem isso é comportamento do próprio SDK.
const CABECALHOS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

function chamada(corpo: unknown): Request {
  return new Request("https://painel.exemplo/api/mcp", {
    method: "POST",
    headers: CABECALHOS,
    body: JSON.stringify(corpo),
  });
}

describe("atenderMcp — fiação do transporte", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PAINEL_MCP_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  it("responde ao handshake de initialize anunciando capacidade de ferramentas", async () => {
    const resposta = await atenderMcp(
      chamada({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "teste", version: "1.0.0" },
        },
      }),
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.result.capabilities.tools).toBeDefined();
    expect(corpo.result.serverInfo.name).toBe("painel-de-controle");
    // As instruções do servidor são o que o cliente mostra ao modelo antes de
    // qualquer chamada — é onde a regra "aprovar é do dono" chega primeiro.
    expect(corpo.result.instructions).toContain("Aprovar ou recusar");
  });

  it("tools/list devolve o catálogo inteiro, cada um com esquema de objeto", async () => {
    const resposta = await atenderMcp(chamada({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    const nomes = corpo.result.tools.map((t: { name: string }) => t.name);
    expect(nomes.sort()).toEqual([...NOMES_FERRAMENTAS_MCP].sort());
    for (const ferramenta of corpo.result.tools) {
      expect(ferramenta.inputSchema.type).toBe("object");
      expect(ferramenta.description.length).toBeGreaterThan(0);
    }
  });

  it("ferramenta inexistente vira erro legível na conversa, não exceção JSON-RPC", async () => {
    // O modelo precisa poder se corrigir: `isError` devolve o texto para ele,
    // enquanto um erro de protocolo derrubaria a chamada.
    const resposta = await atenderMcp(
      chamada({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "aprovar_sugestao", arguments: {} },
      }),
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.error).toBeUndefined();
    expect(corpo.result.isError).toBe(true);
    expect(corpo.result.content[0].text).toContain("aprovar_sugestao");
  });

  it("escrita pelo bypass da routine é recusada com texto que explica o que fazer", async () => {
    // O caminho inteiro: JSON-RPC → despacho → `exigirDonoOuMcp()` →
    // `AcessoNegado` → mensagem legível. Prova que a recusa não vira exceção
    // e não chega perto do banco (nenhuma consulta acontece antes do guard).
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "segredo-bypass-de-teste" });
    mockCookies();

    const resposta = await atenderMcp(
      chamada({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "cadastrar_projeto",
          arguments: { nome: "Novo", repositorio: "dono/repo", frequencia: "semanal" },
        },
      }),
    );

    const corpo = await resposta.json();
    expect(corpo.result.isError).toBe(true);
    expect(corpo.result.content[0].text).toContain("PAINEL_MCP_SECRET");
  });

  it("não emite Mcp-Session-Id — o modo sem estado é a escolha, não um acidente", async () => {
    const resposta = await atenderMcp(
      chamada({
        jsonrpc: "2.0",
        id: 4,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "teste", version: "1.0.0" },
        },
      }),
    );

    expect(resposta.headers.get("mcp-session-id")).toBeNull();
  });
});

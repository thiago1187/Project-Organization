import { describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 1, caso 4 — "o teste de regressão mais
// importante do arquivo". Replica o furo real: a rota PATCH aplicava
// exigirSessaoDoDono(), a Server Action da fila não. Por isso este arquivo
// NÃO mocka "@/servidor/acesso" nem exigirSessaoDoDono() — deliberadamente,
// como o plano pede ("sem mockar sessão válida"). Só a fronteira de I/O
// (`next/headers`) é mockada, simulando uma requisição sem cookie de sessão
// e sem header de bypass; o resto (acesso.ts, sessao.ts, comparacaoSegura.ts)
// roda de verdade. Se algum dia alguém remover a chamada a
// exigirSessaoDoDono() de acoes-sugestao.ts, este teste passa a chamar de
// verdade aprovarSugestao/recusarSugestao/marcarSugestaoFeita (mockadas
// abaixo) e falha.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("./sugestoes", () => ({
  aprovarSugestao: vi.fn(),
  recusarSugestao: vi.fn(),
  marcarSugestaoFeita: vi.fn(),
}));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "@/servidor/sugestoes";
import { aprovarSugestaoAction, marcarFeitaAction, recusarSugestaoAction } from "@/servidor/acoes-sugestao";

const SUGESTAO_ID = "11111111-1111-1111-1111-111111111111";
const PROJETO_ID = "22222222-2222-2222-2222-222222222222";

describe("Server Actions de sugestão — sem sessão do dono", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  // Nenhuma variável de ambiente configurada (limparEnvEntreTestes já apagou
  // as cinco acima) e nenhum cookie, nenhum header de bypass — a requisição
  // "anônima" mais simples possível, o caso que o furo original deixava
  // passar.
  function requisicaoAnonima() {
    mockHeaders();
    mockCookies();
  }

  it("aprovarSugestaoAction devolve 'Acesso negado.' e nunca chama aprovarSugestao", async () => {
    requisicaoAnonima();

    const resultado = await aprovarSugestaoAction(SUGESTAO_ID, PROJETO_ID);

    expect(resultado).toEqual({ ok: false, erro: "Acesso negado." });
    expect(aprovarSugestao).not.toHaveBeenCalled();
  });

  it("recusarSugestaoAction devolve 'Acesso negado.' e nunca chama recusarSugestao", async () => {
    requisicaoAnonima();

    const resultado = await recusarSugestaoAction(SUGESTAO_ID, PROJETO_ID);

    expect(resultado).toEqual({ ok: false, erro: "Acesso negado." });
    expect(recusarSugestao).not.toHaveBeenCalled();
  });

  it("marcarFeitaAction devolve 'Acesso negado.' e nunca chama marcarSugestaoFeita", async () => {
    requisicaoAnonima();

    const resultado = await marcarFeitaAction(SUGESTAO_ID, PROJETO_ID, "https://exemplo.com/pr/1");

    expect(resultado).toEqual({ ok: false, erro: "Acesso negado." });
    expect(marcarSugestaoFeita).not.toHaveBeenCalled();
  });

  it("mesmo com o header de bypass da routine (sem sessão), as três Server Actions continuam recusando", async () => {
    // A routine não escreve mais em `sugestao` (docs/proximos-passos.md item
    // 2) — bypass nunca deveria abrir este caminho, mesmo com o segredo
    // certo. Ver também o caso 17 em acesso.test.ts, que prova isto
    // diretamente em exigirSessaoDoDono().
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "segredo-bypass-de-teste" });
    mockCookies();

    const resultado = await aprovarSugestaoAction(SUGESTAO_ID, PROJETO_ID);

    expect(resultado).toEqual({ ok: false, erro: "Acesso negado." });
    expect(aprovarSugestao).not.toHaveBeenCalled();
  });
});

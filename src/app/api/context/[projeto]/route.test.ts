import { beforeEach, describe, expect, it, vi } from "vitest";

// A regra que estes casos seguram: **a routine não escreve contexto.**
//
// O motivo está no CLAUDE.md, regra 4, e não é procedimento: contexto vira
// instrução no CLAUDE.md do repositório alvo, e um agente comprometido numa
// rodada escreveria as próprias ordens para a rodada seguinte. `PUT` e
// `DELETE` chamam `exigirSessaoDoDono()` por causa disso, e nada provava.
//
// Este arquivo **não mocka** `acesso.ts` — mesma disciplina de
// `src/servidor/acoes-sugestao.test.ts`. Só `next/headers` é mockado, e o
// resto (acesso.ts, sessao.ts, comparacaoSegura.ts) roda de verdade. Se alguém
// remover a linha do guard, a função de dados abaixo passa a ser chamada e o
// teste fica vermelho — que é o único jeito de o teste provar alguma coisa.

vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/servidor/contextos", () => ({
  listarContextosDoProjeto: vi.fn(),
  upsertContexto: vi.fn(),
  deletarContexto: vi.fn(),
}));
vi.mock("@/servidor/projetos", () => ({ obterProjetoPorId: vi.fn() }));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { deletarContexto, listarContextosDoProjeto, upsertContexto } from "@/servidor/contextos";
import { obterProjetoPorId } from "@/servidor/projetos";
import { DELETE, GET, PUT } from "./route";

const PROJETO = "11111111-1111-1111-1111-111111111111";
const SEGREDO_BYPASS = "segredo-bypass-de-teste";
const CABECALHO_BYPASS = "x-vercel-protection-bypass";

const params = Promise.resolve({ projeto: PROJETO });

function req(corpo: unknown) {
  return new Request("https://painel.invalido/api/context/x", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

describe("/api/context/[projeto] — a routine lê, mas não escreve", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PAINEL_MCP_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(obterProjetoPorId).mockResolvedValue({ id: PROJETO, nome: "P" } as never);
    vi.mocked(listarContextosDoProjeto).mockResolvedValue([] as never);
  });

  /** A routine autenticada: header de bypass com o segredo certo, sem cookie. */
  function comoRoutine() {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = SEGREDO_BYPASS;
    mockHeaders({ [CABECALHO_BYPASS]: SEGREDO_BYPASS });
    mockCookies();
  }

  it("a routine LÊ contexto — GET passa", async () => {
    comoRoutine();

    const resposta = await GET(new Request("https://painel.invalido/x"), { params });

    expect(resposta.status).toBe(200);
    expect(listarContextosDoProjeto).toHaveBeenCalled();
  });

  it("a routine NÃO escreve — PUT recusa, e não chega no banco", async () => {
    comoRoutine();

    const resposta = await PUT(req({ agente_destino: "designer-ui", tipo: "nota", conteudo: "x" }), {
      params,
    });

    expect(resposta.status).toBe(401);
    // O que de fato importa: não basta responder 401, a escrita não pode ter
    // acontecido antes.
    expect(upsertContexto).not.toHaveBeenCalled();
  });

  it("a routine NÃO apaga — DELETE recusa, e não chega no banco", async () => {
    comoRoutine();

    const resposta = await DELETE(req({ id: "c1" }), { params });

    expect(resposta.status).toBe(401);
    expect(deletarContexto).not.toHaveBeenCalled();
  });

  it("sem credencial nenhuma, nem ler é permitido", async () => {
    process.env.VERCEL_ENV = "production";
    mockHeaders({});
    mockCookies();

    const resposta = await GET(new Request("https://painel.invalido/x"), { params });

    expect(resposta.status).toBe(401);
    expect(listarContextosDoProjeto).not.toHaveBeenCalled();
  });
});

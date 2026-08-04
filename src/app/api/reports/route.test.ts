import { beforeEach, describe, expect, it, vi } from "vitest";

// `POST /api/reports` é por onde o diagnóstico da madrugada entra. Ela é
// chamada pela routine com o header de bypass, então `exigirAcesso()` é o
// guard certo aqui — diferente de `/api/context`, onde a routine é recusada
// de propósito.
//
// O que estes casos seguram é o outro lado: um corpo inválido tem que ser
// recusado com 4xx e uma mensagem, nunca gravado pela metade nem estourando em
// 500. Relatório é o único registro que sobra de uma noite; se ele sumir em
// silêncio porque um campo veio fora da lista, o dono acorda achando que a
// rodada não rodou.

vi.mock("@/servidor/acesso", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("@/servidor/acesso")>();
  return { ...real, exigirAcesso: vi.fn() };
});
vi.mock("@/servidor/relatorios", () => ({
  criarRelatorio: vi.fn(),
  ultimoRelatorioPorProjeto: vi.fn(),
}));
vi.mock("@/servidor/projetos", () => ({ obterProjetoPorId: vi.fn() }));

import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { criarRelatorio, ultimoRelatorioPorProjeto } from "@/servidor/relatorios";
import { obterProjetoPorId } from "@/servidor/projetos";
import { GET, POST } from "./route";

const PROJETO = "11111111-1111-1111-1111-111111111111";

const CORPO_VALIDO = {
  projeto_id: PROJETO,
  status: "ok",
  resumo: "Rodei a suíte duas vezes: 381 testes verdes nas duas.",
  testes_passaram: true,
  achados_por_agente: [{ agente: "qa-testes", achado: "381 testes, todos passando.", selo: "381 verdes" }],
};

function req(corpo: unknown) {
  return new Request("https://painel.invalido/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exigirAcesso).mockResolvedValue(undefined);
    vi.mocked(obterProjetoPorId).mockResolvedValue({ id: PROJETO, nome: "P" } as never);
    vi.mocked(criarRelatorio).mockResolvedValue({ id: "r1" } as never);
  });

  it("recusa sem acesso, antes de tocar no banco", async () => {
    vi.mocked(exigirAcesso).mockRejectedValue(new AcessoNegado());

    const resposta = await POST(req(CORPO_VALIDO));

    expect(resposta.status).toBe(401);
    expect(criarRelatorio).not.toHaveBeenCalled();
  });

  it("aceita o corpo que a routine manda", async () => {
    const resposta = await POST(req(CORPO_VALIDO));

    expect(resposta.status).toBeLessThan(300);
    expect(criarRelatorio).toHaveBeenCalledTimes(1);
  });

  it("corpo que não é JSON vira 400, não 500", async () => {
    const resposta = await POST(
      new Request("https://painel.invalido/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ isto não é json",
      }),
    );

    expect(resposta.status).toBe(400);
    expect(criarRelatorio).not.toHaveBeenCalled();
  });

  it("status fora da lista é recusado — o banco tem CHECK, mas a mensagem tem que sair daqui", async () => {
    const resposta = await POST(req({ ...CORPO_VALIDO, status: "quase" }));

    expect(resposta.status).toBe(400);
    expect(criarRelatorio).not.toHaveBeenCalled();
  });

  it("resumo vazio é recusado — relatório sem resumo não diz nada de manhã", async () => {
    const resposta = await POST(req({ ...CORPO_VALIDO, resumo: "   " }));

    expect(resposta.status).toBe(400);
    expect(criarRelatorio).not.toHaveBeenCalled();
  });

  it("projeto inexistente é recusado, e a mensagem diz isso", async () => {
    vi.mocked(obterProjetoPorId).mockResolvedValue(null as never);

    const resposta = await POST(req(CORPO_VALIDO));

    expect(resposta.status).toBeGreaterThanOrEqual(400);
    expect(criarRelatorio).not.toHaveBeenCalled();
  });

  // ── GET, que a rodada lê no passo 0 ──────────────────────────────────────

  it("GET devolve uma linha por projeto, não o histórico inteiro", async () => {
    // A rodada usa só "o relatório mais recente de cada projeto" (passo 0.2 do
    // prompt). Mandar o histórico completo era pagar tokens toda madrugada por
    // dado descartado na linha seguinte, e a conta cresce uma noite por dia.
    vi.mocked(ultimoRelatorioPorProjeto).mockResolvedValue([] as never);

    const resposta = await GET();

    expect(resposta.status).toBe(200);
    expect(ultimoRelatorioPorProjeto).toHaveBeenCalledTimes(1);
  });

  it("GET recusa sem acesso, antes de consultar", async () => {
    vi.mocked(exigirAcesso).mockRejectedValue(new AcessoNegado());

    const resposta = await GET();

    expect(resposta.status).toBe(401);
    expect(ultimoRelatorioPorProjeto).not.toHaveBeenCalled();
  });
});

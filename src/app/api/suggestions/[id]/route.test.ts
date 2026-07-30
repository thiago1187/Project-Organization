import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 1, casos 1, 2, 3 e 8 — o gate de aprovação
// na camada de rota. A checagem de acesso em si (bypass nunca abre este
// caminho, matriz de ambiente etc.) já é provada com código real em
// src/servidor/acesso.test.ts; aqui o interesse é como a ROTA usa o
// resultado dessa checagem — por isso `exigirSessaoDoDono()` é mockada
// diretamente (representando os dois desfechos possíveis, já provados em
// outro arquivo), e o foco fica em status code e em nunca tocar a camada de
// dados quando o acesso é negado ou o id é inválido.

vi.mock("@/servidor/acesso", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("@/servidor/acesso")>();
  return { ...real, exigirSessaoDoDono: vi.fn() };
});
vi.mock("@/servidor/sugestoes", () => ({
  aprovarSugestao: vi.fn(),
  recusarSugestao: vi.fn(),
  marcarSugestaoFeita: vi.fn(),
}));

import { AcessoNegado, exigirSessaoDoDono } from "@/servidor/acesso";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "@/servidor/sugestoes";
import { PATCH } from "./route";

const ID_VALIDO = "11111111-1111-1111-1111-111111111111";

function requisicao(id: string, corpo: unknown): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/suggestions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return [req, { params: Promise.resolve({ id }) }];
}

function nenhumaFuncaoDeDecisaoFoiChamada() {
  expect(aprovarSugestao).not.toHaveBeenCalled();
  expect(recusarSugestao).not.toHaveBeenCalled();
  expect(marcarSugestaoFeita).not.toHaveBeenCalled();
}

describe("PATCH /api/suggestions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caso 1 — sem sessão nem bypass: 401, nenhuma função de decisão é chamada", async () => {
    vi.mocked(exigirSessaoDoDono).mockRejectedValue(new AcessoNegado());

    const [req, ctx] = requisicao(ID_VALIDO, { estado: "aprovada" });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(401);
    nenhumaFuncaoDeDecisaoFoiChamada();
  });

  it("caso 2 — header de bypass da routine, sem sessão: 401 (bypass não abre mais este caminho)", async () => {
    // exigirSessaoDoDono() recusa a origem bypass mesmo com o header certo —
    // comportamento provado com código real no caso 17 de acesso.test.ts.
    // Aqui só confirmamos que a rota devolve 401 quando ela recusa.
    vi.mocked(exigirSessaoDoDono).mockRejectedValue(new AcessoNegado());

    const req = new Request(`http://localhost/api/suggestions/${ID_VALIDO}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-vercel-protection-bypass": "qualquer-valor" },
      body: JSON.stringify({ estado: "aprovada" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: ID_VALIDO }) });

    expect(res.status).toBe(401);
    nenhumaFuncaoDeDecisaoFoiChamada();
  });

  it("caso 3 — sessão do dono, transição válida: 200 com estado 'aprovada' e aprovada_em preenchido", async () => {
    vi.mocked(exigirSessaoDoDono).mockResolvedValue(undefined);
    const sugestaoAprovada = {
      id: ID_VALIDO,
      projeto_id: "22222222-2222-2222-2222-222222222222",
      agente: "revisor-seguranca",
      proposta: "proposta",
      motivo: "motivo",
      esforco: "pequeno",
      risco: "risco",
      reversibilidade: "facil",
      estado: "aprovada",
      criada_em: new Date().toISOString(),
      aprovada_em: new Date().toISOString(),
      recusada_em: null,
      feita_em: null,
      pr_url: null,
    };
    vi.mocked(aprovarSugestao).mockResolvedValue(sugestaoAprovada as never);

    const [req, ctx] = requisicao(ID_VALIDO, { estado: "aprovada" });
    const res = await PATCH(req, ctx);
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.estado).toBe("aprovada");
    expect(corpo.aprovada_em).toBeTruthy();
    expect(aprovarSugestao).toHaveBeenCalledWith(ID_VALIDO);
  });

  it("caso 8 — id que não é UUID: 404 antes de ler o corpo ou tocar o banco", async () => {
    vi.mocked(exigirSessaoDoDono).mockResolvedValue(undefined);

    for (const idInvalido of ["1", "'; DROP TABLE sugestao;--"]) {
      const req = new Request(`http://localhost/api/suggestions/${encodeURIComponent(idInvalido)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estado: "aprovada" }),
      });
      const leituraDoCorpo = vi.spyOn(req, "json");

      const res = await PATCH(req, { params: Promise.resolve({ id: idInvalido }) });

      expect(res.status).toBe(404);
      expect(leituraDoCorpo).not.toHaveBeenCalled();
    }
    nenhumaFuncaoDeDecisaoFoiChamada();
  });
});

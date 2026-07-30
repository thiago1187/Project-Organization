import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 1, caso 7 — POST /api/suggestions
// (routine) não aceita `estado` no corpo; toda sugestão nasce "pendente".

vi.mock("@/servidor/acesso", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("@/servidor/acesso")>();
  return { ...real, exigirAcesso: vi.fn() };
});
vi.mock("@/servidor/sugestoes", () => ({
  criarSugestao: vi.fn(),
}));
vi.mock("@/servidor/projetos", () => ({
  obterProjetoPorId: vi.fn(),
}));

import { exigirAcesso } from "@/servidor/acesso";
import { criarSugestao } from "@/servidor/sugestoes";
import { obterProjetoPorId } from "@/servidor/projetos";
import { POST } from "./route";

const PROJETO_ID = "22222222-2222-2222-2222-222222222222";

const CORPO_VALIDO = {
  projeto_id: PROJETO_ID,
  agente: "revisor-seguranca",
  proposta: "proposta de teste",
  motivo: "motivo de teste",
  esforco: "pequeno",
  risco: "risco de teste",
  reversibilidade: "facil",
};

describe("POST /api/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exigirAcesso).mockResolvedValue(undefined);
    vi.mocked(obterProjetoPorId).mockResolvedValue({
      id: PROJETO_ID,
      nome: "Projeto de teste",
      repositorio: "dono/repo",
      frequencia: "toda_madrugada",
      ativo: true,
      criado_em: new Date().toISOString(),
    } as never);
    vi.mocked(criarSugestao).mockResolvedValue({ id: "id-qualquer", estado: "pendente" } as never);
  });

  it("caso 7 — corpo com estado: 'aprovada' é ignorado; a sugestão nasce pendente", async () => {
    const req = new Request("http://localhost/api/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...CORPO_VALIDO, estado: "aprovada" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(criarSugestao).toHaveBeenCalledTimes(1);
    const dadosEnviados = vi.mocked(criarSugestao).mock.calls[0][0];
    expect(dadosEnviados).not.toHaveProperty("estado");
  });
});

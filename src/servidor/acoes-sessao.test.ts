import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 3 — "entrarAction com proximo malicioso no
// FormData", o teste de ponta a ponta que fecha o caso destinoSeguro.test.ts
// no ponto de uso real. `redirect()` normalmente lança (é assim que o Next
// interrompe a renderização); aqui é mockado para só registrar o argumento
// recebido, sem lançar, para dar para inspecionar o valor.

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { entrarAction } from "@/servidor/acoes-sessao";

describe("entrarAction", () => {
  limparEnvEntreTestes(["PAINEL_SESSAO_SECRET", "VERCEL_ENV", "PERMITIR_SESSAO_LOCAL"]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function ambienteQueConcedeSessao() {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    process.env.VERCEL_ENV = "production";
    vi.mocked(cookies).mockResolvedValue({ set: vi.fn() } as never);
    vi.mocked(redirect).mockImplementation(() => undefined as never);
  }

  it("com 'proximo' malicioso no FormData, redirect() usa o valor já normalizado por destinoSeguro, não o bruto do formulário", async () => {
    ambienteQueConcedeSessao();

    const formData = new FormData();
    formData.set("segredo", "segredo-de-teste");
    formData.set("proximo", "/\\evil.com");

    await entrarAction({ erro: null }, formData);

    expect(redirect).toHaveBeenCalledWith("/");
    expect(redirect).not.toHaveBeenCalledWith("/\\evil.com");
  });

  it("com 'proximo' interno válido, redirect() usa o caminho pedido", async () => {
    ambienteQueConcedeSessao();

    const formData = new FormData();
    formData.set("segredo", "segredo-de-teste");
    formData.set("proximo", "/projeto/123");

    await entrarAction({ erro: null }, formData);

    expect(redirect).toHaveBeenCalledWith("/projeto/123");
  });

  it("segredo incorreto: não grava cookie nem redireciona", async () => {
    ambienteQueConcedeSessao();
    const cookieStore = { set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);

    const formData = new FormData();
    formData.set("segredo", "segredo-errado");
    formData.set("proximo", "/projeto/123");

    const resultado = await entrarAction({ erro: null }, formData);

    expect(resultado.erro).toBe("Segredo incorreto.");
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

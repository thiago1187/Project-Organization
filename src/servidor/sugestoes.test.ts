import { describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 1, casos 5 e 6 — a camada de dados de
// `sugestao`. Só `next/headers` (fronteira de I/O de acesso.ts) e `@/servidor/db`
// (fronteira de I/O do banco) são mockados; `exigirSessaoDoDono()` roda de
// verdade — é o próprio ponto do caso 5: provar que a checagem está na camada
// de dados, não emulada por um mock que "finge" negar.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("@/servidor/db", () => ({
  sql: vi.fn(),
}));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { sql } from "@/servidor/db";
import { NOME_COOKIE_SESSAO, gerarValorCookieSessao } from "@/servidor/sessao";
import { AcessoNegado } from "@/servidor/acesso";
import { ErroDados } from "@/servidor/erros";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "@/servidor/sugestoes";

const ID_QUALQUER = "11111111-1111-1111-1111-111111111111";

/** Linha "de sucesso" que o SQL devolveria se chegasse a ser chamado — usada
 * só para provar que a checagem de acesso barra antes de sequer tentar. */
const LINHA_SUCESSO = {
  id: ID_QUALQUER,
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

function semSessao() {
  mockHeaders();
  mockCookies();
}

function comSessaoValida() {
  process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
  process.env.VERCEL_ENV = "production";
  process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
  mockHeaders();
  mockCookies({ [NOME_COOKIE_SESSAO]: gerarValorCookieSessao() });
}

describe("sugestoes — camada de dados", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  describe("caso 5 — sem sessão, lança AcessoNegado antes de emitir qualquer UPDATE", () => {
    it("aprovarSugestao", async () => {
      semSessao();
      const consultaMock = vi.fn().mockResolvedValue([LINHA_SUCESSO]);
      vi.mocked(sql).mockReturnValue(consultaMock as never);

      await expect(aprovarSugestao(ID_QUALQUER)).rejects.toBeInstanceOf(AcessoNegado);
      expect(sql).not.toHaveBeenCalled();
      expect(consultaMock).not.toHaveBeenCalled();
    });

    it("recusarSugestao", async () => {
      semSessao();
      const consultaMock = vi.fn().mockResolvedValue([LINHA_SUCESSO]);
      vi.mocked(sql).mockReturnValue(consultaMock as never);

      await expect(recusarSugestao(ID_QUALQUER)).rejects.toBeInstanceOf(AcessoNegado);
      expect(sql).not.toHaveBeenCalled();
      expect(consultaMock).not.toHaveBeenCalled();
    });

    it("marcarSugestaoFeita", async () => {
      semSessao();
      const consultaMock = vi.fn().mockResolvedValue([LINHA_SUCESSO]);
      vi.mocked(sql).mockReturnValue(consultaMock as never);

      await expect(marcarSugestaoFeita(ID_QUALQUER, "https://exemplo.com/pr/1")).rejects.toBeInstanceOf(
        AcessoNegado,
      );
      expect(sql).not.toHaveBeenCalled();
      expect(consultaMock).not.toHaveBeenCalled();
    });
  });

  it("caso 6 — transição inválida (SQL devolve zero linhas): ErroDados com a mensagem certa, não erro genérico", async () => {
    comSessaoValida();
    const consultaMock = vi.fn().mockResolvedValue([]); // simula estado != 'pendente'
    vi.mocked(sql).mockReturnValue(consultaMock as never);

    await expect(aprovarSugestao(ID_QUALQUER)).rejects.toThrow(ErroDados);
    await expect(aprovarSugestao(ID_QUALQUER)).rejects.toThrow(/pode já ter sido decidida em outra aba/);
  });
});

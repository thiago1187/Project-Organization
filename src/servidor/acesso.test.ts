import { describe, expect, it, vi } from "vitest";

// docs/plano-testes.md § 2, nível 2 — matriz de origem × ambiente de
// src/servidor/acesso.ts. Só `next/headers` é mockado (fronteira de I/O); a
// lógica real de acesso.ts, sessao.ts e comparacaoSegura.ts roda sem mock
// nenhum, para que estes testes provem o comportamento de verdade, não uma
// simulação dele.

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

import { mockCookies, mockHeaders } from "@/testes/mockNextHeaders";
import { limparEnvEntreTestes } from "@/testes/envSandbox";
import { AcessoNegado, exigirAcesso, exigirSessaoDoDono } from "@/servidor/acesso";
import { NOME_COOKIE_SESSAO, gerarValorCookieSessao } from "@/servidor/sessao";

describe("acesso — matriz de origem × ambiente", () => {
  limparEnvEntreTestes([
    "VERCEL_ENV",
    "PAINEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "PERMITIR_SESSAO_LOCAL",
    "PAINEL_SESSAO_SECRET",
  ]);

  it("caso 9 — produção, sem segredo de bypass configurado, header de bypass presente: recusa (regressão de 'promover a routine a dono')", async () => {
    process.env.VERCEL_ENV = "production";
    // PAINEL_BYPASS_SECRET e VERCEL_AUTOMATION_BYPASS_SECRET ficam ausentes —
    // limparEnvEntreTestes já apagou os dois antes deste teste rodar.
    mockHeaders({ "x-vercel-protection-bypass": "qualquer-valor" });
    mockCookies();

    await expect(exigirAcesso()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("caso 10 — produção, segredo configurado, header com o segredo certo: exigirAcesso() passa, exigirSessaoDoDono() continua recusando", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "segredo-bypass-de-teste" });
    mockCookies();

    await expect(exigirAcesso()).resolves.toBeUndefined();
    await expect(exigirSessaoDoDono()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("caso 11 — produção, segredo configurado, header com valor errado: recusa", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "valor-errado" });
    mockCookies();

    await expect(exigirAcesso()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("caso 12 — PAINEL_BYPASS_SECRET ausente mas VERCEL_AUTOMATION_BYPASS_SECRET presente e batendo: aceita (fallback documentado)", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "segredo-vercel-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "segredo-vercel-de-teste" });
    mockCookies();

    await expect(exigirAcesso()).resolves.toBeUndefined();
  });

  it("caso 13 — produção, cookie de sessão válido, sem header: exigirSessaoDoDono() passa", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: gerarValorCookieSessao() });

    await expect(exigirSessaoDoDono()).resolves.toBeUndefined();
  });

  it("caso 13b — produção SEM segredo de bypass, cookie de sessão válido: o dono entra", async () => {
    // Havia uma recusa geral quando o segredo de bypass faltava em ambiente
    // Vercel. Ela protegia o desenho antigo, em que sessão era concedida pela
    // mera presença no ambiente — sem ela, a routine caía nas regras de sessão
    // e virava dona.
    //
    // Hoje sessão exige cookie assinado, que a routine não consegue forjar. A
    // recusa geral perdeu o alvo e sobrou o efeito colateral: um deploy sem o
    // segredo de bypass trancava o próprio dono fora do painel.
    //
    // Este caso existe para essa regressão não voltar. Repare que
    // PAINEL_BYPASS_SECRET fica ausente de propósito.
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: gerarValorCookieSessao() });

    await expect(exigirSessaoDoDono()).resolves.toBeUndefined();
  });

  it("caso 14 — preview, cookie tecnicamente válido (assinatura bate): exigirSessaoDoDono() recusa mesmo assim", async () => {
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
    const cookieValido = gerarValorCookieSessao();

    process.env.VERCEL_ENV = "preview";
    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: cookieValido });

    await expect(exigirSessaoDoDono()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("caso 15 — local, sem VERCEL_ENV, sem PERMITIR_SESSAO_LOCAL, cookie válido: recusa (substitui o antigo NODE_ENV !== 'production')", async () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
    const cookieValido = gerarValorCookieSessao();

    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: cookieValido });

    await expect(exigirSessaoDoDono()).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("caso 16 — local, PERMITIR_SESSAO_LOCAL=1, cookie válido: aceita", async () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-sessao-de-teste";
    process.env.PERMITIR_SESSAO_LOCAL = "1";
    const cookieValido = gerarValorCookieSessao();

    mockHeaders();
    mockCookies({ [NOME_COOKIE_SESSAO]: cookieValido });

    await expect(exigirSessaoDoDono()).resolves.toBeUndefined();
  });

  it("caso 17 — exigirSessaoDoDono() com origem bypass recusa, mesmo com header de bypass correto: só sessão abre esse portão", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.PAINEL_BYPASS_SECRET = "segredo-bypass-de-teste";
    mockHeaders({ "x-vercel-protection-bypass": "segredo-bypass-de-teste" });
    mockCookies();

    await expect(exigirSessaoDoDono()).rejects.toBeInstanceOf(AcessoNegado);
  });
});

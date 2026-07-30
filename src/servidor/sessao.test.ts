import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cookieSessaoEhValido, gerarValorCookieSessao } from "@/servidor/sessao";
import { limparEnvEntreTestes } from "@/testes/envSandbox";

// docs/plano-testes.md § 2, nível 2, casos 18-21.
//
// `assinar` (sessao.ts) não é exportada — o formato do cookie é
// `"<expira_em_ms>.<assinatura>"`, documentado no comentário de
// `gerarValorCookieSessao`. Esta função replica só isso (uma linha de HMAC)
// para montar valores de cookie que `gerarValorCookieSessao()` sozinha não
// consegue produzir (expirado, assinado com outro segredo) — não é o mesmo
// que reimportar a lógica de sessao.ts, então não torna o teste circular.
function assinarParaTeste(exp: number, segredo: string): string {
  return createHmac("sha256", segredo).update(String(exp)).digest("base64url");
}

describe("cookieSessaoEhValido", () => {
  limparEnvEntreTestes(["PAINEL_SESSAO_SECRET"]);

  it("caso 18 — sem PAINEL_SESSAO_SECRET configurada: false para qualquer valor, mesmo um assinado com um segredo antigo válido", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-antigo";
    const cookieAssinadoComSegredoAntigo = gerarValorCookieSessao();

    delete process.env.PAINEL_SESSAO_SECRET;

    expect(cookieSessaoEhValido(cookieAssinadoComSegredoAntigo)).toBe(false);
  });

  it("caso 19 — cookie expirado (exp no passado, assinatura correta): false", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    const expNoPassado = Date.now() - 1000;
    const valor = `${expNoPassado}.${assinarParaTeste(expNoPassado, "segredo-de-teste")}`;

    expect(cookieSessaoEhValido(valor)).toBe(false);
  });

  it("caso 20 — assinatura adulterada (exp certo, assinatura de outro segredo): false", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    const expNoFuturo = Date.now() + 1000 * 60 * 60;
    const assinaturaDeOutroSegredo = assinarParaTeste(expNoFuturo, "segredo-errado");
    const valor = `${expNoFuturo}.${assinaturaDeOutroSegredo}`;

    expect(cookieSessaoEhValido(valor)).toBe(false);
  });

  it("caso 20b — assinatura adulterada (exp certo no cookie, mas assinatura calculada para outro exp): false", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    const expNoFuturo = Date.now() + 1000 * 60 * 60;
    const assinaturaDeOutroExp = assinarParaTeste(expNoFuturo + 1, "segredo-de-teste");
    const valor = `${expNoFuturo}.${assinaturaDeOutroExp}`;

    expect(cookieSessaoEhValido(valor)).toBe(false);
  });

  it("caso 21 — valor malformado: false, sem lançar", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";

    expect(() => cookieSessaoEhValido("sem-ponto-nenhum")).not.toThrow();
    expect(cookieSessaoEhValido("sem-ponto-nenhum")).toBe(false);

    expect(cookieSessaoEhValido("abc.qualquerassinatura")).toBe(false);

    expect(cookieSessaoEhValido("")).toBe(false);

    expect(cookieSessaoEhValido(undefined)).toBe(false);
  });

  it("aceita um cookie recém-gerado com o segredo certo (caminho feliz de referência)", () => {
    process.env.PAINEL_SESSAO_SECRET = "segredo-de-teste";
    expect(cookieSessaoEhValido(gerarValorCookieSessao())).toBe(true);
  });
});

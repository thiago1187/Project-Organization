import { describe, expect, it } from "vitest";
import { validarPatchSugestao } from "@/dominio/validacaoPatchSugestao";

// docs/plano-testes.md § 2, nível 4, casos 49-54.

describe("validarPatchSugestao", () => {
  it("caso 49 — estado fora de aprovada/recusada/feita: erro", () => {
    expect(validarPatchSugestao({ estado: "pendente" }).ok).toBe(false);
    expect(validarPatchSugestao({ estado: "cancelada" }).ok).toBe(false);
  });

  it("caso 50 — estado: 'feita' sem pr_url: aceito, pr_url: null", () => {
    const resultado = validarPatchSugestao({ estado: "feita" });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.pr_url).toBeNull();
  });

  it("caso 51 — estado: 'feita' com pr_url que não começa com https://: erro", () => {
    const resultado = validarPatchSugestao({ estado: "feita", pr_url: "http://exemplo.com/pr/1" });
    expect(resultado.ok).toBe(false);
  });

  it("caso 52 — estado: 'feita' com pr_url acima de 2048 caracteres: erro", () => {
    const urlGigante = "https://exemplo.com/" + "a".repeat(2048);
    const resultado = validarPatchSugestao({ estado: "feita", pr_url: urlGigante });
    expect(resultado.ok).toBe(false);
  });

  it("caso 53 — estado: 'aprovada' com pr_url no corpo: pr_url ignorado", () => {
    const resultado = validarPatchSugestao({ estado: "aprovada", pr_url: "https://exemplo.com/pr/1" });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.pr_url).toBeNull();
  });

  it("caso 54 — estado: 'feita' com pr_url só espaços: aceito, vira null (não erro de formato)", () => {
    const resultado = validarPatchSugestao({ estado: "feita", pr_url: "   " });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.pr_url).toBeNull();
  });
});

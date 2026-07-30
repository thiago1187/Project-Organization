import { describe, expect, it } from "vitest";
import { segredosBatem } from "@/servidor/comparacaoSegura";

// docs/plano-testes.md § 2, nível 2, caso 22.

describe("segredosBatem", () => {
  it("caso 22 — tamanhos diferentes: false, sem lançar (timingSafeEqual jogaria)", () => {
    expect(() => segredosBatem("curto", "muito-mais-longo-que-curto")).not.toThrow();
    expect(segredosBatem("curto", "muito-mais-longo-que-curto")).toBe(false);
  });

  it("bate quando os dois valores são idênticos", () => {
    expect(segredosBatem("mesmo-valor", "mesmo-valor")).toBe(true);
  });

  it("não bate quando os valores têm o mesmo tamanho mas diferem", () => {
    expect(segredosBatem("valor-aaaaa", "valor-bbbbb")).toBe(false);
  });
});

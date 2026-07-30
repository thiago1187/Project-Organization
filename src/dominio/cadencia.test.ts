import { describe, expect, it } from "vitest";
import { ORDEM_FAIXAS, faixaDoProjeto, patchParaFaixa } from "@/dominio/cadencia";

// docs/plano-testes.md § 2, nível 5, casos 67-72.

describe("faixaDoProjeto", () => {
  it("caso 67 — ativo:false vence qualquer frequência: 'pausado'", () => {
    expect(faixaDoProjeto({ ativo: false, frequencia: "toda_madrugada" })).toBe("pausado");
    expect(faixaDoProjeto({ ativo: false, frequencia: "semanal" })).toBe("pausado");
  });

  it("caso 68 — ativo:true, dias_alternados: 'alternada'", () => {
    expect(faixaDoProjeto({ ativo: true, frequencia: "dias_alternados" })).toBe("alternada");
  });
});

describe("patchParaFaixa", () => {
  it("caso 69 — 'pausado' devolve só { ativo: false }, sem tocar a frequência", () => {
    expect(patchParaFaixa("pausado")).toEqual({ ativo: false });
  });

  it("caso 70 — 'diaria' devolve { ativo: true, frequencia: 'toda_madrugada' }", () => {
    expect(patchParaFaixa("diaria")).toEqual({ ativo: true, frequencia: "toda_madrugada" });
  });

  it("caso 71 — 'semanal' devolve { ativo: true, frequencia: 'semanal' }", () => {
    expect(patchParaFaixa("semanal")).toEqual({ ativo: true, frequencia: "semanal" });
  });

  it("caso 72 — faixaDoProjeto(patchParaFaixa(f)) === f para toda faixa de ORDEM_FAIXAS (as duas são inversas)", () => {
    for (const faixa of ORDEM_FAIXAS) {
      const patch = patchParaFaixa(faixa);
      const projetoResultante = patch.ativo
        ? { ativo: true as const, frequencia: patch.frequencia }
        : { ativo: false as const, frequencia: "toda_madrugada" as const };
      expect(faixaDoProjeto(projetoResultante)).toBe(faixa);
    }
  });
});

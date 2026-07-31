import { describe, expect, it } from "vitest";
import { confirmacaoDeNomeValida, totalApagado } from "@/dominio/exclusaoProjeto";

describe("confirmacaoDeNomeValida", () => {
  it("aceita o nome exato", () => {
    expect(confirmacaoDeNomeValida("Cofre de Rotinas", "Cofre de Rotinas")).toBe(true);
  });

  it("tolera espaço em volta do que foi digitado", () => {
    expect(confirmacaoDeNomeValida("  Cofre de Rotinas  ", "Cofre de Rotinas")).toBe(true);
  });

  it("recusa vazio ou só espaço", () => {
    expect(confirmacaoDeNomeValida("", "Cofre de Rotinas")).toBe(false);
    expect(confirmacaoDeNomeValida("   ", "Cofre de Rotinas")).toBe(false);
  });

  it("recusa nome parecido mas diferente", () => {
    expect(confirmacaoDeNomeValida("Cofre de Rotina", "Cofre de Rotinas")).toBe(false);
    expect(confirmacaoDeNomeValida("cofre de rotinas", "Cofre de Rotinas")).toBe(false);
  });
});

describe("totalApagado", () => {
  it("soma as quatro contagens", () => {
    expect(totalApagado({ relatorios: 3, sugestoes: 2, contextos: 1, tarefas: 4 })).toBe(10);
  });

  it("zero quando não há nada", () => {
    expect(totalApagado({ relatorios: 0, sugestoes: 0, contextos: 0, tarefas: 0 })).toBe(0);
  });
});

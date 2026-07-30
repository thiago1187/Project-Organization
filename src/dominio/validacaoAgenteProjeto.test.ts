import { describe, expect, it } from "vitest";
import { validarInstrucaoAgente, validarOrdemAgentes } from "@/dominio/validacaoAgenteProjeto";

// docs/plano-testes.md § 2, nível 4, casos 64-66.

describe("validarInstrucaoAgente", () => {
  it("caso 64 — teto_sugestoes fora de 0..3, ou não inteiro: erro", () => {
    expect(validarInstrucaoAgente({ teto_sugestoes: 4 }).ok).toBe(false);
    expect(validarInstrucaoAgente({ teto_sugestoes: -1 }).ok).toBe(false);
    expect(validarInstrucaoAgente({ teto_sugestoes: 1.5 }).ok).toBe(false);
  });

  it("aceita teto_sugestoes dentro de 0..3", () => {
    for (const teto of [0, 1, 2, 3]) {
      const resultado = validarInstrucaoAgente({ teto_sugestoes: teto });
      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.dados.teto_sugestoes).toBe(teto);
    }
  });

  it("caso 65 — instrucao acima de 4000 caracteres: erro", () => {
    const resultado = validarInstrucaoAgente({ instrucao: "a".repeat(4001) });
    expect(resultado.ok).toBe(false);
  });
});

describe("validarOrdemAgentes", () => {
  it("caso 66 — mais de 64 itens, ou item não-string: erro", () => {
    expect(validarOrdemAgentes(Array.from({ length: 65 }, () => "revisor-seguranca")).ok).toBe(false);
    expect(validarOrdemAgentes(["revisor-seguranca", 42]).ok).toBe(false);
    expect(validarOrdemAgentes("não é um array").ok).toBe(false);
  });

  it("aceita uma lista válida de nomes de agente", () => {
    const resultado = validarOrdemAgentes(["revisor-seguranca", "qa-testes"]);
    expect(resultado.ok).toBe(true);
  });
});

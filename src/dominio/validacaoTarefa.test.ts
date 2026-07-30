import { describe, expect, it } from "vitest";
import { validarEstadoTarefa, validarOrdemTarefas, validarTituloTarefa } from "@/dominio/validacaoTarefa";

describe("validarTituloTarefa", () => {
  it("rejeita título vazio ou só espaço", () => {
    expect(validarTituloTarefa("").ok).toBe(false);
    expect(validarTituloTarefa("   ").ok).toBe(false);
    expect(validarTituloTarefa(undefined).ok).toBe(false);
  });

  it("rejeita título maior que 200 caracteres", () => {
    expect(validarTituloTarefa("x".repeat(201)).ok).toBe(false);
    expect(validarTituloTarefa("x".repeat(200)).ok).toBe(true);
  });

  it("rejeita caractere de controle (ex.: quebra de linha)", () => {
    expect(validarTituloTarefa("linha 1\nlinha 2").ok).toBe(false);
    expect(validarTituloTarefa("com tab\tno meio").ok).toBe(false);
  });

  it("rejeita título com cara de credencial", () => {
    expect(validarTituloTarefa("trocar sk-abcdefghijklmnop por variável de ambiente").ok).toBe(false);
  });

  it("aceita título normal e apara espaço nas pontas", () => {
    const resultado = validarTituloTarefa("  Migrar a autenticação para X  ");
    expect(resultado).toEqual({ ok: true, dados: "Migrar a autenticação para X" });
  });
});

describe("validarEstadoTarefa", () => {
  it("aceita os três estados válidos", () => {
    for (const estado of ["aberta", "fazendo", "feita"]) {
      expect(validarEstadoTarefa(estado).ok).toBe(true);
    }
  });

  it("rejeita estado fora da lista fechada", () => {
    expect(validarEstadoTarefa("pausada").ok).toBe(false);
    expect(validarEstadoTarefa(undefined).ok).toBe(false);
  });
});

describe("validarOrdemTarefas", () => {
  it("aceita lista de ids", () => {
    const resultado = validarOrdemTarefas(["a", "b", "c"]);
    expect(resultado).toEqual({ ok: true, dados: ["a", "b", "c"] });
  });

  it("rejeita item que não é string, ou string vazia", () => {
    expect(validarOrdemTarefas(["a", 1]).ok).toBe(false);
    expect(validarOrdemTarefas(["a", ""]).ok).toBe(false);
  });

  it("rejeita entrada que não é array", () => {
    expect(validarOrdemTarefas("a").ok).toBe(false);
    expect(validarOrdemTarefas(null).ok).toBe(false);
  });
});

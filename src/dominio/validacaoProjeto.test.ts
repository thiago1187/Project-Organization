import { describe, expect, it } from "vitest";
import { validarDadosProjeto, validarDadosProjetoComFrequencia } from "@/dominio/validacaoProjeto";

// docs/plano-testes.md § 2, nível 4, casos 60-63.

describe("validarDadosProjeto", () => {
  it("caso 60 — repositorio com segmento '.' ou '..': erro (path traversal)", () => {
    expect(validarDadosProjeto({ nome: "Projeto", repositorio: "../x" }).ok).toBe(false);
    expect(validarDadosProjeto({ nome: "Projeto", repositorio: "x/.." }).ok).toBe(false);
  });

  it("caso 61 — repositorio fora do formato dono/repo: erro", () => {
    expect(validarDadosProjeto({ nome: "Projeto", repositorio: "com espaço/repo" }).ok).toBe(false);
    expect(validarDadosProjeto({ nome: "Projeto", repositorio: "sem-barra" }).ok).toBe(false);
    expect(validarDadosProjeto({ nome: "Projeto", repositorio: "dono/meio/repo" }).ok).toBe(false);
  });

  it("caso 62 — nome vazio ou só espaço: erro", () => {
    expect(validarDadosProjeto({ nome: "", repositorio: "dono/repo" }).ok).toBe(false);
    expect(validarDadosProjeto({ nome: "   ", repositorio: "dono/repo" }).ok).toBe(false);
  });

  it("aceita nome e repositório válidos", () => {
    const resultado = validarDadosProjeto({ nome: "Projeto", repositorio: "dono/repo" });
    expect(resultado.ok).toBe(true);
  });
});

describe("validarDadosProjetoComFrequencia", () => {
  it("caso 63 — frequencia fora das três válidas: erro", () => {
    const resultado = validarDadosProjetoComFrequencia({
      nome: "Projeto",
      repositorio: "dono/repo",
      frequencia: "todo_dia",
    });
    expect(resultado.ok).toBe(false);
  });

  it("aceita as três frequências válidas", () => {
    for (const frequencia of ["toda_madrugada", "dias_alternados", "semanal"]) {
      const resultado = validarDadosProjetoComFrequencia({ nome: "Projeto", repositorio: "dono/repo", frequencia });
      expect(resultado.ok).toBe(true);
    }
  });
});

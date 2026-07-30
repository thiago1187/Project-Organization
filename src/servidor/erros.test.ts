import { describe, expect, it, vi } from "vitest";
import { NeonDbError } from "@neondatabase/serverless";
import { ErroDados, traduzirErroDeBanco } from "@/servidor/erros";

// docs/plano-testes.md § 2, nível 7, casos 88-90.

function neonError(code: string): NeonDbError {
  const erro = new NeonDbError("mensagem original do postgres, cheia de detalhe interno");
  erro.code = code;
  return erro;
}

describe("traduzirErroDeBanco", () => {
  it("caso 88 — code 23505 (unique_violation): mensagem fixa sobre repositório duplicado, não o texto cru do Postgres", () => {
    const traduzido = traduzirErroDeBanco(neonError("23505"), "teste");
    expect(traduzido).toBeInstanceOf(ErroDados);
    expect(traduzido.message).toBe("Já existe um projeto cadastrado com este repositório.");
    expect(traduzido.message).not.toMatch(/detalhe interno/);
  });

  it("caso 89 — code 23514 (check_violation): mensagem genérica de dados inválidos, não o nome da constraint", () => {
    const traduzido = traduzirErroDeBanco(neonError("23514"), "teste");
    expect(traduzido).toBeInstanceOf(ErroDados);
    expect(traduzido.message).toBe("Dados inválidos para salvar o projeto.");
    expect(traduzido.message).not.toMatch(/detalhe interno/);
  });

  it("caso 90 — qualquer outro erro: mensagem genérica, nunca o detalhe original; detalhe vai só para o log", () => {
    const espiaoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const erroComum = new Error("ECONNREFUSED: não conseguiu conectar ao banco em host-secreto.interno");
    const traduzido = traduzirErroDeBanco(erroComum, "teste");

    expect(traduzido).not.toBeInstanceOf(ErroDados);
    expect(traduzido.message).toBe(
      "Não foi possível completar a operação agora. Tente novamente em instantes.",
    );
    expect(traduzido.message).not.toMatch(/ECONNREFUSED/);
    expect(traduzido.message).not.toMatch(/host-secreto/);

    // O detalhe real não desaparece — vai para o log do servidor, não some.
    expect(espiaoConsole).toHaveBeenCalled();

    espiaoConsole.mockRestore();
  });

  it("um erro de conexão do Neon sem code 23505/23514 também vira mensagem genérica", () => {
    const espiaoConsole = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const traduzido = traduzirErroDeBanco(neonError("08006"), "teste"); // connection_failure
    expect(traduzido.message).toBe(
      "Não foi possível completar a operação agora. Tente novamente em instantes.",
    );
    espiaoConsole.mockRestore();
  });
});

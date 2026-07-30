import { describe, expect, it } from "vitest";
import { pareceCredencial, semCredencial } from "@/dominio/pareceCredencial";

// docs/plano-testes.md § 2, nível 6, casos 82-84.

describe("pareceCredencial", () => {
  it("caso 82 — reconhece cada padrão isoladamente", () => {
    expect(pareceCredencial("postgres://usuario:senha123@host/db")).toBe(true);
    expect(pareceCredencial("sk-abcdefghijklmnopqrst")).toBe(true);
    expect(pareceCredencial("AKIAABCDEFGHIJKLMNOP")).toBe(true);
    expect(pareceCredencial("ghp_abcdefghijklmnopqrstuvwxyz01")).toBe(true);
    expect(pareceCredencial("xoxb-1234567890-abcdef")).toBe(true);
    expect(
      pareceCredencial(
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQ_dummy_dummy",
      ),
    ).toBe(true);
  });

  it("caso 83 — texto comum sem nenhum desses padrões: não reconhecido", () => {
    expect(pareceCredencial("revisei o código e está ok")).toBe(false);
    expect(pareceCredencial("a proposta é adicionar suíte de testes")).toBe(false);
  });

  it("caso 84 — null, undefined, string vazia: false, sem lançar", () => {
    expect(() => pareceCredencial(null)).not.toThrow();
    expect(pareceCredencial(null)).toBe(false);
    expect(pareceCredencial(undefined)).toBe(false);
    expect(pareceCredencial("")).toBe(false);
  });
});

describe("semCredencial", () => {
  it("devolve o texto inalterado quando não parece credencial", () => {
    expect(semCredencial("texto comum")).toBe("texto comum");
  });

  it("devolve o marcador de omissão quando parece credencial", () => {
    expect(semCredencial("postgres://usuario:senha123@host/db")).toMatch(/omitido/);
  });
});

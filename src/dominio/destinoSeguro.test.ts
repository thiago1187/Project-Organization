import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/dominio/destinoSeguro";

// docs/plano-testes.md § 2, nível 3, casos 23-30. Cada caso é uma entrada do
// comentário de destinoSeguro.ts — o furo real que a rodada de 2026-07-30
// encontrou, e os truques que a versão atual fecha.

describe("destinoSeguro", () => {
  it("caso 23 — barra invertida que o navegador normaliza para host externo: '/'", () => {
    expect(destinoSeguro("/\\evil.com")).toBe("/");
  });

  it("caso 24 — URL protocol-relative ('//evil.com'): '/'", () => {
    expect(destinoSeguro("//evil.com")).toBe("/");
  });

  it("caso 25 — URL absoluta com esquema https: '/'", () => {
    expect(destinoSeguro("https://evil.com")).toBe("/");
  });

  it("caso 26 — esquema javascript: '/'", () => {
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
  });

  it("caso 27 — caminho interno normal passa inalterado", () => {
    expect(destinoSeguro("/projeto/123")).toBe("/projeto/123");
  });

  it("caso 28 — preserva query e hash", () => {
    expect(destinoSeguro("/projeto/123?x=1#y")).toBe("/projeto/123?x=1#y");
  });

  it("caso 29 — entrada que não é string não vazia: undefined, null, '', número", () => {
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro(42)).toBe("/");
  });

  it("caso 30 — string sem barra inicial: '/'", () => {
    expect(destinoSeguro("not-a-path")).toBe("/");
  });
});

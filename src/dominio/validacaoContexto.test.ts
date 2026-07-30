import { describe, expect, it } from "vitest";
import { validarContexto } from "@/dominio/validacaoContexto";

// docs/plano-testes.md § 2, nível 4, casos 55-59.

const BASE = { agente_destino: "designer-ui", tipo: "modelo de design" };

describe("validarContexto", () => {
  it("caso 55 — nem conteudo nem arquivo_url informados: erro", () => {
    const resultado = validarContexto(BASE);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatch(/conteúdo ou.*link/i);
  });

  it("caso 56 — arquivo_url sem https:// (defesa contra SSRF): erro", () => {
    expect(validarContexto({ ...BASE, arquivo_url: "http://exemplo.com/spec.md" }).ok).toBe(false);
    expect(validarContexto({ ...BASE, arquivo_url: "file:///etc/passwd" }).ok).toBe(false);
  });

  it("caso 57 — agente_destino ou tipo com quebra de linha ou caractere de controle: erro", () => {
    expect(validarContexto({ ...BASE, agente_destino: "designer-ui\ninjetado", conteudo: "x" }).ok).toBe(false);
    expect(validarContexto({ ...BASE, tipo: "modelo\tde design", conteudo: "x" }).ok).toBe(false);
  });

  it("caso 58 — conteudo acima de 20000 caracteres: erro", () => {
    const resultado = validarContexto({ ...BASE, conteudo: "a".repeat(20001) });
    expect(resultado.ok).toBe(false);
  });

  it("caso 59 — conteudo só espaços: tratado como ausente (vira null), não como erro de tamanho", () => {
    // Sem arquivo_url, conteudo só-espaço equivale a "nada informado" — erro
    // esperado é o do caso 55, não um erro de tamanho.
    const semArquivo = validarContexto({ ...BASE, conteudo: "   " });
    expect(semArquivo.ok).toBe(false);
    if (!semArquivo.ok) expect(semArquivo.erro).toMatch(/conteúdo ou.*link/i);

    // Com arquivo_url presente, conteudo só-espaço vira null e o restante passa.
    const comArquivo = validarContexto({ ...BASE, conteudo: "   ", arquivo_url: "https://exemplo.com/spec.md" });
    expect(comArquivo.ok).toBe(true);
    if (comArquivo.ok) expect(comArquivo.dados.conteudo).toBeNull();
  });
});

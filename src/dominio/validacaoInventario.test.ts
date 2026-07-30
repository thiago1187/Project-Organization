import { describe, expect, it } from "vitest";
import { validarServico, validarStack } from "@/dominio/validacaoInventario";

// Espelha os CHECKs de db/migrations/002_inventario.sql > stack e > servico —
// mesmo espírito do nível 4 de docs/plano-testes.md (validadores puros,
// entrada de formulário do dono).

const STACK_BASE = { categoria: "linguagem", nome: "TypeScript" };
const SERVICO_BASE = { categoria: "banco", nome: "Neon", conta: "pessoal" };

describe("validarStack", () => {
  it("aceita um item válido", () => {
    const resultado = validarStack(STACK_BASE);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados).toEqual({ categoria: "linguagem", nome: "TypeScript" });
  });

  it("categoria fora de linguagem/framework/runtime: erro", () => {
    expect(validarStack({ ...STACK_BASE, categoria: "banco" }).ok).toBe(false);
    expect(validarStack({ ...STACK_BASE, categoria: "" }).ok).toBe(false);
    expect(validarStack({ ...STACK_BASE, categoria: undefined }).ok).toBe(false);
  });

  it("nome ausente ou só espaço: erro", () => {
    expect(validarStack({ categoria: "linguagem" }).ok).toBe(false);
    expect(validarStack({ ...STACK_BASE, nome: "   " }).ok).toBe(false);
  });

  it("nome acima de 120 caracteres: erro", () => {
    expect(validarStack({ ...STACK_BASE, nome: "a".repeat(121) }).ok).toBe(false);
  });

  it("nome com quebra de linha ou caractere de controle: erro", () => {
    expect(validarStack({ ...STACK_BASE, nome: "Node.js\n20" }).ok).toBe(false);
  });

  it("nome com cara de credencial (string de conexão): erro, com mensagem legível", () => {
    const resultado = validarStack({ ...STACK_BASE, nome: "postgres://user:senha123@host/db" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatch(/credencial/i);
  });

  it("aparo de espaço nas bordas do nome", () => {
    const resultado = validarStack({ ...STACK_BASE, nome: "  Next.js  " });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.nome).toBe("Next.js");
  });

  it("corpo que não é objeto: erro", () => {
    expect(validarStack(null).ok).toBe(false);
    expect(validarStack("stack").ok).toBe(false);
    expect(validarStack([]).ok).toBe(false);
  });
});

describe("validarServico", () => {
  it("aceita um item válido, completo", () => {
    const resultado = validarServico({
      ...SERVICO_BASE,
      papel: "producao",
      administrado_url: "https://vercel.com/painel",
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados).toEqual({
        categoria: "banco",
        nome: "Neon",
        conta: "pessoal",
        papel: "producao",
        administrado_url: "https://vercel.com/painel",
      });
    }
  });

  it("aceita um item válido sem papel nem administrado_url — os dois viram null", () => {
    const resultado = validarServico(SERVICO_BASE);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.papel).toBeNull();
      expect(resultado.dados.administrado_url).toBeNull();
    }
  });

  it("categoria fora da lista fechada: erro", () => {
    expect(validarServico({ ...SERVICO_BASE, categoria: "outro" }).ok).toBe(false);
  });

  it("nome ausente: erro", () => {
    expect(validarServico({ categoria: "banco", conta: "pessoal" }).ok).toBe(false);
  });

  it("conta ausente ou só espaço: erro — 'usa Neon' sozinho não diz qual Neon", () => {
    expect(validarServico({ categoria: "banco", nome: "Neon" }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, conta: "   " }).ok).toBe(false);
  });

  it("papel só espaço: tratado como ausente (vira null), não como erro", () => {
    const resultado = validarServico({ ...SERVICO_BASE, papel: "   " });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.papel).toBeNull();
  });

  it("nome/conta/papel acima de 120 caracteres: erro, um por campo", () => {
    expect(validarServico({ ...SERVICO_BASE, nome: "a".repeat(121) }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, conta: "a".repeat(121) }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, papel: "a".repeat(121) }).ok).toBe(false);
  });

  it("administrado_url sem https://: erro (mesma defesa contra SSRF de arquivo_url)", () => {
    expect(validarServico({ ...SERVICO_BASE, administrado_url: "http://vercel.com/" }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, administrado_url: "file:///etc/passwd" }).ok).toBe(false);
  });

  it("administrado_url acima de 500 caracteres: erro", () => {
    const urlGigante = "https://vercel.com/" + "a".repeat(500);
    expect(validarServico({ ...SERVICO_BASE, administrado_url: urlGigante }).ok).toBe(false);
  });

  it("administrado_url só espaço: tratado como ausente (vira null)", () => {
    const resultado = validarServico({ ...SERVICO_BASE, administrado_url: "   " });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.administrado_url).toBeNull();
  });

  it("nome, conta, papel ou administrado_url com cara de credencial: erro em cada campo isoladamente", () => {
    expect(validarServico({ ...SERVICO_BASE, nome: "sk-abcdefghijklmnop" }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, conta: "ghp_abcdefghijklmnopqrstuvwxyz01" }).ok).toBe(false);
    expect(validarServico({ ...SERVICO_BASE, papel: "AKIAABCDEFGHIJKLMNOP" }).ok).toBe(false);
    expect(
      validarServico({ ...SERVICO_BASE, administrado_url: "https://user:senha123@painel.exemplo.com/" }).ok,
    ).toBe(false);
  });

  it("corpo que não é objeto: erro", () => {
    expect(validarServico(null).ok).toBe(false);
    expect(validarServico("servico").ok).toBe(false);
  });
});

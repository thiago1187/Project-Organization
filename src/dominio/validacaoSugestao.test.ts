import { describe, expect, it } from "vitest";
import { validarSugestao } from "@/dominio/validacaoSugestao";

// docs/plano-testes.md § 2, nível 4, casos 44-48.

const CORPO_VALIDO = {
  projeto_id: "22222222-2222-2222-2222-222222222222",
  agente: "  revisor-seguranca  ",
  proposta: "  Adicionar suíte de testes.  ",
  motivo: "  Não há teste nenhum hoje.  ",
  esforco: "medio",
  risco: "  Pode revelar bug existente.  ",
  reversibilidade: "facil",
};

describe("validarSugestao", () => {
  it("caso 44 — corpo válido completo: ok:true com todos os campos aparados (trim)", () => {
    const resultado = validarSugestao(CORPO_VALIDO);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.agente).toBe("revisor-seguranca");
      expect(resultado.dados.proposta).toBe("Adicionar suíte de testes.");
      expect(resultado.dados.motivo).toBe("Não há teste nenhum hoje.");
      expect(resultado.dados.risco).toBe("Pode revelar bug existente.");
    }
  });

  it("caso 45 — esforco fora de pequeno/medio/grande: erro", () => {
    expect(validarSugestao({ ...CORPO_VALIDO, esforco: "enorme" }).ok).toBe(false);
  });

  it("caso 46 — reversibilidade fora de facil/dificil/nao_reverte: erro", () => {
    expect(validarSugestao({ ...CORPO_VALIDO, reversibilidade: "talvez" }).ok).toBe(false);
  });

  it("caso 47 — proposta/motivo/risco/agente acima do próprio teto: erro específico por campo", () => {
    const agente = validarSugestao({ ...CORPO_VALIDO, agente: "a".repeat(65) });
    expect(agente.ok).toBe(false);
    if (!agente.ok) expect(agente.erro).toMatch(/^agente /);

    const proposta = validarSugestao({ ...CORPO_VALIDO, proposta: "a".repeat(501) });
    expect(proposta.ok).toBe(false);
    if (!proposta.ok) expect(proposta.erro).toMatch(/^proposta /);

    const motivo = validarSugestao({ ...CORPO_VALIDO, motivo: "a".repeat(2001) });
    expect(motivo.ok).toBe(false);
    if (!motivo.ok) expect(motivo.erro).toMatch(/^motivo /);

    const risco = validarSugestao({ ...CORPO_VALIDO, risco: "a".repeat(1001) });
    expect(risco.ok).toBe(false);
    if (!risco.ok) expect(risco.erro).toMatch(/^risco /);
  });

  it("caso 48 — corpo com estado: 'aprovada' incluído: campo ignorado (não é lido)", () => {
    const resultado = validarSugestao({ ...CORPO_VALIDO, estado: "aprovada" });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados).not.toHaveProperty("estado");
  });
});

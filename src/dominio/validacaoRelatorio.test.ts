import { describe, expect, it } from "vitest";
import { validarRelatorio } from "@/dominio/validacaoRelatorio";

// docs/plano-testes.md § 2, nível 4, casos 31-43.

const CORPO_VALIDO = {
  projeto_id: "22222222-2222-2222-2222-222222222222",
  status: "ok",
  resumo: "Rodada tranquila, nada a reportar.",
};

describe("validarRelatorio", () => {
  it("caso 31 — corpo não é objeto (array, string, null): erro", () => {
    expect(validarRelatorio([]).ok).toBe(false);
    expect(validarRelatorio("string qualquer").ok).toBe(false);
    expect(validarRelatorio(null).ok).toBe(false);
  });

  it("caso 32 — projeto_id ausente ou vazio: erro", () => {
    expect(validarRelatorio({ ...CORPO_VALIDO, projeto_id: undefined }).ok).toBe(false);
    expect(validarRelatorio({ ...CORPO_VALIDO, projeto_id: "   " }).ok).toBe(false);
  });

  it("caso 33 — status fora de ok/atencao/falha: erro", () => {
    const resultado = validarRelatorio({ ...CORPO_VALIDO, status: "sucesso" });
    expect(resultado.ok).toBe(false);
  });

  it("caso 34 — resumo vazio (só espaço): erro", () => {
    expect(validarRelatorio({ ...CORPO_VALIDO, resumo: "   " }).ok).toBe(false);
  });

  it("caso 35 — resumo acima de 4000 caracteres: erro, sem truncar", () => {
    const resultado = validarRelatorio({ ...CORPO_VALIDO, resumo: "a".repeat(4001) });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatch(/4000/);
  });

  it("caso 36 — testes_passaram ausente: aceito, vira null", () => {
    const resultado = validarRelatorio(CORPO_VALIDO);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.testes_passaram).toBeNull();
  });

  it("caso 37 — testes_passaram com valor não booleano: erro", () => {
    expect(validarRelatorio({ ...CORPO_VALIDO, testes_passaram: "true" }).ok).toBe(false);
    expect(validarRelatorio({ ...CORPO_VALIDO, testes_passaram: 1 }).ok).toBe(false);
  });

  it("caso 38 — achados_por_agente ausente: aceito, vira []", () => {
    const resultado = validarRelatorio(CORPO_VALIDO);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.achados_por_agente).toEqual([]);
  });

  it("caso 39 — achados_por_agente não é array (é objeto): erro", () => {
    expect(validarRelatorio({ ...CORPO_VALIDO, achados_por_agente: { agente: "x" } }).ok).toBe(false);
  });

  it("caso 40 — achados_por_agente com mais de 20 itens: erro", () => {
    const item = { agente: "revisor-seguranca", achado: "achado", selo: "selo" };
    const resultado = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: Array.from({ length: 21 }, () => item),
    });
    expect(resultado.ok).toBe(false);
  });

  it("caso 41 — item sem agente, sem achado ou sem selo: erro apontando índice e campo", () => {
    const semAgente = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: [{ achado: "achado", selo: "selo" }],
    });
    expect(semAgente.ok).toBe(false);
    if (!semAgente.ok) expect(semAgente.erro).toMatch(/achados_por_agente\[0\]\.agente/);

    const semAchado = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: [{ agente: "revisor-seguranca", selo: "selo" }],
    });
    expect(semAchado.ok).toBe(false);
    if (!semAchado.ok) expect(semAchado.erro).toMatch(/achados_por_agente\[0\]\.achado/);

    const semSelo = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: [{ agente: "revisor-seguranca", achado: "achado" }],
    });
    expect(semSelo.ok).toBe(false);
    if (!semSelo.ok) expect(semSelo.erro).toMatch(/achados_por_agente\[0\]\.selo/);
  });

  it("caso 42 — item com campo acima do teto individual: erro", () => {
    const resultado = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: [{ agente: "a".repeat(65), achado: "achado", selo: "selo" }],
    });
    expect(resultado.ok).toBe(false);
  });

  it("caso 43 — item com campo extra não documentado: aceito, mas o campo extra é descartado", () => {
    const resultado = validarRelatorio({
      ...CORPO_VALIDO,
      achados_por_agente: [
        { agente: "revisor-seguranca", achado: "achado", selo: "selo", campo_extra: "não deveria sobreviver" },
      ],
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.achados_por_agente[0]).toEqual({
        agente: "revisor-seguranca",
        achado: "achado",
        selo: "selo",
      });
    }
  });
});

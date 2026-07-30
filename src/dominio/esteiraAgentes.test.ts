import { describe, expect, it } from "vitest";
import { montarEsteira } from "@/dominio/esteiraAgentes";
import type { ProjetoAgente } from "@/dominio/tipos";

// docs/plano-testes.md § 2, nível 7, casos 85-87.

function linhaFixture(overrides: Partial<ProjetoAgente> = {}): ProjetoAgente {
  return {
    id: "id-1",
    projeto_id: "proj-1",
    agente: "revisor-seguranca",
    habilitado: true,
    ordem: 1,
    instrucao: null,
    teto_sugestoes: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe("montarEsteira", () => {
  it("caso 85 — uma linha habilitada e uma desabilitada: a habilitada cai em ativos, a desabilitada em inativos", () => {
    const linhas = [
      linhaFixture({ agente: "revisor-seguranca", habilitado: true, ordem: 1 }),
      linhaFixture({ agente: "qa-testes", habilitado: false, ordem: 2 }),
    ];

    const esteira = montarEsteira(linhas);

    expect(esteira.ativos.map((a) => a.agente)).toEqual(["revisor-seguranca"]);
    expect(esteira.inativos.some((a) => a.agente === "qa-testes")).toBe(true);
    expect(esteira.ativos.some((a) => a.agente === "qa-testes")).toBe(false);
  });

  it("caso 86 — duas linhas habilitadas com a mesma ordem: desempate alfabético por agente", () => {
    const linhas = [
      linhaFixture({ agente: "revisor-seguranca", habilitado: true, ordem: 1 }),
      linhaFixture({ agente: "qa-testes", habilitado: true, ordem: 1 }),
    ];

    const esteira = montarEsteira(linhas);

    expect(esteira.ativos.map((a) => a.agente)).toEqual(["qa-testes", "revisor-seguranca"]);
  });

  it("caso 87 — agente do catálogo sem linha gravada aparece em inativos como entrada virtual, sem exigir registro no banco", () => {
    const linhas = [linhaFixture({ agente: "revisor-seguranca", habilitado: true })];

    const esteira = montarEsteira(linhas);
    const virtual = esteira.inativos.find((a) => a.agente === "designer-ui");

    expect(virtual).toBeDefined();
    expect(virtual?.instrucao).toBeNull();
    expect(virtual?.tetoSugestoes).toBeNull();
  });
});

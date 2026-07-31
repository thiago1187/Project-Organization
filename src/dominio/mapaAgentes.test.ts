import { describe, expect, it } from "vitest";
import { montarMapaAgentes } from "@/dominio/mapaAgentes";
import { montarEsteira } from "@/dominio/esteiraAgentes";
import type { ProjetoAgente, Relatorio } from "@/dominio/tipos";

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

function relatorioFixture(overrides: Partial<Relatorio> = {}): Relatorio {
  return {
    id: "rel-1",
    projeto_id: "proj-1",
    executado_em: "2026-07-29T03:12:00-03:00",
    status: "ok",
    resumo: "rodada limpa",
    testes_passaram: true,
    achados_por_agente: [],
    ...overrides,
  };
}

describe("montarMapaAgentes", () => {
  it("agente presente no relatório mais recente entra como 'rodou', com achado e selo tais como escritos", () => {
    const esteira = montarEsteira([
      linhaFixture({ agente: "qa-testes", ordem: 1 }),
      linhaFixture({ agente: "revisor-seguranca", ordem: 2 }),
    ]);
    const relatorio = relatorioFixture({
      achados_por_agente: [
        { agente: "qa-testes", achado: "86 testes, todos passando.", selo: "86 verdes" },
      ],
    });

    const mapa = montarMapaAgentes(esteira.ativos, relatorio);

    const qa = mapa.itens.find((i) => i.agente === "qa-testes");
    expect(qa?.estado).toBe("rodou");
    expect(qa?.achado).toBe("86 testes, todos passando.");
    expect(qa?.selo).toBe("86 verdes");
  });

  it("agente ausente do relatório mais recente entra como 'não rodou', sem achado nem selo inventado", () => {
    const esteira = montarEsteira([
      linhaFixture({ agente: "qa-testes", ordem: 1 }),
      linhaFixture({ agente: "revisor-seguranca", ordem: 2 }),
    ]);
    const relatorio = relatorioFixture({
      achados_por_agente: [{ agente: "qa-testes", achado: "ok", selo: "ok" }],
    });

    const mapa = montarMapaAgentes(esteira.ativos, relatorio);

    const revisor = mapa.itens.find((i) => i.agente === "revisor-seguranca");
    expect(revisor?.estado).toBe("nao_rodou");
    expect(revisor?.achado).toBeNull();
    expect(revisor?.selo).toBeNull();
  });

  it("sem relatório nenhum, todos os itens aparecem 'não rodou' e temRelatorio é false", () => {
    const esteira = montarEsteira([linhaFixture({ agente: "qa-testes", ordem: 1 })]);

    const mapa = montarMapaAgentes(esteira.ativos, null);

    expect(mapa.temRelatorio).toBe(false);
    expect(mapa.horaLabel).toBeNull();
    expect(mapa.itens.every((i) => i.estado === "nao_rodou")).toBe(true);
  });

  it("preserva a ordem de execução da esteira, não a ordem do relatório", () => {
    const esteira = montarEsteira([
      linhaFixture({ agente: "revisor-seguranca", ordem: 1 }),
      linhaFixture({ agente: "qa-testes", ordem: 2 }),
    ]);
    const relatorio = relatorioFixture({
      achados_por_agente: [
        { agente: "qa-testes", achado: "ok", selo: "ok" },
        { agente: "revisor-seguranca", achado: "ok", selo: "ok" },
      ],
    });

    const mapa = montarMapaAgentes(esteira.ativos, relatorio);

    expect(mapa.itens.map((i) => i.agente)).toEqual(["revisor-seguranca", "qa-testes"]);
  });

  it("horaLabel reflete a hora gravada do relatório mais recente", () => {
    const esteira = montarEsteira([linhaFixture({ agente: "qa-testes", ordem: 1 })]);
    const relatorio = relatorioFixture({ executado_em: "2026-07-29T03:12:00-03:00" });

    const mapa = montarMapaAgentes(esteira.ativos, relatorio);

    expect(mapa.horaLabel).toBe("03:12");
  });
});

import { describe, expect, it } from "vitest";
import { mapaAgentesPadrao, resolverConfiguracaoAgente } from "@/dominio/agentePadrao";
import type { AgentePadrao } from "@/dominio/tipos";

function padraoFixture(overrides: Partial<AgentePadrao> = {}): AgentePadrao {
  return {
    agente: "revisor-seguranca",
    instrucao: "olhe especialmente autenticação",
    teto_sugestoes: 2,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolverConfiguracaoAgente", () => {
  it("override do projeto vence o padrão inteiro — nunca concatena os dois", () => {
    const resultado = resolverConfiguracaoAgente(
      "instrução específica deste projeto",
      1,
      padraoFixture(),
    );

    expect(resultado.instrucao).toBe("instrução específica deste projeto");
    expect(resultado.origemInstrucao).toBe("projeto");
    expect(resultado.tetoSugestoes).toBe(1);
    expect(resultado.origemTeto).toBe("projeto");
    // Nunca contém o texto do padrão junto — sobrescreve, não soma.
    expect(resultado.instrucao?.includes("autenticação")).toBe(false);
  });

  it("projeto vazio cai no padrão global quando ele existe", () => {
    const resultado = resolverConfiguracaoAgente(null, null, padraoFixture());

    expect(resultado.instrucao).toBe("olhe especialmente autenticação");
    expect(resultado.origemInstrucao).toBe("padrao");
    expect(resultado.tetoSugestoes).toBe(2);
    expect(resultado.origemTeto).toBe("padrao");
  });

  it("nem projeto nem padrão configurados: nenhuma, tudo null", () => {
    const resultado = resolverConfiguracaoAgente(undefined, undefined, null);

    expect(resultado.instrucao).toBeNull();
    expect(resultado.origemInstrucao).toBe("nenhuma");
    expect(resultado.tetoSugestoes).toBeNull();
    expect(resultado.origemTeto).toBe("nenhuma");
  });

  it("teto 0 do projeto é um override válido — não vira null como se não tivesse vindo (0 não é falsy no ??)", () => {
    const resultado = resolverConfiguracaoAgente(null, 0, padraoFixture({ teto_sugestoes: 3 }));

    expect(resultado.tetoSugestoes).toBe(0);
    expect(resultado.origemTeto).toBe("projeto");
  });

  it("teto 0 do padrão também vale quando o projeto não tem override", () => {
    const resultado = resolverConfiguracaoAgente(null, null, padraoFixture({ teto_sugestoes: 0 }));

    expect(resultado.tetoSugestoes).toBe(0);
    expect(resultado.origemTeto).toBe("padrao");
  });

  it("instrução e teto podem vir de origens diferentes — cada campo resolve sozinho", () => {
    // Projeto só sobrescreveu a instrução; o teto continua herdando do padrão.
    const resultado = resolverConfiguracaoAgente("instrução do projeto", null, padraoFixture());

    expect(resultado.origemInstrucao).toBe("projeto");
    expect(resultado.origemTeto).toBe("padrao");
    expect(resultado.tetoSugestoes).toBe(2);
  });
});

describe("mapaAgentesPadrao", () => {
  it("indexa pelo nome do agente", () => {
    const mapa = mapaAgentesPadrao([padraoFixture({ agente: "qa-testes" }), padraoFixture({ agente: "revisor-codigo" })]);

    expect(mapa.get("qa-testes")?.agente).toBe("qa-testes");
    expect(mapa.get("designer-ui")).toBeUndefined();
  });
});

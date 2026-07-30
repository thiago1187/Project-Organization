import { describe, expect, it } from "vitest";
import { sugerirAgentes } from "@/dominio/sugestorAgentes";
import type { ProjetoAgente, Relatorio, Servico, Sugestao } from "@/dominio/tipos";

function agenteFixture(overrides: Partial<ProjetoAgente> = {}): ProjetoAgente {
  return {
    id: "id-1",
    projeto_id: "proj-1",
    agente: "revisor-seguranca",
    habilitado: true,
    ordem: 0,
    instrucao: null,
    teto_sugestoes: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  };
}

function servicoFixture(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "svc-1",
    projeto_id: "proj-1",
    categoria: "banco",
    nome: "Neon",
    conta: "pessoal",
    papel: null,
    administrado_url: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  };
}

function relatorioFixture(overrides: Partial<Relatorio> = {}): Relatorio {
  return {
    id: "rel-1",
    projeto_id: "proj-1",
    executado_em: new Date().toISOString(),
    status: "ok",
    resumo: "tudo bem",
    testes_passaram: true,
    achados_por_agente: [],
    ...overrides,
  };
}

function sugestaoFixture(overrides: Partial<Sugestao> = {}): Sugestao {
  return {
    id: "sug-1",
    projeto_id: "proj-1",
    agente: "qa-testes",
    proposta: "fazer x",
    motivo: "porque y",
    esforco: "pequeno",
    risco: "baixo",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: new Date().toISOString(),
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
    ...overrides,
  };
}

describe("sugerirAgentes", () => {
  it("inventário vazio e nenhum histórico: não sugere nada", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [],
      relatorios: [],
      sugestoes: [],
    });
    expect(resultado).toEqual([]);
  });

  it("nunca sugere agente que já tem linha em projeto_agente, mesmo desligado", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [agenteFixture({ agente: "revisor-performance", habilitado: false })],
      stack: [],
      servico: [servicoFixture({ categoria: "banco", nome: "Neon" })],
      relatorios: [],
      sugestoes: [],
    });
    expect(resultado.some((s) => s.agente === "revisor-performance")).toBe(false);
  });

  it("serviço categoria banco sugere revisor-performance (esteira) e engenheiro-dados (prompt)", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [servicoFixture({ categoria: "banco", nome: "Neon" })],
      relatorios: [],
      sugestoes: [],
    });

    const performance = resultado.find((s) => s.agente === "revisor-performance");
    const dados = resultado.find((s) => s.agente === "engenheiro-dados");

    expect(performance?.destino).toBe("esteira");
    expect(dados?.destino).toBe("prompt");
    expect(performance?.porque).toContain("Neon");
  });

  it("serviço categoria modelo sugere avaliador-ia (esteira) e engenheiro-ia (prompt)", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [servicoFixture({ categoria: "modelo", nome: "OpenAI" })],
      relatorios: [],
      sugestoes: [],
    });

    expect(resultado.find((s) => s.agente === "avaliador-ia")?.destino).toBe("esteira");
    expect(resultado.find((s) => s.agente === "engenheiro-ia")?.destino).toBe("prompt");
  });

  it("serviço categoria storage ou email não sugere nada — sem agente mapeado", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [servicoFixture({ categoria: "storage", nome: "S3" }), servicoFixture({ categoria: "email", nome: "Resend" })],
      relatorios: [],
      sugestoes: [],
    });
    expect(resultado).toEqual([]);
  });

  it("agente sem linha que já aparece em achados_por_agente é sugerido por histórico, com destino correto", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [],
      relatorios: [
        relatorioFixture({ achados_por_agente: [{ agente: "qa-testes", achado: "142 testes", selo: "142 verdes" }] }),
      ],
      sugestoes: [],
    });

    const sugerido = resultado.find((s) => s.agente === "qa-testes");
    expect(sugerido).toBeDefined();
    expect(sugerido?.destino).toBe("esteira");
    expect(sugerido?.porque).toContain("achado");
  });

  it("agente sem linha com sugestão aprovada aqui é sugerido por histórico", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [],
      relatorios: [],
      sugestoes: [sugestaoFixture({ agente: "revisor-codigo", estado: "aprovada" })],
    });

    const sugerido = resultado.find((s) => s.agente === "revisor-codigo");
    expect(sugerido).toBeDefined();
    expect(sugerido?.porque).toContain("sugestão aprovada");
  });

  it("sugestão pendente ou recusada não conta como histórico (só aprovada/feita)", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [],
      relatorios: [],
      sugestoes: [
        sugestaoFixture({ agente: "revisor-codigo", estado: "pendente" }),
        sugestaoFixture({ agente: "investigador-bugs", estado: "recusada" }),
      ],
    });
    expect(resultado).toEqual([]);
  });

  it("histórico e inventário concordando no mesmo agente: não duplica, mantém o motivo do histórico", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [servicoFixture({ categoria: "banco", nome: "Neon" })],
      relatorios: [
        relatorioFixture({
          achados_por_agente: [{ agente: "revisor-performance", achado: "consulta lenta", selo: "1 achado" }],
        }),
      ],
      sugestoes: [],
    });

    const ocorrencias = resultado.filter((s) => s.agente === "revisor-performance");
    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0].porque).toContain("achado");
  });

  it("resultado ordenado alfabeticamente por agente", () => {
    const resultado = sugerirAgentes({
      agentesProjeto: [],
      stack: [],
      servico: [servicoFixture({ categoria: "banco", nome: "Neon" }), servicoFixture({ categoria: "modelo", nome: "OpenAI" })],
      relatorios: [],
      sugestoes: [],
    });
    const nomes = resultado.map((s) => s.agente);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b)));
  });
});

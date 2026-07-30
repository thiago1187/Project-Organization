import { describe, expect, it } from "vitest";
import {
  calcularDesde,
  gerarDocumentoAndamento,
  type DadosDocumentoAndamento,
} from "@/dominio/documentoAndamento";
import type { Relatorio, Sugestao, Tarefa } from "@/dominio/tipos";

// docs/proximos-passos.md item 4 — documento de andamento, duas vozes sobre
// os mesmos dados. Cobre: cálculo de período, filtro por corte de data
// (histórico) x estado atual (pendente/aprovada/em aberto), ausência de
// dado ("não invente"), e redação de credencial nas duas vozes.

const CREDENCIAL_DE_TESTE = "postgres://user:senha123@host/db";

function relatorioFixture(overrides: Partial<Relatorio> = {}): Relatorio {
  return {
    id: "rel-1",
    projeto_id: "proj-1",
    executado_em: "2026-07-15T03:00:00.000Z",
    status: "ok",
    resumo: "tudo passou",
    testes_passaram: true,
    achados_por_agente: [],
    ...overrides,
  };
}

function sugestaoFixture(overrides: Partial<Sugestao> = {}): Sugestao {
  return {
    id: "sug-1",
    projeto_id: "proj-1",
    agente: "revisor-seguranca",
    proposta: "proposta qualquer",
    motivo: "motivo qualquer",
    esforco: "medio",
    risco: "risco qualquer",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: "2026-07-15T03:00:00.000Z",
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
    ...overrides,
  };
}

function tarefaFixture(overrides: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t-1",
    projeto_id: "proj-1",
    titulo: "título qualquer",
    estado: "aberta",
    ordem: 0,
    criado_em: "2026-07-15T03:00:00.000Z",
    atualizado_em: "2026-07-15T03:00:00.000Z",
    concluida_em: null,
    ...overrides,
  };
}

const BASE: DadosDocumentoAndamento = {
  projetoNome: "Projeto de teste",
  descricao: null,
  periodo: "tudo",
  desde: null,
  geradoEmLabel: "30 jul 2026, 09:00",
  relatorios: [],
  sugestoes: [],
  tarefas: [],
};

describe("calcularDesde", () => {
  const agora = new Date("2026-07-30T12:00:00.000Z");

  it("'tudo' não tem corte", () => {
    expect(calcularDesde("tudo", agora, null)).toBeNull();
  });

  it("'7dias' corta 7 dias antes de agora", () => {
    expect(calcularDesde("7dias", agora, null)).toBe("2026-07-23T12:00:00.000Z");
  });

  it("'30dias' corta 30 dias antes de agora", () => {
    expect(calcularDesde("30dias", agora, null)).toBe("2026-06-30T12:00:00.000Z");
  });

  it("'desde_ultima' usa a data informada", () => {
    expect(calcularDesde("desde_ultima", agora, "2026-07-20T00:00:00.000Z")).toBe("2026-07-20T00:00:00.000Z");
  });

  it("'desde_ultima' sem geração anterior conhecida: sem corte (mostra tudo, não inventa data)", () => {
    expect(calcularDesde("desde_ultima", agora, null)).toBeNull();
  });
});

describe("gerarDocumentoAndamento — sem dado nenhum: não inventa movimento", () => {
  it("período sem rodada, sugestão ou tarefa: as duas vozes dizem isso explicitamente", () => {
    const doc = gerarDocumentoAndamento(BASE);
    expect(doc.tecnico).toContain("Nenhuma rodada de diagnóstico neste período.");
    expect(doc.andamento).toContain("Não houve revisão automática do projeto neste período.");
    expect(doc.andamento).toContain("Nada foi concluído neste período.");
  });
});

describe("gerarDocumentoAndamento — corte de período (histórico) x estado atual", () => {
  const relatorioFora = relatorioFixture({ id: "rel-fora", executado_em: "2026-01-01T03:00:00.000Z" });
  const relatorioDentro = relatorioFixture({ id: "rel-dentro", executado_em: "2026-07-25T03:00:00.000Z" });
  const desde = "2026-07-20T00:00:00.000Z";

  it("relatório fora do período não entra na seção de rodadas", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      periodo: "7dias",
      desde,
      relatorios: [relatorioFora, relatorioDentro],
    });
    expect(doc.tecnico).toContain("2026-07-25".slice(0, 4)); // sanity: contém o ano
    expect(doc.tecnico).not.toMatch(/1 jan 2026/);
    expect(doc.tecnico).toMatch(/25 jul 2026/);
  });

  it("sugestão pendente antiga aparece mesmo fora do período — decisão pendente é estado atual", () => {
    const pendenteAntiga = sugestaoFixture({ id: "s-antiga", criada_em: "2026-01-01T00:00:00.000Z" });
    const doc = gerarDocumentoAndamento({ ...BASE, periodo: "7dias", desde, sugestoes: [pendenteAntiga] });
    expect(doc.tecnico).toContain("proposta qualquer");
    expect(doc.andamento).toContain("proposta qualquer");
  });

  it("sugestão feita fora do período não aparece em 'feitas neste período'", () => {
    const feitaAntiga = sugestaoFixture({
      id: "s-feita-antiga",
      estado: "feita",
      criada_em: "2026-01-01T00:00:00.000Z",
      feita_em: "2026-01-02T00:00:00.000Z",
      proposta: "feita há muito tempo",
    });
    const doc = gerarDocumentoAndamento({ ...BASE, periodo: "7dias", desde, sugestoes: [feitaAntiga] });
    expect(doc.tecnico).not.toContain("feita há muito tempo");
    expect(doc.andamento).not.toContain("feita há muito tempo");
  });

  it("sugestão feita dentro do período aparece em 'o que avançou' (andamento) e 'feitas' (técnico)", () => {
    const feitaRecente = sugestaoFixture({
      id: "s-feita-recente",
      estado: "feita",
      criada_em: "2026-07-21T00:00:00.000Z",
      feita_em: "2026-07-22T00:00:00.000Z",
      proposta: "corrigido o login",
      pr_url: "https://github.com/dono/repo/pull/9",
    });
    const doc = gerarDocumentoAndamento({ ...BASE, periodo: "7dias", desde, sugestoes: [feitaRecente] });
    expect(doc.tecnico).toContain("corrigido o login");
    expect(doc.tecnico).toContain("https://github.com/dono/repo/pull/9");
    expect(doc.andamento).toContain("corrigido o login");
    expect(doc.andamento).not.toContain("PR"); // zero jargão
    expect(doc.andamento).not.toContain("pull/9");
  });

  it("tarefa em aberto aparece sempre, independente do período", () => {
    const aberta = tarefaFixture({ id: "t-aberta", criado_em: "2026-01-01T00:00:00.000Z", titulo: "tarefa antiga em aberto" });
    const doc = gerarDocumentoAndamento({ ...BASE, periodo: "7dias", desde, tarefas: [aberta] });
    expect(doc.tecnico).toContain("tarefa antiga em aberto");
  });
});

describe("gerarDocumentoAndamento — voz de andamento não usa jargão técnico", () => {
  it("não menciona nome de agente nem 'esforço'/'reversibilidade' no corpo", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      sugestoes: [
        sugestaoFixture({ estado: "pendente", proposta: "revisar permissões", agente: "revisor-seguranca" }),
      ],
    });
    expect(doc.andamento).not.toContain("revisor-seguranca");
    expect(doc.andamento).not.toMatch(/esforço/i);
    expect(doc.andamento).not.toMatch(/reversibilidade/i);
  });

  it("sugestão pendente com reversibilidade 'nao_reverte' vira ponto de atenção em prosa, não rótulo técnico", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      sugestoes: [sugestaoFixture({ estado: "pendente", reversibilidade: "nao_reverte", proposta: "apagar tabela antiga" })],
    });
    expect(doc.andamento).toContain("apagar tabela antiga");
    expect(doc.andamento).toMatch(/não pode ser desfeita/);
    expect(doc.andamento).not.toContain("nao_reverte");
  });
});

describe("gerarDocumentoAndamento — redação de credencial nas duas vozes", () => {
  it("relatorio.resumo com cara de credencial: omitido nas duas vozes", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      relatorios: [relatorioFixture({ resumo: `credencial vazada: ${CREDENCIAL_DE_TESTE}` })],
    });
    expect(doc.tecnico).not.toContain(CREDENCIAL_DE_TESTE);
    expect(doc.tecnico).toMatch(/omitido/);
  });

  it("achado_por_agente.achado com cara de credencial: omitido (voz técnica)", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      relatorios: [
        relatorioFixture({
          achados_por_agente: [{ agente: "revisor-seguranca", achado: `achou: ${CREDENCIAL_DE_TESTE}`, selo: "1 achado" }],
        }),
      ],
    });
    expect(doc.tecnico).not.toContain(CREDENCIAL_DE_TESTE);
  });

  it("sugestao.proposta com cara de credencial: omitida nas duas vozes", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      sugestoes: [sugestaoFixture({ estado: "pendente", proposta: CREDENCIAL_DE_TESTE })],
    });
    expect(doc.tecnico).not.toContain(CREDENCIAL_DE_TESTE);
    expect(doc.andamento).not.toContain(CREDENCIAL_DE_TESTE);
  });

  it("tarefa.titulo com cara de credencial: omitido (voz técnica)", () => {
    const doc = gerarDocumentoAndamento({
      ...BASE,
      tarefas: [tarefaFixture({ titulo: `trocar por ${CREDENCIAL_DE_TESTE}` })],
    });
    expect(doc.tecnico).not.toContain(CREDENCIAL_DE_TESTE);
  });

  it("descricao do projeto com cara de credencial: omitida (voz técnica)", () => {
    const doc = gerarDocumentoAndamento({ ...BASE, descricao: `use isto: ${CREDENCIAL_DE_TESTE}` });
    expect(doc.tecnico).not.toContain(CREDENCIAL_DE_TESTE);
  });
});

describe("gerarDocumentoAndamento — cabeçalho", () => {
  it("as duas vozes citam o nome do projeto e o rótulo do período", () => {
    const doc = gerarDocumentoAndamento({ ...BASE, projetoNome: "Painel de Controle", periodo: "30dias" });
    expect(doc.tecnico).toContain("Painel de Controle");
    expect(doc.tecnico).toContain("últimos 30 dias");
    expect(doc.andamento).toContain("Painel de Controle");
    expect(doc.andamento).toContain("últimos 30 dias");
  });
});

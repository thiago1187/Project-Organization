import { describe, expect, it } from "vitest";
import { fichaDetalheDoAgente, fichaDoAgente, montarListaAgentes } from "@/dominio/agentes";
import type { Projeto, ProjetoAgente, Relatorio, Sugestao } from "@/dominio/tipos";

function projetoFixture(overrides: Partial<Projeto> = {}): Projeto {
  return {
    id: "proj-1",
    nome: "Painel",
    repositorio: "dono/painel",
    frequencia: "toda_madrugada",
    ativo: true,
    criado_em: new Date().toISOString(),
    descricao: null,
    ...overrides,
  };
}

function relatorioFixture(overrides: Partial<Relatorio> = {}): Relatorio {
  return {
    id: "rel-1",
    projeto_id: "proj-1",
    executado_em: "2026-07-20T03:00:00-03:00",
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
    agente: "revisor-seguranca",
    proposta: "fazer x",
    motivo: "porque y",
    esforco: "pequeno",
    risco: "baixo",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: "2026-07-20T03:00:00-03:00",
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
    ...overrides,
  };
}

function projetoAgenteFixture(overrides: Partial<ProjetoAgente> = {}): ProjetoAgente {
  return {
    id: "pa-1",
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

describe("reputação (taxa de aprovação)", () => {
  it("é null quando o agente nunca teve sugestão decidida — não há taxa sobre zero decisão", () => {
    const ficha = fichaDoAgente("revisor-seguranca", [], [], [sugestaoFixture({ estado: "pendente" })], []);
    expect(ficha.reputacao.decididas).toBe(0);
    expect(ficha.reputacao.taxaPct).toBeNull();
  });

  it("é null quando o agente nunca propôs nada", () => {
    const ficha = fichaDoAgente("revisor-seguranca", [], [], [], []);
    expect(ficha.reputacao.aprovadas).toBe(0);
    expect(ficha.reputacao.decididas).toBe(0);
    expect(ficha.reputacao.taxaPct).toBeNull();
  });

  it("conta 'feita' como aprovada — só se chega lá depois de aprovada", () => {
    const sugestoes = [
      sugestaoFixture({ id: "s1", estado: "feita" }),
      sugestaoFixture({ id: "s2", estado: "recusada" }),
    ];
    const ficha = fichaDoAgente("revisor-seguranca", [], [], sugestoes, []);
    expect(ficha.reputacao.aprovadas).toBe(1);
    expect(ficha.reputacao.decididas).toBe(2);
    expect(ficha.reputacao.taxaPct).toBe(50);
  });

  it("ignora pendente na contagem de decididas", () => {
    const sugestoes = [
      sugestaoFixture({ id: "s1", estado: "aprovada" }),
      sugestaoFixture({ id: "s2", estado: "pendente" }),
      sugestaoFixture({ id: "s3", estado: "pendente" }),
    ];
    const ficha = fichaDoAgente("revisor-seguranca", [], [], sugestoes, []);
    expect(ficha.reputacao.decididas).toBe(1);
    expect(ficha.reputacao.taxaPct).toBe(100);
  });

  it("taxa sobre poucas decisões continua exposta junto da contagem — quem lê decide o peso", () => {
    const sugestoes = [sugestaoFixture({ id: "s1", estado: "aprovada" })];
    const ficha = fichaDoAgente("revisor-seguranca", [], [], sugestoes, []);
    expect(ficha.reputacao).toEqual({ aprovadas: 1, decididas: 1, taxaPct: 100 });
  });
});

describe("honestidade do histórico", () => {
  it("agente sem relatório e sem sugestão mostra zero real, não histórico inventado", () => {
    const ficha = fichaDoAgente("qa-testes", [], [], [], []);
    expect(ficha.totalAchados).toBe(0);
    expect(ficha.totalSugestoes).toBe(0);
    expect(ficha.ultimaAtividadeLabel).toBeNull();
    expect(ficha.ultimaAtividadeIso).toBeNull();
    expect(ficha.projetosAtivos).toEqual([]);
  });

  it("última atividade pega a mais recente entre achado e sugestão", () => {
    const relatorios = [
      relatorioFixture({
        executado_em: "2026-07-10T03:00:00-03:00",
        achados_por_agente: [{ agente: "qa-testes", achado: "achou bug", selo: "1 bug" }],
      }),
    ];
    const sugestoes = [sugestaoFixture({ agente: "qa-testes", criada_em: "2026-07-25T03:00:00-03:00" })];
    const ficha = fichaDoAgente("qa-testes", [], relatorios, sugestoes, []);
    expect(ficha.ultimaAtividadeIso).toBe("2026-07-25T03:00:00-03:00");
  });
});

describe("projetos ativos", () => {
  it("só entra o que está habilitado agora, não o que já foi desligado", () => {
    const projetos = [projetoFixture({ id: "p1", nome: "Painel" }), projetoFixture({ id: "p2", nome: "Outro" })];
    const agentesProjeto = [
      projetoAgenteFixture({ projeto_id: "p1", agente: "qa-testes", habilitado: true }),
      projetoAgenteFixture({ projeto_id: "p2", agente: "qa-testes", habilitado: false }),
    ];
    const ficha = fichaDoAgente("qa-testes", projetos, [], [], agentesProjeto);
    expect(ficha.projetosAtivos).toEqual([{ id: "p1", nome: "Painel" }]);
  });
});

describe("montarListaAgentes", () => {
  it("divide leitura e escrita conforme papeis.ts, e inclui agente conhecido sem nenhum histórico", () => {
    const lista = montarListaAgentes([], [], [], []);
    const nomesLeitura = lista.leitura.map((f) => f.agente);
    const nomesEscrita = lista.escrita.map((f) => f.agente);
    expect(nomesLeitura).toContain("qa-testes");
    expect(nomesEscrita).toContain("dev-backend");
    expect(nomesLeitura).not.toContain("dev-backend");
    // nenhuma sobreposição
    expect(nomesLeitura.filter((n) => nomesEscrita.includes(n))).toEqual([]);
  });

  it("inclui um nome livre encontrado só nos dados, não travado à lista de PAPEIS", () => {
    const relatorios = [
      relatorioFixture({ achados_por_agente: [{ agente: "agente-novo", achado: "achou algo", selo: "1" }] }),
    ];
    const lista = montarListaAgentes([], relatorios, [], []);
    const todos = [...lista.leitura, ...lista.escrita].map((f) => f.agente);
    expect(todos).toContain("agente-novo");
  });

  it("ordena por atividade recente primeiro, sem atividade por último em ordem alfabética", () => {
    const relatorios = [
      relatorioFixture({
        executado_em: "2026-07-01T03:00:00-03:00",
        achados_por_agente: [{ agente: "qa-testes", achado: "a", selo: "1" }],
      }),
      relatorioFixture({
        executado_em: "2026-07-20T03:00:00-03:00",
        achados_por_agente: [{ agente: "investigador-bugs", achado: "a", selo: "1" }],
      }),
    ];
    const lista = montarListaAgentes([], relatorios, [], []);
    const indiceInvestigador = lista.leitura.findIndex((f) => f.agente === "investigador-bugs");
    const indiceQa = lista.leitura.findIndex((f) => f.agente === "qa-testes");
    const indiceArquiteto = lista.leitura.findIndex((f) => f.agente === "arquiteto-chefe"); // sem atividade
    expect(indiceInvestigador).toBeLessThan(indiceQa);
    expect(indiceQa).toBeLessThan(indiceArquiteto);
  });
});

describe("fichaDetalheDoAgente", () => {
  it("devolve null para um nome que não aparece em PAPEIS nem em nenhum dado", () => {
    expect(fichaDetalheDoAgente("nao-existe", [], [], [], [])).toBeNull();
  });

  it("devolve ficha vazia e honesta para agente conhecido sem histórico", () => {
    const ficha = fichaDetalheDoAgente("qa-testes", [], [], [], []);
    expect(ficha).not.toBeNull();
    expect(ficha?.historicoAchados).toEqual([]);
    expect(ficha?.historicoSugestoes).toEqual([]);
    expect(ficha?.projetosLigados).toEqual([]);
  });

  it("monta histórico de achados e sugestões mais recente primeiro, com nome do projeto", () => {
    const projetos = [projetoFixture({ id: "p1", nome: "Painel" })];
    const relatorios = [
      relatorioFixture({
        id: "r1",
        projeto_id: "p1",
        executado_em: "2026-07-01T03:00:00-03:00",
        achados_por_agente: [{ agente: "qa-testes", achado: "achou X", selo: "1 falha" }],
      }),
      relatorioFixture({
        id: "r2",
        projeto_id: "p1",
        executado_em: "2026-07-15T03:00:00-03:00",
        achados_por_agente: [{ agente: "qa-testes", achado: "achou Y", selo: "0 falhas" }],
      }),
    ];
    const sugestoes = [
      sugestaoFixture({ id: "s1", projeto_id: "p1", agente: "qa-testes", estado: "aprovada", criada_em: "2026-07-16T03:00:00-03:00" }),
    ];
    const ficha = fichaDetalheDoAgente("qa-testes", projetos, relatorios, sugestoes, []);
    expect(ficha?.historicoAchados.map((a) => a.achado)).toEqual(["achou Y", "achou X"]);
    expect(ficha?.historicoAchados[0].projetoNome).toBe("Painel");
    expect(ficha?.historicoSugestoes[0].estadoLabel).toBe("aprovada");
  });

  it("mostra a instrução do projeto quando ligado, e rótulo honesto quando o projeto sumiu", () => {
    const agentesProjeto = [
      projetoAgenteFixture({ projeto_id: "p-fantasma", agente: "qa-testes", habilitado: true, instrucao: "olhe x" }),
    ];
    const ficha = fichaDetalheDoAgente("qa-testes", [], [], [], agentesProjeto);
    expect(ficha?.projetosLigados).toEqual([{ id: "p-fantasma", nome: "projeto removido", instrucao: "olhe x" }]);
  });
});

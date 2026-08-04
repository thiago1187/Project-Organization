import { describe, expect, it } from "vitest";
import {
  chipDoAgente,
  formatarDataCurta,
  formatarHora,
  detalheProjeto,
  hojeNoFusoDoDono,
  ondeEstamos,
  type SugestaoVM,
} from "@/dominio/visao";
import type { Projeto, Relatorio, Sugestao, Tarefa } from "@/dominio/tipos";

function projetoFixture(overrides: Partial<Projeto> = {}): Projeto {
  return {
    id: "proj-1",
    nome: "Projeto",
    repositorio: "dono/repo",
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
    executado_em: "2026-07-29T03:12:00-03:00",
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
    criada_em: new Date().toISOString(),
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
    titulo: "Fazer algo",
    estado: "aberta",
    ordem: 0,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    concluida_em: null,
    ...overrides,
  };
}

function sugestaoVMFixture(overrides: Partial<SugestaoVM> = {}): SugestaoVM {
  return {
    id: "sug-vm-1",
    chip: chipDoAgente("revisor-seguranca"),
    proposta: "proposta aprovada",
    motivo: "motivo",
    risco: "risco",
    esforcoLabel: "esforço pequeno",
    reversibilidadeLabel: "reverte fácil",
    reversibilidadeCor: "var(--ok)",
    naoReverte: false,
    estado: "aprovada",
    estadoLabel: "aprovada",
    estadoCor: "var(--ok)",
    criadaEmLabel: "29 jul",
    decisaoLabel: null,
    prUrl: null,
    ...overrides,
  };
}

describe("detalheProjeto — descricao e tira", () => {
  it("descricao nula: ProjetoDetalheVM.descricao é null (sem inventar texto)", () => {
    const detalhe = detalheProjeto("proj-1", [projetoFixture({ descricao: null })], [], [], []);
    expect(detalhe?.descricao).toBeNull();
  });

  it("descricao presente: passa direto para o VM", () => {
    const detalhe = detalheProjeto("proj-1", [projetoFixture({ descricao: "Um painel pessoal." })], [], [], []);
    expect(detalhe?.descricao).toBe("Um painel pessoal.");
  });

  it("tira sem nenhuma rodada: diz 'nenhuma rodada ainda' e 'nada esperando você'", () => {
    const detalhe = detalheProjeto("proj-1", [projetoFixture()], [], [], []);
    expect(detalhe?.tira.texto).toContain("nenhuma rodada ainda");
    expect(detalhe?.tira.texto).toContain("nada esperando você");
  });

  it("tira com pendentes: conta sugestões pendentes e usa a cor de atenção", () => {
    const detalhe = detalheProjeto(
      "proj-1",
      [projetoFixture()],
      [relatorioFixture()],
      [sugestaoFixture({ estado: "pendente" }), sugestaoFixture({ id: "sug-2", estado: "pendente" })],
      [],
    );
    expect(detalhe?.tira.texto).toContain("2 sugestões esperando você");
    expect(detalhe?.tira.cor).toBe("var(--atn)");
  });

  it("tira com testes falhando: cor de falha mesmo sem pendentes", () => {
    const detalhe = detalheProjeto(
      "proj-1",
      [projetoFixture()],
      [relatorioFixture({ testes_passaram: false })],
      [],
      [],
    );
    expect(detalhe?.tira.texto).toContain("testes com falha");
    expect(detalhe?.tira.cor).toBe("var(--fal)");
  });
});

describe("ondeEstamos", () => {
  it("nenhuma tarefa, nenhuma sugestão aprovada: fazendoAgora null, itens vazio", () => {
    const resultado = ondeEstamos([], []);
    expect(resultado.fazendoAgora).toBeNull();
    expect(resultado.itens).toEqual([]);
  });

  it("tarefa em 'fazendo' vira o título do bloco e não entra na lista de itens", () => {
    const tarefas = [tarefaFixture({ id: "t-fazendo", titulo: "Migrar autenticação", estado: "fazendo" })];
    const resultado = ondeEstamos(tarefas, []);
    expect(resultado.fazendoAgora).toEqual({ id: "t-fazendo", titulo: "Migrar autenticação" });
    expect(resultado.itens.some((i) => i.id === "t-fazendo")).toBe(false);
  });

  it("tarefa 'feita' não aparece em itens nem em fazendoAgora", () => {
    const tarefas = [tarefaFixture({ id: "t-feita", estado: "feita", concluida_em: new Date().toISOString() })];
    const resultado = ondeEstamos(tarefas, []);
    expect(resultado.itens).toEqual([]);
    expect(resultado.fazendoAgora).toBeNull();
  });

  it("tarefas abertas e sugestões aprovadas se misturam num bloco só, com selo de origem", () => {
    const tarefas = [tarefaFixture({ id: "t-aberta", titulo: "Tarefa do dono" })];
    const aprovadas = [sugestaoVMFixture({ id: "sug-aprovada", proposta: "Sugestão aprovada" })];
    const resultado = ondeEstamos(tarefas, aprovadas);

    expect(resultado.itens).toHaveLength(2);
    expect(resultado.itens.find((i) => i.id === "t-aberta")?.origem).toBe("tarefa");
    expect(resultado.itens.find((i) => i.id === "sug-aprovada")?.origem).toBe("sugestao");
  });

  it("itens numerados sequencialmente, tarefas antes das sugestões", () => {
    const tarefas = [tarefaFixture({ id: "t-1" })];
    const aprovadas = [sugestaoVMFixture({ id: "sug-1" })];
    const resultado = ondeEstamos(tarefas, aprovadas);

    expect(resultado.itens.map((i) => i.num)).toEqual(["01", "02"]);
    expect(resultado.itens[0].origem).toBe("tarefa");
    expect(resultado.itens[1].origem).toBe("sugestao");
  });
});

describe("hojeNoFusoDoDono", () => {
  // "Hoje" ficou escrito à mão como { dia: 29, mes: 7 } na conversão do export
  // e nunca foi trocado. O efeito era silencioso e permanente: rodada de 29 de
  // julho aparecia como se fosse de hoje, para sempre, e toda outra aparecia
  // com a data colada na hora. Ninguém percebe porque a tela continua bonita.

  it("resolve no fuso do dono, não no do processo", () => {
    // 30/07 às 02:00 UTC ainda é 29/07 em São Paulo (-03:00). É o caso que
    // pega o erro de usar getDate() direto: a Vercel roda em UTC.
    expect(hojeNoFusoDoDono(new Date("2026-07-30T02:00:00Z"))).toEqual({ dia: 29, mes: 7 });
  });

  it("vira o dia no horário certo", () => {
    expect(hojeNoFusoDoDono(new Date("2026-07-30T03:00:00Z"))).toEqual({ dia: 30, mes: 7 });
  });

  it("atravessa a virada de mês", () => {
    expect(hojeNoFusoDoDono(new Date("2026-08-01T05:00:00Z"))).toEqual({ dia: 1, mes: 8 });
  });

  // ── Fuso ─────────────────────────────────────────────────────────────────
  //
  // A tela ficou três horas adiantada por semanas porque um comentário
  // afirmava que os timestamps chegavam com offset -03:00 e o parser confiou
  // nele. Chegam em UTC. Estes casos existem para que a próxima pessoa que
  // "simplificar" o parser descubra na hora.

  it("converte de UTC para o fuso do dono — 3h42 não é 6h42", () => {
    // O caso real: a rodada roda às 3h42 e o card mostrava 06:42.
    expect(formatarHora("2026-08-03T06:42:02.337Z")).toBe("03:42");
  });

  it("a data acompanha a conversão, não só a hora", () => {
    // 02:00Z do dia 4 ainda é dia 3 em São Paulo. Era aqui que o dia pulava.
    expect(formatarDataCurta("2026-08-04T02:00:00.000Z")).toBe("3 ago");
  });

  it("meia-noite em São Paulo sai como 00:xx, não 24:xx", () => {
    expect(formatarHora("2026-08-04T03:10:00.000Z")).toBe("00:10");
  });

  it("atravessa a virada de mês no fuso certo", () => {
    expect(formatarDataCurta("2026-09-01T02:30:00.000Z")).toBe("31 ago");
  });

  it("timestamp inválido falha alto, em vez de mostrar NaN na tela", () => {
    expect(() => formatarHora("não é data")).toThrow();
  });
});

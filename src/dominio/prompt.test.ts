import { describe, expect, it } from "vitest";
import { gerarTextoPrompt, type DadosPrompt } from "@/dominio/prompt";
import { chipDoAgente, type SugestaoVM } from "@/dominio/visao";
import type { Contexto, Relatorio, Tarefa } from "@/dominio/tipos";

// docs/plano-testes.md § 2, nível 6, casos 73-81.

const CREDENCIAL_DE_TESTE = "postgres://user:senha123@host/db";

function contextoFixture(overrides: Partial<Contexto> = {}): Contexto {
  return {
    id: "ctx-1",
    projeto_id: "proj-1",
    agente_destino: "designer-ui",
    tipo: "modelo de design",
    conteudo: null,
    arquivo_url: null,
    origem: "painel",
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
    resumo: "resumo qualquer",
    testes_passaram: true,
    achados_por_agente: [],
    ...overrides,
  };
}

function sugestaoVMFixture(overrides: Partial<SugestaoVM> = {}): SugestaoVM {
  return {
    id: "sug-1",
    chip: chipDoAgente("revisor-seguranca"),
    proposta: "proposta qualquer",
    motivo: "motivo qualquer",
    risco: "risco qualquer",
    esforcoLabel: "médio",
    reversibilidadeLabel: "fácil",
    reversibilidadeCor: "#000000",
    naoReverte: false,
    estado: "pendente",
    estadoLabel: "pendente",
    estadoCor: "#000000",
    criadaEmLabel: "hoje",
    decisaoLabel: null,
    prUrl: null,
    ...overrides,
  };
}

const BASE: DadosPrompt = {
  projetoNome: "Projeto de teste",
  repositorio: "dono/repo",
  contextos: [],
  ultimoRelatorio: null,
  selecionadas: [],
  recusadas: [],
};

describe("gerarTextoPrompt — redação de credencial", () => {
  it("caso 73 — contexto.conteudo com cara de credencial: omitido, marcador presente", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      contextos: [contextoFixture({ conteudo: `use isto para conectar: ${CREDENCIAL_DE_TESTE}` })],
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
    expect(texto).toMatch(/omitido/);
  });

  it("caso 74a — relatorio.resumo com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      ultimoRelatorio: relatorioFixture({ resumo: `credencial vazada: ${CREDENCIAL_DE_TESTE}` }),
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
    expect(texto).toMatch(/omitido/);
  });

  it("caso 74b — achado_por_agente.achado com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      ultimoRelatorio: relatorioFixture({
        achados_por_agente: [
          { agente: "revisor-seguranca", achado: `achou isto: ${CREDENCIAL_DE_TESTE}`, selo: "1 achado" },
        ],
      }),
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
    expect(texto).toMatch(/omitido/);
  });

  it("caso 74c — sugestao.motivo com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ motivo: CREDENCIAL_DE_TESTE })],
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
  });

  it("caso 74d — sugestao.risco com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ risco: CREDENCIAL_DE_TESTE })],
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
  });

  it("caso 74e — sugestao.proposta com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ proposta: CREDENCIAL_DE_TESTE })],
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
  });
});

describe("gerarTextoPrompt — aviso de 'não reverte'", () => {
  it("caso 75 — sugestão selecionada com naoReverte:true: texto contém 'NÃO REVERTE' e o aviso extra no topo", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ naoReverte: true })],
    });
    expect(texto).toMatch(/NÃO REVERTE/);
    expect(texto).toMatch(/ATENÇÃO/);
  });

  it("caso 76 — nenhuma sugestão selecionada com naoReverte:true: o aviso extra no topo não aparece", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ naoReverte: false })],
    });
    expect(texto).not.toMatch(/ATENÇÃO/);
    expect(texto).not.toMatch(/NÃO REVERTE/);
  });
});

describe("gerarTextoPrompt — seção de recusadas", () => {
  it("caso 77 — recusadas não vazio: a seção aparece e lista as propostas", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      recusadas: [sugestaoVMFixture({ proposta: "proposta já recusada pelo dono" })],
    });
    expect(texto).toContain("Já recusado — não reproponha");
    expect(texto).toContain("proposta já recusada pelo dono");
  });

  it("caso 78 — recusadas vazio: a seção inteira está ausente (sem cabeçalho vazio)", () => {
    const texto = gerarTextoPrompt({ ...BASE, recusadas: [] });
    expect(texto).not.toContain("Já recusado");
  });
});

describe("gerarTextoPrompt — casos vazios", () => {
  it("caso 79 — selecionadas vazio: pede para decidir com o dono, não uma lista vazia", () => {
    const texto = gerarTextoPrompt({ ...BASE, selecionadas: [] });
    expect(texto).toContain("O que fazer agora");
    expect(texto).toMatch(/decida com o dono/i);
  });

  it("caso 80 — ultimoRelatorio: null: diz explicitamente que nenhuma rodada foi registrada, sem 'null'/'undefined' literal", () => {
    const texto = gerarTextoPrompt({ ...BASE, ultimoRelatorio: null });
    expect(texto).toContain("Nenhuma rodada registrada ainda");
    expect(texto).not.toMatch(/\bnull\b/i);
    expect(texto).not.toMatch(/\bundefined\b/i);
  });

  it("caso 81 — contextos: []: diz que nenhum contexto foi anexado", () => {
    const texto = gerarTextoPrompt({ ...BASE, contextos: [] });
    expect(texto).toContain("Nenhum contexto foi anexado a este projeto no painel.");
  });
});

function tarefaFixture(overrides: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t-1",
    projeto_id: "proj-1",
    titulo: "Migrar a autenticação para X",
    estado: "aberta",
    ordem: 0,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    concluida_em: null,
    ...overrides,
  };
}

describe("gerarTextoPrompt — descricao", () => {
  it("descricao ausente: diz que o dono ainda não escreveu, sem 'null'/'undefined' literal", () => {
    const texto = gerarTextoPrompt({ ...BASE, descricao: null });
    expect(texto).toContain("O dono ainda não escreveu uma descrição");
    expect(texto).not.toMatch(/\bnull\b/i);
  });

  it("descricao presente: entra na seção 'O que é este projeto', antes do diagnóstico", () => {
    const texto = gerarTextoPrompt({ ...BASE, descricao: "Painel pessoal para dirigir agentes de IA." });
    expect(texto).toContain("## O que é este projeto");
    expect(texto).toContain("Painel pessoal para dirigir agentes de IA.");
    expect(texto.indexOf("## O que é este projeto")).toBeLessThan(texto.indexOf("## Diagnóstico"));
  });

  it("descricao com cara de credencial: omitida, mesma regra dos outros campos livres", () => {
    const texto = gerarTextoPrompt({ ...BASE, descricao: `use isto: ${CREDENCIAL_DE_TESTE}` });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
    expect(texto).toMatch(/omitido/);
  });
});

describe("gerarTextoPrompt — tarefas", () => {
  it("tarefa marcada entra na lista numerada de 'O que fazer agora', junto com sugestões", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      selecionadas: [sugestaoVMFixture({ proposta: "sugestão marcada" })],
      tarefasSelecionadas: [tarefaFixture({ titulo: "tarefa marcada" })],
    });
    expect(texto).toContain("1. sugestão marcada");
    expect(texto).toContain("2. tarefa marcada");
  });

  it("só tarefa marcada, sem sugestão: 'O que fazer agora' não fica com a mensagem de vazio", () => {
    const texto = gerarTextoPrompt({ ...BASE, tarefasSelecionadas: [tarefaFixture({ titulo: "só a tarefa" })] });
    expect(texto).toContain("1. só a tarefa");
    expect(texto).not.toMatch(/decida com o dono/i);
  });

  it("tarefa em aberto não marcada entra como contexto curto, com aviso de não instrução", () => {
    const naoMarcada = tarefaFixture({ id: "t-2", titulo: "ainda não marcada" });
    const texto = gerarTextoPrompt({ ...BASE, tarefasEmAberto: [naoMarcada] });
    expect(texto).toContain("Já está na mesa");
    expect(texto).toContain("ainda não marcada");
  });

  it("tarefa marcada não repete na lista de 'não marcadas'", () => {
    const marcada = tarefaFixture({ id: "t-3", titulo: "marcada" });
    const texto = gerarTextoPrompt({ ...BASE, tarefasSelecionadas: [marcada], tarefasEmAberto: [marcada] });
    expect(texto).not.toContain("Já está na mesa");
  });

  it("título de tarefa com cara de credencial: omitido", () => {
    const texto = gerarTextoPrompt({
      ...BASE,
      tarefasSelecionadas: [tarefaFixture({ titulo: `trocar por ${CREDENCIAL_DE_TESTE}` })],
    });
    expect(texto).not.toContain(CREDENCIAL_DE_TESTE);
    expect(texto).toMatch(/omitido/);
  });

  it("nem tarefa nem sugestão: 'nenhuma sugestão marcada' continua valendo (caso 79 estendido)", () => {
    const texto = gerarTextoPrompt({ ...BASE });
    expect(texto).toMatch(/decida com o dono/i);
  });
});

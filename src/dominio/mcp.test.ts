import { describe, expect, it } from "vitest";

// Teste da lógica pura do servidor MCP (src/dominio/mcp.ts). Nada aqui toca
// banco, transporte nem SDK — é exatamente por isso que essa lógica mora no
// domínio e não no route handler.
//
// O que estes casos protegem, em ordem de importância:
//
// 1. **Nada com cara de credencial sai daqui.** O que sai vai para o contexto
//    de um modelo, que repete, resume e às vezes cola em outro lugar. Se um
//    campo novo entrar numa das funções `...ParaMcp` sem `semCredencial`, o
//    vazamento é silencioso — nenhum erro, nenhum log, só o segredo no chat.
// 2. **`resolverProjeto` nunca chuta.** Empate tem que virar pergunta, não
//    escolha. Um chute aqui anexa contexto no projeto errado.
// 3. **Os tetos de tamanho existem de verdade.** Custo por token é silencioso
//    do mesmo jeito: só aparece na fatura.

import {
  CORTE_CONTEUDO_CONTEXTO,
  FERRAMENTAS_MCP,
  LIMITE_RODADAS_MAXIMO,
  LIMITE_RODADAS_PADRAO,
  LIMITE_SUGESTOES,
  NOMES_FERRAMENTAS_MCP,
  contextoExistente,
  contextosParaMcp,
  inventarioParaMcp,
  limiteDeRodadas,
  ordenarSugestoes,
  projetosParaMcp,
  resolverProjeto,
  rodadasParaMcp,
  sugestoesParaMcp,
  truncar,
} from "@/dominio/mcp";
import type { Contexto, Projeto, Relatorio, Servico, Stack, Sugestao } from "@/dominio/tipos";

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

// Valores com forma de credencial, fabricados aqui e sem valor nenhum — o
// mesmo padrão de src/dominio/pareceCredencial.test.ts. Nenhum deles é um
// segredo real, e nenhum vem de arquivo de ambiente (regra 2 do CLAUDE.md).
const PARECE_TOKEN = "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MARCADOR = "[omitido";

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nome: "Painel",
    repositorio: "thiago1187/painel",
    descricao: null,
    frequencia: "toda_madrugada",
    ativo: true,
    criado_em: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function relatorio(over: Partial<Relatorio> = {}): Relatorio {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    projeto_id: projeto().id,
    executado_em: "2026-07-30T03:00:00.000Z",
    status: "ok",
    resumo: "Tudo certo.",
    testes_passaram: true,
    achados_por_agente: [],
    ...over,
  };
}

function sugestao(over: Partial<Sugestao> = {}): Sugestao {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projeto_id: projeto().id,
    agente: "revisor-seguranca",
    proposta: "Limitar tentativas no /entrar.",
    motivo: "Senha memorável fica adivinhável.",
    esforco: "pequeno",
    risco: "Bloquear o dono por engano.",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: "2026-07-30T03:10:00.000Z",
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
    ...over,
  };
}

function contexto(over: Partial<Contexto> = {}): Contexto {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projeto_id: projeto().id,
    agente_destino: "designer-ui",
    tipo: "modelo de design",
    conteudo: "Densidade alta, zero cerimônia.",
    arquivo_url: null,
    origem: "painel",
    criado_em: "2026-07-20T00:00:00.000Z",
    atualizado_em: "2026-07-29T00:00:00.000Z",
    ...over,
  };
}

function stack(over: Partial<Stack> = {}): Stack {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projeto_id: projeto().id,
    categoria: "framework",
    nome: "Next.js",
    criado_em: "2026-07-01T00:00:00.000Z",
    atualizado_em: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function servico(over: Partial<Servico> = {}): Servico {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    projeto_id: projeto().id,
    categoria: "banco",
    nome: "Neon",
    conta: "pessoal",
    papel: "producao",
    administrado_url: "https://console.neon.tech/app/projects/x",
    criado_em: "2026-07-01T00:00:00.000Z",
    atualizado_em: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Catálogo
// ─────────────────────────────────────────────────────────────────────────

describe("catálogo de ferramentas", () => {
  it("expõe exatamente as sete ferramentas decididas, e nenhuma de decisão", () => {
    expect([...NOMES_FERRAMENTAS_MCP].sort()).toEqual([
      "anexar_contexto",
      "cadastrar_projeto",
      "listar_projetos",
      "ver_contexto",
      "ver_inventario",
      "ver_rodadas",
      "ver_sugestoes",
    ]);
  });

  it("não expõe nada que aprove, recuse, marque como feita ou apague", () => {
    // Guarda de regressão da regra que sustenta o desenho inteiro
    // (docs/proximos-passos.md item 7). Uma ferramenta nova com um desses
    // verbos no nome falha aqui antes de chegar a um cliente MCP.
    const proibidos = ["aprov", "recus", "feita", "apag", "delet", "remov", "excluir"];
    for (const nome of NOMES_FERRAMENTAS_MCP) {
      for (const verbo of proibidos) {
        expect(nome, `ferramenta "${nome}" tem cara de decisão`).not.toContain(verbo);
      }
    }
  });

  it("toda ferramenta descreve quando usar, não só o que faz", () => {
    // Barra baixa de propósito: não dá para testar qualidade de prosa. O que
    // dá para garantir é que ninguém registre uma ferramenta com descrição de
    // uma linha, que é o jeito de ela ser chamada na hora errada.
    for (const f of FERRAMENTAS_MCP) {
      expect(f.description.length, `descrição de ${f.name} curta demais`).toBeGreaterThan(120);
      expect(f.description, `descrição de ${f.name} não diz quando usar`).toMatch(/\bUse\b|\bnunca\b|\bsó\b/);
    }
  });

  it("nenhuma ferramenta aceita campo fora do esquema", () => {
    for (const f of FERRAMENTAS_MCP) {
      expect(f.inputSchema.additionalProperties, `${f.name} aceita campo extra`).toBe(false);
    }
  });

  it("as duas de escrita não se anunciam como somente leitura", () => {
    const escrita = FERRAMENTAS_MCP.filter((f) => f.name === "cadastrar_projeto" || f.name === "anexar_contexto");
    expect(escrita).toHaveLength(2);
    for (const f of escrita) expect(f.annotations?.readOnlyHint).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// resolverProjeto
// ─────────────────────────────────────────────────────────────────────────

describe("resolverProjeto", () => {
  const painel = projeto({ id: "aaaaaaaa-1111-4111-8111-111111111111", nome: "Painel", repositorio: "thiago1187/painel" });
  const painelAntigo = projeto({
    id: "bbbbbbbb-2222-4222-8222-222222222222",
    nome: "Painel antigo",
    repositorio: "thiago1187/painel-antigo",
  });
  const gravidade = projeto({
    id: "cccccccc-3333-4333-8333-333333333333",
    nome: "Gravidade Zero",
    repositorio: "thiago1187/gravidade-zero",
  });
  const todos = [painel, painelAntigo, gravidade];

  it("acha por id", () => {
    const r = resolverProjeto(painel.id, todos);
    expect(r.ok && r.projeto.nome).toBe("Painel");
  });

  it("acha por nome exato mesmo com outro nome que o contém", () => {
    // "Painel" é prefixo de "Painel antigo". Se o degrau de nome exato não
    // existisse, isto viraria ambiguidade e o dono teria que digitar o uuid.
    const r = resolverProjeto("Painel", todos);
    expect(r.ok && r.projeto.id).toBe(painel.id);
  });

  it("ignora acento e caixa", () => {
    const r = resolverProjeto("gravidade zéro", todos);
    expect(r.ok && r.projeto.id).toBe(gravidade.id);
  });

  it("acha por repositório inteiro e só pela parte depois da barra", () => {
    expect(resolverProjeto("thiago1187/gravidade-zero", todos).ok).toBe(true);
    const r = resolverProjeto("gravidade-zero", todos);
    expect(r.ok && r.projeto.id).toBe(gravidade.id);
  });

  it("acha por pedaço quando não há empate", () => {
    const r = resolverProjeto("antigo", todos);
    expect(r.ok && r.projeto.id).toBe(painelAntigo.id);
  });

  it("recusa em vez de chutar quando mais de um casa por pedaço", () => {
    const r = resolverProjeto("painel", [
      projeto({ id: "dddddddd-4444-4444-8444-444444444444", nome: "Painel de controle", repositorio: "x/a" }),
      projeto({ id: "eeeeeeee-5555-4555-8555-555555555555", nome: "Painel do cliente", repositorio: "x/b" }),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain("Mais de um projeto");
      expect(r.erro).toContain("Painel de controle");
      expect(r.erro).toContain("Painel do cliente");
    }
  });

  it("quando não acha, diz quais existem — o modelo consegue se corrigir sozinho", () => {
    const r = resolverProjeto("inexistente", todos);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain("Nenhum projeto");
      expect(r.erro).toContain("Gravidade Zero");
    }
  });

  it("recusa termo ausente, vazio, de outro tipo ou gigante", () => {
    expect(resolverProjeto(undefined, todos).ok).toBe(false);
    expect(resolverProjeto("   ", todos).ok).toBe(false);
    expect(resolverProjeto(42, todos).ok).toBe(false);
    expect(resolverProjeto("x".repeat(500), todos).ok).toBe(false);
  });

  it("com o painel vazio, explica que não há projeto em vez de dizer 'não achei'", () => {
    const r = resolverProjeto("qualquer", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("nenhum projeto cadastrado");
  });

  it("projeto sem repositório continua achável pelo nome", () => {
    const semRepo = projeto({ id: "ffffffff-6666-4666-8666-666666666666", nome: "Fluxo n8n", repositorio: null });
    const r = resolverProjeto("fluxo n8n", [painel, semRepo]);
    expect(r.ok && r.projeto.id).toBe(semRepo.id);
  });

  it("não vaza credencial na lista de projetos da mensagem de erro", () => {
    const envenenado = projeto({ id: "99999999-9999-4999-8999-999999999999", nome: `repo ${PARECE_TOKEN}` });
    const r = resolverProjeto("nada disso", [envenenado]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).not.toContain(PARECE_TOKEN);
      expect(r.erro).toContain(MARCADOR);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Controle de tamanho
// ─────────────────────────────────────────────────────────────────────────

describe("controle de tamanho", () => {
  it("limiteDeRodadas cai no padrão para ausente, lixo e valor sem sentido", () => {
    expect(limiteDeRodadas(undefined)).toBe(LIMITE_RODADAS_PADRAO);
    expect(limiteDeRodadas("três")).toBe(LIMITE_RODADAS_PADRAO);
    expect(limiteDeRodadas(0)).toBe(LIMITE_RODADAS_PADRAO);
    expect(limiteDeRodadas(-5)).toBe(LIMITE_RODADAS_PADRAO);
    expect(limiteDeRodadas(Number.NaN)).toBe(LIMITE_RODADAS_PADRAO);
    expect(limiteDeRodadas(Number.POSITIVE_INFINITY)).toBe(LIMITE_RODADAS_PADRAO);
  });

  it("limiteDeRodadas respeita o pedido e o teto", () => {
    expect(limiteDeRodadas(3)).toBe(3);
    expect(limiteDeRodadas(3.9)).toBe(3);
    expect(limiteDeRodadas(9999)).toBe(LIMITE_RODADAS_MAXIMO);
  });

  it("truncar avisa que cortou, e não mexe no que cabe", () => {
    expect(truncar("curto", 10)).toBe("curto");
    const cortado = truncar("x".repeat(50), 10);
    expect(cortado.startsWith("x".repeat(10))).toBe(true);
    expect(cortado).toContain("cortado");
  });

  it("ver_rodadas devolve no máximo o limite pedido", () => {
    const muitas = Array.from({ length: 30 }, () => relatorio());
    expect(rodadasParaMcp(muitas, limiteDeRodadas(undefined))).toHaveLength(LIMITE_RODADAS_PADRAO);
    expect(rodadasParaMcp(muitas, limiteDeRodadas(1000))).toHaveLength(LIMITE_RODADAS_MAXIMO);
  });

  it("a fila de sugestões tem teto", () => {
    const muitas = Array.from({ length: LIMITE_SUGESTOES + 20 }, () => sugestao());
    expect(sugestoesParaMcp(muitas, () => "Painel")).toHaveLength(LIMITE_SUGESTOES);
  });

  it("conteúdo de contexto longo sai cortado", () => {
    const [saida] = contextosParaMcp([contexto({ conteudo: "a".repeat(CORTE_CONTEUDO_CONTEXTO + 500) })]);
    expect(saida.conteudo!.length).toBeLessThan(CORTE_CONTEUDO_CONTEXTO + 100);
    expect(saida.conteudo).toContain("cortado");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Redação de credencial em toda saída
// ─────────────────────────────────────────────────────────────────────────

describe("nada com cara de credencial sai para o modelo", () => {
  it("projeto", () => {
    const [saida] = projetosParaMcp([projeto({ nome: `Painel ${PARECE_TOKEN}` })]);
    expect(saida.nome).not.toContain(PARECE_TOKEN);
    expect(saida.nome).toContain(MARCADOR);
  });

  it("rodada: resumo e cada achado", () => {
    const [saida] = rodadasParaMcp(
      [
        relatorio({
          resumo: `Falhou com ${PARECE_TOKEN}`,
          achados_por_agente: [{ agente: "qa-testes", selo: "atenção", achado: `vazou ${PARECE_TOKEN}` }],
        }),
      ],
      5,
    );
    expect(saida.resumo).not.toContain(PARECE_TOKEN);
    expect(saida.achados[0].achado).not.toContain(PARECE_TOKEN);
  });

  it("sugestão: proposta, motivo e risco", () => {
    const [saida] = sugestoesParaMcp(
      [
        sugestao({
          proposta: `Rotacionar ${PARECE_TOKEN}`,
          motivo: `Está em ${PARECE_TOKEN}`,
          risco: `Quebra quem usa ${PARECE_TOKEN}`,
        }),
      ],
      () => "Painel",
    );
    expect(saida.proposta).not.toContain(PARECE_TOKEN);
    expect(saida.motivo).not.toContain(PARECE_TOKEN);
    expect(saida.risco).not.toContain(PARECE_TOKEN);
  });

  it("contexto: conteúdo, e o link perde userinfo e query", () => {
    const [saida] = contextosParaMcp([
      contexto({
        conteudo: `use ${PARECE_TOKEN}`,
        arquivo_url: "https://usuario:senha@exemplo.com/spec.md?assinatura=abc#trecho",
      }),
    ]);
    expect(saida.conteudo).not.toContain(PARECE_TOKEN);
    expect(saida.arquivo).toBe("https://exemplo.com/spec.md");
  });

  it("inventário: nome, conta, papel e o link de administração", () => {
    const saida = inventarioParaMcp(
      [stack({ nome: `Next.js ${PARECE_TOKEN}` })],
      [
        servico({
          nome: `Neon ${PARECE_TOKEN}`,
          conta: `conta ${PARECE_TOKEN}`,
          papel: `papel ${PARECE_TOKEN}`,
          administrado_url: "https://console.neon.tech/app?api_key=segredo",
        }),
      ],
    );
    expect(saida.stack[0].nome).not.toContain(PARECE_TOKEN);
    expect(saida.servicos[0].nome).not.toContain(PARECE_TOKEN);
    expect(saida.servicos[0].conta).not.toContain(PARECE_TOKEN);
    expect(saida.servicos[0].papel).not.toContain(PARECE_TOKEN);
    expect(saida.servicos[0].administrado_em).toBe("https://console.neon.tech/app");
  });

  it("o nome de projeto injetado em cada sugestão também passa pelo filtro", () => {
    const [saida] = sugestoesParaMcp([sugestao()], () => `Projeto ${PARECE_TOKEN}`);
    expect(saida.projeto).not.toContain(PARECE_TOKEN);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Forma da saída
// ─────────────────────────────────────────────────────────────────────────

describe("forma da saída", () => {
  it("projeto pausado sai como pausado, não como ausente", () => {
    const [saida] = projetosParaMcp([projeto({ ativo: false })]);
    expect(saida.estado).toBe("pausado");
  });

  it('"sem suíte" é um resultado distinto de "falharam"', () => {
    expect(rodadasParaMcp([relatorio({ testes_passaram: null })], 5)[0].testes).toBe("sem suíte");
    expect(rodadasParaMcp([relatorio({ testes_passaram: false })], 5)[0].testes).toBe("falharam");
    expect(rodadasParaMcp([relatorio({ testes_passaram: true })], 5)[0].testes).toBe("passaram");
  });

  it("nao_reverte vem com aviso explícito; o resto não carrega o campo", () => {
    const [naoReverte] = sugestoesParaMcp([sugestao({ reversibilidade: "nao_reverte" })], () => "Painel");
    expect(naoReverte.aviso).toContain("Não reverte");

    const [facil] = sugestoesParaMcp([sugestao({ reversibilidade: "facil" })], () => "Painel");
    expect(facil.aviso).toBeUndefined();
  });

  it("sugestão de projeto apagado não quebra a lista", () => {
    const [saida] = sugestoesParaMcp([sugestao({ projeto_id: "sumiu" })], () => "projeto removido");
    expect(saida.projeto).toBe("projeto removido");
  });

  it("ordena pendentes primeiro e, dentro do estado, a mais nova antes", () => {
    const ordenadas = ordenarSugestoes([
      sugestao({ id: "a", estado: "feita", criada_em: "2026-07-01T00:00:00.000Z" }),
      sugestao({ id: "b", estado: "pendente", criada_em: "2026-07-01T00:00:00.000Z" }),
      sugestao({ id: "c", estado: "pendente", criada_em: "2026-07-20T00:00:00.000Z" }),
      sugestao({ id: "d", estado: "recusada", criada_em: "2026-07-25T00:00:00.000Z" }),
      sugestao({ id: "e", estado: "aprovada", criada_em: "2026-07-02T00:00:00.000Z" }),
    ]);
    expect(ordenadas.map((s) => s.id)).toEqual(["c", "b", "e", "a", "d"]);
  });

  it("ordenar não muda a lista de origem", () => {
    const original = [sugestao({ id: "a", estado: "feita" }), sugestao({ id: "b", estado: "pendente" })];
    ordenarSugestoes(original);
    expect(original.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Guarda de sobrescrita
// ─────────────────────────────────────────────────────────────────────────

describe("contextoExistente", () => {
  const existentes = [
    contexto({ id: "c1", agente_destino: "designer-ui", tipo: "modelo de design" }),
    contexto({ id: "c2", agente_destino: "qa-testes", tipo: "restrições" }),
  ];

  it("encontra a colisão que o upsert substituiria", () => {
    expect(contextoExistente(existentes, "designer-ui", "modelo de design")?.id).toBe("c1");
  });

  it("agente igual com tipo diferente não é colisão — o upsert criaria linha nova", () => {
    expect(contextoExistente(existentes, "designer-ui", "notas")).toBeNull();
  });

  it("tipo igual com agente diferente não é colisão", () => {
    expect(contextoExistente(existentes, "dev-frontend", "modelo de design")).toBeNull();
  });

  it("compara exatamente como o índice único do banco, sem ignorar caixa", () => {
    // Se isto passasse a casar sem caixa, `substituir=true` criaria uma linha
    // nova em vez de trocar a antiga — avisar errado é pior que não avisar.
    expect(contextoExistente(existentes, "Designer-UI", "Modelo de Design")).toBeNull();
  });

  it("lista vazia não é colisão", () => {
    expect(contextoExistente([], "designer-ui", "modelo de design")).toBeNull();
  });
});

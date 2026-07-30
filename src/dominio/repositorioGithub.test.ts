import { describe, expect, it } from "vitest";
import { extrairDonoRepo, normalizarRepositorioGithub } from "./repositorioGithub";

describe("extrairDonoRepo", () => {
  it("reconhece a forma bruta dono/repo", () => {
    expect(extrairDonoRepo("thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("apara espaço em volta", () => {
    expect(extrairDonoRepo("  thiago/painel  ")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("reconhece a URL completa https", () => {
    expect(extrairDonoRepo("https://github.com/thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("reconhece a URL com www", () => {
    expect(extrairDonoRepo("https://www.github.com/thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("reconhece http (sem s)", () => {
    expect(extrairDonoRepo("http://github.com/thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("aceita a URL sem protocolo", () => {
    expect(extrairDonoRepo("github.com/thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("remove o sufixo .git", () => {
    expect(extrairDonoRepo("https://github.com/thiago/painel.git")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("ignora caminho depois do repositório (/tree/main)", () => {
    expect(extrairDonoRepo("https://github.com/thiago/painel/tree/main")).toEqual({
      dono: "thiago",
      repo: "painel",
    });
  });

  it("ignora caminho de arquivo (/blob/main/README.md)", () => {
    expect(extrairDonoRepo("https://github.com/thiago/painel/blob/main/README.md")).toEqual({
      dono: "thiago",
      repo: "painel",
    });
  });

  it("ignora barra final", () => {
    expect(extrairDonoRepo("https://github.com/thiago/painel/")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("reconhece a forma SSH", () => {
    expect(extrairDonoRepo("git@github.com:thiago/painel.git")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("reconhece a forma SSH sem .git", () => {
    expect(extrairDonoRepo("git@github.com:thiago/painel")).toEqual({ dono: "thiago", repo: "painel" });
  });

  it("devolve null para texto vazio", () => {
    expect(extrairDonoRepo("")).toBeNull();
    expect(extrairDonoRepo("   ")).toBeNull();
  });

  it("devolve null para texto sem barra", () => {
    expect(extrairDonoRepo("painel")).toBeNull();
  });

  it("devolve null para texto solto com mais de uma barra", () => {
    expect(extrairDonoRepo("thiago/painel/extra")).toBeNull();
  });

  it("devolve null para host que não é github.com", () => {
    expect(extrairDonoRepo("https://gitlab.com/thiago/painel")).toBeNull();
  });

  it("devolve null para URL do GitHub sem repositório (só o usuário)", () => {
    expect(extrairDonoRepo("https://github.com/thiago")).toBeNull();
  });

  it("recusa segmento de travessia no dono", () => {
    expect(extrairDonoRepo("../painel")).toBeNull();
    expect(extrairDonoRepo("https://github.com/../painel")).toBeNull();
  });

  it("recusa segmento de travessia no repositório", () => {
    expect(extrairDonoRepo("thiago/..")).toBeNull();
  });

  it("devolve null para URL malformada", () => {
    expect(extrairDonoRepo("https://github.com/ /painel")).toBeNull();
  });
});

describe("normalizarRepositorioGithub", () => {
  const brutoBase = {
    nome: "painel",
    descricao: "Um painel de controle.",
    linguagens: ["TypeScript", "CSS"],
    ultimoCommit: {
      sha: "abcdef1234567890",
      mensagem: "corrige o redirecionamento aberto\n\ncorpo estendido aqui",
      data: "2026-07-30T12:00:00Z",
    },
    prsAbertos: { quantidade: 3, aproximado: false },
    readme: "# Painel\n\nDescrição do projeto.",
  };

  it("monta o repositorio a partir de dono e repo", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", brutoBase);
    expect(resultado.repositorio).toBe("thiago/painel");
  });

  it("usa o repo como nome quando a API não devolve nome", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", { ...brutoBase, nome: null });
    expect(resultado.nome).toBe("painel");
  });

  it("corta a descrição no tamanho máximo", () => {
    const longa = "a".repeat(600);
    const resultado = normalizarRepositorioGithub("thiago", "painel", { ...brutoBase, descricao: longa });
    expect(resultado.descricao?.length).toBeLessThanOrEqual(501);
    expect(resultado.descricao?.endsWith("…")).toBe(true);
  });

  it("descarta a descrição inteira se parecer credencial, em vez de deixar marcador", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      ...brutoBase,
      descricao: "usa ghp_abcdefghijklmnopqrstuvwxyz1234 para autenticar",
    });
    expect(resultado.descricao).toBeNull();
  });

  it("remove caractere de controle da descrição", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      ...brutoBase,
      descricao: "tem\x00controle\x1Baqui",
    });
    expect(resultado.descricao).toBe("temcontroleaqui");
  });

  it("mantém só a primeira linha da mensagem de commit", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", brutoBase);
    expect(resultado.ultimoCommit?.mensagem).toBe("corrige o redirecionamento aberto");
  });

  it("encurta o sha para 7 caracteres", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", brutoBase);
    expect(resultado.ultimoCommit?.sha).toBe("abcdef1");
  });

  it("devolve null para commit sem sha reconhecível", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      ...brutoBase,
      ultimoCommit: { sha: "não é hex", mensagem: "x", data: null },
    });
    expect(resultado.ultimoCommit).toBeNull();
  });

  it("descarta data que não parece ISO", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      ...brutoBase,
      ultimoCommit: { sha: "abcdef1234567890", mensagem: "x", data: "ontem" },
    });
    expect(resultado.ultimoCommit?.data).toBeNull();
  });

  it("limita a lista de linguagens ao teto e remove duplicata", () => {
    const muitas = ["A", "B", "C", "D", "E", "F", "G", "H", "A"];
    const resultado = normalizarRepositorioGithub("thiago", "painel", { ...brutoBase, linguagens: muitas });
    expect(resultado.linguagens).toHaveLength(6);
    expect(resultado.linguagens).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("repassa prsAbertos como veio", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", brutoBase);
    expect(resultado.prsAbertos).toEqual({ quantidade: 3, aproximado: false });
  });

  it("corta o README no tamanho máximo, preservando quebra de linha", () => {
    const longo = `# título\n\n${"conteúdo ".repeat(300)}`;
    const resultado = normalizarRepositorioGithub("thiago", "painel", { ...brutoBase, readme: longo });
    expect(resultado.readmeResumo).toContain("\n");
    expect(resultado.readmeResumo!.length).toBeLessThanOrEqual(1501);
  });

  it("descarta o README se parecer conter credencial", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      ...brutoBase,
      readme: "export AWS_KEY=AKIAABCDEFGHIJKLMNOP",
    });
    expect(resultado.readmeResumo).toBeNull();
  });

  it("devolve null para campos ausentes", () => {
    const resultado = normalizarRepositorioGithub("thiago", "painel", {
      nome: null,
      descricao: null,
      linguagens: [],
      ultimoCommit: null,
      prsAbertos: null,
      readme: null,
    });
    expect(resultado.descricao).toBeNull();
    expect(resultado.ultimoCommit).toBeNull();
    expect(resultado.prsAbertos).toBeNull();
    expect(resultado.readmeResumo).toBeNull();
    expect(resultado.linguagens).toEqual([]);
  });
});

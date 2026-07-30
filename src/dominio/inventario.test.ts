import { describe, expect, it } from "vitest";
import { agruparServico, agruparStack } from "@/dominio/inventario";
import type { Servico, Stack } from "@/dominio/tipos";

// Agrupamento e ordenação do inventário (stack/servico) — lógica de
// apresentação pura, mesmo espírito de docs/plano-testes.md nível 5/7
// (esteiraAgentes.ts, cadencia.ts): barata de testar, cara de deixar quebrar
// em silêncio, porque decide a ordem que o dono lê numa manhã.

const projetoId = "11111111-1111-4111-8111-111111111111";

function stack(parcial: Partial<Stack>): Stack {
  return {
    id: parcial.id ?? "s0000000-0000-4000-8000-000000000000",
    projeto_id: projetoId,
    categoria: "linguagem",
    nome: "TypeScript",
    criado_em: "2026-07-01T00:00:00-03:00",
    atualizado_em: "2026-07-01T00:00:00-03:00",
    ...parcial,
  };
}

function servico(parcial: Partial<Servico>): Servico {
  return {
    id: parcial.id ?? "v0000000-0000-4000-8000-000000000000",
    projeto_id: projetoId,
    categoria: "banco",
    nome: "Neon",
    conta: "pessoal",
    papel: null,
    administrado_url: null,
    criado_em: "2026-07-01T00:00:00-03:00",
    atualizado_em: "2026-07-01T00:00:00-03:00",
    ...parcial,
  };
}

describe("agruparStack", () => {
  it("lista vazia: nenhum grupo", () => {
    expect(agruparStack([])).toEqual([]);
  });

  it("agrupa por categoria na ordem fixa linguagem, framework, runtime — mesmo com entrada fora de ordem", () => {
    const itens = [
      stack({ id: "3", categoria: "runtime", nome: "Node.js 20" }),
      stack({ id: "1", categoria: "linguagem", nome: "TypeScript" }),
      stack({ id: "2", categoria: "framework", nome: "Next.js" }),
    ];
    const grupos = agruparStack(itens);
    expect(grupos.map((g) => g.categoria)).toEqual(["linguagem", "framework", "runtime"]);
  });

  it("ordena os itens de cada grupo por nome, alfabético", () => {
    const itens = [
      stack({ id: "1", categoria: "framework", nome: "Vue" }),
      stack({ id: "2", categoria: "framework", nome: "Next.js" }),
      stack({ id: "3", categoria: "framework", nome: "Astro" }),
    ];
    const grupos = agruparStack(itens);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(["Astro", "Next.js", "Vue"]);
  });

  it("categoria sem nenhum item não aparece na lista de grupos", () => {
    const grupos = agruparStack([stack({ categoria: "linguagem" })]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].categoria).toBe("linguagem");
  });

  it("label de cada categoria vem preenchido", () => {
    const grupos = agruparStack([stack({ categoria: "runtime" })]);
    expect(grupos[0].label).toBe("runtime");
  });
});

describe("agruparServico", () => {
  it("lista vazia: nenhum grupo", () => {
    expect(agruparServico([])).toEqual([]);
  });

  it("agrupa por categoria na ordem fixa (banco, hospedagem, modelo, autenticacao, storage, email)", () => {
    const itens = [
      servico({ id: "1", categoria: "email", nome: "Resend" }),
      servico({ id: "2", categoria: "banco", nome: "Neon" }),
      servico({ id: "3", categoria: "autenticacao", nome: "Auth.js" }),
    ];
    const grupos = agruparServico(itens);
    expect(grupos.map((g) => g.categoria)).toEqual(["banco", "autenticacao", "email"]);
  });

  it("ordena os itens de cada grupo por nome, alfabético", () => {
    const itens = [
      servico({ id: "1", categoria: "storage", nome: "S3" }),
      servico({ id: "2", categoria: "storage", nome: "Cloudinary" }),
    ];
    const grupos = agruparServico(itens);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(["Cloudinary", "S3"]);
  });

  it("categoria 'autenticacao' tem label acentuado ('autenticação') para exibição", () => {
    const grupos = agruparServico([servico({ categoria: "autenticacao" })]);
    expect(grupos[0].label).toBe("autenticação");
  });

  it("duas linhas com o mesmo nome em contas diferentes: as duas aparecem, sem colapsar", () => {
    const itens = [
      servico({ id: "1", categoria: "banco", nome: "Neon", conta: "pessoal" }),
      servico({ id: "2", categoria: "banco", nome: "Neon", conta: "cliente x" }),
    ];
    const grupos = agruparServico(itens);
    expect(grupos[0].itens).toHaveLength(2);
  });
});

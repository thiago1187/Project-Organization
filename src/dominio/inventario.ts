// Agrupamento e rótulos de exibição do inventário de projeto (`stack` e
// `servico`, db/migrations/002_inventario.sql) — a resposta à pergunta 4 de
// docs/visao.md ("o que tem dentro deste projeto"). Lógica pura, sem import
// de banco nem de React: só decide ordem e agrupamento, testável isolada —
// mesmo padrão de src/dominio/cadencia.ts e src/dominio/esteiraAgentes.ts.
//
// Sem coluna de ordem de exibição no schema de propósito (ver comentário no
// fim de db/migrations/002_inventario.sql): a ordem de leitura natural das
// categorias é um mapeamento fixo aqui, no código de apresentação, não um
// dado por linha. Dentro de cada categoria, os itens vêm ordenados por nome
// (alfabético) — mesma decisão registrada na migration.

import type { CategoriaServico, CategoriaStack, Servico, Stack } from "./tipos";

export const CATEGORIAS_STACK_ORDEM: readonly CategoriaStack[] = ["linguagem", "framework", "runtime"];

export const CATEGORIA_STACK_LABEL: Record<CategoriaStack, string> = {
  linguagem: "linguagem",
  framework: "framework",
  runtime: "runtime",
};

export const CATEGORIAS_SERVICO_ORDEM: readonly CategoriaServico[] = [
  "banco",
  "hospedagem",
  "modelo",
  "autenticacao",
  "storage",
  "email",
];

export const CATEGORIA_SERVICO_LABEL: Record<CategoriaServico, string> = {
  banco: "banco",
  hospedagem: "hospedagem",
  modelo: "modelo",
  autenticacao: "autenticação",
  storage: "storage",
  email: "e-mail",
};

export interface GrupoStackVM {
  categoria: CategoriaStack;
  label: string;
  itens: Stack[];
}

export interface GrupoServicoVM {
  categoria: CategoriaServico;
  label: string;
  itens: Servico[];
}

function porNome<T extends { nome: string }>(a: T, b: T): number {
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/**
 * Agrupa `stack` por categoria, na ordem fixa de leitura (linguagem,
 * framework, runtime), cada grupo ordenado por nome. Categoria sem nenhum
 * item não aparece — o formulário de adicionar continua oferecendo as três,
 * isto é só para a lista já preenchida.
 */
export function agruparStack(stack: readonly Stack[]): GrupoStackVM[] {
  return CATEGORIAS_STACK_ORDEM.map((categoria) => ({
    categoria,
    label: CATEGORIA_STACK_LABEL[categoria],
    itens: stack.filter((s) => s.categoria === categoria).slice().sort(porNome),
  })).filter((grupo) => grupo.itens.length > 0);
}

/**
 * Agrupa `servico` por categoria, mesma regra de `agruparStack` — ordem fixa
 * (banco, hospedagem, modelo, autenticação, storage, e-mail), itens por nome
 * dentro do grupo, grupo vazio omitido.
 */
export function agruparServico(servico: readonly Servico[]): GrupoServicoVM[] {
  return CATEGORIAS_SERVICO_ORDEM.map((categoria) => ({
    categoria,
    label: CATEGORIA_SERVICO_LABEL[categoria],
    itens: servico.filter((s) => s.categoria === categoria).slice().sort(porNome),
  })).filter((grupo) => grupo.itens.length > 0);
}

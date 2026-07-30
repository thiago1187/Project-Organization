import { describe, expect, it } from "vitest";
import { ordenarTarefas, tarefasEmAberto } from "@/dominio/tarefas";
import type { Tarefa } from "@/dominio/tipos";

function tarefaFixture(overrides: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t-1",
    projeto_id: "proj-1",
    titulo: "Fazer algo",
    estado: "aberta",
    ordem: 0,
    criado_em: new Date("2026-01-01T00:00:00Z").toISOString(),
    atualizado_em: new Date("2026-01-01T00:00:00Z").toISOString(),
    concluida_em: null,
    ...overrides,
  };
}

describe("ordenarTarefas", () => {
  it("ordena por `ordem`", () => {
    const tarefas = [
      tarefaFixture({ id: "b", ordem: 2 }),
      tarefaFixture({ id: "a", ordem: 1 }),
    ];
    expect(ordenarTarefas(tarefas).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("empate em `ordem` desempata por `criado_em`", () => {
    const tarefas = [
      tarefaFixture({ id: "depois", ordem: 0, criado_em: "2026-02-01T00:00:00Z" }),
      tarefaFixture({ id: "antes", ordem: 0, criado_em: "2026-01-01T00:00:00Z" }),
    ];
    expect(ordenarTarefas(tarefas).map((t) => t.id)).toEqual(["antes", "depois"]);
  });
});

describe("tarefasEmAberto", () => {
  it("inclui aberta e fazendo, exclui feita", () => {
    const tarefas = [
      tarefaFixture({ id: "1", estado: "aberta", ordem: 0 }),
      tarefaFixture({ id: "2", estado: "fazendo", ordem: 1 }),
      tarefaFixture({ id: "3", estado: "feita", ordem: 2, concluida_em: new Date().toISOString() }),
    ];
    expect(tarefasEmAberto(tarefas).map((t) => t.id)).toEqual(["1", "2"]);
  });
});

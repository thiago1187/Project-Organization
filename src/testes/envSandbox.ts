import { afterEach, beforeEach } from "vitest";

// `process.env` é estado global compartilhado entre testes. As regras de
// acesso.ts e sessao.ts distinguem "variável ausente" de "variável vazia", e
// a degradação certa nos dois casos é recusar (ver comentário de
// `cookieSessaoEhValido` em sessao.ts) — por isso este helper apaga a chave de
// verdade (`delete`), em vez de só sobrescrever com uma string vazia, e
// restaura o valor original (ou a ausência dele) depois de cada teste.
//
// Chame dentro de um `describe(...)`, nunca dentro de um `it(...)` — precisa
// registrar `beforeEach`/`afterEach` no escopo certo.
export function limparEnvEntreTestes(chaves: readonly string[]): void {
  let original: Record<string, string | undefined> = {};

  beforeEach(() => {
    original = Object.fromEntries(chaves.map((chave) => [chave, process.env[chave]]));
    for (const chave of chaves) delete process.env[chave];
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (original[chave] === undefined) delete process.env[chave];
      else process.env[chave] = original[chave];
    }
  });
}

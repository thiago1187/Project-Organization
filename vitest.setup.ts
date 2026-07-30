import { vi } from "vitest";

// "server-only" (node_modules/server-only/index.js) lança um Error assim que
// é importado, a não ser que o resolvedor esteja na condição "react-server" —
// é assim que o pacote impede um Client Component de importar código de
// servidor por engano. Os testes rodam sob Node puro, não sob o runtime do
// Next, então essa condição nunca está presente. Sem este mock, todo módulo
// que começa com `import "server-only"` (acesso.ts, sessao.ts,
// comparacaoSegura.ts, db.ts, erros.ts, sugestoes.ts, respostaApi.ts...)
// falharia na primeira linha, antes de qualquer teste rodar — não é um jeito
// de contornar a regra, é reconhecer que o marcador já fez o trabalho dele
// (apontar "isto é só de servidor") e os testes já são só de servidor.
vi.mock("server-only", () => ({}));

import "server-only";
import { neon } from "@neondatabase/serverless";

// Conexão com o Postgres (Neon), só para código que roda no servidor — nunca
// importado por um componente "use client" (ver CLAUDE.md, regra de segurança
// 1). O `import "server-only"` faz o build falhar alto se isso acontecer por
// engano, em vez de vazar em silêncio.
//
// Cliente: @neondatabase/serverless, não `pg`. A aplicação roda em funções
// serverless da Vercel — processos curtos, muitas invocações concorrentes,
// sem um socket TCP de longa duração para reaproveitar entre requisições.
// O driver da Neon fala HTTP (uma requisição por consulta, via `fetch`), o
// que combina com esse ciclo de vida: não precisa abrir/fechar conexão TCP a
// cada invocação nem depender de um pool gerenciado pelo processo (que não
// sobrevive entre invocações serverless de qualquer forma). `pg` funcionaria
// tecnicamente sobre a `DATABASE_URL` pooled (compatível com PgBouncer), mas
// traria a sobrecarga de handshake TCP/TLS por invocação sem ganho nenhum
// aqui, além de uma dependência nativa (libpq) que o driver HTTP não tem.
// Caso este app um dia precise de transação real (múltiplas escritas
// atômicas), a mesma biblioteca expõe `sql.transaction(...)` — não é motivo
// para trocar de cliente.
//
// Sempre a `DATABASE_URL` pooled. A `DATABASE_URL_UNPOOLED` é só para
// migration, aplicada manualmente fora do runtime da aplicação — ver
// db/README.md.

let clienteSql: ReturnType<typeof neon> | null = null;

/**
 * Função de consulta (tagged template) para o banco. Lida com `process.env`
 * só na primeira chamada, não no import do módulo — assim uma rota que nunca
 * toca banco não falha por falta da variável, e o valor nunca é lido fora do
 * servidor.
 */
export function sql() {
  if (!clienteSql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL não configurada no ambiente do servidor. Confira as variáveis de ambiente " +
          "na Vercel (ou .env.local em desenvolvimento) — nunca via variável com prefixo público.",
      );
    }
    clienteSql = neon(url);
  }
  return clienteSql;
}

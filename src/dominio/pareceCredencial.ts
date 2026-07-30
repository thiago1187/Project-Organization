// Tripwire anti-credencial em JavaScript, mesmo padrão e mesmos padrões
// reconhecidos da função SQL `parece_credencial` (db/migrations/002_inventario.sql).
// As duas existem separadas porque servem momentos diferentes: a função SQL
// protege o que entra nas tabelas `stack`/`servico`; esta protege o texto que
// o gerador de prompt (src/dominio/prompt.ts) monta a partir de contexto e
// relatório e manda para a área de transferência do dono — uma rota que nunca
// passa pelo banco de novo, então o CHECK do Postgres não alcança.
//
// Mesma honestidade do comentário original: isto reconhece formatos literais
// comuns (string de conexão com usuário:senha, sk-..., AKIA..., ghp_..., xox...,
// JWT). Não é análise de entropia nem scanner de verdade — é o alarme barato
// para o acidente mais óbvio, não uma garantia.
const PADRAO_CREDENCIAL = new RegExp(
  [
    "[a-z][a-z0-9+.-]*://[^/\\s@]+:[^/\\s@]+@", // scheme://usuario:senha@ (qualquer protocolo)
    "sk[-.][a-z0-9_-]{10,}", // chave estilo OpenAI/Anthropic/Stripe, e Mapbox (usa ponto)
    "akia[0-9a-z]{12,}", // AWS access key id
    "gh[pousr]_[a-z0-9]{20,}", // token do GitHub (pessoal/oauth/app/instalação)
    "xox[baprs]-[a-z0-9-]{6,}", // token do Slack
    "eyj[a-z0-9_-]{10,}\\.[a-z0-9_-]{10,}", // JWT (cabeçalho.payload em base64url)

    // As famílias abaixo entraram porque a revisão de 2026-07-30 rodou o
    // padrão antigo contra os valores fabricados do próprio export e contra os
    // provedores que ESTE projeto usa: dos 12, ele pegava 5. O alarme estava
    // calibrado para credenciais de terceiros e cego justamente para as que o
    // dono administra — o token da Vercel passava direto.
    //
    // A lista para aqui de propósito. Perseguir prefixo de provedor é esteira
    // infinita; o alvo é o que este inventário de fato contém.
    "vercel_[a-z0-9]{16,}", // token da Vercel
    "npm_[a-z0-9]{20,}", // token do npm
    "aiza[a-z0-9_-]{20,}", // chave de API do Google
    "glpat-[a-z0-9_-]{16,}", // token do GitLab
    "dop_v1_[a-z0-9]{32,}", // token da DigitalOcean
    "re_[a-z0-9]{8,}_[a-z0-9]{10,}", // chave do Resend
    "fly_[a-z0-9]{10,}", // token do Fly.io
  ].join("|"),
  "i",
);

/** `true` se `texto` contém algo com cara de credencial. Ver comentário acima: alarme, não muralha. */
export function pareceCredencial(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return PADRAO_CREDENCIAL.test(texto);
}

const MARCADOR_OMITIDO = "[omitido — este campo parece conter uma credencial e não foi incluído no prompt]";

/** Devolve `texto` inalterado, ou o marcador de omissão se ele parecer conter uma credencial. */
export function semCredencial(texto: string): string {
  return pareceCredencial(texto) ? MARCADOR_OMITIDO : texto;
}

/**
 * URL reduzida a origem + caminho, para sair deste app sem carregar segredo.
 *
 * Nasceu privada no gerador de prompt, quando `contexto.arquivo_url` era a
 * única URL que ia para a área de transferência. Mora aqui desde que o
 * servidor MCP (src/dominio/mcp.ts) passou a precisar da mesma redução em
 * `contexto.arquivo_url` e em `servico.administrado_url` — duas saídas
 * diferentes, uma regra só.
 *
 * O único requisito desses campos é começar com `https://`. Link assinado de
 * S3, export do Notion, compartilhamento do Google com chave na query, ou
 * `https://usuario:senha@host/spec.md` — todos sairiam inteiros.
 *
 * `semCredencial` sozinho não resolve bem aqui: ele apagaria a URL inteira e o
 * dono perderia a informação de onde o arquivo está. Descartar `userinfo` e
 * query string preserva o que ele quer ver e joga fora exatamente a parte onde
 * o segredo viaja.
 */
export function urlSemSegredo(bruta: string): string {
  try {
    const u = new URL(bruta);
    u.username = "";
    u.password = "";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    // Não parseou: não é URL reconhecível, então não dá para reduzir com
    // segurança. Cai no tripwire genérico.
    return semCredencial(bruta);
  }
}

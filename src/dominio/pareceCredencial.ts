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
    "sk-[a-z0-9_-]{10,}", // chave estilo OpenAI/Anthropic/Stripe
    "akia[0-9a-z]{12,}", // AWS access key id
    "gh[pousr]_[a-z0-9]{20,}", // token do GitHub (pessoal/oauth/app/instalação)
    "xox[baprs]-[a-z0-9-]{6,}", // token do Slack
    "eyj[a-z0-9_-]{10,}\\.[a-z0-9_-]{10,}", // JWT (cabeçalho.payload em base64url)
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

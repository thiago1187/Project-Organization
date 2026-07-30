// Validação de forma do corpo de PATCH /api/suggestions/:id. Só a forma —
// "estado é um dos três valores aceitos, pr_url tem o formato certo quando
// informado". *Quem* pode pedir qual transição é uma decisão de autorização,
// não de forma, e fica na rota (src/app/api/suggestions/[id]/route.ts), perto
// de `exigirSessaoDoDono` — desde que a routine parou de escrever em
// `sugestao` (docs/proximos-passos.md item 2), a rota inteira é do dono.
//
// Deliberadamente só lê `estado` e `pr_url` do corpo. Qualquer outro campo —
// em especial `aprovada_em` — é ignorado: essa coluna só é gravada pelo
// caminho de aprovação (`aprovarSugestao`, disparado com `now()` no
// servidor), nunca a partir de valor vindo do cliente.
//
// `pr_url` deixou de ser obrigatório em "feita" e de exigir github.com: sem
// execução automática, o trabalho acontece na hora, supervisionado, e pode
// nunca passar por pull request (CLAUDE.md > Convenções de trabalho). Quando
// informado, ainda precisa parecer um link — mas de qualquer origem, não só
// GitHub. O banco só passa a aceitar isso depois que
// `db/migrations/004_pr_url_opcional.sql` for aplicada.

const PR_URL_FORMATO = /^https:\/\//;
const PR_URL_TAMANHO_MAXIMO = 2048;

export type EstadoPatchSugestao = "aprovada" | "recusada" | "feita";

export interface PatchSugestaoValidado {
  estado: EstadoPatchSugestao;
  pr_url: string | null;
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** Valida o corpo de `PATCH /api/suggestions/:id`. `input` é o resultado bruto de `request.json()`. */
export function validarPatchSugestao(input: unknown): ResultadoValidacao<PatchSugestaoValidado> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { estado, pr_url } = input as Record<string, unknown>;

  if (estado !== "aprovada" && estado !== "recusada" && estado !== "feita") {
    return { ok: false, erro: 'estado precisa ser "aprovada", "recusada" ou "feita".' };
  }

  if (estado === "feita") {
    if (pr_url === undefined || pr_url === null) {
      return { ok: true, dados: { estado, pr_url: null } };
    }
    if (typeof pr_url !== "string") {
      return { ok: false, erro: "pr_url precisa ser texto quando informado." };
    }
    const aparado = pr_url.trim();
    if (aparado.length === 0) {
      return { ok: true, dados: { estado, pr_url: null } };
    }
    if (aparado.length > PR_URL_TAMANHO_MAXIMO) {
      return { ok: false, erro: `pr_url não pode passar de ${PR_URL_TAMANHO_MAXIMO} caracteres.` };
    }
    if (!PR_URL_FORMATO.test(aparado)) {
      return { ok: false, erro: 'pr_url, quando informado, precisa começar com "https://".' };
    }
    return { ok: true, dados: { estado, pr_url: aparado } };
  }

  return { ok: true, dados: { estado, pr_url: null } };
}

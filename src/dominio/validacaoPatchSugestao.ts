// Validação de forma do corpo de PATCH /api/suggestions/:id. Só a forma —
// "estado é um dos três valores aceitos, pr_url tem o formato certo quando
// exigido". *Quem* pode pedir qual transição (sessão vs. bypass da routine)
// é uma decisão de autorização, não de forma, e fica na rota
// (src/app/api/suggestions/[id]/route.ts) por perto de `exigirAcessoComOrigem`.
//
// Deliberadamente só lê `estado` e `pr_url` do corpo. Qualquer outro campo —
// em especial `aprovada_em` — é ignorado: essa coluna só é gravada pelo
// caminho de aprovação (`aprovarSugestao`, disparado com `now()` no
// servidor), nunca a partir de valor vindo do cliente.

const PR_URL_FORMATO = /^https:\/\/github\.com\//;

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
    if (typeof pr_url !== "string" || !PR_URL_FORMATO.test(pr_url)) {
      return {
        ok: false,
        erro: 'pr_url é obrigatório para estado "feita" e precisa começar com "https://github.com/".',
      };
    }
    return { ok: true, dados: { estado, pr_url } };
  }

  return { ok: true, dados: { estado, pr_url: null } };
}

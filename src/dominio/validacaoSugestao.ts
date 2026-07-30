// Validação de entrada de POST /api/suggestions — corpo enviado pela routine,
// um POST por sugestão (ver docs/routine-noturna.md, "2.4 Enviar as
// sugestões"). Espelha os CHECKs de db/migrations/001_schema_inicial.sql >
// sugestao. Sem import de banco: lógica pura, testável sem conexão.
//
// Deliberadamente não lê o campo `estado` do corpo: a rota nunca aceita
// estado vindo de fora — toda sugestão nasce "pendente" (DEFAULT da coluna).
// Isso é o que garante que ninguém, nem a própria routine, consiga criar uma
// sugestão já aprovada.

import type { Esforco, Reversibilidade } from "./tipos";

const ESFORCOS_VALIDOS: readonly Esforco[] = ["pequeno", "medio", "grande"];
const REVERSIBILIDADES_VALIDAS: readonly Reversibilidade[] = ["facil", "dificil", "nao_reverte"];

export interface DadosSugestaoValidados {
  projeto_id: string;
  agente: string;
  proposta: string;
  motivo: string;
  esforco: Esforco;
  risco: string;
  reversibilidade: Reversibilidade;
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function textoNaoVazio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Valida o corpo de `POST /api/suggestions`. `input` é o resultado bruto de `request.json()`. */
export function validarSugestao(input: unknown): ResultadoValidacao<DadosSugestaoValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade } = input as Record<
    string,
    unknown
  >;

  if (!textoNaoVazio(projeto_id)) return { ok: false, erro: "projeto_id é obrigatório." };
  if (!textoNaoVazio(agente)) return { ok: false, erro: "agente é obrigatório." };
  if (!textoNaoVazio(proposta)) return { ok: false, erro: "proposta é obrigatória." };
  if (!textoNaoVazio(motivo)) return { ok: false, erro: "motivo é obrigatório." };
  if (!textoNaoVazio(risco)) return { ok: false, erro: "risco é obrigatório." };
  if (typeof esforco !== "string" || !ESFORCOS_VALIDOS.includes(esforco as Esforco)) {
    return { ok: false, erro: `esforco precisa ser um de: ${ESFORCOS_VALIDOS.join(", ")}.` };
  }
  if (
    typeof reversibilidade !== "string" ||
    !REVERSIBILIDADES_VALIDAS.includes(reversibilidade as Reversibilidade)
  ) {
    return { ok: false, erro: `reversibilidade precisa ser um de: ${REVERSIBILIDADES_VALIDAS.join(", ")}.` };
  }

  return {
    ok: true,
    dados: {
      projeto_id: projeto_id.trim(),
      agente: agente.trim(),
      proposta: proposta.trim(),
      motivo: motivo.trim(),
      esforco: esforco as Esforco,
      risco: risco.trim(),
      reversibilidade: reversibilidade as Reversibilidade,
    },
  };
}

// Validação de entrada de POST /api/reports — corpo enviado pela routine
// (ver docs/routine-noturna.md, "2.3 Enviar o relatório"). Dado de processo
// automatizado falha de formas estranhas sem ninguém olhando, então valida de
// verdade: tipo, campo faltando, valor fora do CHECK do banco. Espelha os
// CHECKs de db/migrations/001_schema_inicial.sql > relatorio. Sem import de
// banco: lógica pura, testável sem conexão.
//
// achados_por_agente é jsonb e o banco só garante que é array (CHECK
// relatorio_achados_e_array) — este é o único lugar onde dá para validar a
// forma de cada item antes de gravar. Um item malformado aqui derrubaria a
// tela inteira depois, não só a linha ruim.

import type { AchadoAgente, StatusRelatorio } from "./tipos";

const STATUS_VALIDOS: readonly StatusRelatorio[] = ["ok", "atencao", "falha"];

export interface DadosRelatorioValidados {
  projeto_id: string;
  status: StatusRelatorio;
  resumo: string;
  testes_passaram: boolean | null;
  achados_por_agente: AchadoAgente[];
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function textoNaoVazio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validarAchado(item: unknown, indice: number): ResultadoValidacao<AchadoAgente> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return { ok: false, erro: `achados_por_agente[${indice}] precisa ser um objeto.` };
  }
  const { agente, achado, selo } = item as Record<string, unknown>;
  if (!textoNaoVazio(agente)) {
    return { ok: false, erro: `achados_por_agente[${indice}].agente precisa ser texto não vazio.` };
  }
  if (!textoNaoVazio(achado)) {
    return { ok: false, erro: `achados_por_agente[${indice}].achado precisa ser texto não vazio.` };
  }
  if (!textoNaoVazio(selo)) {
    return { ok: false, erro: `achados_por_agente[${indice}].selo precisa ser texto não vazio.` };
  }
  return {
    ok: true,
    // Só os três campos documentados entram — qualquer chave a mais no item
    // enviado é descartada, não gravada como veio.
    dados: {
      agente: agente.trim(),
      achado: achado.trim(),
      selo: selo.trim(),
    },
  };
}

/** Valida o corpo de `POST /api/reports`. `input` é o resultado bruto de `request.json()`. */
export function validarRelatorio(input: unknown): ResultadoValidacao<DadosRelatorioValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { projeto_id, status, resumo, testes_passaram, achados_por_agente } = input as Record<string, unknown>;

  if (!textoNaoVazio(projeto_id)) {
    return { ok: false, erro: "projeto_id é obrigatório." };
  }
  if (typeof status !== "string" || !STATUS_VALIDOS.includes(status as StatusRelatorio)) {
    return { ok: false, erro: `status precisa ser um de: ${STATUS_VALIDOS.join(", ")}.` };
  }
  if (!textoNaoVazio(resumo)) {
    return { ok: false, erro: "resumo é obrigatório." };
  }
  if (testes_passaram !== undefined && testes_passaram !== null && typeof testes_passaram !== "boolean") {
    return { ok: false, erro: "testes_passaram precisa ser true, false ou null." };
  }
  if (achados_por_agente !== undefined && !Array.isArray(achados_por_agente)) {
    return { ok: false, erro: "achados_por_agente precisa ser um array." };
  }

  const bruto = (achados_por_agente as unknown[] | undefined) ?? [];
  const achadosValidados: AchadoAgente[] = [];
  for (let i = 0; i < bruto.length; i++) {
    const resultado = validarAchado(bruto[i], i);
    if (!resultado.ok) return resultado;
    achadosValidados.push(resultado.dados);
  }

  return {
    ok: true,
    dados: {
      projeto_id: projeto_id.trim(),
      status: status as StatusRelatorio,
      resumo: resumo.trim(),
      testes_passaram: testes_passaram ?? null,
      achados_por_agente: achadosValidados,
    },
  };
}

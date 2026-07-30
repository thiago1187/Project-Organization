// Mapeamento entre as quatro faixas do quadro/configuração e as colunas reais do
// schema (projeto.frequencia + projeto.ativo). Ver plano de conversão §2.9:
// "pausar não muda a frequência configurada, só interrompe as rodadas" — por isso
// "pausado" não é um quarto valor de Frequencia, é ativo = false com qualquer
// frequência por baixo. Este é o único lugar do código que faz essa tradução.

import type { Frequencia, Projeto } from "./tipos";

export type Faixa = "diaria" | "alternada" | "semanal" | "pausado";

export const ORDEM_FAIXAS: Faixa[] = ["diaria", "alternada", "semanal", "pausado"];

const FREQUENCIA_DA_FAIXA: Record<Exclude<Faixa, "pausado">, Frequencia> = {
  diaria: "toda_madrugada",
  alternada: "dias_alternados",
  semanal: "semanal",
};

/** A faixa em que um projeto aparece no quadro, derivada de frequencia + ativo. */
export function faixaDoProjeto(p: Pick<Projeto, "frequencia" | "ativo">): Faixa {
  if (!p.ativo) return "pausado";
  switch (p.frequencia) {
    case "toda_madrugada":
      return "diaria";
    case "dias_alternados":
      return "alternada";
    case "semanal":
      return "semanal";
  }
}

export type PatchCadencia = { ativo: false } | { ativo: true; frequencia: Frequencia };

/**
 * O que gravar em projeto quando o usuário solta um card (ou escolhe um botão) na
 * faixa `alvo`. Soltar em "Pausado" só muda `ativo`. Soltar fora de "Pausado" muda
 * `ativo` para true **e** grava a frequência da faixa de destino — porque o gesto
 * já disse qual o usuário quer (plano §2.9).
 */
export function patchParaFaixa(alvo: Faixa): PatchCadencia {
  if (alvo === "pausado") return { ativo: false };
  return { ativo: true, frequencia: FREQUENCIA_DA_FAIXA[alvo] };
}

export const FAIXA_META: Record<Faixa, { titulo: string; nota: string }> = {
  diaria: { titulo: "Toda madrugada", nota: "rodada completa todas as noites" },
  alternada: { titulo: "Dias alternados", nota: "segunda, quarta e sexta" },
  semanal: { titulo: "Uma vez por semana", nota: "só a checagem de segurança e testes" },
  pausado: { titulo: "Pausado", nota: "agentes não visitam nem atualizam a etapa" },
};

/** Rótulo usado no crachá de status da tela de detalhe ("toda madrugada"). */
export const FAIXA_LABEL_LONGO: Record<Faixa, string> = {
  diaria: "toda madrugada",
  alternada: "dias alternados",
  semanal: "semanal",
  pausado: "pausado",
};

/** Rótulo curto usado nos botões de escolha da tela de configuração. */
export const FAIXA_LABEL_CURTO: Record<Faixa, string> = {
  diaria: "diária",
  alternada: "alternada",
  semanal: "semanal",
  pausado: "pausado",
};

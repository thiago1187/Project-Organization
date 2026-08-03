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

// As notas descrevem o que a rodada **faz**, e antes descreviam uma rodada que
// não existe: "segunda, quarta e sexta" e "só a checagem de segurança e
// testes". Nenhuma das duas era verdade.
//
// A regra real está em docs/routine-noturna.md, passo 1: a rodada não olha o
// calendário, olha a **idade do último relatório** — 40 horas para alternada,
// 6 dias para semanal. E roda a esteira **inteira** nas três faixas; a
// frequência muda quando ela visita, nunca o que ela faz quando visita.
//
// Isso importa porque o dono lê essas frases na primeira tela e decide a
// cadência de um projeto a partir delas. Acreditar que semanal recebe uma
// checagem mais leve é escolher semanal por um motivo que não existe.
//
// Quem editar estas frases: confira o passo 1 daquele documento antes, senão
// troca uma frase errada por outra.
export const FAIXA_META: Record<Faixa, { titulo: string; nota: string }> = {
  diaria: { titulo: "Toda madrugada", nota: "a esteira inteira, toda noite" },
  alternada: {
    titulo: "Dias alternados",
    nota: "a esteira inteira, quando a última rodada passa de 40 horas",
  },
  semanal: {
    titulo: "Uma vez por semana",
    nota: "a esteira inteira, quando a última rodada passa de 6 dias",
  },
  pausado: { titulo: "Pausado", nota: "a rodada não visita este projeto" },
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

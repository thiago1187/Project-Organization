// O sugestor de agentes — docs/plano-gerenciador-de-projeto.md § 4. Módulo
// puro, sem banco e sem rede, testável como esteiraAgentes.ts já é. Recebe o
// que a tela de detalhe de um projeto já carrega (inventário, esteira,
// histórico de relatórios e sugestões, todos já filtrados para aquele
// projeto) e devolve uma lista de agentes que valeria ligar, cada um com o
// porquê visível — sugestão sem motivo é palpite.
//
// Duas correções do enunciado original, e as duas importam (ver o plano):
//
// 1. Só regra por presença, nunca por ausência. Um inventário vazio — o caso
//    mais comum hoje, porque é preenchido à mão — não pode disparar todas as
//    regras de "não tem X" de uma vez. Cada regra aqui parte de algo que
//    EXISTE (um serviço cadastrado, um achado já registrado), nunca da
//    ausência de uma linha.
// 2. Sugere-se só agente sem linha em `projeto_agente` para este projeto.
//    Ligar cria a linha; desligar grava `habilitado = false` — e é essa
//    linha que impede o sugestor de insistir (alternarAgenteProjeto,
//    src/servidor/agentesProjeto.ts, já faz upsert nos dois sentidos). Assim
//    que o dono toca no agente, em qualquer direção, o sugestor cala a boca
//    sobre ele.
//
// Duas famílias de regra, em ordem de qualidade do sinal:
//
// (a) Histórico do próprio projeto — o sinal mais forte, e já está no banco
//     de graça. Um agente que aparece em achados_por_agente ou produziu
//     sugestão aqui, mas nunca ganhou uma linha em projeto_agente, rodou por
//     fora da esteira configurável (ex.: fazia parte da lista fixa de antes
//     dela existir) — ligar formaliza o que já está acontecendo.
// (b) Inventário — o sinal de partida a frio. `stack`/`servico` sugerem
//     quem diagnosticaria melhor um projeto com aquele serviço, mesmo sem
//     nenhuma rodada ainda.
//
// A restrição que define o formato de saída: `agenteEhDeLeitura`
// (esteiraAgentes.ts) já é a regra da esteira — só agente de leitura entra
// nela, porque quem estiver lá é acionado às 3h sem ninguém para barrar.
// Agente de escrita, quando faz sentido sugerir, sai por outra porta: uma
// linha para o prompt gerado, nunca um botão que liga nada.

import { agenteEhDeLeitura } from "./esteiraAgentes";
import type { CategoriaServico, ProjetoAgente, Relatorio, Servico, Stack, Sugestao } from "./tipos";

export type DestinoSugestaoAgente = "esteira" | "prompt";

export interface SugestaoAgenteVM {
  agente: string;
  destino: DestinoSugestaoAgente;
  /** Por que este agente foi sugerido — sempre visível, nunca um palpite sem evidência. */
  porque: string;
}

export interface EntradaSugestorAgentes {
  /** A esteira já configurada deste projeto — usada só para saber quem já tem linha. */
  agentesProjeto: ProjetoAgente[];
  stack: Stack[];
  servico: Servico[];
  relatorios: Relatorio[];
  sugestoes: Sugestao[];
}

function destinoDoAgente(agente: string): DestinoSugestaoAgente {
  return agenteEhDeLeitura(agente) ? "esteira" : "prompt";
}

// Mapa de categoria → candidatos, na forma (agente, motivo-base). A
// categoria só entra aqui se `servico.categoria` (lista fechada, migration
// 002) realmente indicar o papel do agente — ver docs/plano-gerenciador-de-
// projeto.md § 4.2 para a tabela completa e o porquê de cada linha.
const CANDIDATOS_POR_CATEGORIA: Record<CategoriaServico, string[]> = {
  modelo: ["avaliador-ia", "engenheiro-ia"],
  hospedagem: ["devops-deploy"],
  banco: ["revisor-performance", "engenheiro-dados"],
  autenticacao: ["revisor-seguranca"],
  storage: [],
  email: [],
};

/**
 * Regra (a): agente que já apareceu no histórico deste projeto (achado de
 * rodada, ou autor de uma sugestão, aprovada ou não) mas nunca ganhou linha
 * em `projeto_agente`. Presença, não ausência: o agente rodou de verdade.
 */
function candidatosPorHistorico(
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
): Map<string, { achados: number; aprovadas: number }> {
  const contagem = new Map<string, { achados: number; aprovadas: number }>();

  function linha(agente: string) {
    let atual = contagem.get(agente);
    if (!atual) {
      atual = { achados: 0, aprovadas: 0 };
      contagem.set(agente, atual);
    }
    return atual;
  }

  for (const r of relatorios) {
    for (const a of r.achados_por_agente) {
      linha(a.agente).achados += 1;
    }
  }
  for (const s of sugestoes) {
    if (s.estado === "aprovada" || s.estado === "feita") {
      linha(s.agente).aprovadas += 1;
    }
  }

  return contagem;
}

function porqueHistorico(achados: number, aprovadas: number): string {
  const partes: string[] = [];
  if (achados > 0) partes.push(`${achados} ${achados === 1 ? "achado" : "achados"} já registrado`);
  if (aprovadas > 0) {
    partes.push(`${aprovadas} ${aprovadas === 1 ? "sugestão aprovada" : "sugestões aprovadas"}`);
  }
  return `já rodou neste projeto — ${partes.join(" e ")}, mas não está na esteira`;
}

function porqueInventario(servicosDaCategoria: Servico[]): string {
  const nomes = [...new Set(servicosDaCategoria.map((s) => s.nome))];
  return `este projeto usa ${nomes.join(", ")}`;
}

/**
 * Deriva a lista de agentes que valeria ligar (esteira) ou convocar (prompt)
 * para este projeto — sempre com o motivo visível. Nunca sugere um agente
 * que já tem linha em `projeto_agente`, ligado ou dispensado: essa linha é o
 * que o dono já decidiu, e é ela que faz o sugestor calar a boca.
 */
export function sugerirAgentes(entrada: EntradaSugestorAgentes): SugestaoAgenteVM[] {
  const nomesComLinha = new Set(entrada.agentesProjeto.map((a) => a.agente));
  const sugestoes = new Map<string, SugestaoAgenteVM>();

  // (a) Histórico — sinal mais forte, checado primeiro: se um agente já
  // aparece aqui por evidência real, a sugestão dele não precisa do
  // inventário para ganhar motivo.
  const historico = candidatosPorHistorico(entrada.relatorios, entrada.sugestoes);
  for (const [agente, { achados, aprovadas }] of historico) {
    if (nomesComLinha.has(agente)) continue;
    sugestoes.set(agente, {
      agente,
      destino: destinoDoAgente(agente),
      porque: porqueHistorico(achados, aprovadas),
    });
  }

  // (b) Inventário — sinal de partida a frio, só complementa o que o
  // histórico ainda não cobriu.
  const servicosPorCategoria = new Map<CategoriaServico, Servico[]>();
  for (const s of entrada.servico) {
    const atual = servicosPorCategoria.get(s.categoria) ?? [];
    atual.push(s);
    servicosPorCategoria.set(s.categoria, atual);
  }

  for (const [categoria, servicosDaCategoria] of servicosPorCategoria) {
    for (const agente of CANDIDATOS_POR_CATEGORIA[categoria]) {
      if (nomesComLinha.has(agente) || sugestoes.has(agente)) continue;
      sugestoes.set(agente, {
        agente,
        destino: destinoDoAgente(agente),
        porque: porqueInventario(servicosDaCategoria),
      });
    }
  }

  return [...sugestoes.values()].sort((a, b) => a.agente.localeCompare(b.agente));
}

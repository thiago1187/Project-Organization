// Modelo de visão da esteira de agentes (tela de detalhe do projeto) —
// docs/plano-agentes-por-projeto.md § 2.3. Deriva as duas metades da esteira
// (ativos, na ordem gravada; inativos, o resto do catálogo) a partir das
// linhas de `projeto_agente`. Nenhuma cor hexadecimal aqui — mesma regra do
// cabeçalho de visao.ts.
//
// A banda de execução (§ 2.3, "espelho, não formulário") não tem view model
// aqui: ela é derivada de `sugestao` (aprovadas), que já tem `SugestaoVM` em
// visao.ts — a esteira só reaproveita esse tipo, não duplica a derivação.

import type { AgentePadrao, ProjetoAgente } from "./tipos";
import { chipDoAgente, type ChipVM } from "./visao";
import { papelDoAgente } from "./papeis";
import { AGENTES_CONHECIDOS } from "./agentesConhecidos";
import { mapaAgentesPadrao } from "./agentePadrao";

export interface AgenteEsteiraVM extends ChipVM {
  agente: string;
  ordem: number;
  /** Override deste projeto — `null` quando o card nunca foi editado aqui. */
  instrucao: string | null;
  tetoSugestoes: number | null;
  /**
   * O padrão global deste agente (`agente_padrao`), só para a UI mostrar
   * "usando o padrão do agente" quando `instrucao`/`tetoSugestoes` acima
   * estão vazios — nunca combinado com eles aqui. O valor que de fato vale
   * (override senão padrão) é `resolverConfiguracaoAgente`
   * (src/dominio/agentePadrao.ts), usado em GET /api/projects, não neste VM.
   */
  instrucaoPadrao: string | null;
  tetoPadrao: number | null;
}

export interface EsteiraVM {
  /** habilitado = true, na ordem gravada (desempate alfabético — `ordem` não tem UNIQUE, ver migration 005). */
  ativos: AgenteEsteiraVM[];
  /** O resto do catálogo conhecido, mais qualquer agente desligado que ainda guarda instrução/teto — ordem alfabética. */
  inativos: AgenteEsteiraVM[];
}

function linhaParaVM(
  l: {
    agente: string;
    ordem: number;
    instrucao: string | null;
    teto_sugestoes: number | null;
  },
  padrao: AgentePadrao | undefined,
): AgenteEsteiraVM {
  return {
    agente: l.agente,
    ordem: l.ordem,
    instrucao: l.instrucao,
    tetoSugestoes: l.teto_sugestoes,
    instrucaoPadrao: padrao?.instrucao ?? null,
    tetoPadrao: padrao?.teto_sugestoes ?? null,
    ...chipDoAgente(l.agente),
  };
}

/** As linhas habilitadas de um conjunto, na ordem gravada — mesma regra que `GET /api/projects` aplica. */
export function agentesAtivosOrdenados(linhas: ProjetoAgente[]): ProjetoAgente[] {
  return linhas
    .filter((l) => l.habilitado)
    .slice()
    .sort((a, b) => a.ordem - b.ordem || a.agente.localeCompare(b.agente));
}

/**
 * Monta as duas metades da esteira de um projeto. `linhas` já vem filtrada
 * por projeto (ver `listarAgentesDoProjeto`, src/servidor/agentesProjeto.ts).
 * Um agente do catálogo (`AGENTES_CONHECIDOS`) que nunca foi tocado neste
 * projeto aparece em `inativos` como uma linha "virtual" (sem instrução, sem
 * teto) — é o mesmo raciocínio de `AGENTES_CONHECIDOS` em
 * src/componentes/FormNovoContexto.tsx: sugestão de UI, não um registro que
 * precisa existir no banco antes de aparecer na tela.
 */
/**
 * Um agente pode ser acionado pela rodada noturna? Só os de leitura.
 *
 * `papeis.ts` classifica cada um dos 16. A rodada é somente leitura por
 * desenho — ver "Limites absolutos" em docs/routine-noturna.md — e habilitar
 * um agente de escrita na esteira o faria rodar lá dentro sem supervisão.
 */
export function agenteEhDeLeitura(nome: string): boolean {
  return papelDoAgente(nome).tipo === "leitura";
}

/**
 * `padroes` é opcional (default `[]`) para não quebrar quem já chama
 * `montarEsteira` sem padrão nenhum — a migration 012 pode ainda não estar
 * aplicada, e sem linha nenhuma o resultado é idêntico a hoje (todo
 * `instrucaoPadrao`/`tetoPadrao` fica `null`).
 */
export function montarEsteira(linhas: ProjetoAgente[], padroes: readonly AgentePadrao[] = []): EsteiraVM {
  const mapaPadroes = mapaAgentesPadrao(padroes);
  const ativos = agentesAtivosOrdenados(linhas).map((l) => linhaParaVM(l, mapaPadroes.get(l.agente)));

  // Só agente de leitura pode ser oferecido. A rodada noturna não escreve em
  // lugar nenhum, e quem for habilitado aqui é acionado por ela às 3h, sem
  // ninguém para barrar nada. Oferecer `dev-backend` ou `engenheiro-dados`
  // nesta lista seria reabrir por arrastar de card o caminho de escrita
  // automática que o fim da execução acabou de fechar.
  //
  // A validação de verdade está na Server Action — esta linha é conveniência
  // de tela. Filtro só na UI é filtro nenhum.
  const desligadosComLinha = linhas
    .filter((l) => !l.habilitado && agenteEhDeLeitura(l.agente))
    .map((l) => linhaParaVM(l, mapaPadroes.get(l.agente)));
  const nomesComLinha = new Set(linhas.map((l) => l.agente));
  const semLinha = AGENTES_CONHECIDOS.filter((a) => !nomesComLinha.has(a) && agenteEhDeLeitura(a)).map((agente) =>
    linhaParaVM({ agente, ordem: 0, instrucao: null, teto_sugestoes: null }, mapaPadroes.get(agente)),
  );

  const inativos = [...desligadosComLinha, ...semLinha].sort((a, b) => a.agente.localeCompare(b.agente));

  return { ativos, inativos };
}

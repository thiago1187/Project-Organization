// Ficha de agente — a tripulação do painel, "como se fossem pessoas" (pedido
// do dono, tela /agentes). Deriva de quatro fontes que já existem, nenhuma
// tabela nova e nenhuma coluna nova:
//   - `PAPEIS` (src/dominio/papeis.ts) — quem é, crachá, papel, leitura/escrita.
//   - `relatorio.achados_por_agente`, de todos os relatórios — o que encontrou.
//   - `sugestao.agente` — o que propôs, e o estado de cada proposta.
//   - `projeto_agente` — em quais projetos está ligado na esteira, com que instrução.
//
// A reputação (taxa de aprovação) é o número que este arquivo existe para
// calcular: das sugestões do agente que o dono já decidiu (aprovada, recusada
// ou feita — não conta pendente, que ainda não é decisão), quantas ele
// aprovou. "Feita" conta como aprovada porque só se chega lá depois de
// aprovada; "decididas === 0" devolve `taxaPct: null` de propósito — taxa
// sobre zero decisão não é taxa, é ruído (ver `FichaAgenteVM.reputacao`).
//
// Mesmo padrão de derivação pura de src/dominio/visao.ts: view model
// calculado aqui, a tela só lê. Nenhuma cor hexadecimal — sempre
// `chipDoAgente`/`var(--token)`.

import type { Projeto, ProjetoAgente, Relatorio, Sugestao } from "./tipos";
import {
  chipDoAgente,
  ESTADO_SUGESTAO_COR,
  ESTADO_SUGESTAO_LABEL,
  formatarDataCurta,
  type ChipVM,
} from "./visao";
import { PAPEIS, papelDoAgente } from "./papeis";

// ─────────────────────────────────────────────────────────────────────────
// Reputação.
// ─────────────────────────────────────────────────────────────────────────

export interface ReputacaoVM {
  /** Quantas propostas decididas foram aprovadas (inclui as já marcadas "feita"). */
  aprovadas: number;
  /** Propostas com decisão do dono — pendente não conta, ainda não é decisão. */
  decididas: number;
  /** null quando `decididas === 0` — sem decisão real, não há taxa para mostrar. */
  taxaPct: number | null;
}

function reputacaoDoAgente(nome: string, sugestoes: Sugestao[]): ReputacaoVM {
  const decididas = sugestoes.filter((s) => s.agente === nome && s.estado !== "pendente");
  const aprovadas = decididas.filter((s) => s.estado === "aprovada" || s.estado === "feita");
  return {
    aprovadas: aprovadas.length,
    decididas: decididas.length,
    taxaPct: decididas.length === 0 ? null : Math.round((aprovadas.length / decididas.length) * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Quem existe. `PAPEIS` é a base (os 16 agentes conhecidos, sempre
// mostrados mesmo sem histórico); qualquer nome livre encontrado nos dados
// (achado, sugestão ou linha de projeto_agente) entra também — um agente
// desconhecido não deve desaparecer da tripulação só porque não está na
// tabela de apresentação (mesmo raciocínio do retorno padrão de
// `papelDoAgente`).
// ─────────────────────────────────────────────────────────────────────────

function nomesConhecidos(relatorios: Relatorio[], sugestoes: Sugestao[], agentesProjeto: ProjetoAgente[]): string[] {
  const nomes = new Set<string>(Object.keys(PAPEIS));
  for (const r of relatorios) for (const a of r.achados_por_agente) nomes.add(a.agente);
  for (const s of sugestoes) nomes.add(s.agente);
  for (const pa of agentesProjeto) nomes.add(pa.agente);
  return [...nomes];
}

// ─────────────────────────────────────────────────────────────────────────
// Ficha resumida — o card da tela de lista.
// ─────────────────────────────────────────────────────────────────────────

export interface FichaAgenteVM extends ChipVM {
  agente: string;
  reputacao: ReputacaoVM;
  totalAchados: number;
  totalSugestoes: number;
  /** Projetos onde está ligado na esteira agora (habilitado = true), ordem alfabética. */
  projetosAtivos: { id: string; nome: string }[];
  ultimaAtividadeLabel: string | null;
  /** ISO da atividade mais recente (achado ou sugestão) — só para ordenar a lista; a tela usa o label. */
  ultimaAtividadeIso: string | null;
}

export function fichaDoAgente(
  nome: string,
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  agentesProjeto: ProjetoAgente[],
): FichaAgenteVM {
  const achados = relatorios.flatMap((r) =>
    r.achados_por_agente.filter((a) => a.agente === nome).map((a) => ({ achado: a, executadoEm: r.executado_em })),
  );
  const sugestoesDoAgente = sugestoes.filter((s) => s.agente === nome);
  const projetosPorId = new Map(projetos.map((p) => [p.id, p]));

  const projetosAtivos = agentesProjeto
    .filter((pa) => pa.agente === nome && pa.habilitado)
    .map((pa) => projetosPorId.get(pa.projeto_id))
    .filter((p): p is Projeto => !!p)
    .map((p) => ({ id: p.id, nome: p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const datas = [...achados.map((a) => a.executadoEm), ...sugestoesDoAgente.map((s) => s.criada_em)].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );
  const ultimaAtividadeIso = datas[0] ?? null;

  return {
    agente: nome,
    ...chipDoAgente(nome),
    reputacao: reputacaoDoAgente(nome, sugestoes),
    totalAchados: achados.length,
    totalSugestoes: sugestoesDoAgente.length,
    projetosAtivos,
    ultimaAtividadeLabel: ultimaAtividadeIso ? formatarDataCurta(ultimaAtividadeIso) : null,
    ultimaAtividadeIso,
  };
}

export interface AgentesListaVM {
  /** Rodam sozinhos, de madrugada — a esteira só pode ligar estes. */
  leitura: FichaAgenteVM[];
  /** Só trabalham com o dono presente. */
  escrita: FichaAgenteVM[];
}

function ordenarPorAtividade(a: FichaAgenteVM, b: FichaAgenteVM): number {
  if (a.ultimaAtividadeIso && b.ultimaAtividadeIso) {
    return new Date(b.ultimaAtividadeIso).getTime() - new Date(a.ultimaAtividadeIso).getTime();
  }
  if (a.ultimaAtividadeIso) return -1;
  if (b.ultimaAtividadeIso) return 1;
  return a.agente.localeCompare(b.agente);
}

/**
 * A tripulação inteira, dividida em quem diagnostica e quem escreve — ordem
 * dentro de cada grupo é "quem anda ativo" primeiro (mais recente no topo),
 * quem nunca rodou por último, em ordem alfabética entre si.
 */
export function montarListaAgentes(
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  agentesProjeto: ProjetoAgente[],
): AgentesListaVM {
  const fichas = nomesConhecidos(relatorios, sugestoes, agentesProjeto)
    .sort((a, b) => a.localeCompare(b))
    .map((nome) => fichaDoAgente(nome, projetos, relatorios, sugestoes, agentesProjeto));

  return {
    leitura: fichas.filter((f) => papelDoAgente(f.agente).tipo === "leitura").sort(ordenarPorAtividade),
    escrita: fichas.filter((f) => papelDoAgente(f.agente).tipo === "escrita").sort(ordenarPorAtividade),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ficha detalhada — a página de um agente.
// ─────────────────────────────────────────────────────────────────────────

export interface AchadoHistoricoVM {
  projetoId: string;
  projetoNome: string;
  dataLabel: string;
  achado: string;
  selo: string;
}

export interface SugestaoHistoricoVM {
  id: string;
  projetoId: string;
  projetoNome: string;
  proposta: string;
  estadoLabel: string;
  estadoCor: string;
  dataLabel: string;
}

export interface ProjetoLigadoVM {
  id: string;
  nome: string;
  instrucao: string | null;
}

export interface FichaAgenteDetalheVM extends FichaAgenteVM {
  /** Mais recente primeiro. */
  historicoAchados: AchadoHistoricoVM[];
  /** Mais recente primeiro. */
  historicoSugestoes: SugestaoHistoricoVM[];
  /** Só os projetos onde está ligado (habilitado = true) — com a instrução, se houver. */
  projetosLigados: ProjetoLigadoVM[];
}

/**
 * `nome` some da tripulação (não é `PAPEIS`, nunca apareceu num achado, numa
 * sugestão nem numa linha de `projeto_agente`) devolve `null` — a rota chama
 * `notFound()`. Existir na tripulação não exige ter histórico: um agente
 * conhecido sem nenhum dado ainda tem ficha, só que vazia.
 */
export function fichaDetalheDoAgente(
  nome: string,
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  agentesProjeto: ProjetoAgente[],
): FichaAgenteDetalheVM | null {
  const conhecido = nome in PAPEIS || nomesConhecidos(relatorios, sugestoes, agentesProjeto).includes(nome);
  if (!conhecido) return null;

  const base = fichaDoAgente(nome, projetos, relatorios, sugestoes, agentesProjeto);
  const projetosPorId = new Map(projetos.map((p) => [p.id, p]));

  const historicoAchados: AchadoHistoricoVM[] = relatorios
    .flatMap((r) => r.achados_por_agente.filter((a) => a.agente === nome).map((a) => ({ r, a })))
    .sort((x, y) => new Date(y.r.executado_em).getTime() - new Date(x.r.executado_em).getTime())
    .map(({ r, a }) => ({
      projetoId: r.projeto_id,
      projetoNome: projetosPorId.get(r.projeto_id)?.nome ?? "projeto removido",
      dataLabel: formatarDataCurta(r.executado_em),
      achado: a.achado,
      selo: a.selo,
    }));

  const historicoSugestoes: SugestaoHistoricoVM[] = sugestoes
    .filter((s) => s.agente === nome)
    .slice()
    .sort((a, b) => new Date(b.criada_em).getTime() - new Date(a.criada_em).getTime())
    .map((s) => ({
      id: s.id,
      projetoId: s.projeto_id,
      projetoNome: projetosPorId.get(s.projeto_id)?.nome ?? "projeto removido",
      proposta: s.proposta,
      estadoLabel: ESTADO_SUGESTAO_LABEL[s.estado],
      estadoCor: ESTADO_SUGESTAO_COR[s.estado],
      dataLabel: formatarDataCurta(s.criada_em),
    }));

  const projetosLigados: ProjetoLigadoVM[] = agentesProjeto
    .filter((pa) => pa.agente === nome && pa.habilitado)
    .map((pa) => ({
      id: pa.projeto_id,
      nome: projetosPorId.get(pa.projeto_id)?.nome ?? "projeto removido",
      instrucao: pa.instrucao,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return { ...base, historicoAchados, historicoSugestoes, projetosLigados };
}

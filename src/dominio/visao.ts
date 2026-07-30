// Modelos de visão (o que o template consome) e as funções que os derivam das
// linhas de tabela (Projeto, Relatorio, Sugestao, Contexto). Nenhuma cor aqui é
// hexadecimal — sempre "var(--token)", os 28 tokens de src/app/globals.css.
//
// Três blocos do export não têm origem no modelo de dados (plano §2.8): o painel
// "onde estamos" (etapa), a lista de acessos, e — parcialmente — os documentos
// (o texto "local", ex. "Notion", não tem coluna; aqui é derivado do hostname da
// URL, não inventado). Os tipos EtapaMock e AcessoMock, abaixo, marcam esse limite
// explicitamente: as funções que os consomem recebem essas linhas como parâmetro,
// nunca as leem de uma tabela.

import type {
  Projeto,
  Relatorio,
  Sugestao,
  Contexto,
  StatusRelatorio,
  Esforco,
  Reversibilidade,
  EstadoSugestao,
} from "./tipos";
import { type Faixa, faixaDoProjeto, FAIXA_META, FAIXA_LABEL_LONGO, ORDEM_FAIXAS } from "./cadencia";
import { papelDoAgente } from "./papeis";

// ─────────────────────────────────────────────────────────────────────────
// Sem origem no schema (plano §2.8) — tipos das linhas de mock "cruas".
// ─────────────────────────────────────────────────────────────────────────

export interface EtapaMock {
  titulo: string;
  selo: string;
  contador: string;
  autor: string;
  atualizado: string;
  dias: number;
  resumo: string;
  proximos: string[];
}

/** Sem campo de valor — ver plano §2.11 e CLAUDE.md, regra de segurança 1. */
export interface AcessoMock {
  rotulo: string;
  escopo: string;
  gerido: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Rótulos e cores fixos (equivalentes aos objetos LABEL/COR/PESO do export).
// ─────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusRelatorio, string> = {
  ok: "tudo ok",
  atencao: "PR aberto",
  falha: "falha",
};

const STATUS_COR: Record<StatusRelatorio, string> = {
  ok: "var(--ok)",
  atencao: "var(--atn)",
  falha: "var(--fal)",
};

const STATUS_PESO: Record<StatusRelatorio, number> = { falha: 0, atencao: 1, ok: 2 };

const SELO_COR: Record<string, string> = {
  travado: "var(--fal)",
  "aguardando você": "var(--atn)",
  "em andamento": "var(--ok)",
  estável: "var(--ok)",
  pausado: "var(--mut2)",
};

// ─────────────────────────────────────────────────────────────────────────
// Datas: "agora" fica fixo em 29 jul 2026 nesta etapa (plano §6, risco
// "agora e saudação fixos") — calcular no servidor traria divergência de
// hidratação. Os timestamps do mock usam o formato ISO com offset
// "-03:00"; o parser abaixo lê os dígitos direto da string em vez de
// passar por Date/getHours(), que devolveria a hora local do processo que
// renderiza (o servidor pode rodar em outro fuso) — o objetivo aqui é
// mostrar exatamente a hora gravada, não convertê-la.
// ─────────────────────────────────────────────────────────────────────────

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const HOJE = { dia: 29, mes: 7 };

function partesISO(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) throw new Error(`timestamp inválido: ${iso}`);
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]), hora: m[4], minuto: m[5] };
}

function formatarHora(iso: string): string {
  const p = partesISO(iso);
  return `${p.hora}:${p.minuto}`;
}

function formatarDataCurta(iso: string): string {
  const p = partesISO(iso);
  return `${p.dia} ${MESES[p.mes - 1]}`;
}

/** "03:12" se for hoje (29 jul), senão "12 jul, 03:02" — igual ao p.ultimaRodada do export. */
function formatarUltimaRodada(iso: string): string {
  const p = partesISO(iso);
  if (p.dia === HOJE.dia && p.mes === HOJE.mes) return formatarHora(iso);
  return `${formatarDataCurta(iso)}, ${formatarHora(iso)}`;
}

/**
 * Divergência aceita em relação ao export: `relatorio` guarda um único instante
 * (`executado_em`), não uma janela início–fim — não existe coluna para o horário
 * de início. O export mostrava "02:40 – 03:12"; aqui mostramos só a conclusão.
 */
function formatarConcluida(iso: string): string {
  return `concluída às ${formatarHora(iso)}`;
}

function hostnameCurto(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Chip de agente (o "crachá" de duas letras + rótulo escreve/só leitura).
// ─────────────────────────────────────────────────────────────────────────

export interface ChipVM {
  mono: string;
  papel: string;
  tipoLabel: string;
  corTipo: string;
  bg: string;
  fg: string;
  borda: string;
}

function chipDoAgente(nomeAgente: string): ChipVM {
  const papel = papelDoAgente(nomeAgente);
  const escrita = papel.tipo === "escrita";
  return {
    mono: papel.mono,
    papel: papel.papel,
    tipoLabel: escrita ? "escreve" : "só leitura",
    corTipo: escrita ? "var(--tipo-forte)" : "var(--mut3)",
    bg: escrita ? "var(--chip-bg-esc)" : "var(--chip-bg)",
    fg: "var(--chip-fg)",
    borda: escrita ? "var(--chip-borda-esc)" : "var(--chip-borda)",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Consultas auxiliares (equivalentes ao que viraria SELECT depois).
// ─────────────────────────────────────────────────────────────────────────

function relatoriosDoProjeto(projetoId: string, relatorios: Relatorio[]): Relatorio[] {
  return relatorios
    .filter((r) => r.projeto_id === projetoId)
    .slice()
    .sort((a, b) => new Date(b.executado_em).getTime() - new Date(a.executado_em).getTime());
}

function ultimoRelatorio(projetoId: string, relatorios: Relatorio[]): Relatorio | undefined {
  return relatoriosDoProjeto(projetoId, relatorios)[0];
}

// ─────────────────────────────────────────────────────────────────────────
// Visão geral (home): card de projeto + faixas + totais.
// ─────────────────────────────────────────────────────────────────────────

export interface ProjetoCardVM {
  id: string;
  nome: string;
  resumo: string;
  statusLabel: string;
  cor: string;
  faixa: Faixa;
  cadenciaLabelLongo: string;
  testesCurto: string;
  corTestes: string;
  ultimaRodadaLabel: string;
  strip: ChipVM[];
  status: StatusRelatorio | null; // null = nenhuma rodada ainda registrada
}

export function cardsProjetos(projetos: Projeto[], relatorios: Relatorio[]): ProjetoCardVM[] {
  return projetos.map((p) => {
    const faixa = faixaDoProjeto(p);
    const pausado = faixa === "pausado";
    const ultimo = ultimoRelatorio(p.id, relatorios);

    if (!ultimo) {
      return {
        id: p.id,
        nome: p.nome,
        resumo: "Nenhuma rodada registrada ainda.",
        statusLabel: pausado ? "pausado" : "sem rodada",
        cor: pausado ? "var(--mut3)" : "var(--mut2)",
        faixa,
        cadenciaLabelLongo: FAIXA_LABEL_LONGO[faixa],
        testesCurto: "sem dados",
        corTestes: "var(--mut3)",
        ultimaRodadaLabel: "—",
        strip: [],
        status: null,
      };
    }

    return {
      id: p.id,
      nome: p.nome,
      resumo: ultimo.resumo,
      statusLabel: pausado ? "pausado" : STATUS_LABEL[ultimo.status],
      cor: pausado ? "var(--mut3)" : STATUS_COR[ultimo.status],
      faixa,
      cadenciaLabelLongo: FAIXA_LABEL_LONGO[faixa],
      testesCurto: ultimo.testes_passaram === false ? "testes com falha" : "testes ok",
      corTestes: ultimo.testes_passaram === false ? "var(--fal)" : "var(--mut3)",
      ultimaRodadaLabel: formatarUltimaRodada(ultimo.executado_em),
      strip: ultimo.achados_por_agente.map((a) => chipDoAgente(a.agente)),
      status: ultimo.status,
    };
  });
}

export interface FaixaVM {
  id: Faixa;
  titulo: string;
  nota: string;
  projetos: ProjetoCardVM[];
}

function pesoStatus(status: StatusRelatorio | null): number {
  return status === null ? 3 : STATUS_PESO[status];
}

export function agruparPorFaixa(cards: ProjetoCardVM[]): FaixaVM[] {
  return ORDEM_FAIXAS.map((id) => ({
    id,
    titulo: FAIXA_META[id].titulo,
    nota: FAIXA_META[id].nota,
    projetos: cards
      .filter((c) => c.faixa === id)
      .sort((a, b) => pesoStatus(a.status) - pesoStatus(b.status)),
  }));
}

export interface TotaisHomeVM {
  totalAtivos: number;
  totalPrs: number;
  totalFalhas: number;
  resumoNoite: string;
}

export function totaisHome(projetos: Projeto[], relatorios: Relatorio[]): TotaisHomeVM {
  const ativos = projetos.filter((p) => p.ativo);
  const status = ativos.map((p) => ultimoRelatorio(p.id, relatorios)?.status ?? null);
  const falhas = status.filter((s) => s === "falha").length;
  const prs = status.filter((s) => s === "atencao").length;
  const resumoNoite =
    `${ativos.length} projetos em acompanhamento · ` +
    (falhas ? `${falhas} pede atenção agora` : "nada travado") +
    (prs ? ` · ${prs} PRs esperando revisão` : "");
  return { totalAtivos: ativos.length, totalPrs: prs, totalFalhas: falhas, resumoNoite };
}

// ─────────────────────────────────────────────────────────────────────────
// Detalhe do projeto.
// ─────────────────────────────────────────────────────────────────────────

export interface EtapaVM {
  titulo: string;
  selo: string;
  corSelo: string;
  contador: string;
  autor: string;
  atualizado: string;
  resumo: string;
  frescor: string;
  corFrescor: string;
  proximos: { num: string; texto: string }[];
}

const ETAPA_VAZIA: EtapaVM = {
  titulo: "Sem diagnóstico registrado",
  selo: "sem dados",
  corSelo: "var(--mut2)",
  contador: "",
  autor: "—",
  atualizado: "—",
  resumo: "Nenhuma rodada preencheu esta etapa ainda.",
  frescor: "sem dado de frescor",
  corFrescor: "var(--mut2)",
  proximos: [],
};

function montarEtapa(e: EtapaMock, pausado: boolean): EtapaVM {
  return {
    titulo: e.titulo,
    selo: e.selo,
    corSelo: SELO_COR[e.selo] ?? "var(--mut2)",
    contador: e.contador,
    autor: e.autor,
    atualizado: e.atualizado,
    resumo: e.resumo,
    frescor: pausado
      ? "não atualiza enquanto pausado"
      : e.dias === 0
        ? "atualizado nesta madrugada"
        : `sem atualização há ${e.dias} dias`,
    corFrescor: pausado ? "var(--mut3)" : e.dias === 0 ? "var(--ok)" : "var(--mut2)",
    proximos: e.proximos.map((texto, i) => ({ num: String(i + 1).padStart(2, "0"), texto })),
  };
}

export interface DocVM {
  nome: string;
  url: string;
  local: string;
}

export interface RodadaHistItemVM {
  idx: number;
  data: string;
  qtdAgentes: string;
  ok: boolean;
}

export interface ProjetoDetalheVM {
  id: string;
  nome: string;
  repo: string;
  cor: string;
  statusLabel: string;
  cadenciaLabelLongo: string;
  temPr: boolean;
  prUrl: string | null;
  etapa: EtapaVM;
  docs: DocVM[];
  acessos: AcessoMock[];
  rodadas: RodadaHistItemVM[];
}

export function detalheProjeto(
  projetoId: string,
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  contextos: Contexto[],
  etapas: Record<string, EtapaMock>,
  acessos: Record<string, AcessoMock[]>,
): ProjetoDetalheVM | null {
  const p = projetos.find((x) => x.id === projetoId);
  if (!p) return null;

  const faixa = faixaDoProjeto(p);
  const pausado = faixa === "pausado";
  const historico = relatoriosDoProjeto(p.id, relatorios);
  const ultimo = historico[0];

  const feitasComPr = sugestoes
    .filter((s) => s.projeto_id === p.id && s.estado === "feita" && s.pr_url)
    .sort((a, b) => new Date(b.feita_em ?? 0).getTime() - new Date(a.feita_em ?? 0).getTime());
  const prUrl = feitasComPr[0]?.pr_url ?? null;

  const docs: DocVM[] = contextos
    .filter((c) => c.projeto_id === p.id && c.arquivo_url)
    .map((c) => ({ nome: c.tipo, url: c.arquivo_url as string, local: hostnameCurto(c.arquivo_url as string) }));

  return {
    id: p.id,
    nome: p.nome,
    repo: p.repositorio,
    cor: pausado ? "var(--mut3)" : ultimo ? STATUS_COR[ultimo.status] : "var(--mut2)",
    statusLabel: pausado ? "pausado" : ultimo ? STATUS_LABEL[ultimo.status] : "sem rodada",
    cadenciaLabelLongo: FAIXA_LABEL_LONGO[faixa],
    temPr: !!prUrl && !pausado,
    prUrl,
    etapa: etapas[p.id] ? montarEtapa(etapas[p.id], pausado) : ETAPA_VAZIA,
    docs,
    acessos: acessos[p.id] ?? [],
    rodadas: historico.map((r, idx) => ({
      idx,
      data: formatarDataCurta(r.executado_em),
      qtdAgentes: `${r.achados_por_agente.length} ${r.achados_por_agente.length === 1 ? "agente" : "agentes"}`,
      ok: r.status !== "falha",
    })),
  };
}

export interface AgenteAchadoVM extends ChipVM {
  nome: string;
  acao: string;
  metrica: string;
}

export interface RodadaDetalheVM {
  tituloLongo: string;
  concluida: string;
  testes: string;
  cor: string;
  agentes: AgenteAchadoVM[];
}

export function rodadaDetalhe(
  projetoId: string,
  relatorios: Relatorio[],
  idx: number,
): RodadaDetalheVM | null {
  const historico = relatoriosDoProjeto(projetoId, relatorios);
  const r = historico[idx] ?? historico[0];
  if (!r) return null;

  return {
    tituloLongo: formatarDataCurta(r.executado_em),
    concluida: formatarConcluida(r.executado_em),
    testes: r.resumo,
    cor: r.status === "falha" ? "var(--fal)" : "var(--ok)",
    agentes: r.achados_por_agente.map((a) => ({
      nome: a.agente,
      acao: a.achado,
      metrica: a.selo,
      ...chipDoAgente(a.agente),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Fila de sugestões (detalhe do projeto). "Duas velocidades" (docs/visao.md):
// o resumo (agente, proposta, esforço, reversibilidade) é a porta; motivo e
// risco só aparecem expandidos, sob demanda do componente de cliente.
// ─────────────────────────────────────────────────────────────────────────

const ESFORCO_LABEL: Record<Esforco, string> = {
  pequeno: "esforço pequeno",
  medio: "esforço médio",
  grande: "esforço grande",
};

const REVERSIBILIDADE_LABEL: Record<Reversibilidade, string> = {
  facil: "reverte fácil",
  dificil: "reverte difícil",
  nao_reverte: "não reverte",
};

const REVERSIBILIDADE_COR: Record<Reversibilidade, string> = {
  facil: "var(--ok)",
  dificil: "var(--atn)",
  nao_reverte: "var(--fal)",
};

const ESTADO_SUGESTAO_LABEL: Record<EstadoSugestao, string> = {
  pendente: "aguardando decisão",
  aprovada: "aprovada",
  recusada: "recusada",
  feita: "feita",
};

const ESTADO_SUGESTAO_COR: Record<EstadoSugestao, string> = {
  pendente: "var(--atn)",
  aprovada: "var(--ok)",
  recusada: "var(--mut3)",
  feita: "var(--acento)",
};

function decisaoLabel(s: Sugestao): string | null {
  if (s.estado === "aprovada" && s.aprovada_em) return `aprovada em ${formatarDataCurta(s.aprovada_em)}`;
  if (s.estado === "recusada" && s.recusada_em) return `recusada em ${formatarDataCurta(s.recusada_em)}`;
  if (s.estado === "feita" && s.feita_em) {
    return `feita em ${formatarDataCurta(s.feita_em)}${s.pr_url ? " · PR aberto" : ""}`;
  }
  return null;
}

export interface SugestaoVM {
  id: string;
  chip: ChipVM;
  proposta: string;
  motivo: string;
  risco: string;
  esforcoLabel: string;
  reversibilidadeLabel: string;
  reversibilidadeCor: string;
  naoReverte: boolean;
  estado: EstadoSugestao;
  estadoLabel: string;
  estadoCor: string;
  criadaEmLabel: string;
  decisaoLabel: string | null;
  prUrl: string | null;
}

export interface FilaSugestoesVM {
  pendentes: SugestaoVM[];
  decididas: SugestaoVM[];
}

function sugestaoParaVM(s: Sugestao): SugestaoVM {
  return {
    id: s.id,
    chip: chipDoAgente(s.agente),
    proposta: s.proposta,
    motivo: s.motivo,
    risco: s.risco,
    esforcoLabel: ESFORCO_LABEL[s.esforco],
    reversibilidadeLabel: REVERSIBILIDADE_LABEL[s.reversibilidade],
    reversibilidadeCor: REVERSIBILIDADE_COR[s.reversibilidade],
    naoReverte: s.reversibilidade === "nao_reverte",
    estado: s.estado,
    estadoLabel: ESTADO_SUGESTAO_LABEL[s.estado],
    estadoCor: ESTADO_SUGESTAO_COR[s.estado],
    criadaEmLabel: formatarDataCurta(s.criada_em),
    decisaoLabel: decisaoLabel(s),
    prUrl: s.pr_url,
  };
}

/**
 * Fila de sugestões de um projeto, separada em pendentes (o que precisa de
 * decisão) e decididas (aprovada/recusada/feita — histórico, não some da
 * tela, mas não compete por atenção com o que está pendente). Mais recente
 * primeiro nos dois grupos.
 */
export function filaSugestoes(projetoId: string, sugestoes: Sugestao[]): FilaSugestoesVM {
  const doProjeto = sugestoes
    .filter((s) => s.projeto_id === projetoId)
    .slice()
    .sort((a, b) => new Date(b.criada_em).getTime() - new Date(a.criada_em).getTime());

  return {
    pendentes: doProjeto.filter((s) => s.estado === "pendente").map(sugestaoParaVM),
    decididas: doProjeto.filter((s) => s.estado !== "pendente").map(sugestaoParaVM),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Configuração.
// ─────────────────────────────────────────────────────────────────────────

export interface ConfigLinhaVM {
  id: string;
  nome: string;
  repo: string;
  corTexto: string;
  ultimaRodadaLabel: string;
  faixaAtual: Faixa;
}

export function linhasConfig(projetos: Projeto[], relatorios: Relatorio[]): ConfigLinhaVM[] {
  return projetos.map((p) => {
    const faixa = faixaDoProjeto(p);
    const ultimo = ultimoRelatorio(p.id, relatorios);
    return {
      id: p.id,
      nome: p.nome,
      repo: p.repositorio,
      corTexto: faixa === "pausado" ? "var(--mut2)" : "var(--txt)",
      ultimaRodadaLabel: ultimo ? formatarUltimaRodada(ultimo.executado_em) : "sem rodada",
      faixaAtual: faixa,
    };
  });
}

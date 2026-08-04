// Modelos de visão (o que o template consome) e as funções que os derivam das
// linhas de tabela (Projeto, Relatorio, Sugestao, Contexto, Tarefa). Nenhuma
// cor aqui é hexadecimal — sempre "var(--token)", os 28 tokens de
// src/app/globals.css.
//
// O painel "onde estamos" era mock (EtapaMock/montarEtapa/ETAPA_VAZIA) desde
// a conversão — ver docs/plano-gerenciador-de-projeto.md § 2 para o
// desmonte: título e resumo viram `projeto.descricao`, "próximos passos"
// vira `tarefa`, e "etapa 4 de 6"/autoria morrem (enfeite de mockup sem
// origem no schema e sem consumidor real, ver § 2 e § 3.4 do plano). O
// "estado agora" derivado (última rodada, pendentes, aprovadas, testes) não
// virou um painel — vira uma tira de uma linha no cabeçalho (`TiraEstadoVM`,
// abaixo): voz da máquina cabe numa linha, voz do dono precisa do
// retângulo. A antiga lista de acessos (AcessoMock) saiu daqui antes —
// substituída por `stack` e `servico`, dado real
// (db/migrations/002_inventario.sql; ver src/componentes/InventarioProjeto.tsx).

import type {
  Projeto,
  Relatorio,
  Sugestao,
  Contexto,
  StatusRelatorio,
  Esforco,
  Reversibilidade,
  EstadoSugestao,
  EstadoTarefa,
  Tarefa,
} from "./tipos";
import { type Faixa, faixaDoProjeto, FAIXA_META, FAIXA_LABEL_LONGO, ORDEM_FAIXAS } from "./cadencia";
import { papelDoAgente } from "./papeis";
import { tarefasEmAberto } from "./tarefas";
import type { ContagemExclusaoProjeto } from "./exclusaoProjeto";

// ─────────────────────────────────────────────────────────────────────────
// Rótulos e cores fixos (equivalentes aos objetos LABEL/COR/PESO do export).
// ─────────────────────────────────────────────────────────────────────────

// `atencao` dizia "PR aberto", e mostrava isso em projeto com zero PRs e três
// sugestões esperando decisão. O rótulo veio do export, de quando a rodada
// executava e abria PR; hoje ela diagnostica e propõe, então `atencao` quer
// dizer "a rodada achou algo que precisa de você" — o PR, quando existe, tem
// botão próprio no cabeçalho e não depende deste selo.
//
// Importa mais do que um rótulo errado costuma importar: docs/visao.md define
// o teste de cinco segundos para saber se algo precisa do dono, e este selo é
// a primeira coisa que ele lê na tela inicial.
const STATUS_LABEL: Record<StatusRelatorio, string> = {
  ok: "tudo ok",
  atencao: "precisa de você",
  falha: "falha",
};

const STATUS_COR: Record<StatusRelatorio, string> = {
  ok: "var(--ok)",
  atencao: "var(--atn)",
  falha: "var(--fal)",
};

const STATUS_PESO: Record<StatusRelatorio, number> = { falha: 0, atencao: 1, ok: 2 };

// ─────────────────────────────────────────────────────────────────────────
// Datas.
//
// **Uma regra:** o timestamp viaja em UTC e é convertido para
// America/Sao_Paulo na hora de formatar, sempre com `timeZone` explícito.
// Nunca `getHours()`, que usaria o fuso do processo — a Vercel roda em UTC.
//
// Este cabeçalho dizia o contrário: que os timestamps chegavam com offset
// "-03:00" e por isso o parser podia ler os dígitos crus da string. Era falso
// — toda camada de dados normaliza com `toISOString()`, que devolve Z. O
// parser lia UTC achando que lia São Paulo, e a tela ficou três horas
// adiantada o dia inteiro, com o dia errado entre 21h e a meia-noite. Vale
// registrar: o comentário descrevia exatamente a garantia que o código não
// dava, e foi ele que sustentou o erro por semanas.
//
// "Hoje" também já esteve travado em `{ dia: 29, mes: 7 }`, escrito à mão na
// conversão do export. Enquanto ficou ali, a rodada de 29 de julho aparecia
// como se fosse de hoje, para sempre.
//
// Como `timeZone` é explícito, o resultado é o mesmo no servidor e no
// navegador — então isto serve também a componente `use client`
// (CartaoContexto.tsx) sem divergência de hidratação. A saudação e o relógio
// do cabeçalho continuam calculados no navegador por outro motivo: eles
// dependem de "agora", não de um timestamp gravado (ver Saudacao.tsx).
// ─────────────────────────────────────────────────────────────────────────

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const FUSO_DO_DONO = "America/Sao_Paulo";

/**
 * Dia e mês de hoje no fuso em que os timestamps foram gravados.
 *
 * Exportado com `agora` injetável porque data que vem do relógio é a coisa
 * mais chata de testar que existe — sem o parâmetro, o teste de "hoje mostra
 * só a hora" passaria a falhar amanhã.
 */
export function hojeNoFusoDoDono(agora: Date = new Date()): { dia: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DO_DONO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  // en-CA devolve "2026-07-30", que é o formato mais barato de fatiar.
  const [, mes, dia] = partes.split("-");
  return { dia: Number(dia), mes: Number(mes) };
}

/**
 * Quebra um timestamp ISO nas partes que a tela mostra, **convertidas** para o
 * fuso do dono.
 *
 * Isto lia os dígitos crus da string, com um comentário dizendo que os
 * timestamps chegavam com offset "-03:00". A premissa era falsa: toda camada
 * de dados normaliza com `new Date(x).toISOString()`, que sempre devolve UTC
 * com Z (src/servidor/relatorios.ts:25, e o mesmo em sugestoes, contextos,
 * tarefas, projetos, agentesProjeto, agentesPadrao e inventario). O parser lia
 * UTC achando que lia São Paulo e produzia exatamente o erro que o comentário
 * existia para evitar: **três horas adiantado**, o dia inteiro, e o dia errado
 * entre 21h e a meia-noite.
 *
 * Foi visto no dado real: a rodada roda às 3h42 e a tela mostrava 06:42.
 *
 * A correção é converter, e não deixar de converter. Continua **sem**
 * `getHours()`, que usaria o fuso do processo — a Vercel roda em UTC. O
 * `timeZone` explícito faz o resultado ser o mesmo no servidor e no navegador,
 * o que também resolve a divergência de hidratação em componente `use client`
 * (CartaoContexto.tsx): não é "o fuso de quem renderiza", é sempre este.
 *
 * O dado guardado e o que sai em `GET /api/projects` continuam em UTC. Isso é
 * de propósito: mudar o transporte quebraria o contrato que a rodada lê e o
 * filtro de período de documentoAndamento.ts:70, que compara ISO como string
 * e só funciona porque tudo termina em Z.
 */
function partesISO(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) throw new Error(`timestamp inválido: ${iso}`);

  // en-CA com hourCycle h23 devolve "2026-08-03, 03:42" — o formato mais
  // barato de fatiar, e sem o "24:00" que h24 produziria à meia-noite.
  const texto = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DO_DONO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);

  const [dataParte, horaParte] = texto.split(", ");
  const [ano, mes, dia] = dataParte.split("-");
  const [hora, minuto] = horaParte.split(":");

  return { ano: Number(ano), mes: Number(mes), dia: Number(dia), hora, minuto };
}

/** Hora no fuso do dono. Exportado para src/dominio/mapaAgentes.ts reaproveitar
 * o mesmo parser — um lugar só converte. */
export function formatarHora(iso: string): string {
  const p = partesISO(iso);
  return `${p.hora}:${p.minuto}`;
}

/**
 * "3 ago 2026, 03:42" — data completa com hora, no fuso do dono.
 *
 * Existe para `documentoAndamento.ts` parar de ter o próprio parser. Aquele
 * arquivo tinha uma cópia lendo os dígitos crus da string, e por isso o
 * documento que vai para sócio e cliente saía três horas adiantado depois que
 * a tela já tinha sido corrigida — a mesma rodada aparecia às 03:42 no painel
 * e às 06:42 no PDF.
 *
 * O cabeçalho deste bloco diz "um lugar só converte". Era mentira enquanto
 * houvesse dois parsers.
 */
export function formatarDataHoraCompleta(iso: string): string {
  const p = partesISO(iso);
  return `${p.dia} ${MESES[p.mes - 1]} ${p.ano}, ${p.hora}:${p.minuto}`;
}

/** Exportado para src/dominio/agentes.ts reaproveitar (mesma formatação de data
 * usada em toda a tela de detalhe, agora também na ficha de agente). */
export function formatarDataCurta(iso: string): string {
  const p = partesISO(iso);
  return `${p.dia} ${MESES[p.mes - 1]}`;
}

/** "03:12" quando é de hoje, senão "12 jul, 03:02". */
function formatarUltimaRodada(iso: string, agora?: Date): string {
  const p = partesISO(iso);
  const hoje = hojeNoFusoDoDono(agora);
  if (p.dia === hoje.dia && p.mes === hoje.mes) return formatarHora(iso);
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

/** Exportado para src/dominio/esteiraAgentes.ts reaproveitar (mesmo crachá que os
 * chips de achado e de sugestão já usam, agora também nos cards da esteira). */
export function chipDoAgente(nomeAgente: string): ChipVM {
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
  resumoNoite: string;
}

/**
 * Só a prosa do cabeçalho ("N projetos em acompanhamento · ..."). Os números
 * soltos que existiam aqui (PRs na fila, com falha) saíram — plano da
 * segunda passada de design da visão geral: um bloco de números que ninguém
 * decide nada a partir dele é ruído, e a mesma informação, acionável, agora
 * vive em `itensAtencao` (abaixo), que vira o painel de atenção no topo da
 * tela em vez de estatística estática.
 */
export function totaisHome(
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
): TotaisHomeVM {
  const ativos = projetos.filter((p) => p.ativo);
  const status = ativos.map((p) => ultimoRelatorio(p.id, relatorios)?.status ?? null);
  const falhas = status.filter((s) => s === "falha").length;
  // "Pede decisão" conta sugestão pendente de verdade, e não o `status` do
  // último relatório. Mesma correção de `itensAtencao` — ver o comentário
  // longo lá. Aqui importa também porque este subtítulo fica uma linha acima
  // do painel: se um contasse status e o outro contasse pendentes, a tela se
  // contradiria em dois lugares visíveis ao mesmo tempo.
  const pedemDecisao = ativos.filter((p) => pendentesDoProjeto(p.id, sugestoes) > 0).length;
  const resumoNoite =
    `${ativos.length} ${ativos.length === 1 ? "projeto" : "projetos"} em acompanhamento · ` +
    (falhas ? `${falhas} com falha` : "nada travado") +
    (pedemDecisao ? ` · ${pedemDecisao} ${pedemDecisao === 1 ? "pede decisão" : "pedem decisão"}` : "");
  return { totalAtivos: ativos.length, resumoNoite };
}

export interface ItemAtencaoVM {
  id: string;
  nome: string;
  statusLabel: string;
  cor: string;
  resumo: string;
  cadenciaLabelLongo: string;
}

/** Quantas sugestões deste projeto estão esperando decisão agora. */
function pendentesDoProjeto(projetoId: string, sugestoes: Sugestao[]): number {
  return sugestoes.filter((s) => s.projeto_id === projetoId && s.estado === "pendente").length;
}

/**
 * Projetos que pedem decisão do dono agora, **através de todas as faixas de
 * cadência** — a resposta direta a "em qual dos meus projetos algo precisa
 * de mim", que a grade por frequência sozinha não responde (um projeto em
 * chamas na faixa "uma vez por semana" ficaria no rodapé da tela).
 *
 * ## O que ele lia antes, e por que estava errado
 *
 * Lia `status === "atencao"`, que é o campo gravado pela rodada no relatório
 * daquela noite. O prompt define esse campo como um instantâneo: "há sugestão
 * **nova** na fila", no momento em que a rodada terminou. Não é "há sugestão
 * esperando".
 *
 * A tela errava nos dois sentidos, e o segundo é o pior:
 *
 * - **Cobrava decisão já tomada.** O dono recusava as duas sugestões da noite,
 *   voltava para a home, e ela continuava dizendo "1 projeto pede você agora"
 *   — até a rodada seguinte gravar outro relatório, o que em `semanal` leva
 *   seis dias. Acontecia toda manhã em que ele fazia o trabalho dele.
 * - **Escondia decisão esperando.** Três sugestões pendentes da noite 1; noite
 *   2 roda limpa e grava `status: "ok"`; o projeto some do painel com as três
 *   ainda na fila. O painel existe justamente para ele não precisar procurar,
 *   e era ali que silenciava.
 *
 * Agora conta sugestão pendente de verdade. `falha` continua entrando por
 * status, e está certo: "o build quebrou" é fato da rodada, não algo que o
 * dono decide.
 *
 * Pausado nunca aparece: a rodada não visita mais um projeto pausado, então o
 * que houver ali é de quando ele ainda rodava.
 *
 * Ordem: falha primeiro; depois, mais pendentes primeiro. A ordem antiga
 * dizia no comentário que era "mais recente primeiro", mas `listarProjetos` é
 * `ORDER BY criado_em ASC` — projeto mais **antigo** primeiro, e por data de
 * cadastro, não por recência de rodada. O comentário errava as duas coisas.
 */
export function itensAtencao(cards: ProjetoCardVM[], sugestoes: Sugestao[]): ItemAtencaoVM[] {
  return cards
    .map((c) => ({ card: c, pendentes: pendentesDoProjeto(c.id, sugestoes) }))
    .filter(({ card, pendentes }) => card.faixa !== "pausado" && (card.status === "falha" || pendentes > 0))
    .sort((a, b) => {
      const porStatus = pesoStatus(a.card.status) - pesoStatus(b.card.status);
      return porStatus !== 0 ? porStatus : b.pendentes - a.pendentes;
    })
    .map(({ card, pendentes }) => ({
      id: card.id,
      nome: card.nome,
      statusLabel: card.statusLabel,
      cor: card.cor,
      // O motivo de o projeto estar nesta lista, em vez da prosa da rodada —
      // que conta o que a noite achou e não diz quantas decisões esperam.
      resumo:
        pendentes > 0
          ? `${pendentes} ${pendentes === 1 ? "sugestão esperando decisão" : "sugestões esperando decisão"}`
          : card.resumo,
      cadenciaLabelLongo: card.cadenciaLabelLongo,
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// Detalhe do projeto.
// ─────────────────────────────────────────────────────────────────────────

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

/**
 * Voz da máquina: o que a rodada mais recente achou e o que espera decisão,
 * reduzido a uma linha para o cabeçalho (docs/plano-gerenciador-de-projeto.md
 * § 2.1, § 5.2) — o "estado agora" de um plano anterior, que era pensado como
 * painel e virou tira. Cabe uma linha porque muda toda noite; a voz do dono
 * (`descricao`, `tarefa`) é que precisa do retângulo, porque muda quando ele decide.
 */
export interface TiraEstadoVM {
  texto: string;
  cor: string;
}

function tiraEstado(ultimo: Relatorio | undefined, pendentes: number, aprovadas: number): TiraEstadoVM {
  const partes = [
    ultimo ? `última rodada ${formatarUltimaRodada(ultimo.executado_em)}` : "nenhuma rodada ainda",
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? "sugestão esperando" : "sugestões esperando"} você`
      : "nada esperando você",
  ];
  if (aprovadas > 0) {
    partes.push(`${aprovadas} ${aprovadas === 1 ? "aprovada" : "aprovadas"} na fila`);
  }
  if (ultimo) {
    partes.push(
      ultimo.testes_passaram === false
        ? "testes com falha"
        : ultimo.testes_passaram === null
          ? "sem suíte de testes"
          : "testes ok",
    );
  }
  const cor =
    ultimo?.testes_passaram === false ? "var(--fal)" : pendentes > 0 ? "var(--atn)" : "var(--mut3)";
  return { texto: partes.join(" · "), cor };
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
  /** O que este projeto é, em prosa do dono (projeto.descricao) — null quando ainda não escrita. */
  descricao: string | null;
  tira: TiraEstadoVM;
  docs: DocVM[];
  rodadas: RodadaHistItemVM[];
}

export function detalheProjeto(
  projetoId: string,
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  contextos: Contexto[],
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

  const sugestoesDoProjeto = sugestoes.filter((s) => s.projeto_id === p.id);
  const pendentes = sugestoesDoProjeto.filter((s) => s.estado === "pendente").length;
  const aprovadas = sugestoesDoProjeto.filter((s) => s.estado === "aprovada").length;

  const docs: DocVM[] = contextos
    .filter((c) => c.projeto_id === p.id && c.arquivo_url)
    .map((c) => ({ nome: c.tipo, url: c.arquivo_url as string, local: hostnameCurto(c.arquivo_url as string) }));

  return {
    id: p.id,
    nome: p.nome,
    repo: rotuloRepositorio(p.repositorio),
    cor: pausado ? "var(--mut3)" : ultimo ? STATUS_COR[ultimo.status] : "var(--mut2)",
    statusLabel: pausado ? "pausado" : ultimo ? STATUS_LABEL[ultimo.status] : "sem rodada",
    cadenciaLabelLongo: FAIXA_LABEL_LONGO[faixa],
    temPr: !!prUrl && !pausado,
    prUrl,
    descricao: p.descricao,
    tira: tiraEstado(ultimo, pendentes, aprovadas),
    docs,
    rodadas: historico.map((r, idx) => ({
      idx,
      data: formatarDataCurta(r.executado_em),
      qtdAgentes: `${r.achados_por_agente.length} ${r.achados_por_agente.length === 1 ? "agente" : "agentes"}`,
      ok: r.status !== "falha",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// "Onde estamos": tarefas do dono (aberta/fazendo) e sugestões aprovadas, num
// bloco só, com selo de origem (plano § 3.3 e § 5.2). Tabelas separadas no
// banco, união só aqui — ver docs/plano-gerenciador-de-projeto.md § 3.3 para
// o porquê de não fundir `tarefa` e `sugestao`.
// ─────────────────────────────────────────────────────────────────────────

export type OrigemItemOndeEstamos = "tarefa" | "sugestao";

export interface ItemOndeEstamosVM {
  origem: OrigemItemOndeEstamos;
  id: string;
  num: string;
  texto: string;
  /** Só presente quando origem === "tarefa" — o checkbox de concluir usa isto. */
  tarefaEstado?: EstadoTarefa;
  /** Só presente quando origem === "sugestao" — o crachá de quem propôs. */
  chip?: ChipVM;
}

export interface OndeEstamosVM {
  /** A tarefa em `fazendo`, se houver uma — dá título ao bloco (plano § 3.5). */
  fazendoAgora: { id: string; titulo: string } | null;
  itens: ItemOndeEstamosVM[];
}

/**
 * `tarefas` já filtradas para um projeto (mesma convenção de `stack`/`servico`
 * na tela de detalhe); `aprovadas` é `FilaSugestoesVM.aprovadas`, já derivada
 * por `filaSugestoes` — reaproveitada aqui, não recalculada.
 */
export function ondeEstamos(tarefas: Tarefa[], aprovadas: SugestaoVM[]): OndeEstamosVM {
  const emAberto = tarefasEmAberto(tarefas);
  const tarefaFazendo = emAberto.find((t) => t.estado === "fazendo");
  const fazendoAgora = tarefaFazendo ? { id: tarefaFazendo.id, titulo: tarefaFazendo.titulo } : null;
  const abertas = emAberto.filter((t) => t.estado === "aberta");

  const itensTarefa: Omit<ItemOndeEstamosVM, "num">[] = abertas.map((t) => ({
    origem: "tarefa",
    id: t.id,
    texto: t.titulo,
    tarefaEstado: t.estado,
  }));
  const itensSugestao: Omit<ItemOndeEstamosVM, "num">[] = aprovadas.map((s) => ({
    origem: "sugestao",
    id: s.id,
    texto: s.proposta,
    chip: s.chip,
  }));

  const itens = [...itensTarefa, ...itensSugestao].map((item, i) => ({
    ...item,
    num: String(i + 1).padStart(2, "0"),
  }));

  return { fazendoAgora, itens };
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

/** Exportados para src/dominio/agentes.ts reaproveitar (mesmo rótulo/cor de
 * estado de sugestão, agora também no histórico da ficha de agente). */
export const ESTADO_SUGESTAO_LABEL: Record<EstadoSugestao, string> = {
  pendente: "aguardando decisão",
  aprovada: "aprovada",
  recusada: "recusada",
  feita: "feita",
};

export const ESTADO_SUGESTAO_COR: Record<EstadoSugestao, string> = {
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
  /** Precisa de decisão do dono agora — aprovar ou recusar. */
  pendentes: SugestaoVM[];
  /** Já aprovadas, ainda não feitas — o dono quer isso, mas o trabalho ainda não aconteceu.
   * Continuam selecionáveis para o gerador de prompt (item 1 de docs/proximos-passos.md). */
  aprovadas: SugestaoVM[];
  /** Recusada ou feita — histórico. Não compete por atenção com o que ainda precisa de decisão. */
  historico: SugestaoVM[];
  /** Subconjunto de `historico`: só as recusadas. O gerador de prompt usa isto para
   * dizer ao Claude Code o que já foi negado e não deve ser reproposto. */
  recusadas: SugestaoVM[];
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
 * Fila de sugestões de um projeto, em quatro vistas (ver `FilaSugestoesVM`).
 * Mais recente primeiro em todos os grupos.
 */
export function filaSugestoes(projetoId: string, sugestoes: Sugestao[]): FilaSugestoesVM {
  const doProjeto = sugestoes
    .filter((s) => s.projeto_id === projetoId)
    .slice()
    .sort((a, b) => new Date(b.criada_em).getTime() - new Date(a.criada_em).getTime());

  const historico = doProjeto.filter((s) => s.estado === "recusada" || s.estado === "feita");

  return {
    pendentes: doProjeto.filter((s) => s.estado === "pendente").map(sugestaoParaVM),
    aprovadas: doProjeto.filter((s) => s.estado === "aprovada").map(sugestaoParaVM),
    historico: historico.map(sugestaoParaVM),
    recusadas: historico.filter((s) => s.estado === "recusada").map(sugestaoParaVM),
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
  /** O que some junto se este projeto for apagado — para a confirmação de exclusão. */
  contagemExclusao: ContagemExclusaoProjeto;
}

/**
 * O que mostrar no lugar do repositório quando o projeto não tem um.
 *
 * `repositorio` é nulo em projeto que vive dentro de um connector — um conjunto
 * de workflows no n8n, por exemplo. Deixar em branco pareceria dado faltando;
 * este rótulo diz que a ausência é a resposta, não um cadastro pela metade.
 */
export function rotuloRepositorio(repositorio: string | null): string {
  return repositorio ?? "sem repositório";
}

/**
 * `sugestoes`, `contextos` e `tarefas` só existem para calcular
 * `contagemExclusao` — quantas linhas somem se o dono apagar aquele projeto
 * pela tela de Configuração (ver `ApagarProjeto`, src/componentes). Contar
 * aqui, a partir das listas já carregadas pela página, evita uma consulta
 * `COUNT` a mais por projeto: a mesma lista inteira que outras telas
 * carregam também serve para isto, e a escala é pessoal (dezenas de linhas).
 */
export function linhasConfig(
  projetos: Projeto[],
  relatorios: Relatorio[],
  sugestoes: Sugestao[],
  contextos: Contexto[],
  tarefas: Tarefa[],
): ConfigLinhaVM[] {
  return projetos.map((p) => {
    const faixa = faixaDoProjeto(p);
    const ultimo = ultimoRelatorio(p.id, relatorios);
    return {
      id: p.id,
      nome: p.nome,
      repo: rotuloRepositorio(p.repositorio),
      corTexto: faixa === "pausado" ? "var(--mut2)" : "var(--txt)",
      ultimaRodadaLabel: ultimo ? formatarUltimaRodada(ultimo.executado_em) : "sem rodada",
      faixaAtual: faixa,
      contagemExclusao: {
        relatorios: relatorios.filter((r) => r.projeto_id === p.id).length,
        sugestoes: sugestoes.filter((s) => s.projeto_id === p.id).length,
        contextos: contextos.filter((c) => c.projeto_id === p.id).length,
        tarefas: tarefas.filter((t) => t.projeto_id === p.id).length,
      },
    };
  });
}

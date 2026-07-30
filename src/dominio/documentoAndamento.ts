// Documento de andamento — item 4 de docs/proximos-passos.md. Lógica pura,
// sem import de banco nem de React, mesmo padrão de src/dominio/prompt.ts:
// recebe o que a tela já carregou (relatórios, sugestões e tarefas do
// projeto, todos sem filtro de período) mais um corte de data, e devolve
// duas strings em Markdown — nunca objeto de UI, porque Markdown é a fonte
// (docs/proximos-passos.md item 4: "legível cru, cabe no banco, versiona,
// converte").
//
// Duas vozes sobre os mesmos dados:
//
// - `tecnico`  — para o dono e a equipe. Fala de agente, achado, esforço,
//   reversibilidade, PR. É essencialmente o mesmo vocabulário do resto do
//   painel.
// - `andamento` — para sócio e cliente. Zero jargão: nada de "PR", "commit",
//   "agente", "esforço técnico". Fala do que mudou na prática, o que falta,
//   o que preocupa.
//
// Regra de segurança que este arquivo aplica sozinho, mesma de prompt.ts:
// todo campo de texto livre (resumo de relatório, achado de agente, motivo e
// risco de sugestão, título de tarefa, descrição do projeto) passa por
// `semCredencial` antes de entrar em qualquer um dos dois textos — os dois
// podem virar anexo de e-mail ou página pública do Notion, fora do controle
// deste app.
//
// Sem invenção de dado: cada seção que não tiver nada para mostrar no
// período escolhido diz isso em uma linha, em vez de ficar ausente ou de
// simular movimento (docs/proximos-passos.md item 4: "documento que finge
// movimento é pior que documento curto").

import { semCredencial } from "./pareceCredencial";
import type { Relatorio, Sugestao, Tarefa } from "./tipos";

// ─────────────────────────────────────────────────────────────────────────
// Período: cálculo do corte de data, isolado do resto para ficar testável
// sem depender de "agora" escondido dentro da função principal.
// ─────────────────────────────────────────────────────────────────────────

export type PeriodoChave = "7dias" | "30dias" | "desde_ultima" | "tudo";

export const PERIODO_LABEL: Record<PeriodoChave, string> = {
  "7dias": "últimos 7 dias",
  "30dias": "últimos 30 dias",
  desde_ultima: "desde o último documento gerado",
  tudo: "todo o histórico",
};

/**
 * Corte de data (ISO) a partir do qual algo "entra no período", ou `null`
 * para "sem corte" (todo o histórico). `agora` e `ultimaGeracao` são
 * parâmetros, não `Date.now()` interno — mesma disciplina de determinismo do
 * resto do domínio (ver o comentário sobre fuso em src/dominio/visao.ts).
 *
 * `desde_ultima` não tem tabela própria (não há migration para isto — ver
 * docs/proximos-passos.md item 4, "não precisa de migration se der para
 * gerar sob demanda"): o painel guarda a data do último documento gerado
 * deste projeto no navegador do dono (localStorage), e passa aqui. Sem
 * geração anterior conhecida, cai em "sem corte" — mostrar tudo é mais
 * seguro do que inventar uma data.
 */
export function calcularDesde(chave: PeriodoChave, agora: Date, ultimaGeracao: string | null): string | null {
  if (chave === "tudo") return null;
  if (chave === "desde_ultima") return ultimaGeracao;
  const dias = chave === "7dias" ? 7 : 30;
  const corte = new Date(agora.getTime());
  corte.setUTCDate(corte.getUTCDate() - dias);
  return corte.toISOString();
}

/** `true` se nenhuma das datas informadas for anterior a `desde` (ou se `desde` for `null`). */
function tocouPeriodo(desde: string | null, ...datas: (string | null)[]): boolean {
  if (!desde) return true;
  return datas.some((d) => d !== null && d >= desde);
}

// ─────────────────────────────────────────────────────────────────────────
// Entrada e saída.
// ─────────────────────────────────────────────────────────────────────────

export interface DadosDocumentoAndamento {
  projetoNome: string;
  /** projeto.descricao — null quando o dono ainda não escreveu. */
  descricao: string | null;
  periodo: PeriodoChave;
  /** Corte de data já calculado (ver `calcularDesde`) — null = todo o histórico. */
  desde: string | null;
  /** Instante em que o documento foi gerado, formatado (ex.: "30 jul 2026, 14:20"). */
  geradoEmLabel: string;
  /** Todos os relatórios do projeto, sem filtro — a função filtra por `desde` internamente. */
  relatorios: Relatorio[];
  /** Todas as sugestões do projeto, sem filtro. */
  sugestoes: Sugestao[];
  /** Todas as tarefas do projeto, sem filtro. */
  tarefas: Tarefa[];
}

export interface DocumentoAndamento {
  /** Voz técnica, em Markdown — para o dono e a equipe. */
  tecnico: string;
  /** Voz de andamento, em Markdown — para sócio e cliente. Zero jargão. */
  andamento: string;
}

function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [, ano, mes, dia, hora, minuto] = m;
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${ano}, ${hora}:${minuto}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Voz técnica.
// ─────────────────────────────────────────────────────────────────────────

function secaoRodadasTecnico(relatoriosPeriodo: Relatorio[]): string {
  if (relatoriosPeriodo.length === 0) {
    return "Nenhuma rodada de diagnóstico neste período.";
  }
  return relatoriosPeriodo
    .map((r) => {
      const testes =
        r.testes_passaram === null ? "sem suíte de testes" : r.testes_passaram ? "testes ok" : "testes com falha";
      const achados =
        r.achados_por_agente.length === 0
          ? "Nenhum achado registrado."
          : r.achados_por_agente
              .map((a) => `- ${semCredencial(a.agente)} (${semCredencial(a.selo)}): ${semCredencial(a.achado)}`)
              .join("\n");
      return [
        `### ${formatarData(r.executado_em)} — ${r.status} · ${testes}`,
        semCredencial(r.resumo),
        "",
        achados,
      ].join("\n");
    })
    .join("\n\n");
}

function itemSugestaoTecnico(s: Sugestao): string {
  const pr = s.pr_url ? ` · PR: ${s.pr_url}` : "";
  return [
    `- ${semCredencial(s.proposta)} (${semCredencial(s.agente)})`,
    `  Motivo: ${semCredencial(s.motivo)}`,
    `  Risco: ${semCredencial(s.risco)}`,
    `  Esforço: ${s.esforco} · Reversibilidade: ${s.reversibilidade}${pr}`,
  ].join("\n");
}

function listaOuVazio(itens: string[], vazio: string): string {
  return itens.length === 0 ? vazio : itens.join("\n\n");
}

function secaoSugestoesTecnico(
  feitasPeriodo: Sugestao[],
  recusadasPeriodo: Sugestao[],
  aprovadasAtuais: Sugestao[],
  pendentesAtuais: Sugestao[],
): string {
  return [
    "### Feitas neste período",
    listaOuVazio(feitasPeriodo.map(itemSugestaoTecnico), "Nenhuma sugestão marcada como feita neste período."),
    "",
    "### Recusadas neste período",
    listaOuVazio(recusadasPeriodo.map(itemSugestaoTecnico), "Nenhuma sugestão recusada neste período."),
    "",
    "### Aprovadas, aguardando execução (estado atual)",
    listaOuVazio(aprovadasAtuais.map(itemSugestaoTecnico), "Nenhuma sugestão aprovada aguardando execução."),
    "",
    "### Pendentes, aguardando decisão do dono (estado atual)",
    listaOuVazio(pendentesAtuais.map(itemSugestaoTecnico), "Nenhuma sugestão pendente."),
  ].join("\n");
}

function secaoTarefasTecnico(concluidasPeriodo: Tarefa[], emAbertoAtuais: Tarefa[]): string {
  const concluidas = concluidasPeriodo
    .map((t) => `- ${semCredencial(t.titulo)} (concluída em ${t.concluida_em ? formatarData(t.concluida_em) : "—"})`)
    .join("\n");
  const emAberto = emAbertoAtuais.map((t) => `- [${t.estado}] ${semCredencial(t.titulo)}`).join("\n");
  return [
    "### Concluídas neste período",
    listaOuVazio(concluidas ? [concluidas] : [], "Nenhuma tarefa concluída neste período."),
    "",
    "### Em aberto (estado atual)",
    listaOuVazio(emAberto ? [emAberto] : [], "Nenhuma tarefa em aberto."),
  ].join("\n");
}

function gerarTecnico(
  d: DadosDocumentoAndamento,
  relatoriosPeriodo: Relatorio[],
  sugestoesPeriodo: Sugestao[],
  aprovadasAtuais: Sugestao[],
  pendentesAtuais: Sugestao[],
  tarefasConcluidasPeriodo: Tarefa[],
  tarefasEmAbertoAtuais: Tarefa[],
): string {
  const feitasPeriodo = sugestoesPeriodo.filter((s) => s.estado === "feita");
  const recusadasPeriodo = sugestoesPeriodo.filter((s) => s.estado === "recusada");

  return [
    `# ${d.projetoNome} — relatório técnico`,
    "",
    `Período: ${PERIODO_LABEL[d.periodo]} · gerado em ${d.geradoEmLabel}`,
    "",
    "## O que é este projeto",
    d.descricao ? semCredencial(d.descricao) : "Ainda não descrito no painel.",
    "",
    "## Rodadas de diagnóstico",
    secaoRodadasTecnico(relatoriosPeriodo),
    "",
    "## Sugestões",
    secaoSugestoesTecnico(feitasPeriodo, recusadasPeriodo, aprovadasAtuais, pendentesAtuais),
    "",
    "## Tarefas",
    secaoTarefasTecnico(tarefasConcluidasPeriodo, tarefasEmAbertoAtuais),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Voz de andamento — zero jargão. Fala em prosa curta, não em bullet técnico.
// ─────────────────────────────────────────────────────────────────────────

function resumoAndamento(relatoriosPeriodo: Relatorio[]): string {
  if (relatoriosPeriodo.length === 0) {
    return "Não houve revisão automática do projeto neste período.";
  }
  const ok = relatoriosPeriodo.filter((r) => r.status === "ok").length;
  const atencao = relatoriosPeriodo.filter((r) => r.status === "atencao").length;
  const falha = relatoriosPeriodo.filter((r) => r.status === "falha").length;

  const partes = [`O projeto passou por ${relatoriosPeriodo.length} ${relatoriosPeriodo.length === 1 ? "revisão" : "revisões"} neste período.`];
  if (ok > 0) partes.push(`${ok} não encontraram nenhum problema.`);
  if (atencao > 0) partes.push(`${atencao} encontraram algo que já está sendo avaliado.`);
  if (falha > 0) partes.push(`${falha} sinalizaram uma falha.`);
  return partes.join(" ");
}

function itemAndamento(texto: string): string {
  return `- ${semCredencial(texto)}`;
}

function secaoAndamento(itens: string[], vazio: string): string {
  return itens.length === 0 ? vazio : itens.map(itemAndamento).join("\n");
}

function gerarAndamento(
  d: DadosDocumentoAndamento,
  relatoriosPeriodo: Relatorio[],
  feitasPeriodo: Sugestao[],
  tarefasConcluidasPeriodo: Tarefa[],
  aprovadasAtuais: Sugestao[],
  tarefasFazendoAtuais: Tarefa[],
  pendentesAtuais: Sugestao[],
  falhasPeriodo: Relatorio[],
  naoReverteAtuais: Sugestao[],
): string {
  const avancou = [...feitasPeriodo.map((s) => s.proposta), ...tarefasConcluidasPeriodo.map((t) => t.titulo)];
  const emAndamento = [
    ...aprovadasAtuais.map((s) => s.proposta),
    ...tarefasFazendoAtuais.map((t) => t.titulo),
  ];
  const aguardandoDecisao = pendentesAtuais.map((s) => s.proposta);

  const pontosDeAtencao = [
    ...falhasPeriodo.map((r) => `Uma revisão em ${formatarData(r.executado_em)} sinalizou uma falha: ${r.resumo}`),
    ...naoReverteAtuais.map(
      (s) => `Há uma decisão pendente que, se aprovada, não pode ser desfeita depois: ${s.proposta}`,
    ),
  ];

  return [
    `# ${d.projetoNome} — andamento`,
    "",
    `Período: ${PERIODO_LABEL[d.periodo]}`,
    "",
    "## Resumo",
    resumoAndamento(relatoriosPeriodo),
    "",
    "## O que avançou",
    secaoAndamento(avancou, "Nada foi concluído neste período."),
    "",
    "## Em andamento",
    secaoAndamento(emAndamento, "Nada em andamento no momento."),
    "",
    "## Aguardando decisão",
    secaoAndamento(aguardandoDecisao, "Nada aguardando decisão no momento."),
    "",
    "## Pontos de atenção",
    secaoAndamento(pontosDeAtencao, "Nada preocupante identificado neste período."),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Função pública.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Gera as duas vozes do documento de andamento a partir dos dados brutos de
 * um projeto (sem filtro de período) mais o corte de data já calculado.
 *
 * Convenção de "período" x "estado atual": rodadas e o que foi concluído
 * (sugestão feita, tarefa concluída) são recortados por `desde` — são fatos
 * históricos, e o período diz qual fatia mostrar. O que ainda não foi
 * decidido (sugestão pendente) ou ainda não foi feito (sugestão aprovada,
 * tarefa em aberto) é sempre o estado atual, não recortado — não faz sentido
 * esconder uma decisão pendente antiga só porque ela é anterior ao período
 * escolhido; ela continua pendente.
 */
export function gerarDocumentoAndamento(d: DadosDocumentoAndamento): DocumentoAndamento {
  const relatoriosPeriodo = d.relatorios
    .filter((r) => tocouPeriodo(d.desde, r.executado_em))
    .slice()
    .sort((a, b) => new Date(a.executado_em).getTime() - new Date(b.executado_em).getTime());

  const sugestoesPeriodo = d.sugestoes.filter((s) =>
    tocouPeriodo(d.desde, s.criada_em, s.aprovada_em, s.recusada_em, s.feita_em),
  );
  const feitasPeriodo = sugestoesPeriodo.filter((s) => s.estado === "feita");
  const aprovadasAtuais = d.sugestoes.filter((s) => s.estado === "aprovada");
  const pendentesAtuais = d.sugestoes.filter((s) => s.estado === "pendente");
  const naoReverteAtuais = pendentesAtuais.filter((s) => s.reversibilidade === "nao_reverte");
  const falhasPeriodo = relatoriosPeriodo.filter((r) => r.status === "falha");

  const tarefasConcluidasPeriodo = d.tarefas.filter(
    (t) => t.estado === "feita" && tocouPeriodo(d.desde, t.concluida_em),
  );
  const tarefasEmAbertoAtuais = d.tarefas.filter((t) => t.estado === "aberta" || t.estado === "fazendo");
  const tarefasFazendoAtuais = d.tarefas.filter((t) => t.estado === "fazendo");

  return {
    tecnico: gerarTecnico(
      d,
      relatoriosPeriodo,
      sugestoesPeriodo,
      aprovadasAtuais,
      pendentesAtuais,
      tarefasConcluidasPeriodo,
      tarefasEmAbertoAtuais,
    ),
    andamento: gerarAndamento(
      d,
      relatoriosPeriodo,
      feitasPeriodo,
      tarefasConcluidasPeriodo,
      aprovadasAtuais,
      tarefasFazendoAtuais,
      pendentesAtuais,
      falhasPeriodo,
      naoReverteAtuais,
    ),
  };
}

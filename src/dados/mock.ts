// Dados mockados — em formato de linha de tabela (plano §2.7), como se viessem de
// um SELECT em cada uma das quatro tabelas de db/migrations/001_schema_inicial.sql.
// Os textos são os mesmos do export (design-original/acompanhamento-noturno-v2.dc.html);
// só a forma muda, de objeto achatado por projeto para linhas normalizadas.
//
// Nenhum valor de credencial aparece aqui — nem fabricado. A seção de acessos, mais
// abaixo, guarda só rótulo/escopo/quem administra (plano §2.11).
//
// A segunda metade do arquivo (ETAPAS, ACESSOS) é dado que **não tem tabela**
// (plano §2.8). Fica claramente separada e comentada, e os tipos vêm de
// src/dominio/visao.ts, não de src/dominio/tipos.ts.

import type { Projeto, Relatorio, Sugestao, Contexto, AchadoAgente } from "@/dominio/tipos";
import type { EtapaMock, AcessoMock } from "@/dominio/visao";

// ─────────────────────────────────────────────────────────────────────────
// ids — uuids fabricados, estáveis, um prefixo por tabela para facilitar
// depurar (não é formato exigido por lei nenhuma, só ajuda a leitura).
// ─────────────────────────────────────────────────────────────────────────

const uid = (grupo: 1 | 2 | 3 | 4, n: number) =>
  `${grupo}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const PROJETO_ID = {
  cofre: uid(1, 1),
  medidor: uid(1, 2),
  atlas: uid(1, 3),
  pauta: uid(1, 4),
  ponte: uid(1, 5),
  arquivo: uid(1, 6),
} as const;

let seqRelatorio = 0;
const idRelatorio = () => uid(2, ++seqRelatorio);
let seqSugestao = 0;
const idSugestao = () => uid(3, ++seqSugestao);
let seqContexto = 0;
const idContexto = () => uid(4, ++seqContexto);

/** "2026-07-29T03:12" -> timestamptz com o offset de Brasília, igual ao fuso dos repositórios. */
const isoSp = (dataHora: string) => `${dataHora}:00-03:00`;

const achados = (tuplas: [string, string, string][]): AchadoAgente[] =>
  tuplas.map(([agente, achado, selo]) => ({ agente, achado, selo }));

// ─────────────────────────────────────────────────────────────────────────
// projeto
// ─────────────────────────────────────────────────────────────────────────

export const projetos: Projeto[] = [
  {
    id: PROJETO_ID.cofre,
    nome: "Cofre de rotinas",
    repositorio: "gravidade/cofre-rotinas",
    frequencia: "toda_madrugada",
    ativo: true,
    criado_em: "2026-01-12T00:00:00-03:00",
  },
  {
    id: PROJETO_ID.medidor,
    nome: "Medidor de consumo",
    repositorio: "gravidade/medidor",
    frequencia: "toda_madrugada",
    ativo: true,
    criado_em: "2026-02-03T00:00:00-03:00",
  },
  {
    id: PROJETO_ID.atlas,
    nome: "Atlas interno",
    repositorio: "gravidade/atlas",
    frequencia: "toda_madrugada",
    ativo: true,
    criado_em: "2026-01-20T00:00:00-03:00",
  },
  {
    id: PROJETO_ID.pauta,
    nome: "Pauta editorial",
    repositorio: "gravidade/pauta",
    frequencia: "dias_alternados",
    ativo: true,
    criado_em: "2026-03-02T00:00:00-03:00",
  },
  {
    id: PROJETO_ID.ponte,
    nome: "Ponte de integrações",
    repositorio: "gravidade/ponte",
    frequencia: "semanal",
    ativo: true,
    criado_em: "2026-02-18T00:00:00-03:00",
  },
  {
    id: PROJETO_ID.arquivo,
    nome: "Arquivo morto",
    repositorio: "gravidade/arquivo",
    frequencia: "semanal",
    ativo: false,
    criado_em: "2025-11-04T00:00:00-03:00",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// relatorio
// ─────────────────────────────────────────────────────────────────────────

export const relatorios: Relatorio[] = [
  // Cofre de rotinas — 3 rodadas.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.cofre,
    executado_em: isoSp("2026-07-29T03:12"),
    status: "atencao",
    resumo: "2 bugs corrigidos e 1 PR aberto esperando sua revisão.",
    testes_passaram: true,
    achados_por_agente: achados([
      ["arquiteto-chefe", "Mapeou 3 pontos de dívida técnica no módulo de agendamento e abriu 1 tarefa mínima.", "3 achados"],
      ["revisor-seguranca", "Nenhuma dependência com CVE aberta. Confirmou que nenhum segredo aparece no repositório.", "0 achados"],
      ["revisor-codigo", "Sinalizou duplicação em lib/schedule.ts — deixou comentário, sem alterar.", "1 comentário"],
      ["dev-backend", "Corrigiu erro de fuso na leitura do cron: a madrugada rodava 1h adiantada.", "2 arquivos"],
      ["dev-frontend", "Ajustou o estado vazio da lista de rodadas.", "1 arquivo"],
      ["qa-testes", "142 testes, todos passando. Cobertura 74%, +1 ponto.", "142 verdes"],
      ["devops-deploy", "Preview publicado. Produção espera o merge do PR #184.", "preview"],
    ]),
  },
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.cofre,
    executado_em: isoSp("2026-07-28T03:05"),
    status: "ok",
    resumo: "140 testes, todos passando",
    testes_passaram: true,
    achados_por_agente: achados([
      ["arquiteto-chefe", "Sem mudanças estruturais propostas nesta rodada.", "0 achados"],
      ["engenheiro-banco", "Índice adicionado em runs(project_id, started_at).", "1 migração"],
      ["qa-testes", "140 testes, todos passando.", "140 verdes"],
      ["devops-deploy", "Merge automático do PR #181 depois da checagem verde.", "deploy ok"],
    ]),
  },
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.cofre,
    executado_em: isoSp("2026-07-27T03:19"),
    status: "falha",
    resumo: "1 teste quebrado",
    testes_passaram: false,
    achados_por_agente: achados([
      ["dev-backend", "Tentou melhoria mínima na fila de rodadas e reverteu depois da falha.", "revertido"],
      ["qa-testes", "139 testes, 1 falha em queue.spec.ts por timeout.", "1 vermelho"],
      ["devops-deploy", "Deploy bloqueado. Falha reportada para a rodada seguinte.", "bloqueado"],
    ]),
  },

  // Medidor de consumo — 2 rodadas.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.medidor,
    executado_em: isoSp("2026-07-29T03:04"),
    status: "ok",
    resumo: "Nenhum bug encontrado, 1 melhoria mínima aplicada.",
    testes_passaram: true,
    achados_por_agente: achados([
      ["revisor-seguranca", "Sem achados. Headers de segurança conferidos.", "0 achados"],
      ["revisor-codigo", "Nenhum bloqueio.", "0 bloqueios"],
      ["dev-frontend", "Melhoria mínima: foco visível nos botões da tabela.", "1 arquivo"],
      ["qa-testes", "88 testes, todos passando.", "88 verdes"],
    ]),
  },
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.medidor,
    executado_em: isoSp("2026-07-28T03:01"),
    status: "ok",
    resumo: "88 testes, todos passando",
    testes_passaram: true,
    achados_por_agente: achados([
      ["arquiteto-chefe", "Sugeriu extrair o cliente de API — fora do escopo mínimo, virou tarefa.", "1 tarefa"],
      ["qa-testes", "88 testes, todos passando.", "88 verdes"],
    ]),
  },

  // Atlas interno — 2 rodadas.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.atlas,
    executado_em: isoSp("2026-07-29T03:27"),
    status: "falha",
    resumo: "Rodada travou: migração pendente quebrou 2 testes de região.",
    testes_passaram: false,
    achados_por_agente: achados([
      ["engenheiro-banco", "Aplicou a migração 0042 em teste; a coluna foi renomeada sem backfill.", "1 migração"],
      ["dev-backend", "Corrigiu 1 chamada quebrada; 2 restantes precisam de decisão humana.", "1 de 3"],
      ["qa-testes", "211 testes, 2 falhas em regions.spec.ts.", "2 vermelhos"],
      ["devops-deploy", "Deploy bloqueado. PR #57 aberto com o diagnóstico completo.", "bloqueado"],
    ]),
  },
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.atlas,
    executado_em: isoSp("2026-07-28T03:11"),
    status: "ok",
    resumo: "211 testes, todos passando",
    testes_passaram: true,
    achados_por_agente: achados([
      ["revisor-codigo", "Nenhum bloqueio.", "0 bloqueios"],
      ["qa-testes", "211 testes, todos passando.", "211 verdes"],
    ]),
  },

  // Pauta editorial — 1 rodada.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.pauta,
    executado_em: isoSp("2026-07-29T02:58"),
    status: "atencao",
    resumo: "1 bug corrigido, 2 PRs aguardando revisão.",
    testes_passaram: true,
    achados_por_agente: achados([
      ["revisor-seguranca", "Sem achados.", "0 achados"],
      ["dev-frontend", "Corrigiu recorte de título longo no card de pauta.", "1 arquivo"],
      ["qa-testes", "64 testes, todos passando.", "64 verdes"],
      ["devops-deploy", "Preview publicado. 2 PRs na fila de revisão.", "preview"],
    ]),
  },

  // Ponte de integrações — 1 rodada.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.ponte,
    executado_em: isoSp("2026-07-29T03:09"),
    status: "ok",
    resumo: "Checagens limpas, nenhuma alteração necessária.",
    testes_passaram: true,
    achados_por_agente: achados([
      ["arquiteto-chefe", "Nada a propor nesta rodada.", "0 achados"],
      ["revisor-seguranca", "Sem achados.", "0 achados"],
      ["qa-testes", "37 testes, todos passando.", "37 verdes"],
    ]),
  },

  // Arquivo morto — 1 rodada, pausado desde então.
  {
    id: idRelatorio(),
    projeto_id: PROJETO_ID.arquivo,
    executado_em: isoSp("2026-07-12T03:02"),
    status: "ok",
    resumo: "Congelado depois da migração do histórico.",
    testes_passaram: true,
    achados_por_agente: achados([["qa-testes", "19 testes, todos passando.", "19 verdes"]]),
  },
];

// ─────────────────────────────────────────────────────────────────────────
// sugestao — propostas que o agente levantou. As marcadas "feita" são a
// origem de projeto.prUrl na tela (a sugestão feita mais recente — plano
// §2.7). Não é uma fila exaustiva: a tela que a exibe fica para o próximo
// PR (plano §7); estas linhas existem só para alimentar a derivação acima
// e para a etapa seguinte já ter dado real para desenhar a fila sobre.
// ─────────────────────────────────────────────────────────────────────────

export const sugestoes: Sugestao[] = [
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.cofre,
    agente: "dev-backend",
    proposta: "Corrigir o fuso horário na leitura do cron do agendamento noturno.",
    motivo: "A madrugada rodava 1h adiantada, atrasando a janela real de execução das rodadas.",
    esforco: "pequeno",
    risco: "Pode alterar o horário de outras rotinas que dependem do mesmo cron.",
    reversibilidade: "facil",
    estado: "feita",
    criada_em: isoSp("2026-07-29T03:12"),
    aprovada_em: isoSp("2026-07-29T07:45"),
    recusada_em: null,
    feita_em: isoSp("2026-07-29T09:20"),
    pr_url: "https://github.com/gravidade/cofre-rotinas/pull/184",
  },
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.cofre,
    agente: "revisor-codigo",
    proposta: "Extrair a lógica duplicada de lib/schedule.ts para uma função compartilhada.",
    motivo: "A duplicação sinalizada aumenta o risco de as duas cópias divergirem numa próxima correção de agendamento.",
    esforco: "medio",
    risco: "Pode introduzir regressão sutil no agendamento se a extração não cobrir todos os casos hoje tratados nas duas cópias.",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: isoSp("2026-07-28T03:05"),
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
  },
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.medidor,
    agente: "arquiteto-chefe",
    proposta: "Extrair o cliente de API do medidor de consumo em módulo próprio.",
    motivo: "O cliente de API está embutido no restante do módulo, fora do escopo mínimo do beta — dificulta testar isoladamente.",
    esforco: "medio",
    risco: "Toca import em vários pontos do módulo; risco de esquecer uma chamada durante a extração.",
    reversibilidade: "facil",
    estado: "pendente",
    criada_em: isoSp("2026-07-28T03:01"),
    aprovada_em: null,
    recusada_em: null,
    feita_em: null,
    pr_url: null,
  },
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.atlas,
    agente: "engenheiro-banco",
    proposta: "Abrir PR com o diagnóstico da migração 0042 (coluna de região renomeada sem backfill).",
    motivo: "Dois testes de região quebraram e o deploy ficou bloqueado até haver decisão entre backfill ou rollback.",
    esforco: "grande",
    risco: "Mexe em coluna já usada em produção; a escolha errada pode quebrar leitura de região para todos os usuários.",
    reversibilidade: "nao_reverte",
    estado: "feita",
    criada_em: isoSp("2026-07-29T03:27"),
    aprovada_em: isoSp("2026-07-29T07:50"),
    recusada_em: null,
    feita_em: isoSp("2026-07-29T08:10"),
    pr_url: "https://github.com/gravidade/atlas/pull/57",
  },
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.pauta,
    agente: "arquiteto-chefe",
    proposta: "Definir regra de recorrência de pauta semanal.",
    motivo: "Sem uma regra padrão, cada pauta recorrente é montada manualmente toda semana.",
    esforco: "medio",
    risco: "Nenhum previsto — mudança de regra de negócio isolada, sem tocar dado existente.",
    reversibilidade: "facil",
    estado: "feita",
    criada_em: isoSp("2026-07-26T02:40"),
    aprovada_em: isoSp("2026-07-27T08:00"),
    recusada_em: null,
    feita_em: isoSp("2026-07-27T10:30"),
    pr_url: "https://github.com/gravidade/pauta/pull/92",
  },
  {
    id: idSugestao(),
    projeto_id: PROJETO_ID.pauta,
    agente: "dev-frontend",
    proposta: "Corrigir o recorte de título longo no card de pauta.",
    motivo: "Títulos longos quebravam o layout do card no calendário editorial.",
    esforco: "pequeno",
    risco: "Nenhum previsto — mudança isolada de estilo no card.",
    reversibilidade: "facil",
    estado: "feita",
    criada_em: isoSp("2026-07-29T02:58"),
    aprovada_em: isoSp("2026-07-29T07:42"),
    recusada_em: null,
    feita_em: isoSp("2026-07-29T09:05"),
    pr_url: "https://github.com/gravidade/pauta/pull/93",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// contexto — aqui usado só para os documentos (arquivo_url preenchido). O
// mapeamento é o do plano §2.8: nome do documento ≈ tipo; agente_destino
// não tem doc correspondente no export, então fica em "arquiteto-chefe"
// (quem, no protocolo de sugestões, cuida de estrutura e prioridades) até
// existir um motivo real para diferenciar por documento.
// ─────────────────────────────────────────────────────────────────────────

interface DocBruto {
  nome: string;
  url: string;
}

const docsPorProjeto: Record<string, DocBruto[]> = {
  [PROJETO_ID.cofre]: [
    { nome: "Especificação do produto", url: "https://www.notion.so/" },
    { nome: "Diagrama de dados", url: "https://drive.google.com/" },
    { nome: "Runbook de incidentes", url: "https://www.notion.so/" },
  ],
  [PROJETO_ID.medidor]: [
    { nome: "Brief inicial", url: "https://drive.google.com/" },
    { nome: "Métricas de API", url: "https://www.notion.so/" },
  ],
  [PROJETO_ID.atlas]: [
    { nome: "Modelo de dados geográficos", url: "https://www.notion.so/" },
    { nome: "Contrato de tiles", url: "https://drive.google.com/" },
  ],
  [PROJETO_ID.pauta]: [{ nome: "Calendário de conteúdo", url: "https://drive.google.com/" }],
  [PROJETO_ID.ponte]: [{ nome: "Mapa de webhooks", url: "https://www.notion.so/" }],
  [PROJETO_ID.arquivo]: [{ nome: "Histórico de decisões", url: "https://www.notion.so/" }],
};

export const contextos: Contexto[] = Object.entries(docsPorProjeto).flatMap(([projetoId, docs]) =>
  docs.map((d) => ({
    id: idContexto(),
    projeto_id: projetoId,
    agente_destino: "arquiteto-chefe",
    tipo: d.nome,
    conteudo: null,
    arquivo_url: d.url,
    origem: "painel" as const,
    criado_em: "2026-07-01T00:00:00-03:00",
    atualizado_em: "2026-07-01T00:00:00-03:00",
  })),
);

// ─────────────────────────────────────────────────────────────────────────
// Sem origem no schema (plano §2.8) — etapa ("onde estamos") e acessos.
// Tipos em src/dominio/visao.ts (EtapaMock, AcessoMock).
// ─────────────────────────────────────────────────────────────────────────

export const ETAPAS: Record<string, EtapaMock> = {
  [PROJETO_ID.cofre]: {
    titulo: "Fila de rodadas estável, revisão pendente",
    selo: "aguardando você",
    contador: "etapa 4 de 6",
    autor: "arquiteto-chefe",
    atualizado: "29 jul, 03:12",
    dias: 0,
    resumo:
      "O agendamento noturno já roda no fuso correto e a fila de rodadas não perde execução. O que falta é decidir se a extração do cliente de API entra agora ou depois do lançamento.",
    proximos: [
      "Revisar e mergear o PR #184 (correção de fuso no cron).",
      "Decidir sobre extrair lib/schedule.ts em módulo próprio.",
      "Subir cobertura de queue.spec.ts acima de 80%.",
    ],
  },
  [PROJETO_ID.medidor]: {
    titulo: "Pronto para beta fechado",
    selo: "em andamento",
    contador: "etapa 5 de 6",
    autor: "arquiteto-chefe",
    atualizado: "29 jul, 03:04",
    dias: 0,
    resumo:
      "Coleta e agregação de consumo estão fechadas e o painel de métricas já responde abaixo de 200ms. Falta só o convite do beta e a checagem de acessibilidade.",
    proximos: [
      "Gerar lista de convites do beta fechado.",
      "Passar auditoria de foco e contraste no painel.",
      "Definir alerta de consumo anômalo.",
    ],
  },
  [PROJETO_ID.atlas]: {
    titulo: "Migração de regiões precisa de decisão sua",
    selo: "travado",
    contador: "etapa 3 de 7",
    autor: "engenheiro-banco",
    atualizado: "29 jul, 03:27",
    dias: 0,
    resumo:
      "A coluna de região foi renomeada sem backfill, então dois testes falham e o deploy está bloqueado. O agente parou de propor mudanças até você escolher entre backfill ou rollback da migração 0042.",
    proximos: [
      "Escolher entre backfill da coluna ou rollback da 0042.",
      "Rodar a suíte de regiões depois da escolha.",
      "Liberar o deploy travado no Fly.io.",
    ],
  },
  [PROJETO_ID.pauta]: {
    titulo: "Calendário funcionando, fila de revisão crescendo",
    selo: "aguardando você",
    contador: "etapa 2 de 5",
    autor: "arquiteto-chefe",
    atualizado: "29 jul, 02:58",
    dias: 0,
    resumo:
      "O calendário de pautas já publica e o recorte de títulos longos foi resolvido. O gargalo agora é humano: dois PRs pequenos parados há três noites.",
    proximos: [
      "Revisar PRs #92 e #93.",
      "Definir regra de recorrência de pauta semanal.",
      "Ligar upload de mídia no Cloudinary.",
    ],
  },
  [PROJETO_ID.ponte]: {
    titulo: "Em manutenção, sem frente aberta",
    selo: "estável",
    contador: "etapa 6 de 6",
    autor: "arquiteto-chefe",
    atualizado: "29 jul, 03:09",
    dias: 0,
    resumo:
      "Todos os webhooks estão mapeados e monitorados; as rodadas só confirmam que nada regrediu. Sem trabalho pendente até chegar uma integração nova.",
    proximos: ["Manter a checagem semanal.", "Revisitar quando entrar a integração de pagamentos."],
  },
  [PROJETO_ID.arquivo]: {
    titulo: "Congelado após a migração do histórico",
    selo: "pausado",
    contador: "etapa 5 de 5",
    autor: "arquiteto-chefe",
    atualizado: "12 jul, 03:02",
    dias: 17,
    resumo:
      "O histórico foi migrado e o projeto entrou em congelamento. Enquanto estiver pausado, este documento não é atualizado pelos agentes.",
    proximos: ["Reativar o acompanhamento se voltar a receber commits."],
  },
};

/** Sem campo de valor — nenhum tipo do app tem campo de credencial (plano §2.11). */
export const ACESSOS: Record<string, AcessoMock[]> = {
  [PROJETO_ID.cofre]: [
    { rotulo: "Neon — banco de produção", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
    { rotulo: "Vercel — deploy", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
    { rotulo: "Auth.js — secret", escopo: "server-side", gerido: "cofre da empresa", url: "https://vercel.com/" },
  ],
  [PROJETO_ID.medidor]: [
    { rotulo: "Supabase — banco de produção", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
    { rotulo: "Resend — envio de e-mail", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
  ],
  [PROJETO_ID.atlas]: [
    { rotulo: "PostGIS — banco de produção", escopo: "server-side", gerido: "cofre da empresa", url: "https://vercel.com/" },
    { rotulo: "Mapbox — tiles", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
    { rotulo: "Fly.io — deploy", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
  ],
  [PROJETO_ID.pauta]: [
    { rotulo: "Neon — banco de produção", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
    { rotulo: "Cloudinary — mídia", escopo: "server-side", gerido: "cofre da empresa", url: "https://vercel.com/" },
  ],
  [PROJETO_ID.ponte]: [
    { rotulo: "Railway — deploy", escopo: "server-side", gerido: "Vercel env", url: "https://vercel.com/" },
  ],
  [PROJETO_ID.arquivo]: [
    { rotulo: "S3 — arquivos", escopo: "server-side", gerido: "cofre da empresa", url: "https://vercel.com/" },
  ],
};

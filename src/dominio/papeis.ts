// Papéis de agente: mono (crachá de duas letras), rótulo do papel e se o agente
// escreve ou só lê. Fora do schema de propósito — relatorio.achados_por_agente.agente
// é texto livre (ver comentário da coluna na migration, linha 63-67): "não há lista
// fechada aqui para não travar quando um agente novo aparecer". PAPEIS é só a tabela
// de apresentação para os agentes conhecidos hoje; um agente desconhecido cai no
// retorno padrão de papelDoAgente.
//
// As 16 entradas abaixo espelham os 16 arquivos em ~/.claude/agents/ na máquina do
// dono (lista também usada por src/dominio/agentesConhecidos.ts) — estendido de 8
// para 16 na entrega da esteira de agentes por projeto (docs/plano-agentes-por-projeto.md
// § 3.3, "Alternativas descartadas": "papeis.ts também é uma cópia, mas é uma cópia
// que um PR atualiza e que aparece em revisão"). A esteira é a primeira tela que
// mostra os 16 lado a lado, então uma entrada faltando ou errada aparece na cara do
// dono, não só num relatório.
//
// `tipo` não é "quais ferramentas o agente tem" — é "o papel dele resulta em código
// de produção mudando, ou em decisão/leitura/plano?". Por isso arquiteto-chefe,
// analista-requisitos e designer-ui são "leitura" mesmo tendo a ferramenta Write:
// eles decidem e especificam, e cada descrição de agente aponta explicitamente para
// quem implementa a partir disso (dev-backend, dev-frontend). `tipo` é só rótulo de
// apresentação na esteira — não é o que decide se um agente pode ser ligado nela.
// Quem estiver habilitado roda no diagnóstico, ponto (mesma decisão do plano § 3.4
// para resolver a contradição do devops-deploy, ver abaixo).
//
// Correção nesta entrega: `devops-deploy` estava classificado "escrita" aqui, mas
// ~/.claude/agents/devops-deploy.md diz, na primeira linha da descrição, "somente
// leitura", lista as ferramentas Read/Grep/Glob/Bash (sem Write nem Edit) e fecha
// com "Nunca altera configuração nem faz deploy" — e o prompt da rodada
// (docs/routine-noturna.md, passo 2.2) sempre o acionou entre "os subagentes, que
// não alteram código". A definição real do agente e o prompt já concordavam; só
// esta tabela estava errada. Corrigido para "leitura".
//
// Também corrigido nesta entrega: a entrada existia como "engenheiro-banco", nome
// que não corresponde a nenhum agente real — o agente que modela dados e migrations
// é `engenheiro-dados` (~/.claude/agents/engenheiro-dados.md), o mesmo nome já usado
// em src/dominio/agentesConhecidos.ts. Renomeada a chave; mono e papel preservados.

export type TipoAgente = "leitura" | "escrita";

export interface Papel {
  mono: string;
  papel: string;
  tipo: TipoAgente;
}

export const PAPEIS: Record<string, Papel> = {
  "analista-requisitos": { mono: "AR", papel: "requisitos", tipo: "leitura" },
  "arquiteto-chefe": { mono: "AC", papel: "estrutura e prioridades", tipo: "leitura" },
  "avaliador-ia": { mono: "AV", papel: "qualidade de ia", tipo: "leitura" },
  "designer-ui": { mono: "UI", papel: "design de interface", tipo: "leitura" },
  "dev-backend": { mono: "BE", papel: "backend", tipo: "escrita" },
  "dev-frontend": { mono: "FE", papel: "interface", tipo: "escrita" },
  "devops-deploy": { mono: "DO", papel: "deploy", tipo: "leitura" },
  // Não é um subagente: é a própria rodada tendo feito a leitura à mão porque
  // o subagente não existia no ambiente dela. O prompt manda registrar assim
  // (docs/routine-noturna.md, passo 2.2) exatamente para não mentir sobre quem
  // olhou o projeto — e sem esta linha o painel exibia "?? · agente", que
  // esconde o que o prompt fez questão de expor: o ambiente da routine está
  // sem os agentes instalados.
  "rodada": { mono: "RN", papel: "a própria rodada, sem subagente", tipo: "leitura" },
  "engenheiro-dados": { mono: "DB", papel: "banco e migrações", tipo: "escrita" },
  "engenheiro-ia": { mono: "IA", papel: "camada de ia", tipo: "escrita" },
  "escriba-docs": { mono: "DC", papel: "documentação", tipo: "escrita" },
  "investigador-bugs": { mono: "IB", papel: "investigação de bugs", tipo: "leitura" },
  "qa-testes": { mono: "QA", papel: "testes", tipo: "leitura" },
  refatorador: { mono: "RF", papel: "refatoração", tipo: "escrita" },
  "revisor-codigo": { mono: "RC", papel: "revisão de código", tipo: "leitura" },
  "revisor-performance": { mono: "RP", papel: "desempenho", tipo: "leitura" },
  "revisor-seguranca": { mono: "SE", papel: "segurança", tipo: "leitura" },
};

const PAPEL_PADRAO: Papel = { mono: "??", papel: "agente", tipo: "leitura" };

export function papelDoAgente(nome: string): Papel {
  return PAPEIS[nome] || PAPEL_PADRAO;
}

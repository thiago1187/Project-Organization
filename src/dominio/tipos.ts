// Espelha as quatro tabelas de db/migrations/001_schema_inicial.sql.
// Cada união de literais corresponde a um CHECK de lista fechada da migration —
// o comentário aponta a linha onde o CHECK está declarado.

/** projeto.frequencia — CHECK projeto_frequencia_valida (linha 27-29). */
export type Frequencia = "toda_madrugada" | "dias_alternados" | "semanal";

/** relatorio.status — CHECK relatorio_status_valido (linha 55). */
export type StatusRelatorio = "ok" | "atencao" | "falha";

/** sugestao.esforco — CHECK sugestao_esforco_valido (linha 95). */
export type Esforco = "pequeno" | "medio" | "grande";

/** sugestao.reversibilidade — CHECK sugestao_reversibilidade_valida (linha 96-98). */
export type Reversibilidade = "facil" | "dificil" | "nao_reverte";

/** sugestao.estado — CHECK sugestao_estado_valido (linha 99). */
export type EstadoSugestao = "pendente" | "aprovada" | "recusada" | "feita";

/** contexto.origem — CHECK contexto_origem_valida (linha 228). Lista fechada a um valor. */
export type OrigemContexto = "painel";

/** tarefa.estado — CHECK tarefa_estado_valido (db/migrations/009_tarefa.sql). */
export type EstadoTarefa = "aberta" | "fazendo" | "feita";

/**
 * projeto — linha 15-30 da migration, `descricao` acrescentada em
 * db/migrations/008_projeto_descricao.sql.
 * "pausar não muda a frequência configurada, só interrompe as rodadas"
 * (comentário da tabela, linha 32-37).
 */
export interface Projeto {
  id: string; // uuid
  nome: string;
  repositorio: string | null; // "owner/repo"
  frequencia: Frequencia;
  ativo: boolean;
  criado_em: string; // timestamptz (ISO)
  /** O que este projeto é, em prosa do dono — null quando ainda não escrita, ou
   * enquanto a migration 008 não foi aplicada. Ver comentário da coluna na migration. */
  descricao: string | null;
}

/**
 * tarefa — db/migrations/009_tarefa.sql. A worklist do dono por projeto:
 * "o que estamos fazendo nele". Não é `sugestao` e não vira `sugestao` — ver
 * o comentário no topo da migration e docs/plano-gerenciador-de-projeto.md
 * § 3.3 para o argumento completo.
 */
export interface Tarefa {
  id: string; // uuid
  projeto_id: string; // uuid
  titulo: string;
  estado: EstadoTarefa;
  ordem: number;
  criado_em: string; // timestamptz (ISO)
  atualizado_em: string; // timestamptz (ISO)
  concluida_em: string | null; // preenchido só quando estado = 'feita'
}

/**
 * relatorio — linha 42-57. Diagnóstico de uma rodada; nunca representa mudança de
 * código (ver CLAUDE.md > "a rodada noturna não altera código").
 */
export interface AchadoAgente {
  agente: string;
  achado: string;
  selo: string;
}

export interface Relatorio {
  id: string; // uuid
  projeto_id: string; // uuid
  executado_em: string; // timestamptz (ISO)
  status: StatusRelatorio;
  resumo: string;
  testes_passaram: boolean | null;
  achados_por_agente: AchadoAgente[];
}

/**
 * sugestao — linha 72-136. Proposta de um agente; só vira trabalho depois de
 * aprovada pelo dono no painel (ver CLAUDE.md > "protocolo de sugestões").
 */
export interface Sugestao {
  id: string; // uuid
  projeto_id: string; // uuid
  agente: string;
  proposta: string;
  motivo: string;
  esforco: Esforco;
  risco: string;
  reversibilidade: Reversibilidade;
  estado: EstadoSugestao;
  criada_em: string; // timestamptz (ISO)
  aprovada_em: string | null;
  recusada_em: string | null;
  feita_em: string | null;
  pr_url: string | null;
}

/**
 * contexto — linha 181-229. Material que o dono anexa por projeto e por agente;
 * é dado, não instrução (ver CLAUDE.md, regra de segurança 6).
 */
export interface Contexto {
  id: string; // uuid
  projeto_id: string; // uuid
  agente_destino: string;
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
  origem: OrigemContexto;
  criado_em: string; // timestamptz (ISO)
  atualizado_em: string; // timestamptz (ISO)
}

/**
 * projeto_agente — db/migrations/005_agentes_por_projeto.sql. A esteira de
 * diagnóstico de um projeto: quais agentes rodam, em que ordem, e com que
 * instrução (o que fazer aqui — diferente de `contexto`, que é o que ler).
 * `instrucao` vai para a chamada do subagente, nunca para o CLAUDE.md (ver
 * docs/plano-agentes-por-projeto.md § 3.3).
 */
export interface ProjetoAgente {
  id: string; // uuid
  projeto_id: string; // uuid
  agente: string;
  habilitado: boolean;
  ordem: number;
  instrucao: string | null;
  teto_sugestoes: number | null; // NULL = herda o teto global (3)
  criado_em: string; // timestamptz (ISO)
  atualizado_em: string; // timestamptz (ISO)
}

/** stack.categoria — CHECK stack_categoria_valida (db/migrations/002_inventario.sql). */
export type CategoriaStack = "linguagem" | "framework" | "runtime";

/** servico.categoria — CHECK servico_categoria_valida (db/migrations/002_inventario.sql). */
export type CategoriaServico = "banco" | "hospedagem" | "modelo" | "autenticacao" | "storage" | "email";

/**
 * stack — db/migrations/002_inventario.sql. Linguagem, framework e runtime de
 * um projeto. Sem `conta` nem `administrado_url` de propósito — ver o
 * comentário de desenho no topo da tabela na migration: não faz sentido
 * perguntar "em qual conta" de uma linguagem de programação.
 */
export interface Stack {
  id: string; // uuid
  projeto_id: string; // uuid
  categoria: CategoriaStack;
  nome: string; // ex.: "TypeScript", "Next.js", "Node.js 20"
  criado_em: string; // timestamptz (ISO)
  atualizado_em: string; // timestamptz (ISO)
}

/**
 * servico — db/migrations/002_inventario.sql. Serviço ou conta externa que o
 * projeto usa, e onde é administrado. Nunca guarda credencial (ver CLAUDE.md,
 * regra de segurança 1, e o comentário no topo da tabela na migration) — não
 * existe coluna `valor`/`chave`/`token`, e os campos livres são rótulos
 * curtos, não um lugar para colar um segredo.
 */
export interface Servico {
  id: string; // uuid
  projeto_id: string; // uuid
  categoria: CategoriaServico;
  nome: string; // ex.: "Neon", "Vercel", "OpenAI"
  conta: string; // em qual conta do dono, ex.: "pessoal", "cliente x"
  papel: string | null; // ex.: "producao", "preview" — opcional
  administrado_url: string | null; // link para o painel de administração — opcional
  criado_em: string; // timestamptz (ISO)
  atualizado_em: string; // timestamptz (ISO)
}

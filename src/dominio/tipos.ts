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

/**
 * projeto — linha 15-30 da migration.
 * "pausar não muda a frequência configurada, só interrompe as rodadas"
 * (comentário da tabela, linha 32-37).
 */
export interface Projeto {
  id: string; // uuid
  nome: string;
  repositorio: string; // "owner/repo"
  frequencia: Frequencia;
  ativo: boolean;
  criado_em: string; // timestamptz (ISO)
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

// Validação de entrada para as Server Actions de `tarefa`
// (src/servidor/acoes-tarefa.ts) — criar, editar título, mudar estado,
// reordenar e apagar. Espelha os CHECKs de db/migrations/009_tarefa.sql. Sem
// import de banco: lógica pura, testável sem conexão — mesmo padrão de
// validacaoAgenteProjeto.ts.
//
// `titulo` é rótulo curto (mesma categoria de contexto.agente_destino e
// projeto_agente.agente), não corpo de texto: sem caractere de controle, e
// com o mesmo tripwire anti-credencial que stack/servico já usam — a
// migration usa `parece_credencial` (SQL); aqui usamos o par em TypeScript
// (`pareceCredencial`, src/dominio/pareceCredencial.ts), que é a mesma regra
// checada duas vezes, como o comentário daquele arquivo já documenta.

import { pareceCredencial } from "./pareceCredencial";
import type { EstadoTarefa } from "./tipos";

const TITULO_TAMANHO_MAXIMO = 200;
const ESTADOS_VALIDOS: readonly EstadoTarefa[] = ["aberta", "fazendo", "feita"];

// Equivalente ao CHECK `!~ '[[:cntrl:]]'` do Postgres — mesmo raciocínio de
// validacaoAgenteProjeto.ts e validacaoContexto.ts.
const CODIGO_CONTROLE_MAXIMO = 0x1f;
const CODIGO_DEL = 0x7f;

function contemCaractereDeControle(valor: string): boolean {
  for (let i = 0; i < valor.length; i++) {
    const codigo = valor.charCodeAt(i);
    if (codigo <= CODIGO_CONTROLE_MAXIMO || codigo === CODIGO_DEL) return true;
  }
  return false;
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function textoNaoVazio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Valida o título de uma tarefa — criação e edição no lugar usam a mesma regra. */
export function validarTituloTarefa(input: unknown): ResultadoValidacao<string> {
  if (!textoNaoVazio(input)) return { ok: false, erro: "Dê um título à tarefa." };
  const titulo = input.trim();
  if (titulo.length > TITULO_TAMANHO_MAXIMO) {
    return { ok: false, erro: `Título muito longo — no máximo ${TITULO_TAMANHO_MAXIMO} caracteres.` };
  }
  if (contemCaractereDeControle(titulo)) {
    return { ok: false, erro: "Título não pode conter quebra de linha nem caractere de controle." };
  }
  if (pareceCredencial(titulo)) {
    return { ok: false, erro: "Este título parece conter uma credencial — não cole segredos aqui." };
  }
  return { ok: true, dados: titulo };
}

/** Valida o estado de destino de uma tarefa — o clique de mover entre colunas/checkbox. */
export function validarEstadoTarefa(input: unknown): ResultadoValidacao<EstadoTarefa> {
  if (typeof input !== "string" || !ESTADOS_VALIDOS.includes(input as EstadoTarefa)) {
    return { ok: false, erro: "Estado de tarefa inválido." };
  }
  return { ok: true, dados: input as EstadoTarefa };
}

/** Valida a lista completa de ids que o cliente manda ao reordenar a worklist de um projeto. */
export function validarOrdemTarefas(input: unknown): ResultadoValidacao<string[]> {
  if (!Array.isArray(input) || input.some((id) => typeof id !== "string" || id.length === 0)) {
    return { ok: false, erro: "Ordem inválida." };
  }
  // Defesa contra payload absurdo — a lista real é de dezenas de itens, não
  // milhares (mesmo raciocínio de validarOrdemAgentes).
  if (input.length > 500) {
    return { ok: false, erro: "Lista de tarefas grande demais." };
  }
  return { ok: true, dados: input as string[] };
}

// Validação de entrada para as Server Actions da esteira de agentes
// (src/servidor/acoes-agentes.ts) — alternar, reordenar, salvar instrução e
// teto. Espelha os CHECKs de db/migrations/005_agentes_por_projeto.sql. Sem
// import de banco: lógica pura, testável sem conexão — mesmo padrão de
// validacaoContexto.ts.
//
// Fronteira do plano (docs/plano-agentes-por-projeto.md § 3.3): instrução é o
// que o agente deve fazer aqui — vai para a chamada do subagente, nunca para
// o CLAUDE.md. Ainda assim é entrada não confiável (regra 6 do CLAUDE.md,
// mesmo raciocínio de contexto.conteudo): teto de tamanho, e nenhuma
// interpolação em comando de sistema ou query. Diferente de
// contexto.agente_destino/tipo, `instrucao` é corpo de texto, não rótulo —
// por isso não há checagem de caractere de controle nela (quebra de linha é
// esperada), só teto de tamanho.

const AGENTE_TAMANHO_MAXIMO = 64;
const INSTRUCAO_TAMANHO_MAXIMO = 4000;
const TETO_SUGESTOES_MINIMO = 0;
const TETO_SUGESTOES_MAXIMO = 3;

// Equivalente ao CHECK `!~ '[[:cntrl:]]'` do Postgres — mesmo raciocínio de
// validacaoContexto.ts: qualquer caractere de controle C0 (inclui \n e \t) ou DEL.
const CODIGO_CONTROLE_MAXIMO = 0x1f; // ultimo codigo C0 (US, 31)
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

/** Valida o nome de um agente vindo de uma Server Action — mesmos limites de `projeto_agente.agente`. */
export function validarNomeAgente(input: unknown): ResultadoValidacao<string> {
  if (!textoNaoVazio(input)) return { ok: false, erro: "agente é obrigatório." };
  const agente = input.trim();
  if (agente.length > AGENTE_TAMANHO_MAXIMO) {
    return { ok: false, erro: `agente não pode passar de ${AGENTE_TAMANHO_MAXIMO} caracteres.` };
  }
  if (contemCaractereDeControle(agente)) {
    return { ok: false, erro: "agente não pode conter quebra de linha nem caractere de controle." };
  }
  return { ok: true, dados: agente };
}

export interface DadosAgenteProjetoValidados {
  instrucao: string | null;
  teto_sugestoes: number | null;
}

/** Valida o corpo do formulário "editar instrução" de um card da esteira (instrucao + teto_sugestoes). */
export function validarInstrucaoAgente(input: unknown): ResultadoValidacao<DadosAgenteProjetoValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { instrucao, teto_sugestoes } = input as Record<string, unknown>;

  let instrucaoValor: string | null = null;
  if (instrucao !== undefined && instrucao !== null) {
    if (typeof instrucao !== "string") return { ok: false, erro: "instrucao precisa ser texto." };
    const aparada = instrucao.trim();
    if (aparada.length > 0) {
      if (aparada.length > INSTRUCAO_TAMANHO_MAXIMO) {
        return { ok: false, erro: `instrucao não pode passar de ${INSTRUCAO_TAMANHO_MAXIMO} caracteres.` };
      }
      instrucaoValor = aparada;
    }
  }

  let tetoValor: number | null = null;
  if (teto_sugestoes !== undefined && teto_sugestoes !== null && teto_sugestoes !== "") {
    const numero = typeof teto_sugestoes === "number" ? teto_sugestoes : Number(teto_sugestoes);
    if (!Number.isInteger(numero) || numero < TETO_SUGESTOES_MINIMO || numero > TETO_SUGESTOES_MAXIMO) {
      return {
        ok: false,
        erro: `teto_sugestoes precisa ser um número inteiro entre ${TETO_SUGESTOES_MINIMO} e ${TETO_SUGESTOES_MAXIMO}.`,
      };
    }
    tetoValor = numero;
  }

  return { ok: true, dados: { instrucao: instrucaoValor, teto_sugestoes: tetoValor } };
}

/** Valida a lista completa de agentes ativos que o cliente manda ao reordenar a esteira. */
export function validarOrdemAgentes(input: unknown): ResultadoValidacao<string[]> {
  if (!Array.isArray(input) || input.some((a) => typeof a !== "string")) {
    return { ok: false, erro: "Ordem inválida." };
  }
  // Bem acima dos 16 agentes conhecidos hoje — defesa contra payload absurdo,
  // não um limite de produto (ver AGENTES_CONHECIDOS em agentesConhecidos.ts).
  if (input.length > 64) {
    return { ok: false, erro: "Lista de agentes grande demais." };
  }
  for (const agente of input) {
    const validado = validarNomeAgente(agente);
    if (!validado.ok) return validado;
  }
  return { ok: true, dados: input as string[] };
}

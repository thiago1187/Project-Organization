// Validação de entrada das três portas de escrita de `contexto`: PUT
// /api/context/:projeto, a Server Action `salvarContextoAction`
// (src/servidor/acoes-contexto.ts) e a ferramenta `anexar_contexto` do
// servidor MCP (src/servidor/mcp.ts). Nenhuma delas é a routine — regra 4 do
// CLAUDE.md: a rodada só lê contexto, porque contexto vira instrução no
// CLAUDE.md do repositório alvo.
//
// A terceira porta é a que mais exige destes CHECKs. O texto que chega por
// ela pode ter sido lido pelo modelo de um README ou de uma página, e vai
// acabar num arquivo que todo agente da rodada seguinte recebe. Espelha os CHECKs
// de db/migrations/001_schema_inicial.sql > contexto. Sem import de banco:
// lógica pura, testável sem conexão — mesmo padrão de validacaoSugestao.ts.
//
// Regra 6 do CLAUDE.md: contexto é dado, não instrução, e `agente_destino` e
// `tipo` viram rótulo de seção no CLAUDE.md que a routine escreve no
// repositório alvo — por isso os dois proíbem caractere de controle (inclui
// quebra de linha): sem essa checagem, um rótulo vira estrutura de documento.

const AGENTE_DESTINO_TAMANHO_MAXIMO = 64;
const TIPO_TAMANHO_MAXIMO = 64;
const CONTEUDO_TAMANHO_MAXIMO = 20000;

// Equivalente ao CHECK `!~ '[[:cntrl:]]'` do Postgres: qualquer caractere de
// controle C0 (inclui \n e \t) ou o DEL (0x7F).
const CONTROLE_REGEX = /[\u0000-\u001F\u007F]/;

// Mesma restrição do CHECK contexto_arquivo_url_formato — só https, para não
// abrir "file:///" nem endereço de metadados de instância (SSRF) a partir do
// ambiente que busca isto para montar o CLAUDE.md.
const ARQUIVO_URL_REGEX = /^https:\/\//;

export interface DadosContextoValidados {
  agente_destino: string;
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function textoNaoVazio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Valida o corpo de `PUT /api/context/:projeto` (e o form de `salvarContextoAction`). */
export function validarContexto(input: unknown): ResultadoValidacao<DadosContextoValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { agente_destino, tipo, conteudo, arquivo_url } = input as Record<string, unknown>;

  if (!textoNaoVazio(agente_destino)) return { ok: false, erro: "agente_destino é obrigatório." };
  const destino = agente_destino.trim();
  if (destino.length > AGENTE_DESTINO_TAMANHO_MAXIMO) {
    return { ok: false, erro: `agente_destino não pode passar de ${AGENTE_DESTINO_TAMANHO_MAXIMO} caracteres.` };
  }
  if (CONTROLE_REGEX.test(destino)) {
    return { ok: false, erro: "agente_destino não pode conter quebra de linha nem caractere de controle." };
  }

  if (!textoNaoVazio(tipo)) return { ok: false, erro: "tipo é obrigatório." };
  const tipoValor = tipo.trim();
  if (tipoValor.length > TIPO_TAMANHO_MAXIMO) {
    return { ok: false, erro: `tipo não pode passar de ${TIPO_TAMANHO_MAXIMO} caracteres.` };
  }
  if (CONTROLE_REGEX.test(tipoValor)) {
    return { ok: false, erro: "tipo não pode conter quebra de linha nem caractere de controle." };
  }

  let conteudoValor: string | null = null;
  if (conteudo !== undefined && conteudo !== null) {
    if (typeof conteudo !== "string") return { ok: false, erro: "conteudo precisa ser texto." };
    const aparado = conteudo.trim();
    if (aparado.length > 0) {
      if (aparado.length > CONTEUDO_TAMANHO_MAXIMO) {
        return { ok: false, erro: `conteudo não pode passar de ${CONTEUDO_TAMANHO_MAXIMO} caracteres.` };
      }
      conteudoValor = aparado;
    }
  }

  let arquivoUrlValor: string | null = null;
  if (arquivo_url !== undefined && arquivo_url !== null) {
    if (typeof arquivo_url !== "string") return { ok: false, erro: "arquivo_url precisa ser texto." };
    const aparado = arquivo_url.trim();
    if (aparado.length > 0) {
      if (!ARQUIVO_URL_REGEX.test(aparado)) {
        return { ok: false, erro: "arquivo_url precisa começar com https://." };
      }
      arquivoUrlValor = aparado;
    }
  }

  if (conteudoValor === null && arquivoUrlValor === null) {
    return { ok: false, erro: "Informe um conteúdo ou um link de arquivo." };
  }

  return {
    ok: true,
    dados: { agente_destino: destino, tipo: tipoValor, conteudo: conteudoValor, arquivo_url: arquivoUrlValor },
  };
}

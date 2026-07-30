// Validação de entrada para as Server Actions de inventário de projeto — stack
// e serviço (src/servidor/acoes-inventario.ts). Espelha os CHECKs de
// db/migrations/002_inventario.sql > stack e > servico. Sem import de banco:
// lógica pura, testável sem conexão — mesmo padrão de validacaoContexto.ts e
// validacaoAgenteProjeto.ts.
//
// Regra 1 do CLAUDE.md e o comentário no topo da migration 002: nenhum campo
// aqui guarda valor de credencial, e isso é estrutural — não existe coluna
// valor/chave/token. O que resta a validar aqui é o mesmo tripwire que a
// migration aplica no banco (`parece_credencial`, função SQL), espelhado em
// JavaScript por `pareceCredencial` (src/dominio/pareceCredencial.ts, mesmos
// padrões reconhecidos) — com mensagem legível, para não deixar o CHECK do
// Postgres recusar com um erro genérico de "dados inválidos".

import type { CategoriaServico, CategoriaStack } from "./tipos";
import { pareceCredencial } from "./pareceCredencial";

const CATEGORIAS_STACK: readonly CategoriaStack[] = ["linguagem", "framework", "runtime"];
const CATEGORIAS_SERVICO: readonly CategoriaServico[] = [
  "banco",
  "hospedagem",
  "modelo",
  "autenticacao",
  "storage",
  "email",
];

const NOME_TAMANHO_MAXIMO = 120;
const CONTA_TAMANHO_MAXIMO = 120;
const PAPEL_TAMANHO_MAXIMO = 120;
const ADMINISTRADO_URL_TAMANHO_MAXIMO = 500;

// Equivalente ao CHECK `!~ '[[:cntrl:]]'` do Postgres, código do caractere em
// vez de escape literal (evita depender de como o editor/arquivo trata
// caractere de controle bruto na fonte) — mesmo raciocínio de
// validacaoAgenteProjeto.ts > contemCaractereDeControle.
const CODIGO_CONTROLE_MAXIMO = 0x1f; // último código C0 (US, 31)
const CODIGO_DEL = 0x7f;

function contemCaractereDeControle(valor: string): boolean {
  for (let i = 0; i < valor.length; i++) {
    const codigo = valor.charCodeAt(i);
    if (codigo <= CODIGO_CONTROLE_MAXIMO || codigo === CODIGO_DEL) return true;
  }
  return false;
}

// Mesma restrição do CHECK servico_administrado_url_formato — só https,
// mesmo raciocínio de contexto.arquivo_url (evita "file:///" e alvo de SSRF).
const ADMINISTRADO_URL_REGEX = /^https:\/\//;

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

const MENSAGEM_CREDENCIAL =
  "parece conter uma credencial — isto é inventário, não segredo. Os valores vivem nas environment variables do Vercel.";

/**
 * Valida um rótulo curto de texto livre (nome, conta ou papel): teto de
 * tamanho, sem caractere de controle, sem cara de credencial. `obrigatorio`
 * decide se ausente/vazio é erro ou vira `null` — mesmo tratamento de
 * `contexto.conteudo` em validacaoContexto.ts (espaço em branco não conta
 * como preenchido).
 */
function validarRotulo(
  valor: unknown,
  campo: string,
  tamanhoMaximo: number,
  obrigatorio: boolean,
): ResultadoValidacao<string | null> {
  if (valor === undefined || valor === null || (typeof valor === "string" && valor.trim().length === 0)) {
    if (obrigatorio) return { ok: false, erro: `${campo} é obrigatório.` };
    return { ok: true, dados: null };
  }
  if (typeof valor !== "string") return { ok: false, erro: `${campo} precisa ser texto.` };
  const aparado = valor.trim();
  if (aparado.length > tamanhoMaximo) {
    return { ok: false, erro: `${campo} não pode passar de ${tamanhoMaximo} caracteres.` };
  }
  if (contemCaractereDeControle(aparado)) {
    return { ok: false, erro: `${campo} não pode conter quebra de linha nem caractere de controle.` };
  }
  if (pareceCredencial(aparado)) {
    return { ok: false, erro: `${campo} ${MENSAGEM_CREDENCIAL}` };
  }
  return { ok: true, dados: aparado };
}

export interface DadosStackValidados {
  categoria: CategoriaStack;
  nome: string;
}

/** Valida o corpo de `salvarStackAction` — criar ou editar um item de `stack`. */
export function validarStack(input: unknown): ResultadoValidacao<DadosStackValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { categoria, nome } = input as Record<string, unknown>;

  if (typeof categoria !== "string" || !CATEGORIAS_STACK.includes(categoria as CategoriaStack)) {
    return { ok: false, erro: `categoria precisa ser um de: ${CATEGORIAS_STACK.join(", ")}.` };
  }

  const nomeValidado = validarRotulo(nome, "nome", NOME_TAMANHO_MAXIMO, true);
  if (!nomeValidado.ok) return nomeValidado;

  return { ok: true, dados: { categoria: categoria as CategoriaStack, nome: nomeValidado.dados as string } };
}

export interface DadosServicoValidados {
  categoria: CategoriaServico;
  nome: string;
  conta: string;
  papel: string | null;
  administrado_url: string | null;
}

/** Valida o corpo de `salvarServicoAction` — criar ou editar um item de `servico`. */
export function validarServico(input: unknown): ResultadoValidacao<DadosServicoValidados> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, erro: "Corpo da requisição precisa ser um objeto JSON." };
  }
  const { categoria, nome, conta, papel, administrado_url } = input as Record<string, unknown>;

  if (typeof categoria !== "string" || !CATEGORIAS_SERVICO.includes(categoria as CategoriaServico)) {
    return { ok: false, erro: `categoria precisa ser um de: ${CATEGORIAS_SERVICO.join(", ")}.` };
  }

  const nomeValidado = validarRotulo(nome, "nome", NOME_TAMANHO_MAXIMO, true);
  if (!nomeValidado.ok) return nomeValidado;

  const contaValidada = validarRotulo(conta, "conta", CONTA_TAMANHO_MAXIMO, true);
  if (!contaValidada.ok) return contaValidada;

  const papelValidado = validarRotulo(papel, "papel", PAPEL_TAMANHO_MAXIMO, false);
  if (!papelValidado.ok) return papelValidado;

  let administradoUrlValor: string | null = null;
  if (administrado_url !== undefined && administrado_url !== null) {
    if (typeof administrado_url !== "string") {
      return { ok: false, erro: "administrado_url precisa ser texto." };
    }
    const aparado = administrado_url.trim();
    if (aparado.length > 0) {
      if (!ADMINISTRADO_URL_REGEX.test(aparado)) {
        return { ok: false, erro: "administrado_url precisa começar com https://." };
      }
      if (aparado.length > ADMINISTRADO_URL_TAMANHO_MAXIMO) {
        return {
          ok: false,
          erro: `administrado_url não pode passar de ${ADMINISTRADO_URL_TAMANHO_MAXIMO} caracteres.`,
        };
      }
      if (pareceCredencial(aparado)) {
        return { ok: false, erro: `administrado_url ${MENSAGEM_CREDENCIAL}` };
      }
      administradoUrlValor = aparado;
    }
  }

  return {
    ok: true,
    dados: {
      categoria: categoria as CategoriaServico,
      nome: nomeValidado.dados as string,
      conta: contaValidada.dados as string,
      papel: papelValidado.dados,
      administrado_url: administradoUrlValor,
    },
  };
}

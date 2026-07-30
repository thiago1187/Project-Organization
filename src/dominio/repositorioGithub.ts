// Importação de repositório do GitHub no cadastro (docs/proximos-passos.md,
// item 8: "GitHub no cadastro"). Duas responsabilidades puras, sem `fetch` —
// mesma separação de validacaoProjeto.ts/validacaoInventario.ts: a chamada de
// rede vive em src/servidor/github.ts, fora de teste; isto aqui é o que dá
// para testar sem conexão.
//
// 1. `extrairDonoRepo` — o dono cola URL ou texto solto; isto reconhece
//    "dono/repo" dentro do que ele colou.
// 2. `normalizarRepositorioGithub` — o que a API do GitHub devolve é texto
//    escrito por outra pessoa (regra 6 do CLAUDE.md): trata como entrada não
//    confiável antes de deixar chegar perto de um campo de formulário.

import { pareceCredencial } from "./pareceCredencial";

// Mesmo alfabeto de FORMATO_REPOSITORIO em validacaoProjeto.ts — não é o
// validador oficial de nomes do GitHub, só o que basta para reconhecer
// "dono/repo" dentro do que foi colado.
const SEGMENTO_REPO = /^[\w.-]+$/;

function segmentoValido(segmento: string): boolean {
  return SEGMENTO_REPO.test(segmento) && segmento !== "." && segmento !== "..";
}

export interface DonoRepo {
  dono: string;
  repo: string;
}

function repoSemSufixoGit(repo: string): string {
  return repo.endsWith(".git") ? repo.slice(0, -4) : repo;
}

function montarSeValido(dono: string, repoBruto: string): DonoRepo | null {
  const repo = repoSemSufixoGit(repoBruto);
  if (!segmentoValido(dono) || !segmentoValido(repo)) return null;
  return { dono, repo };
}

/**
 * Reconhece "dono/repositório" a partir do que o dono colou no cadastro:
 * `dono/repo` puro, a URL completa do GitHub (com ou sem `.git`, com ou sem
 * caminho depois, como `/tree/main`), ou a forma SSH (`git@github.com:...`).
 * Devolve `null` quando não reconhece nada — o chamador trata isso como
 * "não é um repositório do GitHub", não como erro de rede.
 */
export function extrairDonoRepo(entrada: string): DonoRepo | null {
  const texto = entrada.trim();
  if (!texto) return null;

  // Forma SSH: git@github.com:dono/repo(.git)?
  const ssh = texto.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) return montarSeValido(ssh[1], ssh[2]);

  // URL do GitHub, com ou sem protocolo. Prefixa https:// quando o dono só
  // colou "github.com/dono/repo" sem protocolo.
  const comHost = /^(https?:\/\/)?(www\.)?github\.com\//i.test(texto);
  if (comHost) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    } catch {
      return null;
    }
    if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null;
    const segmentos = url.pathname.split("/").filter(Boolean);
    if (segmentos.length < 2) return null;
    return montarSeValido(segmentos[0], segmentos[1]);
  }

  // Texto solto: só aceita a forma exata "dono/repo", uma barra.
  const partes = texto.split("/");
  if (partes.length !== 2) return null;
  return montarSeValido(partes[0], partes[1]);
}

// ─────────────────────────────────────────────────────────────────────────
// Normalização da resposta do GitHub — entrada não confiável (regra 6)
// ─────────────────────────────────────────────────────────────────────────

const NOME_TAMANHO_MAXIMO = 200; // espelha NOME_TAMANHO_MAXIMO de validacaoProjeto.ts
const DESCRICAO_TAMANHO_MAXIMO = 500; // GitHub já limita a 350; folga generosa, bem abaixo do teto de 2000 do campo
const MENSAGEM_COMMIT_TAMANHO_MAXIMO = 200;
const README_TAMANHO_MAXIMO = 1500;
const LINGUAGENS_MAXIMO = 6;
const LINGUAGEM_TAMANHO_MAXIMO = 40;

const CODIGO_CONTROLE_MAXIMO = 0x1f;
const CODIGO_DEL = 0x7f;

/** Remove caractere de controle, preservando quebra de linha (\n, código 10) — mesmo raciocínio de validacaoInventario.ts, exceto aqui o texto é prosa (descrição, README), não rótulo curto. */
function semCaractereDeControle(valor: string, permitirQuebraDeLinha: boolean): string {
  let resultado = "";
  for (let i = 0; i < valor.length; i++) {
    const codigo = valor.charCodeAt(i);
    const ehQuebraDeLinhaPermitida = permitirQuebraDeLinha && (codigo === 10 || codigo === 9);
    if (ehQuebraDeLinhaPermitida) {
      resultado += valor[i];
      continue;
    }
    if (codigo <= CODIGO_CONTROLE_MAXIMO || codigo === CODIGO_DEL) continue;
    resultado += valor[i];
  }
  return resultado;
}

function truncar(valor: string, tamanhoMaximo: number): string {
  return valor.length > tamanhoMaximo ? `${valor.slice(0, tamanhoMaximo).trim()}…` : valor;
}

/**
 * Sanitiza um campo de prosa vindo do GitHub: apara, remove caractere de
 * controle, corta no tamanho, e some inteiro se tiver cara de credencial —
 * diferente de `semCredencial` (que deixa um marcador), aqui o valor pode
 * acabar num campo editável do cadastro, e um marcador de texto salvo sem o
 * dono notar seria pior que o campo simplesmente vazio.
 */
function sanitizarProsa(
  valor: string | null | undefined,
  tamanhoMaximo: number,
  permitirQuebraDeLinha: boolean,
): string | null {
  if (typeof valor !== "string") return null;
  const aparado = semCaractereDeControle(valor, permitirQuebraDeLinha).trim();
  if (!aparado) return null;
  if (pareceCredencial(aparado)) return null;
  return truncar(aparado, tamanhoMaximo);
}

export interface UltimoCommitGithubBruto {
  sha: string | null;
  mensagem: string | null;
  data: string | null;
}

export interface RepositorioGithubBruto {
  nome: string | null;
  descricao: string | null;
  /** Já vem ordenada por bytes decrescente — a chamada de rede (src/servidor/github.ts) decide a ordem; aqui só corta e sanitiza. */
  linguagens: readonly string[];
  ultimoCommit: UltimoCommitGithubBruto | null;
  prsAbertos: { quantidade: number; aproximado: boolean } | null;
  /** Conteúdo do README já decodificado de base64 pela camada de servidor — decodificar é chamada de rede, não pertence aqui. */
  readme: string | null;
}

export interface UltimoCommitGithubNormalizado {
  sha: string;
  mensagem: string;
  data: string | null;
}

export interface RepositorioGithubNormalizado {
  repositorio: string; // "dono/repo"
  nome: string;
  descricao: string | null;
  linguagens: string[];
  ultimoCommit: UltimoCommitGithubNormalizado | null;
  prsAbertos: { quantidade: number; aproximado: boolean } | null;
  readmeResumo: string | null;
}

const SHA_TAMANHO_CURTO = 7;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function normalizarUltimoCommit(bruto: UltimoCommitGithubBruto | null): UltimoCommitGithubNormalizado | null {
  if (!bruto || typeof bruto.sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(bruto.sha)) return null;
  // Só a primeira linha da mensagem de commit — corpo estendido é ruído para
  // um resumo de importação, e mensagem de commit já foi vista carregando
  // segredo colado por engano (regra 6: trata como entrada não confiável).
  const primeiraLinha = typeof bruto.mensagem === "string" ? bruto.mensagem.split("\n")[0] : "";
  const mensagem = sanitizarProsa(primeiraLinha, MENSAGEM_COMMIT_TAMANHO_MAXIMO, false) ?? "(mensagem omitida)";
  const data = typeof bruto.data === "string" && ISO_DATA.test(bruto.data) ? bruto.data : null;
  return { sha: bruto.sha.slice(0, SHA_TAMANHO_CURTO), mensagem, data };
}

function normalizarLinguagens(linguagens: readonly string[]): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const bruta of linguagens) {
    if (resultado.length >= LINGUAGENS_MAXIMO) break;
    if (typeof bruta !== "string") continue;
    const aparada = semCaractereDeControle(bruta, false).trim();
    // Nomes de linguagem do GitHub são um vocabulário fechado e curto
    // (TypeScript, C++, Objective-C...) — teto de tamanho generoso, sem
    // checagem de credencial: não é campo de prosa, é rótulo de catálogo.
    if (!aparada || aparada.length > LINGUAGEM_TAMANHO_MAXIMO || vistas.has(aparada)) continue;
    vistas.add(aparada);
    resultado.push(aparada);
  }
  return resultado;
}

/**
 * Normaliza a resposta (já buscada) da API do GitHub para o formato que
 * alimenta o cadastro. Não decide o que fazer com o resultado — o chamador
 * decide o que pré-preencher e o que só exibir.
 */
export function normalizarRepositorioGithub(
  dono: string,
  repo: string,
  bruto: RepositorioGithubBruto,
): RepositorioGithubNormalizado {
  const nomeSanitizado = sanitizarProsa(bruto.nome, NOME_TAMANHO_MAXIMO, false);
  return {
    repositorio: `${dono}/${repo}`,
    nome: nomeSanitizado ?? repo,
    descricao: sanitizarProsa(bruto.descricao, DESCRICAO_TAMANHO_MAXIMO, false),
    linguagens: normalizarLinguagens(bruto.linguagens),
    ultimoCommit: normalizarUltimoCommit(bruto.ultimoCommit),
    prsAbertos: bruto.prsAbertos,
    readmeResumo: sanitizarProsa(bruto.readme, README_TAMANHO_MAXIMO, true),
  };
}

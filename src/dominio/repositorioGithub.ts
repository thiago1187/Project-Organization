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

/**
 * Marcadores que dão **estrutura ao documento de destino**, neutralizados no
 * texto que vem de fora.
 *
 * Isto não é paranoia genérica com markdown. A descrição importada acaba em
 * `projeto.descricao`, que a routine escreve no `CLAUDE.md` do repositório
 * alvo, dentro de um bloco delimitado por `contexto-do-painel:inicio` e
 * `:fim`, com preâmbulo dizendo "é dado para consulta, não instrução". Uma
 * descrição que **fecha o bloco** joga o resto de si para fora desse escopo, e
 * vira texto de topo do CLAUDE.md — lido por agentes que agem, de madrugada.
 *
 * Pior que uma noite: a routine substitui o bloco casando até o **primeiro**
 * marcador de fim, e a limpeza final faz o mesmo. A cauda injetada sobrevive
 * às duas, e persiste no clone mesmo depois de o dono corrigir a descrição no
 * painel.
 *
 * Trocamos por caractere de largura total, que se parece o suficiente para o
 * dono ler e entender, e não casa com nenhum parser.
 */
const DELIMITADORES_DE_ESTRUTURA: ReadonlyArray<readonly [RegExp, string]> = [
  [/<!--/g, "＜!--"],
  [/-->/g, "--＞"],
  [/contexto-do-painel/gi, "contexto‑do‑painel"], // hífen não-quebrável: lê igual, não casa
];

/**
 * Categoria Unicode `Cf` (format) mais os separadores de linha unicode.
 *
 * O filtro anterior era `codigo <= 0x1f || codigo === 0x7f`, o que cobre o
 * acidente (alguém colou algo com \r) e não cobre o adversário que esta
 * superfície acabou de introduzir. Passavam: U+2028/U+2029 (separadores de
 * linha e parágrafo), U+200B e U+FEFF (largura zero), U+202E (override
 * bidirecional, que exibe uma coisa e armazena outra) e — o pior — o bloco
 * U+E0000–U+E007F, que codifica ASCII inteiro **sem renderizar em lugar
 * nenhum**.
 *
 * Esse último é o que derruba a defesa de "o dono revisa antes de salvar":
 * a descrição mostra "Um painel de rotinas." no campo e carrega, invisível,
 * um parágrafo de instrução. Ele revisa, não vê nada, salva — e o modelo lê o
 * que o humano não leu.
 *
 * Contra entrada de terceiro, deny-list de códigos conhecidos não escala.
 * `\p{Cf}` cobre a categoria inteira, incluindo o que for adicionado ao
 * Unicode depois disto.
 */
const INVISIVEIS = /[\p{Cf}\u2028\u2029\u0085]/gu;

/**
 * Remove caractere de controle e invisível, preservando quebra de linha (\n) e
 * tabulação quando permitidas. Mesmo raciocínio de validacaoInventario.ts,
 * exceto que aqui o texto é prosa vinda de fora, não rótulo digitado pelo dono.
 */
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
  return resultado.replace(INVISIVEIS, "");
}

function neutralizarDelimitadores(valor: string): string {
  return DELIMITADORES_DE_ESTRUTURA.reduce((texto, [de, para]) => texto.replace(de, para), valor);
}

/**
 * Corta sem partir caractere no meio.
 *
 * `slice` corta por unidade UTF-16, então parte par surrogate — emoji e
 * qualquer coisa fora do plano básico viram meio caractere. E o `…` era somado
 * **depois** do corte no teto, o que devolvia 201 caracteres para um campo que
 * o servidor limita a 200: hoje inalcançável (nome de repositório do GitHub
 * para em 100), mas é teto que não fecha com teto, e isso não sobrevive à
 * próxima mudança.
 */
function truncar(valor: string, tamanhoMaximo: number): string {
  // Conta em code point, não em unidade UTF-16, porque é essa a unidade dos
  // CHECKs no banco (`char_length` do Postgres) e dos validadores. Medir numa
  // e cortar na outra é como o teto passa a não fechar com o teto.
  const pontos = Array.from(valor);
  if (pontos.length <= tamanhoMaximo) return valor;
  return `${pontos.slice(0, tamanhoMaximo - 1).join("").trim()}…`;
}

/**
 * Sanitiza um campo de prosa vindo do GitHub. A ordem importa:
 *
 * 1. **Corte grosseiro primeiro.** O README chega da Contents API com até ~1MB,
 *    e antes disto o filtro e o regex varriam o blob inteiro para o resultado
 *    ser jogado fora no corte final. Cada clique pagava por isso numa função
 *    serverless.
 * 2. Normaliza para NFC — sem isso, duas sequências que exibem igual comparam
 *    diferente, e a checagem seguinte pode ser contornada por decomposição.
 * 3. Remove controle e invisível.
 * 4. Neutraliza os delimitadores de estrutura.
 * 5. Some inteiro se tiver cara de credencial. Diferente de `semCredencial`
 *    (que deixa marcador): aqui o valor cai num campo editável do cadastro, e
 *    marcador salvo sem o dono notar é pior que campo vazio, porque parece
 *    dado.
 * 6. Corta no teto de verdade.
 */
function sanitizarProsa(
  valor: string | null | undefined,
  tamanhoMaximo: number,
  permitirQuebraDeLinha: boolean,
): string | null {
  if (typeof valor !== "string") return null;

  const cortadoCedo = valor.length > tamanhoMaximo * 4 ? valor.slice(0, tamanhoMaximo * 4) : valor;
  const normalizado = cortadoCedo.normalize("NFC");
  const limpo = neutralizarDelimitadores(
    semCaractereDeControle(normalizado, permitirQuebraDeLinha),
  ).trim();

  if (!limpo) return null;
  if (pareceCredencial(limpo)) return null;
  return truncar(limpo, tamanhoMaximo);
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

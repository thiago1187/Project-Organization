import "server-only";

// Chamada de rede à API pública do GitHub — item 8 de docs/proximos-passos.md
// ("GitHub no cadastro"). Fica fora do teste de propósito (a normalização
// pura vive em src/dominio/repositorioGithub.ts, testada sem rede); aqui
// existem o `fetch`, o timeout e a leitura do corpo.
//
// Sem token: 60 requisições/hora por IP, compartilhado na Vercel — pode já
// estar zerado quando o dono for usar. Com `GITHUB_TOKEN` (fine-grained,
// read-only) configurado como environment variable: 5.000/hora. A variável é
// lida só aqui, nunca exposta ao cliente (regra 1 do CLAUDE.md), e sua
// ausência não trava nada — o caminho sem token é o caminho normal, não um
// modo degradado tratado como erro.

import type { RepositorioGithubBruto } from "@/dominio/repositorioGithub";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 5000;
const USER_AGENT = "painel-de-controle (uso pessoal)";

export type MotivoFalhaGithub = "nao_encontrado" | "limite" | "falha";

export type ResultadoBuscaGithub =
  | { ok: true; dados: RepositorioGithubBruto }
  | { ok: false; motivo: MotivoFalhaGithub };

function cabecalhos(): HeadersInit {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

/**
 * Uma requisição, com o corpo já lido dentro do mesmo temporizador.
 *
 * A leitura do corpo ficava nos chamadores, depois do `clearTimeout` — o que
 * existia era timeout de *resposta*, não de requisição: assim que o cabeçalho
 * chegava, o sinal era liberado e um corpo que nunca terminasse ficaria
 * pendurado. Cada chamada tem seu próprio orçamento de 5s (não um compartilhado
 * entre as cinco), e agora ele cobre até a última linha do corpo.
 *
 * `redirect: "manual"` porque o padrão do `fetch` é seguir. `GITHUB_API` é
 * constante e `dono`/`repo` são `[\w.-]+`, então não há como sair de
 * `/repos/...` — isto não é defesa contra SSRF, é o princípio de não seguir
 * cegamente para onde um serviço externo mandar, ainda mais com `Authorization`
 * no cabeçalho.
 */
async function buscar<T>(caminho: string): Promise<{ resposta: Response; corpo: T | null } | null> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(`${GITHUB_API}${caminho}`, {
      headers: cabecalhos(),
      signal: controlador.signal,
      redirect: "manual",
    });

    // 3xx vira falha em vez de ser seguido. O GitHub não redireciona nestes
    // caminhos no uso normal; se passar a redirecionar, é mudança que merece
    // ser vista, não absorvida em silêncio.
    if (resposta.status >= 300 && resposta.status < 400) {
      console.error(`[github] redirect inesperado em ${caminho}: ${resposta.status}`);
      return null;
    }

    if (!resposta.ok) return { resposta, corpo: null };

    try {
      return { resposta, corpo: (await resposta.json()) as T };
    } catch {
      return { resposta, corpo: null };
    }
  } catch (erro) {
    // Timeout (AbortError) ou falha de rede — GitHub fora do ar não pode
    // travar o cadastro. Detalhe fica só no log do servidor (regra 5).
    console.error(`[github] falha ao buscar ${caminho}:`, erro);
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

function estaComLimiteEsgotado(resposta: Response): boolean {
  return resposta.status === 403 && resposta.headers.get("x-ratelimit-remaining") === "0";
}

/** Busca `/repos/{dono}/{repo}/languages` — nomes ordenados por bytes decrescente. */
async function buscarLinguagens(dono: string, repo: string): Promise<string[]> {
  const r = await buscar<Record<string, number>>(`/repos/${dono}/${repo}/languages`);
  if (!r?.corpo || typeof r.corpo !== "object") return [];
  return Object.entries(r.corpo)
    .sort(([, a], [, b]) => b - a)
    .map(([nome]) => nome);
}

/** Busca o commit mais recente do branch padrão via `/commits?per_page=1`. */
async function buscarUltimoCommit(
  dono: string,
  repo: string,
): Promise<RepositorioGithubBruto["ultimoCommit"]> {
  type LinhaCommit = {
    sha?: string;
    commit?: { message?: string; author?: { date?: string } | null };
  };
  const r = await buscar<LinhaCommit[]>(`/repos/${dono}/${repo}/commits?per_page=1`);
  const primeiro = Array.isArray(r?.corpo) ? r.corpo[0] : undefined;
  if (!primeiro) return null;
  return {
    sha: primeiro.sha ?? null,
    mensagem: primeiro.commit?.message ?? null,
    data: primeiro.commit?.author?.date ?? null,
  };
}

// GitHub não expõe "quantidade de PRs abertos" direto; `/pulls?state=open`
// devolve a lista. Cem é generoso para um projeto pessoal e barato (uma
// página); quando bate no teto, `aproximado: true` avisa que é "100 ou mais",
// não um número exato.
const TETO_PRS_CONTADOS = 100;

/** ~48KB de base64 → ~36KB de texto, muito acima do teto de 1500 do domínio. */
const TETO_README_BASE64 = 48_000;

async function buscarPrsAbertos(dono: string, repo: string): Promise<RepositorioGithubBruto["prsAbertos"]> {
  const r = await buscar<unknown[]>(
    `/repos/${dono}/${repo}/pulls?state=open&per_page=${TETO_PRS_CONTADOS}`,
  );
  if (!Array.isArray(r?.corpo)) return null;
  return { quantidade: r.corpo.length, aproximado: r.corpo.length === TETO_PRS_CONTADOS };
}

/** Busca `/readme` e decodifica de base64 — decodificar é parte da chamada de rede, a sanitização do texto fica no domínio. */
async function buscarReadme(dono: string, repo: string): Promise<string | null> {
  const r = await buscar<{ content?: string; encoding?: string }>(`/repos/${dono}/${repo}/readme`);
  const corpo = r?.corpo;
  if (!corpo || typeof corpo.content !== "string" || corpo.encoding !== "base64") return null;

  // Teto antes de decodificar. A Contents API entrega até ~1MB, e o domínio
  // corta em 1500 caracteres — decodificar o resto é trabalho pago por clique
  // numa função serverless para um resultado que vai ser jogado fora. O teto é
  // generoso o bastante para o corte final continuar sendo o do domínio.
  const base64Cortado = corpo.content.slice(0, TETO_README_BASE64);
  return Buffer.from(base64Cortado, "base64").toString("utf-8");
}

/**
 * Busca os dados públicos de um repositório do GitHub. O repositório em si
 * (nome, descrição) é obrigatório — se essa chamada falhar, a função devolve
 * o motivo sem tentar as outras. As chamadas complementares (linguagens,
 * commit, PRs, README) degradam de forma independente: uma falhando não
 * derruba as outras nem o resultado principal.
 */
export async function buscarRepositorioGithub(dono: string, repo: string): Promise<ResultadoBuscaGithub> {
  const r = await buscar<{ name?: string; description?: string | null }>(`/repos/${dono}/${repo}`);
  if (!r) return { ok: false, motivo: "falha" };
  if (r.resposta.status === 404) return { ok: false, motivo: "nao_encontrado" };
  if (estaComLimiteEsgotado(r.resposta)) return { ok: false, motivo: "limite" };
  if (!r.corpo) return { ok: false, motivo: "falha" };

  const repoBruto = r.corpo;

  const [linguagens, ultimoCommit, prsAbertos, readme] = await Promise.all([
    buscarLinguagens(dono, repo),
    buscarUltimoCommit(dono, repo),
    buscarPrsAbertos(dono, repo),
    buscarReadme(dono, repo),
  ]);

  return {
    ok: true,
    dados: {
      nome: repoBruto.name ?? null,
      descricao: repoBruto.description ?? null,
      linguagens,
      ultimoCommit,
      prsAbertos,
      readme,
    },
  };
}

import "server-only";

// Chamada de rede à API pública do GitHub — item 8 de docs/proximos-passos.md
// ("GitHub no cadastro"). Fica fora do teste de propósito (a normalização
// pura vive em src/dominio/repositorioGithub.ts, testada sem rede); aqui só
// existe o `fetch`, o timeout e a leitura de status/cabeçalho.
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

async function buscar(caminho: string): Promise<Response | null> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${GITHUB_API}${caminho}`, { headers: cabecalhos(), signal: controlador.signal });
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
  const resposta = await buscar(`/repos/${dono}/${repo}/languages`);
  if (!resposta || !resposta.ok) return [];
  try {
    const corpo = (await resposta.json()) as Record<string, number>;
    return Object.entries(corpo)
      .sort(([, a], [, b]) => b - a)
      .map(([nome]) => nome);
  } catch {
    return [];
  }
}

/** Busca o commit mais recente do branch padrão via `/commits?per_page=1`. */
async function buscarUltimoCommit(
  dono: string,
  repo: string,
): Promise<RepositorioGithubBruto["ultimoCommit"]> {
  const resposta = await buscar(`/repos/${dono}/${repo}/commits?per_page=1`);
  if (!resposta || !resposta.ok) return null;
  try {
    const corpo = (await resposta.json()) as Array<{
      sha?: string;
      commit?: { message?: string; author?: { date?: string } | null };
    }>;
    const primeiro = corpo[0];
    if (!primeiro) return null;
    return {
      sha: primeiro.sha ?? null,
      mensagem: primeiro.commit?.message ?? null,
      data: primeiro.commit?.author?.date ?? null,
    };
  } catch {
    return null;
  }
}

// GitHub não expõe "quantidade de PRs abertos" direto; `/pulls?state=open`
// devolve a lista. Cem é generoso para um projeto pessoal e barato (uma
// página); quando bate no teto, `aproximado: true` avisa que é "100 ou mais",
// não um número exato.
const TETO_PRS_CONTADOS = 100;

async function buscarPrsAbertos(dono: string, repo: string): Promise<RepositorioGithubBruto["prsAbertos"]> {
  const resposta = await buscar(`/repos/${dono}/${repo}/pulls?state=open&per_page=${TETO_PRS_CONTADOS}`);
  if (!resposta || !resposta.ok) return null;
  try {
    const corpo = (await resposta.json()) as unknown[];
    if (!Array.isArray(corpo)) return null;
    return { quantidade: corpo.length, aproximado: corpo.length === TETO_PRS_CONTADOS };
  } catch {
    return null;
  }
}

/** Busca `/readme` e decodifica de base64 — decodificar é parte da chamada de rede, a sanitização do texto fica no domínio. */
async function buscarReadme(dono: string, repo: string): Promise<string | null> {
  const resposta = await buscar(`/repos/${dono}/${repo}/readme`);
  if (!resposta || !resposta.ok) return null;
  try {
    const corpo = (await resposta.json()) as { content?: string; encoding?: string };
    if (typeof corpo.content !== "string" || corpo.encoding !== "base64") return null;
    return Buffer.from(corpo.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Busca os dados públicos de um repositório do GitHub. O repositório em si
 * (nome, descrição) é obrigatório — se essa chamada falhar, a função devolve
 * o motivo sem tentar as outras. As chamadas complementares (linguagens,
 * commit, PRs, README) degradam de forma independente: uma falhando não
 * derruba as outras nem o resultado principal.
 */
export async function buscarRepositorioGithub(dono: string, repo: string): Promise<ResultadoBuscaGithub> {
  const respostaRepo = await buscar(`/repos/${dono}/${repo}`);
  if (!respostaRepo) return { ok: false, motivo: "falha" };
  if (respostaRepo.status === 404) return { ok: false, motivo: "nao_encontrado" };
  if (estaComLimiteEsgotado(respostaRepo)) return { ok: false, motivo: "limite" };
  if (!respostaRepo.ok) return { ok: false, motivo: "falha" };

  let repoBruto: { name?: string; description?: string | null };
  try {
    repoBruto = await respostaRepo.json();
  } catch {
    return { ok: false, motivo: "falha" };
  }

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

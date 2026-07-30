"use server";

// Server Action da importação de repositório do GitHub no cadastro — mesmo
// padrão de src/servidor/acoes-projeto.ts: `exigirSessaoDoDono()` primeiro
// (Server Action é endpoint HTTP, regra 4 do CLAUDE.md), estado devolvido em
// vez de lançado. Só o painel chama isto, quando o dono clica "importar" —
// não é a routine (ver docs/proximos-passos.md, item 8).

import type { RepositorioGithubNormalizado } from "@/dominio/repositorioGithub";
import { extrairDonoRepo, normalizarRepositorioGithub } from "@/dominio/repositorioGithub";
import { AcessoNegado, exigirSessaoDoDono } from "./acesso";
import { buscarRepositorioGithub, type MotivoFalhaGithub } from "./github";

export interface ResultadoImportacaoGithub {
  ok: boolean;
  erro: string | null;
  dados: RepositorioGithubNormalizado | null;
}

// Teto generoso para o que o dono cola — nem a URL mais longa do GitHub
// chega perto disto. Recusar cedo evita mandar lixo para `extrairDonoRepo`.
const ENTRADA_TAMANHO_MAXIMO = 300;

const MENSAGEM_POR_MOTIVO: Record<MotivoFalhaGithub, (alvo: string) => string> = {
  nao_encontrado: (alvo) => `Não encontrei "${alvo}" no GitHub — confira se está certo e se o repositório é público.`,
  limite: () => "O GitHub recusou por limite de requisições. Tente de novo em alguns minutos, ou cadastre à mão.",
  falha: () => "Não consegui falar com o GitHub agora. Cadastre à mão, ou tente de novo em instantes.",
};

/**
 * Busca um repositório do GitHub a partir do que o dono colou (URL ou
 * "dono/repositório") e devolve nome, descrição, linguagens, último commit,
 * PRs abertos e um resumo do README, já sanitizados. Nunca escreve nada —
 * quem decide o que salvar é o formulário de cadastro, depois de revisar.
 */
export async function importarRepositorioGithubAction(entrada: string): Promise<ResultadoImportacaoGithub> {
  try {
    await exigirSessaoDoDono();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return { ok: false, erro: "Acesso negado.", dados: null };
    throw erro;
  }

  if (typeof entrada !== "string" || entrada.trim().length === 0) {
    return { ok: false, erro: 'Cole a URL ou o "dono/repositório" do GitHub.', dados: null };
  }
  if (entrada.length > ENTRADA_TAMANHO_MAXIMO) {
    return { ok: false, erro: "Isso não parece um link nem um repositório do GitHub.", dados: null };
  }

  const alvo = extrairDonoRepo(entrada);
  if (!alvo) {
    return {
      ok: false,
      erro: 'Não reconheci um repositório do GitHub aí. Use "dono/repositório" ou cole a URL do GitHub.',
      dados: null,
    };
  }

  const resultado = await buscarRepositorioGithub(alvo.dono, alvo.repo);
  if (!resultado.ok) {
    return { ok: false, erro: MENSAGEM_POR_MOTIVO[resultado.motivo](`${alvo.dono}/${alvo.repo}`), dados: null };
  }

  return {
    ok: true,
    erro: null,
    dados: normalizarRepositorioGithub(alvo.dono, alvo.repo, resultado.dados),
  };
}

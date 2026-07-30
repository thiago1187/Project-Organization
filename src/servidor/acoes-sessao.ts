"use server";

// Entrada e saída da sessão própria do dono (pendência 1 da revisão de
// segurança — ver o comentário longo no topo de sessao.ts para o porquê).
// Só duas ações: `entrarAction` (confere o segredo, grava o cookie) e
// `sairAction` (apaga o cookie). Nada de cadastro, convite ou recuperação —
// a regra 5 do CLAUDE.md proíbe sistema de contas, e isto não é um.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ambientePermiteSessao,
  gerarValorCookieSessao,
  NOME_COOKIE_SESSAO,
  segredoDeSessaoBate,
  validadeCookieSessaoSegundos,
} from "./sessao";

export interface EstadoEntrar {
  erro: string | null;
}

/** Caminho padrão depois de entrar, e único fallback aceito para `proximo`. */
const DESTINO_PADRAO = "/";

/**
 * Só aceita caminhos internos (`/algo`), nunca uma URL completa — `proximo`
 * vem de um campo de formulário e um valor como `https://phish.example` faria
 * o `redirect()` sair do painel logo depois de confirmar o segredo do dono.
 */
function destinoSeguro(proximo: FormDataEntryValue | null): string {
  if (typeof proximo !== "string") return DESTINO_PADRAO;
  if (!proximo.startsWith("/") || proximo.startsWith("//")) return DESTINO_PADRAO;
  return proximo;
}

/** Confere o segredo enviado pelo formulário de /entrar e, se bater, grava o cookie de sessão. */
export async function entrarAction(_estadoAnterior: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const segredo = formData.get("segredo");
  const destino = destinoSeguro(formData.get("proximo"));

  if (typeof segredo !== "string" || segredo.length === 0) {
    return { erro: "Informe o segredo." };
  }

  // Degradação certa é recusar: sem PAINEL_SESSAO_SECRET configurada,
  // segredoDeSessaoBate devolve false para qualquer valor recebido — nunca
  // libera por omissão.
  if (!segredoDeSessaoBate(segredo)) {
    return { erro: "Segredo incorreto." };
  }

  if (!ambientePermiteSessao()) {
    // Preview, ou local sem PERMITIR_SESSAO_LOCAL=1: o segredo bateu, mas
    // este ambiente nunca concede sessão de dono (ver sessao.ts). Dizer isso
    // é mais honesto do que gravar um cookie que resolverOrigemAcesso() vai
    // ignorar de qualquer forma.
    return {
      erro:
        "Este ambiente não concede sessão. Em desenvolvimento local, defina PERMITIR_SESSAO_LOCAL=1 em .env.local.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE_SESSAO, gerarValorCookieSessao(), {
    httpOnly: true,
    secure: process.env.VERCEL_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: validadeCookieSessaoSegundos(),
  });

  redirect(destino);
}

/** Encerra a sessão do dono, apagando o cookie, e volta para a tela de entrada. */
export async function sairAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NOME_COOKIE_SESSAO);
  redirect("/entrar");
}

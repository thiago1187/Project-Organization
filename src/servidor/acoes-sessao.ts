"use server";

// Entrada e saída da sessão própria do dono (pendência 1 da revisão de
// segurança — ver o comentário longo no topo de sessao.ts para o porquê).
// Só duas ações: `entrarAction` (confere o segredo, grava o cookie) e
// `sairAction` (apaga o cookie). Nada de cadastro, convite ou recuperação —
// a regra 5 do CLAUDE.md proíbe sistema de contas, e isto não é um.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destinoSeguro } from "@/dominio/destinoSeguro";
import { mensagemDeTrava } from "@/dominio/travaEntrada";
import {
  estadoDaTravaDeEntrada,
  limparFalhasDeEntrada,
  registrarFalhaDeEntrada,
} from "./tentativasEntrada";
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

/** Confere o segredo enviado pelo formulário de /entrar e, se bater, grava o cookie de sessão. */
export async function entrarAction(_estadoAnterior: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const segredo = formData.get("segredo");
  const destino = destinoSeguro(formData.get("proximo"));

  if (typeof segredo !== "string" || segredo.length === 0) {
    return { erro: "Informe o segredo." };
  }

  // A trava é conferida antes de olhar o segredo. Conferir depois vazaria o
  // que ela existe para esconder: quem estivesse adivinhando saberia, pela
  // diferença entre "senha errada" e "travado", que a tentativa foi de fato
  // avaliada. Ver db/migrations/011_tentativa_entrada.sql para o desenho.
  const trava = await estadoDaTravaDeEntrada();
  if (trava.travado) {
    return { erro: mensagemDeTrava(trava) };
  }

  // Degradação certa é recusar: sem PAINEL_SESSAO_SECRET configurada,
  // segredoDeSessaoBate devolve false para qualquer valor recebido — nunca
  // libera por omissão.
  if (!segredoDeSessaoBate(segredo)) {
    await registrarFalhaDeEntrada();
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

  // Entrou: o orçamento de tentativas volta ao cheio. Um erro de digitação de
  // ontem não deve comer metade do orçamento de amanhã.
  await limparFalhasDeEntrada();

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

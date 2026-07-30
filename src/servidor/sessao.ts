import "server-only";

import { createHmac } from "node:crypto";
import { segredosBatem } from "./comparacaoSegura";

// Sessão própria do app — pendência 1 da revisão de segurança.
//
// Por que isto existe: `resolverOrigemAcesso()` (acesso.ts) confiava que
// "produção" implicava "o Vercel Authentication já barrou na borda". A
// revisão apontou que isso não é verificável em código — não existe cabeçalho
// de identidade não-falsificável injetado pela Vercel — e que se a proteção
// de borda for desligada ou divergir, qualquer requisição anônima seria
// tratada como o dono. Este módulo é a segunda camada, a que o código
// consegue de fato verificar: um segredo nosso (`PAINEL_SESSAO_SECRET`),
// nunca a Vercel.
//
// Isto não é sistema de contas (regra 5 do CLAUDE.md): não há tabela de
// usuário, cadastro nem recuperação de senha. É um segredo único do dono,
// comparado em tempo constante, que resulta num cookie assinado. Cookie sem
// assinatura é só um texto que o cliente escolhe — por isso o valor carrega
// uma assinatura HMAC verificada aqui, nunca confiada por presença.

/** Nome do cookie de sessão do dono. */
export const NOME_COOKIE_SESSAO = "painel_sessao";

// 30 dias: o dono digita o segredo raramente, e a experiência pedida é
// "funciona quando eu preciso", não "peça de novo toda semana". Sair
// (`sairAction`) continua disponível para quem quiser encerrar antes disso —
// ver acoes-sessao.ts.
const VALIDADE_MS = 1000 * 60 * 60 * 24 * 30;

function assinar(exp: number, segredo: string): string {
  return createHmac("sha256", segredo).update(String(exp)).digest("base64url");
}

/**
 * Se este ambiente pode conceder sessão de dono.
 *
 * - Produção: sempre pode (sujeito ainda a `PAINEL_SESSAO_SECRET` existir e
 *   ao cookie validar — ver `cookieSessaoEhValido`).
 * - Local (sem `VERCEL_ENV`, sem borda nenhuma na frente): só com o opt-in
 *   explícito `PERMITIR_SESSAO_LOCAL=1`. Antes disto checava
 *   `NODE_ENV !== "production"`, que libera por omissão — exatamente o
 *   padrão que produziu o furo original. Quem roda local escolhe
 *   conscientemente; quem esquece de configurar não ganha acesso de graça.
 * - Preview: nunca. Preview costuma ter proteção de borda diferente da
 *   produção, e é onde um furo apareceria primeiro — de propósito fora,
 *   mesma decisão que já existia antes desta mudança.
 */
export function ambientePermiteSessao(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  if (!process.env.VERCEL_ENV && process.env.PERMITIR_SESSAO_LOCAL === "1") return true;
  return false;
}

/**
 * Gera o valor do cookie de sessão: `"<expira_em_ms>.<assinatura>"`.
 * Lança se `PAINEL_SESSAO_SECRET` não estiver configurada — chame só depois
 * de já ter confirmado o segredo com `segredoDeSessaoBate`.
 */
export function gerarValorCookieSessao(): string {
  const segredo = process.env.PAINEL_SESSAO_SECRET;
  if (!segredo) throw new Error("PAINEL_SESSAO_SECRET não está configurada.");
  const exp = Date.now() + VALIDADE_MS;
  return `${exp}.${assinar(exp, segredo)}`;
}

/** Validade do cookie em segundos, para o `maxAge` do `Set-Cookie`. */
export function validadeCookieSessaoSegundos(): number {
  return Math.floor(VALIDADE_MS / 1000);
}

/**
 * Valida um valor de cookie de sessão contra `PAINEL_SESSAO_SECRET`.
 * `false` para: segredo não configurado (degradação certa é recusar, nunca
 * liberar), cookie ausente ou malformado, cookie expirado, ou assinatura que
 * não bate.
 */
export function cookieSessaoEhValido(valor: string | undefined | null): boolean {
  const segredo = process.env.PAINEL_SESSAO_SECRET;
  if (!segredo || !valor) return false;

  const separador = valor.indexOf(".");
  if (separador < 0) return false;

  const expTexto = valor.slice(0, separador);
  const assinatura = valor.slice(separador + 1);
  if (assinatura.length === 0) return false;

  const exp = Number(expTexto);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  if (Date.now() > exp) return false;

  return segredosBatem(assinatura, assinar(exp, segredo));
}

/** Confere se `recebido` bate com `PAINEL_SESSAO_SECRET`, em tempo constante. `false` se a variável não existe. */
export function segredoDeSessaoBate(recebido: string): boolean {
  const segredo = process.env.PAINEL_SESSAO_SECRET;
  if (!segredo) return false;
  return segredosBatem(recebido, segredo);
}

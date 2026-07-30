import { NextResponse, type NextRequest } from "next/server";
import { ambientePermiteSessao, cookieSessaoEhValido, NOME_COOKIE_SESSAO } from "@/servidor/sessao";

// Gate de tela — pendência 1 da revisão de segurança.
//
// As rotas de API (`/api/*`) já se protegem sozinhas via `exigirAcesso()`
// (src/servidor/acesso.ts), que também aceita o header de bypass da routine.
// Este proxy cobre a outra metade: as telas do painel (Server Components),
// que hoje não chamavam `exigirAcesso()` nenhuma e dependiam só do Vercel
// Authentication na borda — a mesma lacuna que motivou a sessão própria. Sem
// isto, a sessão existiria mas nada a cobraria antes de renderizar a página.
//
// Convenção `proxy.ts` (renomeada de `middleware.ts` a partir do Next.js 16;
// ver https://nextjs.org/docs/messages/middleware-to-proxy). Roda em runtime
// Node.js por padrão nesta versão — não há como declarar `runtime` aqui, e
// não precisa: a validação de cookie usa `node:crypto` (sessao.ts), o mesmo
// módulo usado pelas rotas de API, para não ter duas implementações de "o
// que é um cookie de sessão válido" que podem divergir.

export function proxy(request: NextRequest) {
  // Rota de entrada em si nunca é bloqueada — senão ninguém consegue entrar.
  if (request.nextUrl.pathname === "/entrar") return NextResponse.next();

  if (!ambientePermiteSessao()) {
    // Preview, ou local sem PERMITIR_SESSAO_LOCAL=1: nenhum cookie seria
    // válido aqui de qualquer forma (ver sessao.ts). Manda para /entrar, que
    // vai explicar o motivo em vez de deixar a tela renderizar sem checagem.
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const cookieSessao = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  if (cookieSessaoEhValido(cookieSessao)) return NextResponse.next();

  const destino = new URL("/entrar", request.url);
  // Só o caminho + query, nunca a URL inteira — evita repassar algo que não
  // seja deste app para o parâmetro que `entrarAction` usa como redirect.
  destino.searchParams.set("proximo", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = {
  // Deixa de fora: rotas de API (protegidas por si mesmas, e é onde a
  // routine chama com o header de bypass — um redirect aqui quebraria isso
  // silenciosamente), assets internos do Next e o ícone do site.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

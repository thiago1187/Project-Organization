import "server-only";

import { cookies, headers } from "next/headers";
import { segredosBatem } from "./comparacaoSegura";
import { ambientePermiteSessao, cookieSessaoEhValido, NOME_COOKIE_SESSAO } from "./sessao";

// Ponto único de verificação de acesso — regra 4 do CLAUDE.md.
//
// Por que este arquivo existe:
//
// Server Action não é uma função interna. O "use server" publica um endpoint
// HTTP de verdade, com ID de ação, invocável por qualquer um que descubra o
// ID. Hoje a única coisa que impede um POST anônimo é o Vercel Authentication,
// que é configuração fora do repositório — pode ser desligada por engano, ou
// divergir entre produção e preview, sem que uma linha de código mude ou
// quebre. O sistema falharia aberto, em silêncio.
//
// Isto não é sistema de contas, que a regra 5 proíbe. É um guard.
//
// Quando as rotas de API existirem (POST /api/reports e as outras), elas usam
// esta mesma função. É de propósito que só exista um lugar: quem escrever a
// próxima rota não precisa reinventar a checagem, e não precisa lembrar
// sozinho que Server Action também é superfície de rede.

const CABECALHO_BYPASS = "x-vercel-protection-bypass";

export class AcessoNegado extends Error {
  constructor() {
    super("Acesso negado.");
    this.name = "AcessoNegado";
  }
}

/**
 * Como o acesso foi concedido. Distinguir os dois importa para
 * `PATCH /api/suggestions/:id`: quem tem sessão é o dono (pode aprovar e
 * recusar); quem tem só o header de bypass é a routine (pode só marcar como
 * "feita", e apenas a partir de "aprovada"). Ver CLAUDE.md, rotas de API.
 */
export type OrigemAcesso = "sessao" | "bypass";

/** Resolve a origem do acesso desta requisição, ou `null` se nenhuma bater. */
async function resolverOrigemAcesso(): Promise<OrigemAcesso | null> {
  const cabecalhos = await headers();

  // Caminho da routine: header de bypass com o segredo correto.
  const segredo = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const recebido = cabecalhos.get(CABECALHO_BYPASS);
  if (segredo && recebido && segredosBatem(recebido, segredo)) return "bypass";

  // Se o segredo não está configurado, o ramo do bypass acima nunca casa — e a
  // requisição da routine cairia nas regras de sessão abaixo, promovendo a
  // routine a dono. Falta de segredo é erro de configuração, não permissão:
  // recusa tudo. A degradação certa é "para de funcionar", nunca "vira o dono".
  if (process.env.VERCEL_ENV && !segredo) return null;

  // Caminho do dono: sessão própria do app (cookie assinado com
  // `PAINEL_SESSAO_SECRET`, ver sessao.ts), não mais "confia que o Vercel
  // Authentication já barrou na borda". Aquele caminho não era verificável em
  // código — a Vercel não injeta cabeçalho de identidade não-falsificável —
  // e se a proteção de borda fosse desligada, qualquer requisição anônima
  // seria promovida a dono. O Vercel Authentication continua ligado e
  // continua sendo a primeira camada; esta é a segunda, a que o código
  // consegue de fato verificar.
  //
  // `ambientePermiteSessao()` decide separadamente se este ambiente pode
  // conceder sessão de dono (produção sempre; local só com opt-in explícito;
  // preview nunca — ver o comentário lá para o raciocínio de cada caso).
  if (!ambientePermiteSessao()) return null;

  const cookieStore = await cookies();
  const cookieSessao = cookieStore.get(NOME_COOKIE_SESSAO)?.value;
  return cookieSessaoEhValido(cookieSessao) ? "sessao" : null;
}

/**
 * Exige que a origem seja a sessão do dono. Use em tudo que decide — aprovar,
 * recusar, e o CRUD de projeto.
 *
 * Existe porque a regra "só o dono decide" precisa morar num lugar só. Ela
 * estava duplicada em cada chamador, e o resultado foi previsível: a rota
 * `PATCH` aplicava, a Server Action da fila não, e a routine podia se
 * auto-aprovar por uma porta que ninguém lembrou de fechar.
 */
export async function exigirSessaoDoDono(): Promise<void> {
  const origem = await resolverOrigemAcesso();
  if (origem !== "sessao") throw new AcessoNegado();
}

/**
 * Garante que quem chama é o dono no navegador, ou a routine com o segredo.
 * Lança `AcessoNegado` caso contrário. Chame como primeira linha de qualquer
 * Server Action que escreve, e de qualquer route handler.
 */
export async function exigirAcesso(): Promise<void> {
  const origem = await resolverOrigemAcesso();
  if (!origem) throw new AcessoNegado();
}

/**
 * Mesma checagem de `exigirAcesso()`, mas devolve também a origem do acesso
 * (sessão do dono ou bypass da routine) para rotas que precisam decidir *o
 * quê* cada chamador pode fazer, não só *se* pode chamar. Lança
 * `AcessoNegado` nas mesmas condições que `exigirAcesso()`.
 */
export async function exigirAcessoComOrigem(): Promise<OrigemAcesso> {
  const origem = await resolverOrigemAcesso();
  if (!origem) throw new AcessoNegado();
  return origem;
}

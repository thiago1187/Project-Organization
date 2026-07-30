import "server-only";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

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

/** Comparação em tempo constante. `===` em segredo vaza o tamanho do prefixo comum pelo tempo de resposta. */
function segredosBatem(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual joga se os tamanhos diferem — o que já é um vazamento de
  // tamanho, mas inevitável e sem valor prático para quem ataca.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class AcessoNegado extends Error {
  constructor() {
    super("Acesso negado.");
    this.name = "AcessoNegado";
  }
}

/**
 * Garante que quem chama é o dono no navegador, ou a routine com o segredo.
 * Lança `AcessoNegado` caso contrário. Chame como primeira linha de qualquer
 * Server Action que escreve, e de qualquer route handler.
 */
export async function exigirAcesso(): Promise<void> {
  const cabecalhos = await headers();

  // Caminho da routine: header de bypass com o segredo correto.
  const segredo = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const recebido = cabecalhos.get(CABECALHO_BYPASS);
  if (segredo && recebido && segredosBatem(recebido, segredo)) return;

  // Caminho do dono: sessão resolvida pelo Vercel Authentication, que roda na
  // borda e só deixa a requisição chegar aqui se já estiver autenticada. Em
  // produção, chegar até esta linha já significa sessão válida.
  //
  // Fora da Vercel (desenvolvimento local) não há borda nenhuma na frente, e
  // exigir o segredo aqui tornaria o app impossível de rodar na máquina do
  // dono. Por isso o desenvolvimento passa — e só ele.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.VERCEL_ENV) return;

  throw new AcessoNegado();
}

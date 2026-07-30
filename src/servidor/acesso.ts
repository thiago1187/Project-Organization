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
 * Como o acesso foi concedido: sessão é o dono no navegador, bypass é a
 * routine com o header de segredo. Desde que a routine parou de escrever em
 * `sugestao` (docs/proximos-passos.md item 2, "tirar a execução da
 * routine"), nenhuma rota mais decide *o quê* fazer a partir dessa
 * distinção — todo caminho de escrita já exige sessão do dono
 * (`exigirSessaoDoDono()`); bypass só abre os caminhos de leitura e os dois
 * POSTs que a routine ainda usa (`/api/reports`, `/api/suggestions`), via
 * `exigirAcesso()`. O tipo continua interno a este arquivo por isso — nada
 * de fora precisa mais perguntar qual foi a origem, só se houve uma.
 */
type OrigemAcesso = "sessao" | "bypass";

/** Resolve a origem do acesso desta requisição, ou `null` se nenhuma bater. */
async function resolverOrigemAcesso(): Promise<OrigemAcesso | null> {
  const cabecalhos = await headers();

  // Caminho da routine: header de bypass com o segredo correto.
  //
  // `PAINEL_BYPASS_SECRET` é uma variável nossa, criada à mão com o mesmo valor
  // do bypass gerado no Vercel. `VERCEL_AUTOMATION_BYPASS_SECRET` é a variável
  // de sistema que a Vercel injeta sozinha — quando injeta: depende de uma
  // configuração do projeto que nem sempre está ligada, e cujo nome e lugar
  // mudam entre versões do painel deles. Depender só dela custou uma sessão
  // inteira de depuração para um 401 que parecia segredo errado e era variável
  // ausente.
  //
  // A nossa vem primeiro porque é a que o dono controla e consegue ver. A da
  // Vercel fica como conveniência para quem tiver a exposição automática
  // ligada e não quiser manter o valor em dois lugares.
  const segredo =
    process.env.PAINEL_BYPASS_SECRET || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const recebido = cabecalhos.get(CABECALHO_BYPASS);
  if (segredo && recebido && segredosBatem(recebido, segredo)) return "bypass";

  // Aqui havia uma recusa geral quando `PAINEL_BYPASS_SECRET` não estava
  // configurada em ambiente Vercel. Ela foi removida, e vale registrar por quê,
  // porque a intenção original era boa.
  //
  // Ela nasceu quando "sessão" era concedida pela mera presença num ambiente
  // Vercel — sem segredo, a requisição da routine caía nas regras de sessão e
  // ela era promovida a dona. Recusar tudo era a defesa certa naquele desenho.
  //
  // Hoje sessão exige cookie assinado com HMAC sobre `PAINEL_SESSAO_SECRET`,
  // que a routine não tem e não consegue forjar. A defesa perdeu o alvo, e
  // sobrou só o efeito colateral: um deploy sem o segredo de bypass trancava
  // também o dono fora do próprio painel — não só a routine ficava sem acesso.
  //
  // A degradação certa continua existindo, só que no lugar certo: sem segredo
  // configurado, o ramo do bypass acima nunca casa, então a routine é recusada.
  // O dono, com cookie válido, entra. Achado pelo caso 13 da suíte de teste.

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
 * recusar, marcar como feita, e o CRUD de projeto.
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

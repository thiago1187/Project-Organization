import "server-only";

import { cookies, headers } from "next/headers";
import { segredosBatem } from "./comparacaoSegura";
// `ambientePermiteSessao` vale para as duas origens em que o dono está
// presente — o navegador dele e o Claude Code dele. O apelido diz isso; o nome
// original ficou preso a "sessão" porque, quando nasceu, sessão era a única.
import {
  ambientePermiteSessao as ambientePermiteOrigemDoDono,
  cookieSessaoEhValido,
  NOME_COOKIE_SESSAO,
} from "./sessao";

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
const CABECALHO_MCP = "x-painel-mcp-secret";

export class AcessoNegado extends Error {
  constructor() {
    super("Acesso negado.");
    this.name = "AcessoNegado";
  }
}

/**
 * Como o acesso foi concedido. Três origens, em ordem de autoridade:
 *
 * - `sessao` — o dono no navegador, com cookie assinado (ver sessao.ts).
 * - `mcp` — o Claude Code do dono, com `PAINEL_MCP_SECRET` (ver
 *   src/servidor/mcp.ts e docs/mcp.md).
 * - `bypass` — a routine noturna, com o segredo de bypass da Vercel.
 *
 * `mcp` existe por um motivo específico, não por gosto de granularidade: o
 * Claude Code precisa mandar o header de bypass de qualquer jeito, porque é
 * ele que atravessa o Vercel Authentication na borda. Se o MCP se apoiasse só
 * nisso, "a routine às 3h" e "o dono conversando no terminal" virariam a mesma
 * origem — e aí toda decisão futura do tipo "a routine não pode fazer X"
 * proibiria o dono junto, ou, pior, afrouxar algo para o dono abriria a mesma
 * porta para a rodada sem supervisão. O segredo separado é o que mantém as
 * duas distinguíveis.
 *
 * O que `mcp` **não** é: defesa contra um modelo mal conduzido. Se o texto que
 * o Claude Code leu o convencer a chamar uma ferramenta, ele tem o segredo por
 * construção. Por isso o MCP não expõe aprovar, recusar nem apagar — ali a
 * defesa é a ausência da ferramenta, não a credencial.
 */
type OrigemAcesso = "sessao" | "mcp" | "bypass";

/** Resolve a origem do acesso desta requisição, ou `null` se nenhuma bater. */
async function resolverOrigemAcesso(): Promise<OrigemAcesso | null> {
  const cabecalhos = await headers();

  // O segredo do MCP é conferido antes do bypass de propósito: o Claude Code
  // manda os dois headers (o de bypass para atravessar a borda da Vercel, o do
  // MCP para se identificar), e a origem certa nesse caso é a mais específica.
  //
  // `ambientePermiteOrigemDoDono()` se aplica aqui pelo mesmo motivo que se
  // aplica à sessão, e a ausência dele era um furo: a Vercel marca os três
  // ambientes por padrão numa variável nova, então `PAINEL_MCP_SECRET` criada
  // sem desmarcar Preview daria escrita de contexto a todo deploy de preview
  // — que sai de qualquer branch, inclusive de código alterado, e aponta para
  // o mesmo banco de produção. Preview é onde um furo aparece primeiro, e é
  // por isso que a sessão já era recusada lá.
  const segredoMcp = process.env.PAINEL_MCP_SECRET;
  const recebidoMcp = cabecalhos.get(CABECALHO_MCP);
  if (
    ambientePermiteOrigemDoDono() &&
    segredoMcp &&
    recebidoMcp &&
    segredosBatem(recebidoMcp, segredoMcp)
  ) {
    return "mcp";
  }

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
  if (!ambientePermiteOrigemDoDono()) return null;

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
 * Exige que quem chama seja o dono — no navegador, ou pelo MCP do Claude Code
 * dele. Recusa o bypass da routine.
 *
 * Este é o portão das escritas que o dono faz de qualquer um dos dois lugares
 * em que ele está presente. Hoje: `upsertContexto` (src/servidor/contextos.ts)
 * e as duas ferramentas de escrita do MCP (src/servidor/mcp.ts).
 *
 * O que ele preserva: a regra registrada em `PUT /api/context/:projeto` de que
 * **a routine não escreve contexto** — porque contexto vira instrução no
 * CLAUDE.md do repositório alvo, e um agente comprometido numa rodada
 * escreveria as próprias instruções para a rodada seguinte. A routine tem só o
 * bypass, e o bypass continua recusado aqui. O que mudou é que "o dono" deixou
 * de significar exclusivamente "o dono no navegador".
 *
 * Não use isto para aprovar, recusar ou marcar sugestão como feita: essas três
 * continuam em `exigirSessaoDoDono()`, dois cliques no painel, de propósito.
 */
export async function exigirDonoOuMcp(): Promise<void> {
  const origem = await resolverOrigemAcesso();
  if (origem !== "sessao" && origem !== "mcp") throw new AcessoNegado();
}

/**
 * Garante que quem chama é o dono no navegador, o MCP dele, ou a routine com o
 * segredo. Lança `AcessoNegado` caso contrário. Chame como primeira linha de
 * qualquer Server Action que escreve, e de qualquer route handler.
 */
export async function exigirAcesso(): Promise<void> {
  const origem = await resolverOrigemAcesso();
  if (!origem) throw new AcessoNegado();
}

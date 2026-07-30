import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { atenderMcp } from "@/servidor/mcp";
import { respostaErro } from "@/servidor/respostaApi";

// POST /api/mcp — servidor MCP do painel (item 7 de docs/proximos-passos.md).
// É por aqui que o dono conversa com o painel a partir do Claude Code:
// "adiciona esse projeto lá no meu site", "o que apareceu essa noite", "o que
// está esperando decisão". Ver docs/mcp.md para o passo a passo de conexão, e
// src/servidor/mcp.ts para o catálogo de ferramentas e o raciocínio de acesso.
//
// Esta rota não é lida pela routine noturna, então mudar o formato aqui não
// quebra a automação como mudar `GET /api/projects` quebraria. O que ela
// quebra é a conversa do dono no terminal — o que aparece na hora, não na
// madrugada seguinte.
//
// Acesso em duas camadas:
//
// 1. `exigirAcesso()`, aqui, antes de o MCP ver um byte do corpo. Sessão do
//    dono, `PAINEL_MCP_SECRET` ou o bypass da routine; qualquer outra coisa
//    recebe 401 sem gastar parse de JSON-RPC. Mesma primeira linha das outras
//    rotas de API — regra 4 do CLAUDE.md.
// 2. Por ferramenta, dentro de src/servidor/mcp.ts: as duas de escrita chamam
//    `exigirDonoOuMcp()` e recusam o bypass puro. Quem chega só com o segredo
//    da routine tem um MCP somente de leitura.
//
// Só POST. O transporte Streamable HTTP também define GET (stream SSE do
// servidor para o cliente) e DELETE (encerrar sessão), e os dois pressupõem
// estado entre requisições — que uma função serverless não tem para oferecer.
// O modo sem estado do transporte é a escolha honesta aqui, e nele GET e
// DELETE não têm o que fazer: 405 é a resposta prevista pela especificação, e
// o cliente segue usando POST normalmente.

export const dynamic = "force-dynamic";

const METODO_NAO_SUPORTADO =
  "Este servidor MCP opera sem estado e responde só a POST. GET (stream SSE) e DELETE " +
  "(encerrar sessão) não se aplicam.";

export async function POST(req: Request) {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  return atenderMcp(req);
}

export async function GET() {
  return respostaErro(405, METODO_NAO_SUPORTADO);
}

export async function DELETE() {
  return respostaErro(405, METODO_NAO_SUPORTADO);
}

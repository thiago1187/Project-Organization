import "server-only";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { AcessoNegado, exigirDonoOuMcp } from "./acesso";
import { ErroDados } from "./erros";
import { criarProjeto, listarProjetos } from "./projetos";
import { listarRelatoriosDoProjeto } from "./relatorios";
import { listarSugestoes, listarSugestoesDoProjeto } from "./sugestoes";
import { listarServicoDoProjeto, listarStackDoProjeto } from "./inventario";
import { listarContextosDoProjeto, upsertContexto } from "./contextos";
import { semCredencial } from "@/dominio/pareceCredencial";
import { validarContexto } from "@/dominio/validacaoContexto";
import { validarDadosProjetoComFrequencia } from "@/dominio/validacaoProjeto";
import type { EstadoSugestao, Projeto } from "@/dominio/tipos";
import {
  FERRAMENTAS_MCP,
  contextoExistente,
  contextosParaMcp,
  inventarioParaMcp,
  limiteDeRodadas,
  ordenarSugestoes,
  projetosParaMcp,
  resolverProjeto,
  rodadasParaMcp,
  sugestoesParaMcp,
  LIMITE_RODADAS_MAXIMO,
} from "@/dominio/mcp";

// Servidor MCP do painel — item 7 de docs/proximos-passos.md. Aqui está só o
// fio elétrico: transporte, despacho e acesso a dados. O catálogo de
// ferramentas, a resolução de projeto por nome e toda a formatação de saída
// (incluindo a redação de credencial) são lógica pura e moram em
// src/dominio/mcp.ts, com teste próprio.
//
// ── Por que o SDK direto, e não um adaptador
//
// `@modelcontextprotocol/sdk` traz desde a 1.30 um transporte sobre Web
// Standards (`WebStandardStreamableHTTPServerTransport`): ele recebe um
// `Request` e devolve um `Response`, que é exatamente a assinatura de um route
// handler do App Router. Não precisa de ponte para `http.IncomingMessage`, e
// não precisa de `mcp-handler`/`@vercel/mcp-adapter`, que existiam justamente
// para preencher esse buraco antes desse transporte existir. Uma dependência
// direta a menos, e uma camada a menos entre um bug e a causa dele.
//
// ── Sem sessão, por escolha
//
// `sessionIdGenerator: undefined` = modo sem estado: cada POST constrói um
// `Server` novo, responde e morre. É o único modo honesto em função serverless
// — não há processo de longa duração para guardar sessão entre invocações, e
// duas requisições seguidas podem cair em instâncias diferentes. Como
// consequência não há stream SSE nem notificação do servidor para o cliente,
// o que este painel não usa: toda ferramenta aqui é uma pergunta com uma
// resposta.
//
// ── Esquema de entrada escrito à mão
//
// O `inputSchema` de cada ferramenta é JSON Schema literal, não schema
// derivado de validador. Ele é documentação para o modelo, não o portão: quem
// decide o que entra são os mesmos validadores que as rotas de API usam
// (`validarDadosProjetoComFrequencia`, `validarContexto`). Um segundo conjunto
// de regras aqui divergiria do primeiro na primeira vez que alguém mexesse só
// num dos dois, e o jeito de descobrir seria em produção.
//
// ── O que NÃO existe aqui, e por quê
//
// Não há `aprovar_sugestao`, `recusar_sugestao`, `marcar_feita`, nem nada que
// apague. Todo o desenho do painel se apoia em "só o dono aprova", e um modelo
// num chat pode ser dirigido pelo texto que ele leu — um README, uma página,
// a saída de outra ferramenta. Aprovar continua sendo dois cliques no painel;
// é o único lugar do sistema onde fricção vale a pena. Essa proteção é a
// ausência da ferramenta, não uma checagem: não adianta pedir credencial mais
// forte para algo que o modelo pode ser convencido a chamar, porque ele tem a
// credencial por construção.
//
// ── Acesso
//
// A rota já chamou `exigirAcesso()` antes de entregar a requisição aqui, então
// qualquer chamada que chegue é pelo menos a routine. As duas ferramentas de
// escrita pedem mais: `exigirDonoOuMcp()`, que aceita sessão do dono ou
// `PAINEL_MCP_SECRET` e recusa o bypass puro. Ver o comentário de
// `exigirDonoOuMcp` em src/servidor/acesso.ts para o raciocínio inteiro, e
// docs/mcp.md para como o dono configura isso.

const NOME_SERVIDOR = "painel-de-controle";
const VERSAO_SERVIDOR = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────
// Resultado de ferramenta
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resposta de sucesso: JSON compacto como texto.
 *
 * Sem indentação de propósito — o destino é o contexto de um modelo, que lê
 * JSON compacto igualmente bem e paga por token. Sem `structuredContent`
 * também: ele duplicaria o mesmo corpo na mesma resposta, dobrando o custo
 * para clientes que já leem o bloco de texto.
 */
function resultado(dados: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(dados) }] };
}

/**
 * Resposta de falha. `isError: true` devolve a mensagem *ao modelo*, dentro da
 * conversa, em vez de derrubar a chamada JSON-RPC — é o que permite a ele
 * corrigir o parâmetro e tentar de novo sozinho. Erro de ferramenta que vira
 * exceção mata a conversa e obriga o dono a reexplicar tudo.
 */
function falha(mensagem: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: mensagem }] };
}

const MENSAGEM_GENERICA = "Não foi possível completar esta operação agora. Tente de novo em instantes.";

/**
 * Traduz o que subiu de dentro de uma ferramenta numa mensagem que o modelo
 * pode ler. Só `ErroDados` tem mensagem própria — ela já passou por
 * `traduzirErroDeBanco` (src/servidor/erros.ts) e é segura para sair. Qualquer
 * outro erro vira texto genérico, e o detalhe fica no log do servidor.
 */
function mensagemDeErro(erro: unknown, ferramenta: string): string {
  if (erro instanceof AcessoNegado) {
    return (
      "Esta ferramenta escreve no painel e o acesso atual é só de leitura. " +
      "Configure PAINEL_MCP_SECRET no servidor e o header x-painel-mcp-secret no cliente " +
      "(ver docs/mcp.md), ou faça esta alteração pelo painel."
    );
  }
  if (erro instanceof ErroDados) return erro.message;
  console.error(`[mcp] falha em ${ferramenta}:`, erro);
  return MENSAGEM_GENERICA;
}

// ─────────────────────────────────────────────────────────────────────────
// Ferramentas
// ─────────────────────────────────────────────────────────────────────────

type Argumentos = Record<string, unknown>;

/** Reduz um valor de argumento ao que os validadores de `src/dominio/` esperam receber de um formulário. */
function texto(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

/**
 * Encontra o projeto do argumento `projeto`, ou devolve a falha já formatada.
 *
 * Devolve junto `nome`, que é o **único** rótulo que deve sair daqui para o
 * modelo. `projeto.nome` cru escapava do filtro em quatro respostas enquanto
 * `listar` o redigia — a inconsistência é que é a armadilha, porque a saída
 * continua parecendo certa. Resolver uma vez aqui é o que impede a quinta.
 */
async function comProjeto(
  args: Argumentos,
): Promise<
  | { ok: true; projeto: Projeto; nome: string; todos: Projeto[] }
  | { ok: false; resposta: CallToolResult }
> {
  const todos = await listarProjetos();
  const achado = resolverProjeto(args.projeto, todos);
  if (!achado.ok) return { ok: false, resposta: falha(achado.erro) };
  return { ok: true, projeto: achado.projeto, nome: semCredencial(achado.projeto.nome), todos };
}

async function listar(): Promise<CallToolResult> {
  const projetos = await listarProjetos();
  return resultado({ projetos: projetosParaMcp(projetos) });
}

async function verRodadas(args: Argumentos): Promise<CallToolResult> {
  const alvo = await comProjeto(args);
  if (!alvo.ok) return alvo.resposta;

  // `ver_rodadas` já corta em 5 por padrão e 20 no máximo; buscar mais que o
  // teto da própria ferramenta é trabalho jogado fora.
  const relatorios = await listarRelatoriosDoProjeto(alvo.projeto.id, LIMITE_RODADAS_MAXIMO);
  const limite = limiteDeRodadas(args.limite);
  return resultado({
    projeto: alvo.nome,
    total_de_rodadas: relatorios.length,
    rodadas: rodadasParaMcp(relatorios, limite),
  });
}

const ESTADOS: readonly EstadoSugestao[] = ["pendente", "aprovada", "recusada", "feita"];

async function verSugestoes(args: Argumentos): Promise<CallToolResult> {
  // `null` é tratado como ausente junto com `undefined`: cliente que serializa
  // parâmetro opcional omitido como `null` é comum, e recusar isso viraria um
  // erro que o modelo não entende como corrigir.
  const estadoPedido = args.estado ?? undefined;
  if (estadoPedido !== undefined && !ESTADOS.includes(estadoPedido as EstadoSugestao)) {
    return falha(`estado precisa ser um de: ${ESTADOS.join(", ")}.`);
  }

  const projetos = await listarProjetos();
  const nomePorId = new Map(projetos.map((p) => [p.id, p.nome]));
  const nomeDoProjeto = (id: string) => nomePorId.get(id) ?? "projeto removido";

  // Sem `projeto`, a pergunta é "o que espera decisão em qualquer lugar" — a
  // fila inteira, que é o caso de uso da manhã.
  let sugestoes;
  if (args.projeto === undefined || args.projeto === null) {
    sugestoes = await listarSugestoes();
  } else {
    const achado = resolverProjeto(args.projeto, projetos);
    if (!achado.ok) return falha(achado.erro);
    sugestoes = await listarSugestoesDoProjeto(achado.projeto.id);
  }

  const filtradas = estadoPedido === undefined ? sugestoes : sugestoes.filter((s) => s.estado === estadoPedido);
  const ordenadas = ordenarSugestoes(filtradas);

  return resultado({
    total: filtradas.length,
    sugestoes: sugestoesParaMcp(ordenadas, nomeDoProjeto),
    // Repetido em toda resposta de propósito: é a regra que o desenho inteiro
    // do painel sustenta, e o lugar mais barato de lembrá-la é onde a fila
    // aparece.
    decisao: "Aprovar ou recusar é do dono, no painel. Não existe ferramenta para isso aqui.",
  });
}

async function verInventario(args: Argumentos): Promise<CallToolResult> {
  const alvo = await comProjeto(args);
  if (!alvo.ok) return alvo.resposta;

  const [stack, servicos] = await Promise.all([
    listarStackDoProjeto(alvo.projeto.id),
    listarServicoDoProjeto(alvo.projeto.id),
  ]);
  return resultado({ projeto: alvo.nome, ...inventarioParaMcp(stack, servicos) });
}

async function verContexto(args: Argumentos): Promise<CallToolResult> {
  const alvo = await comProjeto(args);
  if (!alvo.ok) return alvo.resposta;

  const contextos = await listarContextosDoProjeto(alvo.projeto.id);
  return resultado({ projeto: alvo.nome, contexto: contextosParaMcp(contextos) });
}

async function cadastrarProjeto(args: Argumentos): Promise<CallToolResult> {
  // Escrita: recusa o bypass puro da routine. Cadastrar projeto é decisão do
  // dono — e não existe ferramenta para desfazer isso daqui.
  await exigirDonoOuMcp();

  const validado = validarDadosProjetoComFrequencia({
    nome: texto(args.nome),
    repositorio: texto(args.repositorio),
    frequencia: texto(args.frequencia),
  });
  if (!validado.ok) return falha(validado.erro);

  const projeto = await criarProjeto(validado.dados);
  return resultado({
    criado: projetosParaMcp([projeto])[0],
    // Pendência conhecida (docs/proximos-passos.md, "Pendências menores"):
    // painel e routine mantêm listas separadas de repositório, e a falha é
    // silenciosa — vira `falha` no relatório da manhã seguinte. Enquanto o
    // painel não avisa sozinho, o aviso sai por aqui, onde o dono está lendo.
    lembrete:
      projeto.repositorio === null
        ? "O projeto está no painel sem repositório: a rodada não vai clonar nada, e não haverá histórico de commit nem PR na tela dele."
        : "O projeto está no painel, mas a routine noturna tem a própria lista de repositórios. " +
          "Avise o dono para somar este repositório lá também, senão a primeira rodada vira falha.",
  });
}

async function anexarContexto(args: Argumentos): Promise<CallToolResult> {
  // Escrita, e a mais sensível das duas: este texto acaba no CLAUDE.md do
  // repositório alvo, lido por todo agente da rodada seguinte. `upsertContexto`
  // chama `exigirDonoOuMcp()` de novo lá dentro — a checagem aqui existe para
  // a recusa virar mensagem legível em vez de exceção.
  await exigirDonoOuMcp();

  const alvo = await comProjeto(args);
  if (!alvo.ok) return alvo.resposta;

  // O mesmo validador de `PUT /api/context/:projeto`: tamanho, caractere de
  // controle no rótulo, e `https://` obrigatório em link. Nada de regra
  // paralela aqui.
  const validado = validarContexto({
    agente_destino: args.agente_destino,
    tipo: args.tipo,
    conteudo: args.conteudo,
    arquivo_url: null,
  });
  if (!validado.ok) return falha(validado.erro);

  const jaExistentes = await listarContextosDoProjeto(alvo.projeto.id);
  const colidindo = contextoExistente(jaExistentes, validado.dados.agente_destino, validado.dados.tipo);
  if (colidindo && args.substituir !== true) {
    return falha(
      `Já existe contexto de tipo "${validado.dados.tipo}" para o agente "${validado.dados.agente_destino}" ` +
        `no projeto "${alvo.nome}", atualizado em ${colidindo.atualizado_em}. ` +
        "Gravar por cima apagaria o texto anterior e não há como desfazer daqui. " +
        "Mostre ao dono o que já está lá (ver_contexto) e só repita com substituir=true se ele confirmar.",
    );
  }

  const contexto = await upsertContexto(alvo.projeto.id, validado.dados, "mcp");
  return resultado({
    projeto: alvo.nome,
    anexado: contextosParaMcp([contexto])[0],
    substituiu: colidindo !== null,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Despacho
// ─────────────────────────────────────────────────────────────────────────

const EXECUTORES: Record<string, (args: Argumentos) => Promise<CallToolResult>> = {
  listar_projetos: listar,
  ver_rodadas: verRodadas,
  ver_sugestoes: verSugestoes,
  ver_inventario: verInventario,
  ver_contexto: verContexto,
  cadastrar_projeto: cadastrarProjeto,
  anexar_contexto: anexarContexto,
};

async function despachar(nome: string, args: Argumentos): Promise<CallToolResult> {
  const executor = EXECUTORES[nome];
  if (!executor) return falha(`Ferramenta desconhecida: "${nome}".`);

  try {
    return await executor(args);
  } catch (erro) {
    return falha(mensagemDeErro(erro, nome));
  }
}

/** O catálogo do domínio, conferido contra o tipo do SDK aqui na fronteira. */
const FERRAMENTAS: Tool[] = FERRAMENTAS_MCP.map((f) => f);

function construirServidor(): Server {
  const servidor = new Server(
    { name: NOME_SERVIDOR, version: VERSAO_SERVIDOR },
    {
      capabilities: { tools: {} },
      instructions:
        "Painel pessoal de acompanhamento dos agentes noturnos do dono. As ferramentas de leitura " +
        "respondem o que as rodadas encontraram e o que está na fila. As duas de escrita (cadastrar " +
        "projeto, anexar contexto) só devem ser usadas quando o dono pedir. Aprovar ou recusar sugestão " +
        "não existe aqui e é sempre decisão dele, no painel.",
    },
  );

  servidor.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: FERRAMENTAS }));
  servidor.setRequestHandler(CallToolRequestSchema, async (pedido) =>
    despachar(pedido.params.name, (pedido.params.arguments ?? {}) as Argumentos),
  );

  return servidor;
}

/**
 * Atende uma requisição MCP. Um `Server` e um transporte por requisição — modo
 * sem estado; ver o comentário no topo do arquivo.
 */
export async function atenderMcp(req: Request): Promise<Response> {
  const servidor = construirServidor();
  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await servidor.connect(transporte);
    return await transporte.handleRequest(req);
  } finally {
    // A resposta já foi montada inteira (`enableJsonResponse`), então fechar
    // aqui não corta stream nenhum — só solta o que esta invocação alocou.
    await servidor.close().catch(() => {});
  }
}

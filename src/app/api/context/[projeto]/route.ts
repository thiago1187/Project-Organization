import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso, exigirSessaoDoDono } from "@/servidor/acesso";
import { deletarContexto, listarContextosDoProjeto, upsertContexto } from "@/servidor/contextos";
import { obterProjetoPorId } from "@/servidor/projetos";
import { ErroDados } from "@/servidor/erros";
import { validarContexto } from "@/dominio/validacaoContexto";
import { lerJson, respostaErro } from "@/servidor/respostaApi";

// GET /api/context/:projeto — contexto de um projeto (ver CLAUDE.md > "Rotas
// de API"). Lido pelo painel (tela de detalhe) e pela routine — a routine só
// lê, nunca escreve (ver a rota PUT abaixo). Aceita sessão do dono OU o
// header de bypass, como as demais rotas de leitura.
//
// PUT /api/context/:projeto — cria ou substitui um item de contexto (upsert
// por `agente_destino` + `tipo`, ver `upsertContexto` em
// src/servidor/contextos.ts). **Exceção deliberada à regra 4**: exige sessão
// do dono e recusa o header de bypass. O contexto é escrito no CLAUDE.md do
// repositório alvo e lido por agentes que agem — se a routine pudesse
// escrever contexto, um agente comprometido escreveria as próprias
// instruções para a rodada seguinte, uma injeção que persiste entre rodadas
// (ver docs/plano-agentes-por-projeto.md). Corpo:
//   { "agente_destino": "designer-ui", "tipo": "modelo de design",
//     "conteudo": "..." | null, "arquivo_url": "https://..." | null }
// (pelo menos um de conteudo/arquivo_url é obrigatório).
//
// DELETE /api/context/:projeto — remove um item de contexto. Mesma exceção
// de acesso da rota PUT (só sessão do dono). Corpo: { "id": "<uuid>" }.
//
// Rotas novas nesta entrega — GET/PUT/DELETE não existiam antes (ver
// docs/plano-agentes-por-projeto.md, causa nº 1 da tela de detalhe parecer
// vazia). Mudar o formato aqui não quebra a routine da mesma forma que
// GET /api/projects: só GET /api/projects é o contrato lido pela rodada
// noturna (ver o comentário lá).

export const dynamic = "force-dynamic";

const UUID_FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ projeto: string }> }) {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const { projeto: projetoId } = await params;
  const projeto = await obterProjetoPorId(projetoId);
  if (!projeto) return respostaErro(404, "Este projeto não existe.");

  const contexto = await listarContextosDoProjeto(projetoId);
  return NextResponse.json({ contexto }, { status: 200 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ projeto: string }> }) {
  try {
    await exigirSessaoDoDono();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const { projeto: projetoId } = await params;
  const projeto = await obterProjetoPorId(projetoId);
  if (!projeto) return respostaErro(404, "Este projeto não existe.");

  const corpo = await lerJson(req);
  if (!corpo.ok) return respostaErro(400, "Corpo da requisição precisa ser JSON válido.");

  const validado = validarContexto(corpo.dados);
  if (!validado.ok) return respostaErro(400, validado.erro);

  try {
    const contexto = await upsertContexto(projetoId, validado.dados);
    return NextResponse.json(contexto, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroDados) return respostaErro(400, erro.message);
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar o contexto agora.";
    return respostaErro(500, mensagem);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projeto: string }> }) {
  try {
    await exigirSessaoDoDono();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const { projeto: projetoId } = await params;
  const projeto = await obterProjetoPorId(projetoId);
  if (!projeto) return respostaErro(404, "Este projeto não existe.");

  const corpo = await lerJson(req);
  if (!corpo.ok) return respostaErro(400, "Corpo da requisição precisa ser JSON válido.");

  const { id } = corpo.dados as Record<string, unknown>;
  if (typeof id !== "string" || !UUID_FORMATO.test(id)) {
    return respostaErro(400, "id precisa ser o identificador de um item de contexto.");
  }

  try {
    await deletarContexto(id, projetoId);
    return new NextResponse(null, { status: 204 });
  } catch (erro) {
    if (erro instanceof ErroDados) return respostaErro(404, erro.message);
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível remover este item agora.";
    return respostaErro(500, mensagem);
  }
}

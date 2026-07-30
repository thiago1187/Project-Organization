import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { criarRelatorio, listarRelatorios } from "@/servidor/relatorios";
import { obterProjetoPorId } from "@/servidor/projetos";
import { ErroDados } from "@/servidor/erros";
import { validarRelatorio } from "@/dominio/validacaoRelatorio";
import { lerJson, respostaErro } from "@/servidor/respostaApi";

// GET /api/reports — alimenta as telas do painel (histórico de rodadas), e é
// lido pela routine no Passo 0 para saber a idade do último relatório de cada
// projeto (ver docs/routine-noturna.md). Sem filtro: escala pessoal, mesmo
// padrão de `listarRelatorios` (usado hoje pela Visão Geral).
//
// POST /api/reports — recebe o diagnóstico de uma rodada, chamado pela
// routine (ver CLAUDE.md > "Rotas de API" e docs/routine-noturna.md > "2.3
// Enviar o relatório"). Corpo:
//   {
//     "projeto_id": "<uuid>",
//     "status": "ok" | "atencao" | "falha",
//     "resumo": "...",
//     "testes_passaram": true | false | null,
//     "achados_por_agente": [{ "agente": "...", "achado": "...", "selo": "..." }]
//   }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const relatorios = await listarRelatorios();
  return NextResponse.json({ relatorios }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const corpo = await lerJson(req);
  if (!corpo.ok) return respostaErro(400, "Corpo da requisição precisa ser JSON válido.");

  const validado = validarRelatorio(corpo.dados);
  if (!validado.ok) return respostaErro(400, validado.erro);

  const projeto = await obterProjetoPorId(validado.dados.projeto_id);
  if (!projeto) return respostaErro(404, "Este projeto não existe.");

  try {
    const relatorio = await criarRelatorio(validado.dados);
    return NextResponse.json(relatorio, { status: 201 });
  } catch (erro) {
    // Mensagens vindas daqui já passaram por `traduzirErroDeBanco` — seguras
    // para o cliente (nunca detalhe de SQL ou de conexão). `ErroDados` é
    // problema do que foi enviado; qualquer outro `Error` é falha de
    // infraestrutura que já foi logada dentro da camada de dados.
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar o relatório agora.";
    return respostaErro(erro instanceof ErroDados ? 400 : 500, mensagem);
  }
}

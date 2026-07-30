import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { criarSugestao } from "@/servidor/sugestoes";
import { obterProjetoPorId } from "@/servidor/projetos";
import { ErroDados } from "@/servidor/erros";
import { validarSugestao } from "@/dominio/validacaoSugestao";
import { lerJson, respostaErro } from "@/servidor/respostaApi";

// POST /api/suggestions — recebe uma proposta levantada por um agente,
// chamado pela routine, um POST por sugestão (ver CLAUDE.md > "Rotas de API"
// e docs/routine-noturna.md > "2.4 Enviar as sugestões"). Corpo:
//   {
//     "projeto_id": "<uuid>",
//     "agente": "revisor-seguranca",
//     "proposta": "...",
//     "motivo": "...",
//     "esforco": "pequeno" | "medio" | "grande",
//     "risco": "...",
//     "reversibilidade": "facil" | "dificil" | "nao_reverte"
//   }
//
// Não aceita `estado`: toda sugestão nasce "pendente" — aprovar é decisão do
// dono, só possível por `PATCH /api/suggestions/:id` com sessão.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const corpo = await lerJson(req);
  if (!corpo.ok) return respostaErro(400, "Corpo da requisição precisa ser JSON válido.");

  const validado = validarSugestao(corpo.dados);
  if (!validado.ok) return respostaErro(400, validado.erro);

  const projeto = await obterProjetoPorId(validado.dados.projeto_id);
  if (!projeto) return respostaErro(404, "Este projeto não existe.");

  try {
    const sugestao = await criarSugestao(validado.dados);
    return NextResponse.json(sugestao, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar a sugestão agora.";
    return respostaErro(erro instanceof ErroDados ? 400 : 500, mensagem);
  }
}

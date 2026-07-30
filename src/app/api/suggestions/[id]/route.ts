import { NextResponse } from "next/server";
import { AcessoNegado, exigirSessaoDoDono } from "@/servidor/acesso";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "@/servidor/sugestoes";
import { ErroDados } from "@/servidor/erros";
import { validarPatchSugestao } from "@/dominio/validacaoPatchSugestao";
import { lerJson, respostaErro } from "@/servidor/respostaApi";

// PATCH /api/suggestions/:id — aprovar, recusar ou marcar como feita (ver
// CLAUDE.md > "Rotas de API" e docs/proximos-passos.md, item 2 — "tirar a
// execução da routine"). As três transições são do dono agora: a routine só
// lê `GET /api/projects`, nunca escreve em `sugestao`. Por isso esta rota usa
// `exigirSessaoDoDono()` puro, sem o ramo de bypass que existia quando a
// routine executava sugestão aprovada e marcava "feita" sozinha.
//
// A trigger do banco (`sugestao_validar_transicao`,
// db/migrations/001_schema_inicial.sql) continua sendo a segunda linha de
// defesa da máquina de estados: só libera pendente→aprovada, pendente→recusada
// ou aprovada→feita, não importa quem chame.
//
// O corpo nunca é repassado além de `estado` e `pr_url`
// (src/dominio/validacaoPatchSugestao.ts): `aprovada_em` não é um campo
// aceito daqui — quem grava esse timestamp é sempre `now()` no servidor, no
// caminho de aprovação.
//
// Corpo aceito (sempre com sessão do dono):
//   { "estado": "aprovada" | "recusada" }
//   { "estado": "feita", "pr_url": "https://..." }  — pr_url é opcional aqui;
//   ver comentário em src/dominio/validacaoPatchSugestao.ts.

export const dynamic = "force-dynamic";

const UUID_FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirSessaoDoDono();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const { id } = await params;
  if (!UUID_FORMATO.test(id)) return respostaErro(404, "Esta sugestão não existe.");

  const corpo = await lerJson(req);
  if (!corpo.ok) return respostaErro(400, "Corpo da requisição precisa ser JSON válido.");

  const validado = validarPatchSugestao(corpo.dados);
  if (!validado.ok) return respostaErro(400, validado.erro);

  const { estado, pr_url } = validado.dados;

  try {
    const sugestao =
      estado === "aprovada"
        ? await aprovarSugestao(id)
        : estado === "recusada"
          ? await recusarSugestao(id)
          : await marcarSugestaoFeita(id, pr_url);

    return NextResponse.json(sugestao, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroDados) return respostaErro(409, erro.message);
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível decidir esta sugestão agora.";
    return respostaErro(500, mensagem);
  }
}

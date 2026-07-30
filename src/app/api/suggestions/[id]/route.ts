import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcessoComOrigem } from "@/servidor/acesso";
import { aprovarSugestao, marcarSugestaoFeita, recusarSugestao } from "@/servidor/sugestoes";
import { ErroDados } from "@/servidor/erros";
import { validarPatchSugestao } from "@/dominio/validacaoPatchSugestao";
import { lerJson, respostaErro } from "@/servidor/respostaApi";

// PATCH /api/suggestions/:id — aprovar, recusar ou marcar como feita (ver
// CLAUDE.md > "Rotas de API" e docs/routine-noturna.md > "2.5 Executar o que
// já veio aprovado"). É o gate de aprovação do sistema inteiro: quem tem
// sessão (o dono) decide "aprovada"/"recusada"; quem tem só o header de
// bypass (a routine) só pode gravar "feita", e só a partir de "aprovada".
// Sem essa distinção, quem executa (a routine) também poderia se
// auto-aprovar — a trigger do banco barra o salto pendente→feita, mas não
// impede pendente→aprovada vindo do lado errado. Essa distinção é o que esta
// rota garante, e por isso ela não pode ser afrouxada.
//
// O corpo nunca é repassado além de `estado` e `pr_url`
// (src/dominio/validacaoPatchSugestao.ts): `aprovada_em` não é um campo
// aceito daqui — quem grava esse timestamp é sempre `now()` no servidor, no
// caminho de aprovação.
//
// Corpo aceito:
//   { "estado": "aprovada" | "recusada" }               — só com sessão
//   { "estado": "feita", "pr_url": "https://github.com/..." } — só com bypass

export const dynamic = "force-dynamic";

const UUID_FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let origem: "sessao" | "bypass";
  try {
    origem = await exigirAcessoComOrigem();
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

  if (origem === "sessao" && estado === "feita") {
    return respostaErro(403, 'Sessão do dono não marca sugestão como "feita" — isso é da routine.');
  }
  if (origem === "bypass" && estado !== "feita") {
    return respostaErro(403, "A routine só pode marcar sugestão como \"feita\"; aprovar e recusar são do dono.");
  }

  try {
    const sugestao =
      estado === "aprovada"
        ? await aprovarSugestao(id)
        : estado === "recusada"
          ? await recusarSugestao(id)
          : await marcarSugestaoFeita(id, pr_url as string);

    return NextResponse.json(sugestao, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroDados) return respostaErro(409, erro.message);
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível decidir esta sugestão agora.";
    return respostaErro(500, mensagem);
  }
}

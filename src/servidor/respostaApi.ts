import "server-only";
import { NextResponse } from "next/server";

// Helpers minúsculos e repetidos pelas quatro rotas de API (GET /api/projects,
// GET+POST /api/reports, POST /api/suggestions, PATCH /api/suggestions/:id):
// ler corpo JSON sem lançar em corpo malformado, e devolver erro no formato
// `{ "erro": "..." }` com o status certo. Nenhuma lógica de negócio aqui —
// isso fica nos arquivos de src/servidor/*.ts que cada rota chama.

/** Lê o corpo como JSON. `ok: false` cobre corpo ausente, vazio ou malformado — nunca lança. */
export async function lerJson(req: Request): Promise<{ ok: true; dados: unknown } | { ok: false }> {
  try {
    const dados = await req.json();
    return { ok: true, dados };
  } catch {
    return { ok: false };
  }
}

export function respostaErro(status: number, mensagem: string): NextResponse {
  return NextResponse.json({ erro: mensagem }, { status });
}

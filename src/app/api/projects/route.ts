import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { listarProjetos } from "@/servidor/projetos";
import { listarContextos } from "@/servidor/contextos";
import { listarSugestoes } from "@/servidor/sugestoes";
import { respostaErro } from "@/servidor/respostaApi";
import type { Contexto, Sugestao } from "@/dominio/tipos";

// GET /api/projects — lido pela routine noturna (ver CLAUDE.md, "Rotas de
// API", e docs/routine-noturna.md, "Passo 0"). Contrato sensível: mudar o
// formato da resposta quebra a automação em silêncio, só visível na madrugada
// seguinte. Qualquer mudança de formato aqui é mudança significativa (ver
// CLAUDE.md > Documentação) e exige aviso + escriba-docs.
//
// Devolve os projetos ativos, cada um com:
// - o contexto que o dono anexou (a routine escreve isso no CLAUDE.md do
//   repositório alvo antes de acionar os agentes);
// - as sugestões aprovadas, inteiras (a routine executa até três, as mais
//   antigas primeiro, por isso `criada_em` e `id` vão junto);
// - só o texto (proposta) das sugestões pendentes e recusadas — o suficiente
//   para a routine não repetir uma proposta já feita ou já negada (ver
//   CLAUDE.md e docs/routine-noturna.md > "O buraco de duplicata").
//
// Projeto pausado (ativo = false) não entra: a routine não deve rodar nele.

export const dynamic = "force-dynamic";

interface ContextoParaRoutine {
  agente_destino: string;
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
}

function contextoParaRoutine(c: Contexto): ContextoParaRoutine {
  return {
    agente_destino: c.agente_destino,
    tipo: c.tipo,
    conteudo: c.conteudo,
    arquivo_url: c.arquivo_url,
  };
}

interface SugestaoAprovadaParaRoutine {
  id: string;
  agente: string;
  proposta: string;
  motivo: string;
  esforco: Sugestao["esforco"];
  risco: string;
  reversibilidade: Sugestao["reversibilidade"];
  criada_em: string;
  aprovada_em: string | null;
}

function sugestaoAprovadaParaRoutine(s: Sugestao): SugestaoAprovadaParaRoutine {
  return {
    id: s.id,
    agente: s.agente,
    proposta: s.proposta,
    motivo: s.motivo,
    esforco: s.esforco,
    risco: s.risco,
    reversibilidade: s.reversibilidade,
    criada_em: s.criada_em,
    aprovada_em: s.aprovada_em,
  };
}

export async function GET() {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const [projetos, contextos, sugestoes] = await Promise.all([
    listarProjetos(),
    listarContextos(),
    listarSugestoes(),
  ]);

  const projetosAtivos = projetos.filter((p) => p.ativo);

  const corpo = {
    projetos: projetosAtivos.map((p) => {
      const contextoDoProjeto = contextos.filter((c) => c.projeto_id === p.id);
      const sugestoesDoProjeto = sugestoes.filter((s) => s.projeto_id === p.id);

      return {
        id: p.id,
        nome: p.nome,
        repositorio: p.repositorio,
        frequencia: p.frequencia,
        contexto: contextoDoProjeto.map(contextoParaRoutine),
        sugestoes_aprovadas: sugestoesDoProjeto
          .filter((s) => s.estado === "aprovada")
          .map(sugestaoAprovadaParaRoutine),
        sugestoes_pendentes: sugestoesDoProjeto.filter((s) => s.estado === "pendente").map((s) => s.proposta),
        sugestoes_recusadas: sugestoesDoProjeto.filter((s) => s.estado === "recusada").map((s) => s.proposta),
      };
    }),
  };

  return NextResponse.json(corpo, { status: 200 });
}

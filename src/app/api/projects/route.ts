import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { listarProjetos } from "@/servidor/projetos";
import { listarContextos } from "@/servidor/contextos";
import { listarSugestoes } from "@/servidor/sugestoes";
import { listarAgentesProjeto } from "@/servidor/agentesProjeto";
import { agentesAtivosOrdenados } from "@/dominio/esteiraAgentes";
import { respostaErro } from "@/servidor/respostaApi";
import type { Contexto, ProjetoAgente, Sugestao } from "@/dominio/tipos";

// GET /api/projects — lido pela routine noturna (ver CLAUDE.md, "Rotas de
// API", e docs/routine-noturna.md, "Passo 0"). Contrato sensível: mudar o
// formato da resposta quebra a automação em silêncio, só visível na madrugada
// seguinte. Qualquer mudança de formato aqui é mudança significativa (ver
// CLAUDE.md > Documentação) e exige aviso + escriba-docs.
//
// Devolve os projetos ativos, cada um com:
// - o contexto que o dono anexou (a routine escreve isso no CLAUDE.md do
//   repositório alvo antes de acionar os agentes);
// - as sugestões aprovadas, inteiras — não são mais para a routine executar
//   (isso acabou, ver docs/proximos-passos.md item 2, "tirar a execução da
//   routine"); ficam aqui para a rodada saber o que o dono já decidiu que
//   quer, e não sugerir de novo algo que já está aprovado e só esperando o
//   dono gerar o prompt e fazer;
// - só o texto (proposta) das sugestões pendentes e recusadas — o suficiente
//   para a routine não repetir uma proposta já feita ou já negada (ver
//   CLAUDE.md e docs/routine-noturna.md > "O buraco de duplicata");
// - `agentes`: os agentes habilitados na esteira do projeto (ver
//   docs/plano-agentes-por-projeto.md), já ordenados pelo servidor — a
//   routine não deve reordenar nada. Campo ADITIVO (docs/proximos-passos.md
//   item 1, § 4.1 do plano): quando ausente ou vazio, a routine cai na lista
//   fixa de sempre (revisor-seguranca, revisor-codigo, qa-testes,
//   devops-deploy — ver docs/routine-noturna.md, passo 2.2). Essa regra de
//   degradação é o que evita deploy coordenado entre este app e a routine:
//   o painel pode subir o campo antes de a routine saber dele, e a routine
//   pode ser atualizada antes de qualquer projeto ter esteira configurada.
//
// Formato inalterado pela mudança de fluxo de execução — só o significado de
// "aprovada" mudou (de "a routine pode executar" para "o dono quer, vai
// entrar no prompt"), não o contrato JSON daquele campo. `agentes` é o
// primeiro campo novo desde então. Trocar o formato de `agentes` depois é
// mudança significativa pelo CLAUDE.md e exige aviso + escriba-docs, mesma
// regra que já vale para o resto desta rota.
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

interface AgenteParaRoutine {
  agente: string;
  ordem: number;
  instrucao: string | null;
  teto_sugestoes: number | null;
}

function agenteParaRoutine(a: ProjetoAgente): AgenteParaRoutine {
  return { agente: a.agente, ordem: a.ordem, instrucao: a.instrucao, teto_sugestoes: a.teto_sugestoes };
}

export async function GET() {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const [projetos, contextos, sugestoes, agentesProjeto] = await Promise.all([
    listarProjetos(),
    listarContextos(),
    listarSugestoes(),
    listarAgentesProjeto(),
  ]);

  const projetosAtivos = projetos.filter((p) => p.ativo);

  const corpo = {
    projetos: projetosAtivos.map((p) => {
      const contextoDoProjeto = contextos.filter((c) => c.projeto_id === p.id);
      const sugestoesDoProjeto = sugestoes.filter((s) => s.projeto_id === p.id);
      const agentesDoProjeto = agentesProjeto.filter((a) => a.projeto_id === p.id);

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
        agentes: agentesAtivosOrdenados(agentesDoProjeto).map(agenteParaRoutine),
      };
    }),
  };

  return NextResponse.json(corpo, { status: 200 });
}

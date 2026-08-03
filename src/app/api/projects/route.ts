import { NextResponse } from "next/server";
import { AcessoNegado, exigirAcesso } from "@/servidor/acesso";
import { listarProjetos } from "@/servidor/projetos";
import { listarContextos } from "@/servidor/contextos";
import { listarSugestoes } from "@/servidor/sugestoes";
import { listarAgentesProjeto } from "@/servidor/agentesProjeto";
import { listarTarefas } from "@/servidor/tarefas";
import { listarAgentesPadrao } from "@/servidor/agentesPadrao";
import { mapaAgentesPadrao, resolverConfiguracaoAgente } from "@/dominio/agentePadrao";
import { agentesAtivosOrdenados } from "@/dominio/esteiraAgentes";
import { tarefasEmAberto } from "@/dominio/tarefas";
import { textoParaAgente } from "@/dominio/textoParaAgente";
import { respostaErro } from "@/servidor/respostaApi";
import type { AgentePadrao, Contexto, ProjetoAgente, Sugestao, Tarefa } from "@/dominio/tipos";

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
// - `descricao`: o que este projeto é, em prosa do dono (projeto.descricao,
//   db/migrations/008_projeto_descricao.sql) — `null` quando ainda não
//   escrita, ou enquanto a migration não foi aplicada. Entra no bloco
//   contexto-do-painel do CLAUDE.md alvo (docs/routine-noturna.md, passo
//   2.1) pela mesma porta que `contexto` já usa.
// - `tarefas`: as tarefas em aberto do projeto (`aberta`/`fazendo`, nunca
//   `feita` — a rodada não tem o que fazer com uma tarefa concluída), na
//   ordem gravada. Campo ADITIVO, mesma degradação de `agentes`: ausente ou
//   vazio, a rodada não tem material de anti-duplicata extra e segue como
//   hoje (docs/plano-gerenciador-de-projeto.md § 6.1). Sem `id` nem
//   timestamps — a routine nunca escreve em `tarefa`, então não há uso para
//   um identificador que ela não pode usar.
//
// Formato inalterado pela mudança de fluxo de execução — só o significado de
// "aprovada" mudou (de "a routine pode executar" para "o dono quer, vai
// entrar no prompt"), não o contrato JSON daquele campo. `descricao` e
// `tarefas` trocar de formato depois é mudança significativa pelo CLAUDE.md
// e exige aviso + escriba-docs, mesma regra que já vale para o resto desta rota.
//
// Projeto pausado (ativo = false) não entra: a routine não deve rodar nele.

export const dynamic = "force-dynamic";

interface ContextoParaRoutine {
  agente_destino: string;
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
}

// `conteudo` passa por `textoParaAgente` porque a routine escreve este valor
// dentro do bloco `contexto-do-painel` do CLAUDE.md do repositório alvo, e um
// texto contendo o marcador de fim fecharia o bloco e viraria instrução de
// topo — lida por todo agente da rodada seguinte. Ver o cabeçalho de
// src/dominio/textoParaAgente.ts.
//
// Este é o campo mais exposto dos três: `anexar_contexto` (MCP) grava aqui
// conteúdo que o Claude Code pode ter copiado de um README ou de uma página,
// sem passar pelos olhos do dono.
// `agente_destino` e `tipo` também passam, e ficaram de fora na primeira
// correção por engano meu: eles viram o cabeçalho `### Para <agente> — <tipo>`
// do mesmo bloco. `validarContexto` só barra caractere de controle, então um
// `tipo` valendo "<!-- contexto-do-painel:fim -->" tem 30 caracteres
// imprimíveis, cabe no limite de 64 e passa inteiro — e fecha o bloco a partir
// do cabeçalho, o que joga tudo abaixo dele para fora do preâmbulo.
//
// Limpar aqui não mexe na chave de identidade do contexto: `upsertContexto`
// grava e `contextoExistente` casa por (projeto_id, agente_destino, tipo)
// usando o valor **guardado**, e a limpeza é só na saída.
function contextoParaRoutine(c: Contexto): ContextoParaRoutine {
  return {
    agente_destino: textoParaAgente(c.agente_destino),
    tipo: textoParaAgente(c.tipo),
    conteudo: textoParaAgente(c.conteudo),
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

/**
 * A routine recebe a configuração **efetiva** do agente, já resolvida — nunca
 * o padrão global ao lado do valor do projeto para ela escolher.
 *
 * A precedência (projeto sobrescreve padrão, nunca soma) é regra do painel, e
 * mandar as duas pontas seria delegar a regra a um modelo que roda às 3h sem
 * ninguém para corrigir se ele decidir concatenar. Resolver aqui mantém o
 * contrato igual ao de antes de `agente_padrao` existir: um `instrucao` e um
 * `teto_sugestoes` por agente, e ponto.
 */
function agenteParaRoutine(
  a: ProjetoAgente,
  padroes: Map<string, AgentePadrao>,
): AgenteParaRoutine {
  const efetiva = resolverConfiguracaoAgente(a.instrucao, a.teto_sugestoes, padroes.get(a.agente));
  return {
    agente: a.agente,
    ordem: a.ordem,
    instrucao: efetiva.instrucao,
    teto_sugestoes: efetiva.tetoSugestoes,
  };
}

interface TarefaParaRoutine {
  titulo: string;
  estado: Tarefa["estado"];
}

function tarefaParaRoutine(t: Tarefa): TarefaParaRoutine {
  return { titulo: textoParaAgente(t.titulo), estado: t.estado };
}

export async function GET() {
  try {
    await exigirAcesso();
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaErro(401, "Acesso negado.");
    throw erro;
  }

  const [projetos, contextos, sugestoes, agentesProjeto, tarefas, padroes] = await Promise.all([
    listarProjetos(),
    listarContextos(),
    listarSugestoes(),
    listarAgentesProjeto(),
    listarTarefas(),
    listarAgentesPadrao(),
  ]);

  const mapaPadroes = mapaAgentesPadrao(padroes);

  const projetosAtivos = projetos.filter((p) => p.ativo);

  const corpo = {
    projetos: projetosAtivos.map((p) => {
      const contextoDoProjeto = contextos.filter((c) => c.projeto_id === p.id);
      const sugestoesDoProjeto = sugestoes.filter((s) => s.projeto_id === p.id);
      const agentesDoProjeto = agentesProjeto.filter((a) => a.projeto_id === p.id);
      const tarefasDoProjeto = tarefas.filter((t) => t.projeto_id === p.id);

      return {
        id: p.id,
        nome: p.nome,
        repositorio: p.repositorio,
        frequencia: p.frequencia,
        // Mesmo motivo de `conteudo` e `titulo`: a routine escreve isto no
        // CLAUDE.md do repositório alvo.
        descricao: textoParaAgente(p.descricao),
        contexto: contextoDoProjeto.map(contextoParaRoutine),
        sugestoes_aprovadas: sugestoesDoProjeto
          .filter((s) => s.estado === "aprovada")
          .map(sugestaoAprovadaParaRoutine),
        sugestoes_pendentes: sugestoesDoProjeto.filter((s) => s.estado === "pendente").map((s) => s.proposta),
        sugestoes_recusadas: sugestoesDoProjeto.filter((s) => s.estado === "recusada").map((s) => s.proposta),
        agentes: agentesAtivosOrdenados(agentesDoProjeto).map((a) => agenteParaRoutine(a, mapaPadroes)),
        tarefas: tarefasEmAberto(tarefasDoProjeto).map(tarefaParaRoutine),
      };
    }),
  };

  return NextResponse.json(corpo, { status: 200 });
}

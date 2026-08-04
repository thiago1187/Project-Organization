"use client";

import { useMemo, useState } from "react";
import type { FilaSugestoesVM } from "@/dominio/visao";
import type { Contexto, Relatorio, Tarefa } from "@/dominio/tipos";
import { gerarTextoPrompt } from "@/dominio/prompt";
import CartaoSugestao from "./CartaoSugestao";
import GeradorPrompt from "./GeradorPrompt";

// A fila de sugestões — o coração do produto (docs/visao.md: "sala de
// controle", não relatório). Três blocos:
//
// - pendentes: precisa de decisão do dono agora (aprovar/recusar), sempre visível.
// - aprovadas: o dono já quer, ainda não foi feito — continua visível, porque
//   "marcar como feita" é ação do dono agora (ver CartaoSugestao), não mais da
//   routine.
// - histórico (recusada/feita): recolhido por padrão, não compete por atenção.
//
// É "use client" porque guarda a seleção de sugestões para o gerador de
// prompt (docs/proximos-passos.md item 1) — pendentes e aprovadas podem ser
// marcadas; decididas (histórico) não entram na seleção, porque recusada não
// deveria ir para um prompt de trabalho e feita já foi feita.
export default function FilaSugestoes({
  projetoId,
  projetoNome,
  repositorio,
  fila,
  contextos,
  ultimoRelatorio,
  descricao,
  tarefasEmAberto,
}: {
  projetoId: string;
  projetoNome: string;
  repositorio: string;
  fila: FilaSugestoesVM;
  contextos: Contexto[];
  ultimoRelatorio: Relatorio | null;
  /**
   * `descricao` e `tarefasEmAberto` alimentam o prompt gerado, e faltavam.
   *
   * `gerarTextoPrompt` declara os dois como opcionais, então o TypeScript
   * nunca reclamou de não recebê-los — o prompt saía dizendo "o dono ainda não
   * escreveu uma descrição deste projeto" mesmo com a descrição preenchida na
   * tela logo acima. `docs/proximos-passos.md` afirmava que levava.
   *
   * Não são opcionais aqui de propósito: obrigatórios, o próximo chamador não
   * consegue esquecer.
   */
  descricao: string | null;
  tarefasEmAberto: Tarefa[];
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const selecionaveis = useMemo(() => [...fila.pendentes, ...fila.aprovadas], [fila.pendentes, fila.aprovadas]);

  function alternarSelecao(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const marcadasParaPrompt = selecionaveis.filter((s) => selecionadas.has(s.id));
  const temNaoReverte = marcadasParaPrompt.some((s) => s.naoReverte);
  const semNada = fila.pendentes.length === 0 && fila.aprovadas.length === 0 && fila.historico.length === 0;

  function gerarTexto(): string {
    return gerarTextoPrompt({
      projetoNome,
      repositorio,
      contextos,
      ultimoRelatorio,
      descricao,
      tarefasEmAberto,
      selecionadas: marcadasParaPrompt,
      recusadas: fila.recusadas,
    });
  }

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)" }}>
          fila de sugestões
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        {fila.pendentes.length > 0 && (
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--atn)" }}>
            {fila.pendentes.length} {fila.pendentes.length === 1 ? "esperando" : "esperando decisão"}
          </div>
        )}
      </div>

      {semNada && (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontSize: "var(--fs-xs)",
            color: "var(--mut3)",
          }}
        >
          nenhuma sugestão registrada ainda
        </div>
      )}

      {fila.pendentes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fila.pendentes.map((s) => (
            <CartaoSugestao
              key={s.id}
              sugestao={s}
              projetoId={projetoId}
              selecionavel
              selecionada={selecionadas.has(s.id)}
              onToggleSelecao={alternarSelecao}
            />
          ))}
        </div>
      )}

      {fila.aprovadas.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: fila.pendentes.length > 0 ? 18 : 0,
          }}
        >
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)" }}>
            {fila.aprovadas.length} {fila.aprovadas.length === 1 ? "aprovada, aguardando" : "aprovadas, aguardando"}
          </div>
          {fila.aprovadas.map((s) => (
            <CartaoSugestao
              key={s.id}
              sugestao={s}
              projetoId={projetoId}
              selecionavel
              selecionada={selecionadas.has(s.id)}
              onToggleSelecao={alternarSelecao}
            />
          ))}
        </div>
      )}

      {selecionaveis.length > 0 && (
        <GeradorPrompt
          quantidadeSelecionadas={marcadasParaPrompt.length}
          temNaoReverte={temNaoReverte}
          gerarTexto={gerarTexto}
        />
      )}

      {fila.historico.length > 0 && (
        <details style={{ marginTop: fila.pendentes.length > 0 || fila.aprovadas.length > 0 ? 18 : 0 }}>
          <summary
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--mut2)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {fila.historico.length} já {fila.historico.length === 1 ? "decidida" : "decididas"}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {fila.historico.map((s) => (
              <CartaoSugestao key={s.id} sugestao={s} projetoId={projetoId} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

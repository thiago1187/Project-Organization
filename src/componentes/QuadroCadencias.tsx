"use client";

import { useState, useTransition } from "react";
import { ORDEM_FAIXAS, type Faixa } from "@/dominio/cadencia";
import { agruparPorFaixa, type ProjetoCardVM } from "@/dominio/visao";
import { definirCadenciaAction } from "@/servidor/acoes-projeto";
import CardProjeto from "./CardProjeto";

// Drag and drop com HTML5 nativo, sem biblioteca (plano §2.10) — portado do
// export linhas 68-105. Soltar um card muda a faixa efetiva localmente na
// hora (para o quadro responder sem esperar a rede) e chama
// `definirCadenciaAction` para persistir — a mesma action que os botões da
// tela de Configuração usam, via `patchParaFaixa` (src/dominio/cadencia.ts).
// Se a escrita falhar, a faixa volta para onde estava e a mensagem de erro
// aparece acima do quadro.
export default function QuadroCadencias({ cards }: { cards: ProjetoCardVM[] }) {
  const [cadencias, setCadencias] = useState<Record<string, Faixa>>({});
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [faixaAlvo, setFaixaAlvo] = useState<Faixa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  const cardsComFaixaEfetiva = cards.map((c) => ({
    ...c,
    faixa: cadencias[c.id] ?? c.faixa,
  }));
  const faixas = agruparPorFaixa(cardsComFaixaEfetiva);

  // Limpa o estado de arraste. Quem grava a cadência é o onDrop da faixa —
  // este handler só cobre o caso de o drag terminar fora de um alvo válido
  // (ex.: Esc, soltar fora do quadro), igual ao p.solta do export.
  function limparArraste() {
    setArrastando(null);
    setFaixaAlvo(null);
  }

  function soltarEm(idFaixaDestino: Faixa, projetoId: string) {
    const faixaOriginal = cards.find((c) => c.id === projetoId)?.faixa;
    setCadencias((s) => ({ ...s, [projetoId]: idFaixaDestino }));
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await definirCadenciaAction(projetoId, idFaixaDestino);
      if (!resultado.ok) {
        setCadencias((s) => {
          const copia = { ...s };
          if (faixaOriginal) copia[projetoId] = faixaOriginal;
          else delete copia[projetoId];
          return copia;
        });
        setErro(resultado.erro ?? "Não foi possível mover o projeto.");
      }
    });
  }

  return (
    <>
      {erro && (
        <div
          style={{
            marginBottom: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--fal)",
          }}
        >
          {erro}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, alignItems: "start" }}>
        {ORDEM_FAIXAS.map((idFaixa) => {
          const f = faixas.find((x) => x.id === idFaixa)!;
          const alvo = faixaAlvo === idFaixa;
          const qtd = f.projetos.length
            ? `${f.projetos.length} ${f.projetos.length === 1 ? "projeto" : "projetos"}`
            : "vazio";

          return (
            <div
              key={idFaixa}
              onDragOver={(e) => {
                e.preventDefault();
                if (faixaAlvo !== idFaixa) setFaixaAlvo(idFaixa);
              }}
              onDragLeave={() => {
                if (faixaAlvo === idFaixa) setFaixaAlvo(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                if (id) soltarEm(idFaixa, id);
                setArrastando(null);
                setFaixaAlvo(null);
              }}
              style={{
                border: `1px ${idFaixa === "pausado" ? "dashed" : "solid"} ${alvo ? "var(--borda-forte)" : "var(--borda)"}`,
                borderRadius: 10,
                background: alvo ? "var(--faixa-ativa)" : "var(--faixa-fundo)",
                padding: 12,
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "2px 4px 8px",
                  borderBottom: "1px solid var(--linha2)",
                }}
              >
                <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 18, lineHeight: 1.2 }}>
                  {f.titulo}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
                  {qtd}
                </div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)", padding: "0 4px" }}>
                {f.nota}
              </div>

              {f.projetos.map((card) => (
                <CardProjeto
                  key={card.id}
                  card={card}
                  arrastando={arrastando === card.id}
                  onDragStart={() => setArrastando(card.id)}
                  onDragEnd={limparArraste}
                />
              ))}

              {f.projetos.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--borda)",
                    borderRadius: 8,
                    padding: "18px 12px",
                    textAlign: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "var(--mut3)",
                  }}
                >
                  solte um projeto aqui
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

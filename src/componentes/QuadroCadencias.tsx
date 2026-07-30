"use client";

import { useState } from "react";
import { ORDEM_FAIXAS, type Faixa } from "@/dominio/cadencia";
import { agruparPorFaixa, type ProjetoCardVM } from "@/dominio/visao";
import CardProjeto from "./CardProjeto";

// Drag and drop com HTML5 nativo, sem biblioteca (plano §2.10) — portado do
// export linhas 68-105. Nesta etapa mover um card entre faixas é só estado
// local: não persiste (plano §7, "persistência do drag and drop" fica para
// depois). Soltar em qualquer faixa muda a faixa efetiva do projeto naquela
// sessão do navegador.
export default function QuadroCadencias({ cards }: { cards: ProjetoCardVM[] }) {
  const [cadencias, setCadencias] = useState<Record<string, Faixa>>({});
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [faixaAlvo, setFaixaAlvo] = useState<Faixa | null>(null);

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

  return (
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
              if (id) setCadencias((s) => ({ ...s, [id]: idFaixa }));
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
  );
}

"use client";

import { useState } from "react";
import type { RodadaHistItemVM, RodadaDetalheVM } from "@/dominio/visao";
import CartaoAgente from "./CartaoAgente";

// Portado do export, linhas 161-201. `rodadaIdx` é a única seleção que continua
// estado de UI local nesta etapa (plano §2.4) — cada rodada já vem pronta do
// servidor, o clique só troca qual delas é exibida.
export default function HistoricoRodadas({
  resumo,
  detalhe,
}: {
  resumo: RodadaHistItemVM[];
  detalhe: RodadaDetalheVM[];
}) {
  const [idx, setIdx] = useState(0);
  const atual = detalhe[idx] ?? detalhe[0];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          rodadas noturnas
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {resumo.map((r) => {
          const selecionada = r.idx === idx;
          return (
            <div
              key={r.idx}
              onClick={() => setIdx(r.idx)}
              className="h-borda"
              style={{
                border: `1px solid ${selecionada ? "var(--borda-forte)" : "var(--borda)"}`,
                background: selecionada ? "var(--rodada-fundo)" : "var(--painel)",
                borderRadius: 6,
                padding: "9px 13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: r.ok ? "var(--ok)" : "var(--fal)",
                }}
              />
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: selecionada ? "var(--txt)" : "var(--mut2)",
                }}
              >
                {r.data}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
                {r.qtdAgentes}
              </div>
            </div>
          );
        })}
      </div>

      {atual ? (
        // O que cada agente encontrou fica dobrado por padrão — dá pra
        // decidir se essa noite precisa de leitura só pelos chips coloridos
        // acima. Abre sozinho quando a rodada selecionada falhou, porque
        // "erro" é exatamente o caso em que o detalhe importa sem pedir.
        <details className="dobravel" open={atual.cor === "var(--fal)"} key={idx}>
          <summary style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <span className="chevron" aria-hidden="true" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
              ▸
            </span>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22 }}>{atual.tituloLongo}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
              {atual.concluida}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: atual.cor }}>
              {atual.testes}
            </div>
          </summary>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
            {atual.agentes.map((a, i) => (
              <CartaoAgente key={a.nome + i} agente={a} />
            ))}
          </div>
        </details>
      ) : (
        // Estado vazio: projeto sem nenhuma rodada registrada ainda (plano
        // "estado vazio importa" — não é um bug, é um projeto novo ou parado.
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
          nenhuma rodada registrada ainda
        </div>
      )}
    </>
  );
}

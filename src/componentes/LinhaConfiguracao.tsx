"use client";

import { useState } from "react";
import { ORDEM_FAIXAS, FAIXA_LABEL_CURTO, type Faixa } from "@/dominio/cadencia";
import type { ConfigLinhaVM } from "@/dominio/visao";

// Portado do export, linhas 269-279. Nesta etapa a escolha é só estado local
// — nada persiste ainda (plano §7, "persistência do drag and drop e do CRUD
// da configuração" fica para depois). Quando a escrita existir, tanto este
// clique quanto soltar um card na home devem chamar `patchParaFaixa` de
// cadencia.ts — a mesma função nos dois caminhos, para produzirem o mesmo
// estado (critério de aceite da tarefa 8 do plano).
export default function LinhaConfiguracao({ linha }: { linha: ConfigLinhaVM }) {
  const [faixa, setFaixa] = useState<Faixa>(linha.faixaAtual);
  const pausado = faixa === "pausado";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        border: "1px solid var(--borda)",
        borderRadius: 6,
        background: "var(--painel)",
        padding: "14px 16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 180, flex: 1 }}>
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 19,
            color: pausado ? "var(--mut2)" : "var(--txt)",
          }}
        >
          {linha.nome}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)", marginTop: 3 }}>
          {linha.repo} · {linha.ultimaRodadaLabel}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {ORDEM_FAIXAS.map((opcao) => {
          const on = opcao === faixa;
          return (
            <div
              key={opcao}
              onClick={() => setFaixa(opcao)}
              className="h-borda"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: on ? "var(--txt)" : "var(--mut3)",
                border: `1px solid ${on ? "var(--borda-forte)" : "var(--borda)"}`,
                background: on ? "var(--rodada-fundo)" : "var(--painel)",
                borderRadius: 4,
                padding: "5px 9px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {FAIXA_LABEL_CURTO[opcao]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

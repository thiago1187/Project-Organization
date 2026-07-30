"use client";

import { useRouter } from "next/navigation";
import type { ProjetoCardVM } from "@/dominio/visao";

// Portado do export, linhas 79-97. O resumo era contentEditable no export;
// sai nesta etapa (plano §2.12) — sem impacto visual em repouso, só perde o
// cursor: text que só aparecia no hover.
export default function CardProjeto({
  card,
  arrastando,
  onDragStart,
  onDragEnd,
}: {
  card: ProjetoCardVM;
  arrastando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => router.push(`/projeto/${card.id}`)}
      className="h-borda"
      style={{
        position: "relative",
        background: "var(--painel)",
        border: `1px solid ${arrastando ? "var(--borda-forte)" : "var(--borda)"}`,
        borderRadius: 8,
        padding: "14px 16px 12px",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
        opacity: arrastando ? 0.35 : 1,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: card.cor }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 19,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {card.nome}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: card.cor,
            whiteSpace: "nowrap",
          }}
        >
          {card.statusLabel}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--txt2)", textWrap: "pretty" }}>{card.resumo}</div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {card.strip.map((s, i) => (
          <div
            key={i}
            style={{
              width: 19,
              height: 19,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8.5,
              background: s.bg,
              color: s.fg,
              border: `1px solid ${s.borda}`,
            }}
          >
            {s.mono}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop: "1px solid var(--linha3)",
          paddingTop: 9,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5,
          color: "var(--mut3)",
        }}
      >
        <span>{card.ultimaRodadaLabel}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: card.corTestes }}>{card.testesCurto}</span>
      </div>
    </div>
  );
}

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
      // O arraste é o caminho rápido do mouse para mudar a cadência; abrir o
      // projeto precisa funcionar sem mouse também — o mesmo CRUD existe na
      // tela de Configuração, mas o card é o primeiro lugar que o dono vê.
      // role="link" + Enter/Espaço porque a ação é navegar, não um formulário.
      role="link"
      tabIndex={0}
      aria-label={`${card.nome}, ${card.statusLabel} — abrir projeto`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/projeto/${card.id}`);
        }
      }}
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
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-lg)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--txt)",
          }}
        >
          {card.nome}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontWeight: "var(--fw-semibold)",
            fontSize: "var(--fs-2xs)",
            color: card.cor,
            whiteSpace: "nowrap",
          }}
        >
          {card.statusLabel}
        </div>
      </div>
      {/* O resumo é cortado em quatro linhas. Ele vem da rodada e o prompt pede
          no máximo três frases — mas três frases longas viram um muro que
          estica o card e desalinha a coluna inteira, e aí a tela deixa de
          responder "em qual projeto algo precisa de mim?" em cinco segundos.
          É o princípio das duas velocidades: aqui é a porta, o texto inteiro
          está na tela do projeto, a um clique. `title` mantém o resto
          alcançável sem sair daqui. */}
      <div
        title={card.resumo}
        style={{
          fontSize: "var(--fs-sm)",
          color: "var(--txt2)",
          textWrap: "pretty",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {card.resumo}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {card.strip.map((s, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-2xs)",
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
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-2xs)",
          color: "var(--mut3)",
        }}
      >
        <span>{card.ultimaRodadaLabel}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: card.corTestes, fontWeight: "var(--fw-medium)" }}>{card.testesCurto}</span>
      </div>
    </div>
  );
}

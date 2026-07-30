"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BotaoTema from "./BotaoTema";

// "agora" fica fixo nesta etapa — calcular no servidor divergiria na
// hidratação e mostraria hora errada (plano §6, risco "agora e saudação fixos").
const AGORA = "29 jul 2026 · 07:40";

export default function Cabecalho() {
  const pathname = usePathname();
  const emHome = pathname === "/";
  const emConfig = pathname === "/configuracao";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "16px 36px",
        borderBottom: "1px solid var(--linha)",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 5,
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 20,
          letterSpacing: "-0.01em",
          cursor: "pointer",
        }}
      >
        Acompanhamento noturno
      </Link>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--mut2)" }}>
        {AGORA}
      </div>
      <div style={{ flex: 1 }} />
      <BotaoTema />
      <div style={{ display: "flex", gap: 2 }}>
        <Link
          href="/"
          className="h-fundo"
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            color: emHome ? "var(--txt)" : "var(--mut2)",
          }}
        >
          Projetos
        </Link>
        <Link
          href="/configuracao"
          className="h-fundo"
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            color: emConfig ? "var(--txt)" : "var(--mut2)",
          }}
        >
          Configuração
        </Link>
      </div>
    </div>
  );
}

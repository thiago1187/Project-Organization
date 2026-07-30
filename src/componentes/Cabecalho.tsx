"use client";

import Link from "next/link";
import Relogio from "./Relogio";
import { usePathname } from "next/navigation";
import BotaoTema from "./BotaoTema";
import { sairAction } from "@/servidor/acoes-sessao";


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
      <Relogio
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--mut2)" }}
      />
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
      <form action={sairAction}>
        <button
          type="submit"
          className="h-fundo"
          style={{
            border: "none",
            background: "transparent",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            color: "var(--mut2)",
          }}
        >
          sair
        </button>
      </form>
    </div>
  );
}

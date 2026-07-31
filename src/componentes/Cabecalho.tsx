"use client";

import Link from "next/link";
import Relogio from "./Relogio";
import { usePathname } from "next/navigation";
import BotaoTema from "./BotaoTema";
import ControleDensidade from "./ControleDensidade";
import { sairAction } from "@/servidor/acoes-sessao";


export default function Cabecalho() {
  const pathname = usePathname();
  const emHome = pathname === "/";
  const emConfig = pathname === "/configuracao";

  return (
    <div
      className="no-imprimir"
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
          fontSize: "var(--fs-lg)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--ls-tight)",
          color: "var(--txt)",
          cursor: "pointer",
        }}
      >
        Acompanhamento noturno
      </Link>
      <Relogio
        style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--mut2)" }}
      />
      <div style={{ flex: 1 }} />
      <ControleDensidade />
      <BotaoTema />
      <div style={{ display: "flex", gap: 2 }}>
        <Link
          href="/"
          className="h-fundo"
          style={{
            padding: "8px 12px",
            borderRadius: "var(--btn-radius)",
            cursor: "pointer",
            fontSize: "var(--fs-sm)",
            fontWeight: emHome ? "var(--fw-semibold)" : "var(--fw-regular)",
            color: emHome ? "var(--txt)" : "var(--mut2)",
          }}
        >
          Projetos
        </Link>
        <Link
          href="/configuracao"
          className="h-fundo"
          style={{
            padding: "8px 12px",
            borderRadius: "var(--btn-radius)",
            cursor: "pointer",
            fontSize: "var(--fs-sm)",
            fontWeight: emConfig ? "var(--fw-semibold)" : "var(--fw-regular)",
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
            padding: "8px 12px",
            borderRadius: "var(--btn-radius)",
            cursor: "pointer",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-regular)",
            color: "var(--mut2)",
          }}
        >
          sair
        </button>
      </form>
    </div>
  );
}

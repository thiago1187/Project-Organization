"use client";

import { useEffect, useState } from "react";

// Único componente cliente que sabe o nome do tema (plano §2.3). O rótulo
// depende do tema atual, que só existe no DOM depois do script anti-flash de
// layout.tsx rodar — por isso ele nasce vazio e só ganha texto após montar,
// para não divergir do HTML enviado pelo servidor.
export default function BotaoTema() {
  const [tema, setTema] = useState<"escuro" | "claro" | null>(null);

  useEffect(() => {
    setTema(document.documentElement.dataset.tema === "claro" ? "claro" : "escuro");
  }, []);

  function alternar() {
    const novo = document.documentElement.dataset.tema === "claro" ? "escuro" : "claro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      // Sem storage disponível (modo privado, por exemplo) — o tema só não persiste entre visitas.
    }
    setTema(novo);
  }

  return (
    <div
      onClick={alternar}
      className="h-txt"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: "var(--mut2)",
        border: "1px solid var(--borda)",
        borderRadius: 4,
        padding: "5px 10px",
        cursor: "pointer",
      }}
    >
      {tema === null ? " " : tema === "escuro" ? "tema claro" : "tema escuro"}
    </div>
  );
}

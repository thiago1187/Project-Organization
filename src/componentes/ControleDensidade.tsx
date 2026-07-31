"use client";

import { useEffect, useState } from "react";

type Densidade = "compacto" | "normal" | "confortavel";

const OPCOES: { valor: Densidade; rotulo: string; titulo: string }[] = [
  { valor: "compacto", rotulo: "compacto", titulo: "Densidade compacta — mais linhas por tela" },
  { valor: "normal", rotulo: "normal", titulo: "Densidade normal" },
  { valor: "confortavel", rotulo: "confortável", titulo: "Densidade confortável — texto e espaço maiores" },
];

// Seletor de densidade (compacto/normal/confortável) — pedido explícito do
// dono na reforma de tipografia. Mesmo padrão de BotaoTema: o valor real só
// existe no DOM depois do script anti-flash de layout.tsx rodar, então o
// componente nasce sem saber qual opção está ativa e só marca após montar,
// pra não divergir do HTML enviado pelo servidor.
//
// Escala tipografia e espaçamento inteiros via `--densidade` em
// globals.css — não é ajuste de UI isolado, é o app inteiro respondendo.
export default function ControleDensidade() {
  const [ativa, setAtiva] = useState<Densidade | null>(null);

  useEffect(() => {
    const atual = document.documentElement.dataset.densidade;
    setAtiva(atual === "compacto" || atual === "confortavel" ? atual : "normal");
  }, []);

  function escolher(valor: Densidade) {
    if (valor === "normal") {
      delete document.documentElement.dataset.densidade;
    } else {
      document.documentElement.dataset.densidade = valor;
    }
    try {
      localStorage.setItem("densidade", valor);
    } catch {
      // Sem storage disponível (modo privado, por exemplo) — só não persiste entre visitas.
    }
    setAtiva(valor);
  }

  return (
    <div
      role="group"
      aria-label="densidade da tela"
      style={{
        display: "flex",
        border: "1px solid var(--borda)",
        borderRadius: "var(--btn-radius)",
        overflow: "hidden",
      }}
    >
      {OPCOES.map((o) => {
        const selecionada = ativa === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            title={o.titulo}
            aria-pressed={selecionada}
            onClick={() => escolher(o.valor)}
            className={selecionada ? undefined : "h-fundo"}
            style={{
              border: "none",
              borderLeft: o.valor !== "compacto" ? "1px solid var(--borda)" : "none",
              background: selecionada ? "var(--hover)" : "transparent",
              color: selecionada ? "var(--txt)" : "var(--mut2)",
              fontWeight: selecionada ? "var(--fw-semibold)" : "var(--fw-regular)",
              fontSize: "var(--fs-xs)",
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {ativa === null ? " " : o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

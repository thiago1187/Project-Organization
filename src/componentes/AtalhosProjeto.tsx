"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { estaDigitando } from "./tecladoUtil";

// Atalhos de teclado da tela de detalhe (CLAUDE.md, "maleável" — atalho para
// quem já sabe o caminho): `[`/`]` vão para o projeto anterior/próximo na
// mesma ordem da visão geral; `f` pula para a fila de sugestões e coloca o
// foco no primeiro item que ainda espera decisão. Nunca ativa dentro de um
// campo de texto — checa o alvo do evento antes de agir, senão digitar "f"
// numa descrição levaria para outro lugar.
//
// Os vizinhos (`anterior`/`proximo`) também viram links visíveis na tira de
// navegação, ao lado de "← todos os projetos" — o atalho de teclado nunca é
// a única forma de chegar lá (convenção conhecida ganha de invenção
// escondida).
export default function AtalhosProjeto({
  anterior,
  proximo,
}: {
  anterior: { id: string; nome: string } | null;
  proximo: { id: string; nome: string } | null;
}) {
  const router = useRouter();

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (estaDigitando(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "[" && anterior) {
        e.preventDefault();
        router.push(`/projeto/${anterior.id}`);
      } else if (e.key === "]" && proximo) {
        e.preventDefault();
        router.push(`/projeto/${proximo.id}`);
      } else if (e.key === "f" || e.key === "F") {
        const secao = document.getElementById("fila-sugestoes");
        if (!secao) return;
        e.preventDefault();
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
        const alvoFoco = secao.querySelector<HTMLElement>(
          'input[type="checkbox"], button, a[href]',
        );
        alvoFoco?.focus();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [anterior, proximo, router]);

  if (!anterior && !proximo) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
      {anterior && (
        <Link
          href={`/projeto/${anterior.id}`}
          className="h-txt"
          title={`${anterior.nome} (atalho: [)`}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "var(--mut3)",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          ‹ {anterior.nome}
        </Link>
      )}
      {proximo && (
        <Link
          href={`/projeto/${proximo.id}`}
          className="h-txt"
          title={`${proximo.nome} (atalho: ])`}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "var(--mut3)",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {proximo.nome} ›
        </Link>
      )}
    </div>
  );
}

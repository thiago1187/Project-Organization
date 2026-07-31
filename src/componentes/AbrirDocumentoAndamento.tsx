"use client";

import { useState } from "react";
import type { PeriodoChave } from "@/dominio/documentoAndamento";
import { classeBotao, estiloBotao } from "./estiloBotao";

// Botão "gerar documento de andamento" na tela do projeto — item 4 de
// docs/proximos-passos.md. Puramente de apresentação: quem monta o texto é
// `gerarDocumentoAndamento` (src/dominio/documentoAndamento.ts), rodando no
// servidor dentro de /projeto/[id]/documento — este componente só decide
// período e voz, e abre aquela página numa aba nova.
//
// "Desde a última vez" não tem tabela própria (sem migration — ver o
// comentário de `calcularDesde`): a data do último documento gerado deste
// projeto fica no `localStorage` do navegador do dono. É estado de
// interface, não dado do produto — outro navegador ou outro dispositivo
// simplesmente não vê "desde quando", e cai em "todo o histórico", que é o
// comportamento seguro (nunca esconde nada por engano).
const CHAVE_LOCALSTORAGE = (projetoId: string) => `documento-andamento:ultima-geracao:${projetoId}`;

const OPCOES_PERIODO: { valor: PeriodoChave; rotulo: string }[] = [
  { valor: "7dias", rotulo: "últimos 7 dias" },
  { valor: "30dias", rotulo: "últimos 30 dias" },
  { valor: "desde_ultima", rotulo: "desde o último documento gerado" },
  { valor: "tudo", rotulo: "todo o histórico" },
];

function lerUltimaGeracao(projetoId: string): string | null {
  try {
    return localStorage.getItem(CHAVE_LOCALSTORAGE(projetoId));
  } catch {
    return null;
  }
}

function gravarUltimaGeracao(projetoId: string) {
  try {
    localStorage.setItem(CHAVE_LOCALSTORAGE(projetoId), new Date().toISOString());
  } catch {
    // localStorage indisponível (modo privado, por exemplo) — sem persistir
    // não tem problema: a próxima escolha de "desde a última vez" só cai em
    // "todo o histórico", o comportamento seguro.
  }
}

export default function AbrirDocumentoAndamento({ projetoId }: { projetoId: string }) {
  const [periodo, setPeriodo] = useState<PeriodoChave>("7dias");

  function abrir(voz: "andamento" | "tecnica") {
    const params = new URLSearchParams({ periodo, voz });
    if (periodo === "desde_ultima") {
      const ultima = lerUltimaGeracao(projetoId);
      if (ultima) params.set("desde", ultima);
    }
    gravarUltimaGeracao(projetoId);
    window.open(`/projeto/${projetoId}/documento?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        border: "1px dashed var(--borda)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", marginBottom: 8 }}>
        documento de andamento
      </div>

      <select
        value={periodo}
        onChange={(e) => setPeriodo(e.target.value as PeriodoChave)}
        style={{
          width: "100%",
          background: "var(--bg)",
          border: "1px solid var(--borda)",
          borderRadius: 5,
          padding: "8px 10px",
          fontSize: "var(--fs-2xs)",
          color: "var(--txt)",
          fontFamily: "inherit",
          marginBottom: 10,
        }}
      >
        {OPCOES_PERIODO.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => abrir("andamento")}
          className={classeBotao("secundaria")}
          style={{ ...estiloBotao("secundaria"), flex: 1 }}
        >
          para sócio/cliente
        </button>
        <button
          type="button"
          onClick={() => abrir("tecnica")}
          className={classeBotao("secundaria")}
          style={{ ...estiloBotao("secundaria"), flex: 1 }}
        >
          para a equipe
        </button>
      </div>
    </div>
  );
}

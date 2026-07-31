"use client";

import { useState } from "react";
import type { Contexto } from "@/dominio/tipos";
import CartaoContexto from "./CartaoContexto";
import FormNovoContexto from "./FormNovoContexto";
import { classeBotao, estiloBotao } from "./estiloBotao";

// Editor de contexto da tela de detalhe — o que faltava para a tela deixar
// de ser só leitura (ver CLAUDE.md, "Como o contexto chega aos agentes", e
// docs/plano-agentes-por-projeto.md, causa nº 1). Adicionar, editar e
// remover, tudo no lugar; nenhuma navegação para outra página.
export default function EditorContexto({ projetoId, itens }: { projetoId: string; itens: Contexto[] }) {
  const [adicionando, setAdicionando] = useState(false);

  // Fechado por padrão: contexto muda quando o dono decide anexar algo, não
  // toda noite — mesmo raciocínio de EsteiraAgentes.tsx. A contagem de itens
  // fica visível no resumo mesmo fechado, para não esconder "quanto já tem
  // anexado" atrás de um clique.
  return (
    <details className="dobravel" style={{ marginBottom: 30 }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="chevron" aria-hidden="true" style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          ▸
        </span>
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)" }}>
          contexto do projeto
        </span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          {itens.length === 0 ? "nenhum ainda" : itens.length}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        {!adicionando && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setAdicionando(true);
              (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.setAttribute("open", "");
            }}
            className={classeBotao("texto")}
            style={{ ...estiloBotao("texto"), color: "var(--atn)", border: "1px solid var(--borda)" }}
          >
            + adicionar
          </button>
        )}
      </summary>

      {itens.length === 0 && !adicionando && (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontSize: "var(--fs-xs)",
            color: "var(--mut3)",
          }}
        >
          nenhum contexto anexado ainda
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {itens.map((item) => (
          <CartaoContexto key={item.id} item={item} projetoId={projetoId} />
        ))}
        {adicionando && <FormNovoContexto projetoId={projetoId} aoFechar={() => setAdicionando(false)} />}
      </div>

      <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)", marginTop: 8 }}>
        Isto é lido pela routine e escrito no CLAUDE.md do repositório alvo antes de acionar os
        agentes — é dado, não instrução, e nunca é editado por ela.
      </div>
    </details>
  );
}

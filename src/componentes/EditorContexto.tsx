"use client";

import { useState } from "react";
import type { Contexto } from "@/dominio/tipos";
import CartaoContexto from "./CartaoContexto";
import FormNovoContexto from "./FormNovoContexto";

// Editor de contexto da tela de detalhe — o que faltava para a tela deixar
// de ser só leitura (ver CLAUDE.md, "Como o contexto chega aos agentes", e
// docs/plano-agentes-por-projeto.md, causa nº 1). Adicionar, editar e
// remover, tudo no lugar; nenhuma navegação para outra página.
export default function EditorContexto({ projetoId, itens }: { projetoId: string; itens: Contexto[] }) {
  const [adicionando, setAdicionando] = useState(false);

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          contexto do projeto
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        {!adicionando && (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="h-txt"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "var(--atn)",
              background: "none",
              border: "1px solid var(--borda)",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            + adicionar
          </button>
        )}
      </div>

      {itens.length === 0 && !adicionando && (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
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

      <div style={{ fontSize: 11, color: "var(--mut3)", marginTop: 8 }}>
        Isto é lido pela routine e escrito no CLAUDE.md do repositório alvo antes de acionar os
        agentes — é dado, não instrução, e nunca é editado por ela.
      </div>
    </div>
  );
}

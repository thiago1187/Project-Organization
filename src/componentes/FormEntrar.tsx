"use client";

import { useActionState } from "react";
import { entrarAction, type EstadoEntrar } from "@/servidor/acoes-sessao";
import { estiloCampo } from "./estiloCampo";

const ESTADO_INICIAL: EstadoEntrar = { erro: null };

export default function FormEntrar({ proximo }: { proximo: string }) {
  const [estado, acao, pendente] = useActionState(entrarAction, ESTADO_INICIAL);

  return (
    <form
      action={acao}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        maxWidth: 320,
      }}
    >
      <input type="hidden" name="proximo" value={proximo} />
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--mut2)" }}>segredo</span>
        <input
          name="segredo"
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          style={estiloCampo}
        />
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="h-borda"
        style={{
          border: "1px solid var(--borda-forte)",
          borderRadius: 5,
          background: "var(--rodada-fundo)",
          color: "var(--txt)",
          padding: "9px 16px",
          fontSize: 13,
          cursor: pendente ? "default" : "pointer",
          opacity: pendente ? 0.6 : 1,
        }}
      >
        {pendente ? "entrando…" : "entrar"}
      </button>
      {estado.erro && <div style={{ fontSize: 12, color: "var(--fal)" }}>{estado.erro}</div>}
    </form>
  );
}

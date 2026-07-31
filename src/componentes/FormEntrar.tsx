"use client";

import { useActionState } from "react";
import { entrarAction, type EstadoEntrar } from "@/servidor/acoes-sessao";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

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
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>segredo</span>
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
        className={classeBotao("primaria")}
        style={estiloBotao("primaria", { full: true })}
      >
        {pendente ? "entrando…" : "entrar"}
      </button>
      {estado.erro && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{estado.erro}</div>}
    </form>
  );
}

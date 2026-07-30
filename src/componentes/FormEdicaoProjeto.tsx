"use client";

import { useActionState, useEffect, useRef } from "react";
import { editarProjetoAction, type EstadoFormProjeto } from "@/servidor/acoes-projeto";
import { estiloCampo } from "./estiloCampo";

const ESTADO_INICIAL: EstadoFormProjeto = { ok: false, erro: null, campos: {} };

export default function FormEdicaoProjeto({
  id,
  nomeAtual,
  repositorioAtual,
  aoFechar,
}: {
  id: string;
  nomeAtual: string;
  repositorioAtual: string;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState(editarProjetoAction, ESTADO_INICIAL);
  const pendenteAnteriorRef = useRef(pendente);

  // Só fecha o modo de edição depois de um envio que terminou com sucesso —
  // não a cada render (o estado do `useActionState` persiste entre eles).
  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendente && estado.ok) {
      aoFechar();
    }
    pendenteAnteriorRef.current = pendente;
  }, [pendente, estado.ok, aoFechar]);

  return (
    <form
      action={acao}
      style={{ display: "flex", gap: 8, alignItems: "flex-end", flex: 1, minWidth: 260, flexWrap: "wrap" }}
    >
      <input type="hidden" name="id" value={id} />
      <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
        <span style={{ fontSize: 10, color: "var(--mut2)" }}>nome</span>
        <input name="nome" defaultValue={estado.campos.nome ?? nomeAtual} required maxLength={200} style={estiloCampo} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
        <span style={{ fontSize: 10, color: "var(--mut2)" }}>repositório</span>
        <input
          name="repositorio"
          defaultValue={estado.campos.repositorio ?? repositorioAtual}
                    maxLength={140}
          style={estiloCampo}
        />
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="h-borda"
        style={{
          border: "1px solid var(--borda-forte)",
          borderRadius: 4,
          background: "var(--rodada-fundo)",
          color: "var(--txt)",
          padding: "7px 12px",
          fontSize: 12,
          cursor: pendente ? "default" : "pointer",
          opacity: pendente ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {pendente ? "salvando…" : "salvar"}
      </button>
      <button
        type="button"
        onClick={aoFechar}
        disabled={pendente}
        className="h-txt"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--mut3)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "7px 4px",
        }}
      >
        cancelar
      </button>
      {estado.erro && <div style={{ width: "100%", fontSize: 11, color: "var(--fal)" }}>{estado.erro}</div>}
    </form>
  );
}

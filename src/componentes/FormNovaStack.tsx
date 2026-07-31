"use client";

import { useActionState, useEffect, useRef } from "react";
import { CATEGORIAS_STACK_ORDEM, CATEGORIA_STACK_LABEL } from "@/dominio/inventario";
import { salvarStackAction, type EstadoFormStack } from "@/servidor/acoes-inventario";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormStack = { ok: false, erro: null, campos: {} };

/** Formulário de "+ adicionar" da seção de stack — categoria (lista fechada) + nome (livre). */
export default function FormNovaStack({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(salvarStackAction, ESTADO_INICIAL);
  const pendenteAnteriorRef = useRef(pendente);

  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendente && estado.ok) {
      aoFechar();
    }
    pendenteAnteriorRef.current = pendente;
  }, [pendente, estado.ok, aoFechar]);

  return (
    <form
      action={acao}
      className="h-borda"
      style={{
        border: "1px dashed var(--borda-forte)",
        borderRadius: 6,
        background: "var(--painel)",
        padding: "8px 10px",
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input type="hidden" name="projeto_id" value={projetoId} />
      <select name="categoria" defaultValue={estado.campos.categoria ?? "linguagem"} style={{ ...estiloCampo, width: "auto" }}>
        {CATEGORIAS_STACK_ORDEM.map((c) => (
          <option key={c} value={c}>
            {CATEGORIA_STACK_LABEL[c]}
          </option>
        ))}
      </select>
      <input
        name="nome"
        defaultValue={estado.campos.nome ?? ""}
        required
        maxLength={120}
        placeholder="ex.: TypeScript"
        style={{ ...estiloCampo, width: 160 }}
      />
      <button
        type="submit"
        disabled={pendente}
        className={classeBotao("secundaria")}
        style={estiloBotao("secundaria")}
      >
        {pendente ? "adicionando…" : "adicionar"}
      </button>
      <button
        type="button"
        onClick={aoFechar}
        disabled={pendente}
        className={classeBotao("texto")}
        style={estiloBotao("texto")}
      >
        cancelar
      </button>
      {estado.erro && <div style={{ width: "100%", fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{estado.erro}</div>}
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { CATEGORIAS_SERVICO_ORDEM, CATEGORIA_SERVICO_LABEL } from "@/dominio/inventario";
import { salvarServicoAction, type EstadoFormServico } from "@/servidor/acoes-inventario";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormServico = { ok: false, erro: null, campos: {} };

/** Formulário de "+ adicionar" da seção de serviços — mesmo padrão de `FormNovoContexto`. */
export default function FormNovoServico({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(salvarServicoAction, ESTADO_INICIAL);
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
        borderRadius: 8,
        background: "var(--painel)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>categoria</span>
          <select name="categoria" defaultValue={estado.campos.categoria ?? "banco"} style={estiloCampo}>
            {CATEGORIAS_SERVICO_ORDEM.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_SERVICO_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>nome</span>
          <input
            name="nome"
            defaultValue={estado.campos.nome ?? ""}
            required
            maxLength={120}
            placeholder="ex.: Neon"
            style={estiloCampo}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>conta</span>
          <input
            name="conta"
            defaultValue={estado.campos.conta ?? ""}
            required
            maxLength={120}
            placeholder="ex.: pessoal"
            style={estiloCampo}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>papel (opcional)</span>
          <input
            name="papel"
            defaultValue={estado.campos.papel ?? ""}
            maxLength={120}
            placeholder="ex.: produção"
            style={estiloCampo}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>administrado em (opcional)</span>
          <input
            name="administrado_url"
            defaultValue={estado.campos.administrado_url ?? ""}
            placeholder="https://..."
            style={estiloCampo}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={pendente}
          className={classeBotao("secundaria")}
          style={estiloBotao("secundaria")}
        >
          {pendente ? "salvando…" : "adicionar"}
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
      </div>
      {estado.erro && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{estado.erro}</div>}
    </form>
  );
}

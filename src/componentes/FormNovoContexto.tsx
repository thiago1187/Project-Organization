"use client";

import { useActionState, useEffect, useRef } from "react";
import { salvarContextoAction, type EstadoFormContexto } from "@/servidor/acoes-contexto";
import { AGENTES_CONHECIDOS } from "@/dominio/agentesConhecidos";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormContexto = { ok: false, erro: null, campos: {} };

/**
 * Formulário de "+ adicionar contexto". `agente_destino` é um `<input>` com
 * `list` apontando para os 16 agentes conhecidos (src/dominio/agentesConhecidos.ts)
 * — sugestão, não trava: digitar um nome fora da lista continua funcionando,
 * porque a coluna é texto livre de propósito.
 */
export default function FormNovoContexto({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(salvarContextoAction, ESTADO_INICIAL);
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
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>agente</span>
          <input
            name="agente_destino"
            list="agentes-conhecidos"
            defaultValue={estado.campos.agente_destino ?? ""}
            required
            maxLength={64}
            placeholder="ex.: designer-ui"
            style={estiloCampo}
          />
          <datalist id="agentes-conhecidos">
            {AGENTES_CONHECIDOS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>tipo</span>
          <input
            name="tipo"
            defaultValue={estado.campos.tipo ?? ""}
            required
            maxLength={64}
            placeholder="ex.: modelo de design"
            style={estiloCampo}
          />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>conteúdo</span>
        <textarea
          name="conteudo"
          defaultValue={estado.campos.conteudo ?? ""}
          rows={4}
          maxLength={20000}
          placeholder="o que o agente deve ler ao trabalhar neste projeto"
          style={{ ...estiloCampo, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>ou link de arquivo</span>
        <input
          name="arquivo_url"
          defaultValue={estado.campos.arquivo_url ?? ""}
          placeholder="https://..."
          style={estiloCampo}
        />
      </label>
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

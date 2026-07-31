"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AgenteEsteiraVM } from "@/dominio/esteiraAgentes";
import { salvarInstrucaoAgenteAction, type EstadoFormAgente } from "@/servidor/acoes-agentes";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormAgente = { ok: false, erro: null, campos: {} };

/**
 * Um card da faixa de diagnóstico da esteira — sempre habilitado (a versão
 * desligada é um chip simples, renderizado direto em EsteiraAgentes). Sem
 * clicar: crachá, nome, papel, e a primeira linha da instrução se houver.
 * Clicando em "editar"/"+ instrução": formulário no lugar, mesmo padrão de
 * CartaoContexto.
 *
 * Draggable — `onDragStart`/`onDragEnd`/`onDropAqui` vêm de
 * EsteiraAgentes.tsx, que é quem decide o que soltar aqui significa (ligar,
 * reordenar) e chama as Server Actions.
 */
export default function CartaoAgenteEsteira({
  projetoId,
  agente,
  index,
  arrastando,
  onDragStart,
  onDragEnd,
  onDropAqui,
  onDesligar,
}: {
  projetoId: string;
  agente: AgenteEsteiraVM;
  index: number;
  arrastando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropAqui: (agenteArrastado: string, indiceAlvo: number) => void;
  onDesligar: (agente: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendenteSalvar] = useActionState(salvarInstrucaoAgenteAction, ESTADO_INICIAL);
  const pendenteAnteriorRef = useRef(pendenteSalvar);

  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendenteSalvar && estado.ok) {
      setEditando(false);
    }
    pendenteAnteriorRef.current = pendenteSalvar;
  }, [pendenteSalvar, estado.ok]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", agente.agente);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const arrastado = e.dataTransfer.getData("text/plain");
        if (arrastado) onDropAqui(arrastado, index);
      }}
      className="h-borda"
      style={{
        border: `1px solid ${arrastando ? "var(--borda-forte)" : "var(--borda)"}`,
        borderRadius: 8,
        background: "var(--painel)",
        padding: "10px 12px",
        opacity: arrastando ? 0.35 : 1,
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)", flex: "none" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-2xs)",
            background: agente.bg,
            color: agente.fg,
            border: `1px solid ${agente.borda}`,
            flex: "none",
          }}
        >
          {agente.mono}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", overflowWrap: "anywhere", color: "var(--txt)" }}>
            {agente.agente}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>{agente.papel}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className={classeBotao("texto")}
          style={{ ...estiloBotao("texto"), whiteSpace: "nowrap" }}
        >
          {editando ? "fechar" : agente.instrucao ? "editar" : "+ instrução"}
        </button>
        <button
          type="button"
          onClick={() => onDesligar(agente.agente)}
          className={classeBotao("destrutiva")}
          style={{ ...estiloBotao("destrutiva"), whiteSpace: "nowrap" }}
        >
          desligar
        </button>
      </div>

      {!editando && agente.instrucao && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--txt2)", marginTop: 8, textWrap: "pretty" }}>{agente.instrucao}</div>
      )}

      {editando && (
        <form action={acao} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <input type="hidden" name="projeto_id" value={projetoId} />
          <input type="hidden" name="agente" value={agente.agente} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>
              instrução para este agente, neste projeto — o que fazer aqui, não o que ler
            </span>
            <textarea
              name="instrucao"
              defaultValue={estado.campos.instrucao ?? agente.instrucao ?? ""}
              rows={3}
              maxLength={4000}
              placeholder="ex.: olhe especialmente o acoplamento entre o painel e a automação"
              style={{ ...estiloCampo, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 260 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>teto de sugestões desta rodada</span>
            <select
              name="teto_sugestoes"
              defaultValue={estado.campos.teto_sugestoes ?? (agente.tetoSugestoes ?? "")}
              style={estiloCampo}
            >
              <option value="">herda o teto do projeto (3)</option>
              <option value="0">0 — só diagnostica, nunca sugere</option>
              <option value="1">no máximo 1</option>
              <option value="2">no máximo 2</option>
              <option value="3">no máximo 3</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              disabled={pendenteSalvar}
              className={classeBotao("primaria")}
              style={estiloBotao("primaria")}
            >
              {pendenteSalvar ? "salvando…" : "salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              disabled={pendenteSalvar}
              className={classeBotao("texto")}
              style={estiloBotao("texto")}
            >
              cancelar
            </button>
          </div>
          {estado.erro && <div style={{ fontSize: "var(--fs-sm)", color: "var(--fal)", fontWeight: "var(--fw-medium)" }}>{estado.erro}</div>}
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)", textWrap: "pretty" }}>
            Isto vai para a chamada deste agente, nunca para o CLAUDE.md do repositório — para anexar
            material de consulta, use o contexto do projeto, abaixo.
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Frequencia } from "@/dominio/tipos";
import { criarProjetoAction, type EstadoFormProjeto } from "@/servidor/acoes-projeto";
import { estiloCampo } from "./estiloCampo";

const OPCOES_FREQUENCIA: { valor: Frequencia; rotulo: string }[] = [
  { valor: "toda_madrugada", rotulo: "toda madrugada" },
  { valor: "dias_alternados", rotulo: "dias alternados" },
  { valor: "semanal", rotulo: "semanal" },
];

const ESTADO_INICIAL: EstadoFormProjeto = { ok: false, erro: null, campos: {} };

// Cadastro de projeto novo. Sem referência no export original (plano de
// conversão não desenhou esta tela) — layout mínimo com os mesmos tokens e
// tipografia do resto do painel, não uma peça nova de design.
export default function FormNovoProjeto() {
  const [estado, acao, pendente] = useActionState(criarProjetoAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const pendenteAnteriorRef = useRef(pendente);

  // Limpa o formulário só depois de um envio bem-sucedido de verdade — não a
  // cada render em que `estado.ok` continua true por causa do estado anterior.
  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendente && estado.ok) {
      formRef.current?.reset();
    }
    pendenteAnteriorRef.current = pendente;
  }, [pendente, estado.ok]);

  return (
    <div
      style={{
        border: "1px solid var(--borda)",
        borderRadius: 8,
        background: "var(--painel)",
        padding: "16px 18px",
        marginBottom: 22,
      }}
    >
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)", marginBottom: 12 }}>
        novo projeto
      </div>
      <form ref={formRef} action={acao} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px", minWidth: 160 }}>
          <span style={{ fontSize: 11, color: "var(--mut2)" }}>nome</span>
          <input
            name="nome"
            defaultValue={estado.campos.nome}
            required
            maxLength={200}
            style={estiloCampo}
            placeholder="Cofre de rotinas"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px", minWidth: 180 }}>
          <span style={{ fontSize: 11, color: "var(--mut2)" }}>repositório · opcional</span>
          <input
            name="repositorio"
            defaultValue={estado.campos.repositorio}
                        maxLength={140}
            style={estiloCampo}
            placeholder="dono/repositorio"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 170px" }}>
          <span style={{ fontSize: 11, color: "var(--mut2)" }}>cadência</span>
          <select name="frequencia" defaultValue={estado.campos.frequencia || "toda_madrugada"} style={estiloCampo}>
            {OPCOES_FREQUENCIA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
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
            whiteSpace: "nowrap",
          }}
        >
          {pendente ? "cadastrando…" : "cadastrar projeto"}
        </button>
      </form>
      {estado.erro && <div style={{ marginTop: 10, fontSize: 12, color: "var(--fal)" }}>{estado.erro}</div>}
    </div>
  );
}

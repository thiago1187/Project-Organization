"use client";

import { useState } from "react";
import { salvarAgentePadraoAction } from "@/servidor/acoes-agente-padrao";
import { estiloCampo } from "./estiloCampo";

const INSTRUCAO_TAMANHO_MAXIMO = 4000;

/**
 * O padrão global de um agente — editado uma vez na ficha /agentes/[nome],
 * valendo em todo projeto onde ele for ligado, exceto onde o card daquele
 * projeto na esteira sobrescrever (docs/plano-agentes-por-projeto.md e
 * src/dominio/agentePadrao.ts, "sobrescreve, nunca soma"). Edição no lugar,
 * mesmo padrão de DescricaoProjeto.tsx: instrução salva ao perder o foco,
 * teto salva ao trocar a opção — sem formulário, sem outra página.
 */
export default function EditorAgentePadrao({
  agente,
  instrucaoAtual,
  tetoAtual,
}: {
  agente: string;
  instrucaoAtual: string | null;
  tetoAtual: number | null;
}) {
  const [instrucao, setInstrucao] = useState(instrucaoAtual ?? "");
  const [teto, setTeto] = useState(tetoAtual === null ? "" : String(tetoAtual));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(proximaInstrucao: string, proximoTeto: string) {
    setSalvando(true);
    setErro(null);
    const resultado = await salvarAgentePadraoAction(agente, proximaInstrucao, proximoTeto);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível salvar o padrão deste agente.");
    }
  }

  return (
    <div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>
          instrução padrão — o que este agente deve fazer, em qualquer projeto onde for ligado
        </span>
        <textarea
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          onBlur={() => {
            if (instrucao !== (instrucaoAtual ?? "")) void salvar(instrucao, teto);
          }}
          rows={3}
          maxLength={INSTRUCAO_TAMANHO_MAXIMO}
          placeholder="ex.: sempre leia o CLAUDE.md inteiro antes de propor qualquer coisa"
          style={{ ...estiloCampo, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, maxWidth: 320 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>teto de sugestões padrão</span>
        <select
          value={teto}
          onChange={(e) => {
            const proximoTeto = e.target.value;
            setTeto(proximoTeto);
            void salvar(instrucao, proximoTeto);
          }}
          style={estiloCampo}
        >
          <option value="">sem padrão — decide o teto do projeto (ou o global de 3)</option>
          <option value="0">0 — só diagnostica, nunca sugere</option>
          <option value="1">no máximo 1</option>
          <option value="2">no máximo 2</option>
          <option value="3">no máximo 3</option>
        </select>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {salvando && <span style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>salvando…</span>}
        {erro && <span style={{ fontSize: "var(--fs-2xs)", color: "var(--fal)" }}>{erro}</span>}
      </div>

      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)", marginTop: 6, textWrap: "pretty" }}>
        Isto vale em todo projeto onde {agente} estiver ligado na esteira. Um projeto pode sobrescrever —
        nunca soma com este padrão — na própria esteira, no card do agente.
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { salvarDescricaoProjetoAction } from "@/servidor/acoes-projeto";

const TAMANHO_MAXIMO = 2000;

// O que este projeto é, em prosa do dono — editável no lugar, no cabeçalho da
// tela de detalhe (docs/plano-gerenciador-de-projeto.md § 5.2). Salva ao
// perder o foco (blur), não a cada tecla: menos chamada de rede, e o dono
// termina a frase antes de gravar. Estado vazio é o convite mais honesto
// possível — "isto vai para os agentes" é verdade (entra no CLAUDE.md do
// repositório alvo e no prompt gerado, ver src/dominio/prompt.ts).
export default function DescricaoProjeto({
  projetoId,
  descricaoAtual,
}: {
  projetoId: string;
  descricaoAtual: string | null;
}) {
  const [valor, setValor] = useState(descricaoAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (valor === (descricaoAtual ?? "")) return;
    setSalvando(true);
    setErro(null);
    const resultado = await salvarDescricaoProjetoAction(projetoId, valor);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível salvar a descrição.");
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        maxLength={TAMANHO_MAXIMO}
        rows={2}
        placeholder="diga o que é este projeto — isto vai para os agentes"
        style={{
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "inherit",
          fontSize: 14,
          color: "var(--txt2)",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: 6,
          padding: "6px 8px",
          marginLeft: -8,
        }}
        onFocus={(e) => (e.currentTarget.style.border = "1px solid var(--borda)")}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {salvando && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--mut3)" }}>
            salvando…
          </span>
        )}
        {erro && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--fal)" }}>{erro}</span>
        )}
      </div>
    </div>
  );
}

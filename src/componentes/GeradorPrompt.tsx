"use client";

import { useState } from "react";
import { classeBotao, estiloBotao } from "./estiloBotao";

// Painel do gerador de prompt (item 1 de docs/proximos-passos.md). Puramente
// de apresentação: quem monta o texto é `gerarTextoPrompt`
// (src/dominio/prompt.ts); este componente só decide quando gerar (só no
// clique — nunca durante a renderização inicial, para não rodar em SSR e
// dessincronizar do que o cliente mostra depois) e como copiar.
//
// Não é bonito de propósito: o texto vai para outro modelo, não para leitura
// de revista — mas fica visível numa textarea antes de copiar, porque o dono
// precisa bater o olho antes de colar em qualquer lugar (CLAUDE.md, "o prompt
// gerado carrega o que ele teria que reexplicar à mão").
export default function GeradorPrompt({
  quantidadeSelecionadas,
  temNaoReverte,
  gerarTexto,
}: {
  quantidadeSelecionadas: number;
  temNaoReverte: boolean;
  gerarTexto: () => string;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);

  function gerar() {
    setTexto(gerarTexto());
    setCopiado(false);
    setAberto(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px dashed var(--borda)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>
          {quantidadeSelecionadas === 0
            ? "marque sugestões acima para gerar um prompt"
            : `${quantidadeSelecionadas} ${quantidadeSelecionadas === 1 ? "sugestão marcada" : "sugestões marcadas"}`}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={gerar}
          disabled={quantidadeSelecionadas === 0}
          className={classeBotao("primaria")}
          style={estiloBotao("primaria")}
        >
          gerar prompt para o Claude Code
        </button>
      </div>

      {aberto && (
        <div style={{ marginTop: 12 }}>
          {temNaoReverte && (
            <div
              style={{
                border: "1px solid var(--fal)",
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 10,
                fontSize: "var(--fs-2xs)",
                color: "var(--fal)",
              }}
            >
              ⚠ inclui sugestão que não reverte — o próprio texto avisa disso antes de começar,
              mas confira antes de colar.
            </div>
          )}
          <textarea
            readOnly
            value={texto}
            rows={16}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-2xs)",
              lineHeight: "var(--lh-relaxed)",
              color: "var(--txt2)",
              background: "var(--painel)",
              border: "1px solid var(--linha3)",
              borderRadius: 6,
              padding: 10,
              resize: "vertical",
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={copiar}
              className={classeBotao("secundaria")}
              style={estiloBotao("secundaria")}
            >
              {copiado ? "copiado ✓" : "copiar para a área de transferência"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={classeBotao("texto")}
              style={estiloBotao("texto")}
            >
              fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

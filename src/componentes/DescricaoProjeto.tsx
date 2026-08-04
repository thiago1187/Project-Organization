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

  const vazio = valor.trim().length === 0;

  return (
    <div style={{ marginTop: 14 }}>
      {/* Enquanto está vazio, o campo se anuncia: borda tracejada e um rótulo
          acima. "Editar no lugar" (CLAUDE.md, "maleável") economiza um clique
          para quem já sabe que o campo existe — mas some para quem não sabe,
          e este é o campo que alimenta a rodada noturna e o prompt gerado.
          Campo invisível que ninguém preenche é pior que formulário.

          Preenchido, ele volta a ser texto limpo: aí o conteúdo é a coisa
          importante, não a caixa em volta dele. */}
      {vazio && (
        <div
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--mut2)",
            marginBottom: 4,
          }}
        >
          o que é este projeto
        </div>
      )}
      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        maxLength={TAMANHO_MAXIMO}
        rows={vazio ? 2 : 3}
        placeholder="Clique aqui e escreva o que é este projeto. Isto vai junto para os agentes quando a rodada visitar, e para o prompt que você gera."
        style={{
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "inherit",
          fontSize: "var(--fs-sm)",
          color: "var(--txt2)",
          background: vazio ? "var(--painel)" : "transparent",
          border: vazio ? "1px dashed var(--borda-forte)" : "1px solid transparent",
          borderRadius: 6,
          padding: "6px 8px",
          marginLeft: -8,
          cursor: "text",
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid var(--borda-forte)";
          e.currentTarget.style.background = "var(--painel)";
        }}
        onBlurCapture={(e) => {
          const semTexto = e.currentTarget.value.trim().length === 0;
          e.currentTarget.style.border = semTexto
            ? "1px dashed var(--borda-forte)"
            : "1px solid transparent";
          e.currentTarget.style.background = semTexto ? "var(--painel)" : "transparent";
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {salvando && (
          <span style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>
            salvando…
          </span>
        )}
        {erro && (
          <span style={{ fontSize: "var(--fs-2xs)", color: "var(--fal)" }}>{erro}</span>
        )}
      </div>
    </div>
  );
}

"use client";

// Botão de exportação do documento de andamento — item 4 de
// docs/proximos-passos.md. "PDF via impressão do navegador sobre uma página
// de estilo próprio": zero dependência nova, zero binário, e o resultado
// aproveita exatamente o CSS de impressão de src/app/globals.css
// (a barra com este botão soma `.no-imprimir` e desaparece no PDF gerado).
export default function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-borda"
      style={{
        border: "1px solid var(--borda-forte)",
        borderRadius: 4,
        background: "var(--rodada-fundo)",
        color: "var(--txt)",
        padding: "6px 14px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      imprimir / salvar como PDF
    </button>
  );
}

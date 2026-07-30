import type { AgenteAchadoVM } from "@/dominio/visao";

// Portado do export, linhas 185-199.
export default function CartaoAgente({ agente }: { agente: AgenteAchadoVM }) {
  return (
    <div
      className="h-borda"
      style={{
        border: "1px solid var(--borda)",
        borderRadius: 8,
        background: "var(--painel)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            background: agente.bg,
            color: agente.fg,
            border: `1px solid ${agente.borda}`,
            flex: "none",
          }}
        >
          {agente.mono}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, overflowWrap: "anywhere" }}>
            {agente.nome}
          </div>
          <div style={{ fontSize: 10, color: "var(--mut3)", marginTop: 2 }}>{agente.papel}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--txt2)", textWrap: "pretty" }}>{agente.acao}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid var(--linha3)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        }}
      >
        <span style={{ color: agente.corTipo }}>{agente.tipoLabel}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--mut3)" }}>{agente.metrica}</span>
      </div>
    </div>
  );
}

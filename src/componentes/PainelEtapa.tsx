import type { EtapaVM } from "@/dominio/visao";

// Portado do export, linhas 133-159. "onde estamos" continua mockado nesta
// etapa — não tem tabela no schema (plano §2.8). A fila de sugestões mora em
// FilaSugestoes.tsx, logo abaixo deste painel na tela de detalhe. Os campos
// que eram contentEditable (título, resumo, cada próximo passo) viraram
// texto simples (plano §2.12).
export default function PainelEtapa({ etapa }: { etapa: EtapaVM }) {
  return (
    <div
      style={{
        border: "1px solid var(--borda)",
        borderRadius: 8,
        background: "var(--painel)",
        padding: "22px 24px",
        marginBottom: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          onde estamos
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha3)" }} />
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          {etapa.contador}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 26,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {etapa.titulo}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: etapa.corSelo,
            border: `1px solid ${etapa.corSelo}`,
            borderRadius: 3,
            padding: "2px 7px",
          }}
        >
          {etapa.selo}
        </div>
      </div>

      <div style={{ color: "var(--txt2)", fontSize: 14, marginTop: 12, maxWidth: "68ch", textWrap: "pretty" }}>
        {etapa.resumo}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 16 }}>
        {etapa.proximos.map((n) => (
          <div key={n.num} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)", flex: "none" }}>
              {n.num}
            </div>
            <div style={{ fontSize: 13, color: "var(--txt3)", textWrap: "pretty", flex: 1 }}>{n.texto}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid var(--linha3)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--mut3)",
        }}
      >
        <span>escrito por {etapa.autor}</span>
        <span>·</span>
        <span>{etapa.atualizado}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: etapa.corFrescor }}>{etapa.frescor}</span>
      </div>
    </div>
  );
}

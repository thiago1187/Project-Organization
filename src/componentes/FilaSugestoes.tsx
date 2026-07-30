import type { FilaSugestoesVM } from "@/dominio/visao";
import CartaoSugestao from "./CartaoSugestao";

// A fila de sugestões — o coração do produto (docs/visao.md: "sala de
// controle", não relatório). Pendentes primeiro, sempre visíveis; decididas
// (aprovada/recusada/feita) em bloco à parte, recolhido por padrão, para não
// competir por atenção com o que ainda precisa de decisão — mas sem sumir,
// porque histórico de decisão é útil.
//
// Marcar como "feita" é da routine, não do painel — não há botão para isso
// aqui (ver CLAUDE.md e src/servidor/sugestoes.ts).
export default function FilaSugestoes({ projetoId, fila }: { projetoId: string; fila: FilaSugestoesVM }) {
  const semNada = fila.pendentes.length === 0 && fila.decididas.length === 0;

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          fila de sugestões
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        {fila.pendentes.length > 0 && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--atn)" }}>
            {fila.pendentes.length} {fila.pendentes.length === 1 ? "esperando" : "esperando decisão"}
          </div>
        )}
      </div>

      {semNada && (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "var(--mut3)",
          }}
        >
          nenhuma sugestão registrada ainda
        </div>
      )}

      {fila.pendentes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fila.pendentes.map((s) => (
            <CartaoSugestao key={s.id} sugestao={s} projetoId={projetoId} />
          ))}
        </div>
      )}

      {fila.decididas.length > 0 && (
        <details style={{ marginTop: fila.pendentes.length > 0 ? 18 : 0 }}>
          <summary
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "var(--mut3)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {fila.decididas.length} já {fila.decididas.length === 1 ? "decidida" : "decididas"}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {fila.decididas.map((s) => (
              <CartaoSugestao key={s.id} sugestao={s} projetoId={projetoId} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

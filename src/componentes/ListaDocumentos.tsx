import type { DocVM } from "@/dominio/visao";

// Portado do export, linhas 206-221.
export default function ListaDocumentos({ docs }: { docs: DocVM[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>documentos</div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
      </div>

      {docs.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--mut3)" }}>Nenhum documento anexado ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((d) => (
            <a
              key={d.url + d.nome}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="h-borda"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid var(--borda)",
                borderRadius: 6,
                background: "var(--painel)",
                padding: "11px 13px",
              }}
            >
              <span style={{ fontSize: 13, minWidth: 0, overflowWrap: "anywhere" }}>{d.nome}</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: "var(--mut3)",
                  whiteSpace: "nowrap",
                  flex: "none",
                }}
              >
                {d.local} ↗
              </span>
            </a>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--mut3)", marginTop: 8 }}>
        Links para onde o documento já vive — o app não guarda arquivos.
      </div>
    </div>
  );
}

import type { AcessoMock } from "@/dominio/visao";

// Portado do export, linhas 223-255, com as remoções do plano §2.11:
// sai o campo de valor (o tipo AcessoMock nunca teve um — nada a mascarar,
// nada a vazar), sai o botão "revelar" e sai o toggle que simula sessão do
// Vercel Authentication. Fica o que é, onde vive e quem administra.
export default function ListaAcessos({ acessos }: { acessos: AcessoMock[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "var(--mut3)",
            whiteSpace: "nowrap",
            flex: "none",
          }}
        >
          cofre de acessos
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
      </div>

      {acessos.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--mut3)", marginTop: 8 }}>Nenhum acesso registrado para este projeto.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {acessos.map((c) => (
            <div
              key={c.rotulo}
              style={{
                border: "1px solid var(--borda)",
                borderRadius: 6,
                background: "var(--painel)",
                padding: "12px 13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, minWidth: 0, overflowWrap: "anywhere" }}>{c.rotulo}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: "var(--mut3)",
                }}
              >
                <span>{c.escopo}</span>
                <div style={{ flex: 1 }} />
                <a href={c.url} target="_blank" rel="noreferrer" className="h-txt" style={{ whiteSpace: "nowrap", color: "var(--mut3)" }}>
                  {c.gerido} ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          borderLeft: "2px solid var(--borda)",
          padding: "2px 0 2px 10px",
          fontSize: 11,
          color: "var(--mut2)",
          textWrap: "pretty",
        }}
      >
        Os valores vivem nas environment variables do Vercel. Este app não os lê nem os exibe — para adicionar ou
        trocar uma credencial, use o painel do Vercel.
      </div>
    </div>
  );
}

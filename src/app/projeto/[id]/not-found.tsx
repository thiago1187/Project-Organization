import Link from "next/link";

export default function ProjetoNaoEncontrado() {
  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 1240 }}>
      <div
        style={{
          border: "1px dashed var(--borda)",
          borderRadius: 8,
          padding: "22px 18px",
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "var(--mut3)",
        }}
      >
        Este projeto não existe ou foi removido.
        <div style={{ marginTop: 10 }}>
          <Link href="/" className="h-txt" style={{ color: "var(--mut2)" }}>
            ← voltar para todos os projetos
          </Link>
        </div>
      </div>
    </div>
  );
}

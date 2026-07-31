import Link from "next/link";

export default function AgenteNaoEncontrado() {
  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 900 }}>
      <div
        style={{
          border: "1px dashed var(--borda)",
          borderRadius: 8,
          padding: "22px 18px",
          textAlign: "center",
          fontSize: "var(--fs-xs)",
          color: "var(--mut3)",
        }}
      >
        Este agente não existe — nenhum papel conhecido, achado, sugestão ou linha de esteira com este nome.
        <div style={{ marginTop: 10 }}>
          <Link href="/agentes" className="h-txt" style={{ color: "var(--mut2)" }}>
            ← voltar para todos os agentes
          </Link>
        </div>
      </div>
    </div>
  );
}

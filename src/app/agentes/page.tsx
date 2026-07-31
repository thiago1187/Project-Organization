import { montarListaAgentes, type FichaAgenteVM } from "@/dominio/agentes";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import { listarSugestoes } from "@/servidor/sugestoes";
import { listarAgentesProjeto } from "@/servidor/agentesProjeto";
import CartaoFichaAgente from "@/componentes/CartaoFichaAgente";

// Server Component: mesma regra de "nunca cacheado" das outras telas (ver
// src/app/page.tsx) — a reputação muda a cada decisão do dono na fila de
// sugestões, em qualquer projeto, e precisa refletir na hora.
export const dynamic = "force-dynamic";

function GrupoAgentes({
  titulo,
  nota,
  fichas,
  vazio,
}: {
  titulo: string;
  nota: string;
  fichas: FichaAgenteVM[];
  vazio: string;
}) {
  return (
    <section style={{ marginTop: "var(--space-6)" }} aria-labelledby={`grupo-${titulo}`}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <h2
          id={`grupo-${titulo}`}
          style={{
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-lg)",
            lineHeight: "var(--lh-tight)",
            color: "var(--txt)",
            margin: 0,
          }}
        >
          {titulo}
        </h2>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>{nota}</span>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          {fichas.length}
        </span>
      </div>

      {fichas.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            color: "var(--mut3)",
          }}
        >
          {vazio}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {fichas.map((f) => (
            <CartaoFichaAgente key={f.agente} ficha={f} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AgentesPage() {
  const [projetos, relatorios, sugestoes, agentesProjeto] = await Promise.all([
    listarProjetos(),
    listarRelatorios(),
    listarSugestoes(),
    listarAgentesProjeto(),
  ]);

  const lista = montarListaAgentes(projetos, relatorios, sugestoes, agentesProjeto);
  const total = lista.leitura.length + lista.escrita.length;

  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <div>
        <h1
          style={{
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-4xl)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--txt)",
            margin: 0,
          }}
        >
          Agentes
        </h1>
        <div style={{ color: "var(--mut2)", marginTop: 6, fontSize: "var(--fs-sm)" }}>
          {total} {total === 1 ? "agente na tripulação" : "agentes na tripulação"} — quem existe, no que é bom, e se
          vale confiar no que propõe.
        </div>
      </div>

      <GrupoAgentes
        titulo="Diagnóstico"
        nota="leitura — rodam sozinhos, de madrugada"
        fichas={lista.leitura}
        vazio="nenhum agente de leitura na tripulação ainda"
      />
      <GrupoAgentes
        titulo="Escrita"
        nota="só trabalham com você presente"
        fichas={lista.escrita}
        vazio="nenhum agente de escrita na tripulação ainda"
      />
    </div>
  );
}

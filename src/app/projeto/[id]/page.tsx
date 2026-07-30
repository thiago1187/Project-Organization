import { notFound } from "next/navigation";
import Link from "next/link";
import { projetos, relatorios, sugestoes, contextos, ETAPAS, ACESSOS } from "@/dados/mock";
import { detalheProjeto, rodadaDetalhe } from "@/dominio/visao";
import PainelEtapa from "@/componentes/PainelEtapa";
import HistoricoRodadas from "@/componentes/HistoricoRodadas";
import ListaDocumentos from "@/componentes/ListaDocumentos";
import ListaAcessos from "@/componentes/ListaAcessos";

export default async function DetalheProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const atual = detalheProjeto(id, projetos, relatorios, sugestoes, contextos, ETAPAS, ACESSOS);
  if (!atual) notFound();

  const rodadasDetalhe = atual.rodadas
    .map((r) => rodadaDetalhe(id, relatorios, r.idx))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 1240 }}>
      <Link
        href="/"
        className="h-txt"
        style={{
          display: "inline-block",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--mut3)",
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← todos os projetos
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 20,
          paddingBottom: 22,
          borderBottom: "1px solid var(--linha)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: atual.cor, flex: "none" }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: atual.cor }}>
              {atual.statusLabel}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
              {atual.repo}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "var(--mut3)",
                border: "1px solid var(--borda)",
                borderRadius: 3,
                padding: "2px 7px",
              }}
            >
              {atual.cadenciaLabelLongo}
            </div>
          </div>
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 42,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginTop: 8,
            }}
          >
            {atual.nome}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {atual.temPr && atual.prUrl && (
          <a
            href={atual.prUrl}
            target="_blank"
            rel="noreferrer"
            className="h-fundo"
            style={{
              border: "1px solid var(--atn)",
              borderRadius: 5,
              padding: "9px 16px",
              fontSize: 13,
              color: "var(--atn)",
              whiteSpace: "nowrap",
            }}
          >
            Revisar PR no GitHub ↗
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 36,
          marginTop: 26,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <PainelEtapa etapa={atual.etapa} />
          <HistoricoRodadas resumo={atual.rodadas} detalhe={rodadasDetalhe} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <ListaDocumentos docs={atual.docs} />
          <ListaAcessos acessos={atual.acessos} />
        </div>
      </div>
    </div>
  );
}

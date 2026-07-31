import { notFound } from "next/navigation";
import Link from "next/link";
import { fichaDetalheDoAgente } from "@/dominio/agentes";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import { listarSugestoes } from "@/servidor/sugestoes";
import { listarAgentesProjeto } from "@/servidor/agentesProjeto";
import { obterAgentePadrao } from "@/servidor/agentesPadrao";
import EditorAgentePadrao from "@/componentes/EditorAgentePadrao";

export const dynamic = "force-dynamic";

/** >=70% confiável, 40–69% misto, <40% mal calibrado — mesma escala de
 * CartaoFichaAgente.tsx, repetida aqui porque o anel grande do cabeçalho é
 * uma peça de página, não de card (ficha detalhada, não lista). */
function corReputacao(pct: number | null): string {
  if (pct === null) return "var(--mut3)";
  if (pct >= 70) return "var(--ok)";
  if (pct >= 40) return "var(--atn)";
  return "var(--fal)";
}

export default async function FichaAgentePage({
  params,
}: {
  params: Promise<{ nome: string }>;
}) {
  const { nome } = await params;

  const [projetos, relatorios, sugestoes, agentesProjeto, padrao] = await Promise.all([
    listarProjetos(),
    listarRelatorios(),
    listarSugestoes(),
    listarAgentesProjeto(),
    obterAgentePadrao(nome),
  ]);

  const ficha = fichaDetalheDoAgente(nome, projetos, relatorios, sugestoes, agentesProjeto);
  if (!ficha) notFound();

  const cor = corReputacao(ficha.reputacao.taxaPct);

  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 900 }}>
      <Link
        href="/agentes"
        className="h-txt"
        style={{
          display: "inline-block",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          color: "var(--mut3)",
          cursor: "pointer",
          marginBottom: "var(--space-4)",
        }}
      >
        ← todos os agentes
      </Link>

      {/* Cabeçalho: quem é, o que ele é — a resposta às duas primeiras
          perguntas de toda tela (o que é isso, o que está acontecendo). O
          número em destaque é a reputação: das decisões que o dono já
          tomou sobre as propostas deste agente, quantas foram "sim". */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          flexWrap: "wrap",
          paddingBottom: "var(--space-5)",
          borderBottom: "1px solid var(--linha)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-lg)",
            fontWeight: "var(--fw-bold)",
            background: ficha.bg,
            color: ficha.fg,
            border: `1px solid ${ficha.borda}`,
            flex: "none",
          }}
        >
          {ficha.mono}
        </div>

        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--fw-bold)",
              fontSize: "var(--fs-3xl)",
              lineHeight: "var(--lh-tight)",
              letterSpacing: "var(--ls-tight)",
              color: "var(--txt)",
              overflowWrap: "anywhere",
            }}
          >
            {ficha.agente}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: 6 }}>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--txt2)" }}>{ficha.papel}</span>
            <span style={{ color: "var(--mut3)" }}>·</span>
            <span style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: ficha.corTipo }}>
              {ficha.tipoLabel}
            </span>
          </div>
        </div>

        {/* O número que o dono pediu para destacar. */}
        <div
          className="vidro-cartao"
          style={{
            borderRadius: 14,
            padding: "var(--space-4) var(--space-5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: 180,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--fw-bold)",
              fontSize: "var(--fs-3xl)",
              lineHeight: 1,
              color: cor,
            }}
          >
            {ficha.reputacao.taxaPct === null ? "—" : `${ficha.reputacao.taxaPct}%`}
          </div>
          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)", textAlign: "center", textWrap: "pretty" }}>
            {ficha.reputacao.decididas === 0
              ? "taxa de aprovação — sem decisão sua ainda"
              : `taxa de aprovação — ${ficha.reputacao.aprovadas} de ${ficha.reputacao.decididas} ${
                  ficha.reputacao.decididas === 1 ? "decisão" : "decisões"
                }`}
          </div>
        </div>
      </div>

      {/* O padrão do agente vem antes de "onde atua agora", e a ordem é
          deliberada: o que o dono escreve aqui passa a valer em todos os
          projetos listados logo abaixo. Ver a seção na tela, e
          docs/decisoes/ sobre precedência — projeto sobrescreve padrão,
          nunca soma. */}
      <section style={{ marginTop: "var(--space-5)" }} aria-labelledby="secao-padrao">
        <h2
          id="secao-padrao"
          style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", margin: "0 0 var(--space-3)" }}
        >
          padrão deste agente
        </h2>
        <EditorAgentePadrao
          agente={nome}
          instrucaoAtual={padrao?.instrucao ?? null}
          tetoAtual={padrao?.teto_sugestoes ?? null}
        />
      </section>

      {/* Onde atua agora. */}
      <section style={{ marginTop: "var(--space-6)" }} aria-labelledby="secao-projetos">
        <h2
          id="secao-projetos"
          style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", margin: "0 0 var(--space-3)" }}
        >
          onde atua agora
        </h2>
        {ficha.projetosLigados.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--borda)",
              borderRadius: 8,
              padding: "16px 12px",
              textAlign: "center",
              fontSize: "var(--fs-sm)",
              color: "var(--mut3)",
            }}
          >
            não está ligado na esteira de nenhum projeto agora
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {ficha.projetosLigados.map((p) => (
              <Link
                key={p.id}
                href={`/projeto/${p.id}`}
                className="h-borda"
                style={{
                  display: "block",
                  border: "1px solid var(--borda)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--txt)" }}>
                  {p.nome}
                </div>
                {p.instrucao && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)", marginTop: 2, textWrap: "pretty" }}>
                    {p.instrucao}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* O que encontrou — histórico de achados, todos os projetos, mais recente primeiro. */}
      <section style={{ marginTop: "var(--space-6)" }} aria-labelledby="secao-achados">
        <h2
          id="secao-achados"
          style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", margin: "0 0 var(--space-3)" }}
        >
          o que encontrou ({ficha.totalAchados})
        </h2>
        {ficha.historicoAchados.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--borda)",
              borderRadius: 8,
              padding: "16px 12px",
              textAlign: "center",
              fontSize: "var(--fs-sm)",
              color: "var(--mut3)",
            }}
          >
            ainda não rodou em nenhuma rodada registrada
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {ficha.historicoAchados.map((a, i) => (
              <div
                key={`${a.projetoId}-${i}`}
                style={{
                  border: "1px solid var(--borda)",
                  borderRadius: 8,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--txt2)" }}>
                    {a.projetoNome}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>
                    {a.dataLabel}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>{a.selo}</span>
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--txt)", marginTop: 4, textWrap: "pretty" }}>
                  {a.achado}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* O que propôs — histórico de sugestões, com o que o dono decidiu de cada uma. */}
      <section style={{ marginTop: "var(--space-6)" }} aria-labelledby="secao-sugestoes">
        <h2
          id="secao-sugestoes"
          style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", margin: "0 0 var(--space-3)" }}
        >
          o que propôs ({ficha.totalSugestoes})
        </h2>
        {ficha.historicoSugestoes.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--borda)",
              borderRadius: 8,
              padding: "16px 12px",
              textAlign: "center",
              fontSize: "var(--fs-sm)",
              color: "var(--mut3)",
            }}
          >
            ainda não propôs nada
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {ficha.historicoSugestoes.map((s) => (
              <Link
                key={s.id}
                href={`/projeto/${s.projetoId}#fila-sugestoes`}
                className="h-borda"
                style={{
                  display: "block",
                  border: "1px solid var(--borda)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--txt2)" }}>
                    {s.projetoNome}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>
                    {s.dataLabel}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: "var(--fs-2xs)", fontWeight: "var(--fw-semibold)", color: s.estadoCor }}>
                    {s.estadoLabel}
                  </span>
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--txt)", marginTop: 4, textWrap: "pretty" }}>
                  {s.proposta}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

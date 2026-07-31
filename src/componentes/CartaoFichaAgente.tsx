import Link from "next/link";
import type { FichaAgenteVM } from "@/dominio/agentes";

// Card de um agente na tela /agentes — "ficha de tripulação", não linha de
// tabela: crachá, nome, papel e, no centro do card, o número que o dono
// pediu para destacar — a taxa de aprovação (ver AnelReputacao abaixo).
// Vidro e profundidade (globals.css .vidro-cartao, mesmos tokens --vidro-*
// do Mapa dos Agentes) — a segunda peça a usar o registro visual.

/** >=70% confiável (var(--ok)), 40–69% misto (var(--atn)), <40% mal calibrado
 * (var(--fal)) — os mesmos três tons que o resto do painel já usa para
 * "bom/atenção/ruim" (ver STATUS_COR em src/dominio/visao.ts), agora
 * aplicados à reputação em vez do status de uma rodada. */
function corReputacao(pct: number | null): string {
  if (pct === null) return "var(--mut3)";
  if (pct >= 70) return "var(--ok)";
  if (pct >= 40) return "var(--atn)";
  return "var(--fal)";
}

/**
 * Anel de progresso em SVG puro (sem biblioteca de gráfico). `pct === null`
 * — o agente nunca teve sugestão decidida — desenha só o trilho, com um
 * traço no centro em vez de um número: nada de "0%", que pareceria nota
 * baixa em vez de "ainda sem decisão".
 */
function AnelReputacao({ pct }: { pct: number | null }) {
  const raio = 15;
  const circunferencia = 2 * Math.PI * raio;
  const cor = corReputacao(pct);
  const preenchido = pct === null ? 0 : (pct / 100) * circunferencia;

  return (
    <div style={{ position: "relative", width: 44, height: 44, flex: "none" }}>
      <svg
        width={44}
        height={44}
        viewBox="0 0 40 40"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle cx={20} cy={20} r={raio} fill="none" stroke="var(--linha)" strokeWidth={4} />
        {pct !== null && (
          <circle
            cx={20}
            cy={20}
            r={raio}
            fill="none"
            stroke={cor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${preenchido} ${circunferencia}`}
          />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-2xs)",
          fontWeight: "var(--fw-bold)",
          color: cor,
        }}
      >
        {pct === null ? "—" : `${pct}%`}
      </div>
    </div>
  );
}

export default function CartaoFichaAgente({ ficha }: { ficha: FichaAgenteVM }) {
  const temHistorico = ficha.totalAchados > 0 || ficha.totalSugestoes > 0;

  return (
    <Link
      href={`/agentes/${encodeURIComponent(ficha.agente)}`}
      className="vidro-cartao"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        borderRadius: 14,
        padding: "var(--space-4)",
        cursor: "pointer",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-semibold)",
            background: ficha.bg,
            color: ficha.fg,
            border: `1px solid ${ficha.borda}`,
            flex: "none",
          }}
        >
          {ficha.mono}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--txt)",
              overflowWrap: "anywhere",
            }}
          >
            {ficha.agente}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>{ficha.papel}</div>
        </div>
        <span
          style={{
            fontSize: "var(--fs-2xs)",
            fontWeight: "var(--fw-semibold)",
            color: ficha.corTipo,
            whiteSpace: "nowrap",
            flex: "none",
          }}
        >
          {ficha.tipoLabel}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          paddingTop: "var(--space-2)",
          borderTop: "1px solid var(--linha3)",
        }}
      >
        <AnelReputacao pct={ficha.reputacao.taxaPct} />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--txt2)", lineHeight: "var(--lh-tight)", textWrap: "pretty" }}>
          {ficha.reputacao.decididas === 0
            ? "sem decisão sua ainda"
            : `${ficha.reputacao.aprovadas} de ${ficha.reputacao.decididas} ${
                ficha.reputacao.decididas === 1 ? "proposta decidida" : "propostas decididas"
              } aprovada${ficha.reputacao.aprovadas === 1 ? "" : "s"}`}
        </div>
      </div>

      {temHistorico ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: "var(--space-2)",
            rowGap: 2,
            fontSize: "var(--fs-2xs)",
            color: "var(--mut3)",
          }}
        >
          <span>
            {ficha.totalAchados} {ficha.totalAchados === 1 ? "achado" : "achados"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {ficha.totalSugestoes} {ficha.totalSugestoes === 1 ? "sugestão" : "sugestões"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {ficha.projetosAtivos.length} {ficha.projetosAtivos.length === 1 ? "projeto ativo" : "projetos ativos"}
          </span>
          {ficha.ultimaAtividadeLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>ativo em {ficha.ultimaAtividadeLabel}</span>
            </>
          )}
        </div>
      ) : (
        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>ainda não rodou em nenhum projeto</div>
      )}
    </Link>
  );
}

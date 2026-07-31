import type { CSSProperties } from "react";
import type { MapaAgentesVM } from "@/dominio/mapaAgentes";

// A peça de vitrine do painel (pedido do dono: "algo que desperte algo top e
// novo") — ver src/dominio/mapaAgentes.ts para a derivação e para por que só
// existem dois estados honestos ("rodou" / "não rodou"), nunca um terceiro
// fabricado por heurística sobre o texto do achado.
//
// Server Component: nenhuma interação além do que o navegador já dá de graça
// (hover, foco, `title`) — sem estado, sem "use client". A animação de
// entrada e o pulso são CSS puro (globals.css, ".mapa-no"/".mapa-pulso"),
// então o conteúdo existe no HTML e é legível por leitor de tela mesmo se o
// CSS de animação não carregar ou `prefers-reduced-motion` estiver ligado —
// nesse caso os cartões simplesmente já nascem no estado final, sem exibir
// nada "faltando".
//
// As ligações entre agentes não são elementos próprios: cada cartão de vidro
// é translúcido (`backdrop-filter`) sobre uma única linha contínua desenhada
// atrás da fileira (o "fio"), então a linha atravessa os cartões por trás do
// desfoque — a corrente fica visível através do vidro, em vez de ser um
// traço de gráfico por cima.
export default function MapaAgentes({ mapa, nomeProjeto }: { mapa: MapaAgentesVM; nomeProjeto: string }) {
  const { itens, horaLabel, temRelatorio } = mapa;

  return (
    <section aria-label={`mapa dos agentes de ${nomeProjeto}`} style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h2
          style={{
            margin: 0,
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-lg)",
            lineHeight: "var(--lh-tight)",
            color: "var(--txt)",
          }}
        >
          Mapa dos agentes
        </h2>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          {temRelatorio
            ? `estado da última rodada, ${horaLabel}`
            : "nenhuma rodada registrada ainda"}
        </span>
      </div>

      {itens.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 10,
            padding: "20px 16px",
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            color: "var(--mut3)",
          }}
        >
          nenhum agente ligado neste projeto ainda — ligue um na esteira, abaixo
        </div>
      ) : (
        <div className="mapa-trilho">
          <div style={{ position: "relative", padding: "6px 4px 18px" }}>
            {/* O fio — decorativo, atravessa por trás dos cartões translúcidos. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 40,
                left: 16,
                right: 16,
                height: 1,
                background:
                  "linear-gradient(to right, transparent, var(--borda-forte) 8%, var(--borda-forte) 92%, transparent)",
              }}
            />
            <ol
              style={{
                position: "relative",
                display: "flex",
                gap: 22,
                margin: 0,
                padding: 0,
                listStyle: "none",
                width: "max-content",
                minWidth: "100%",
              }}
            >
              {itens.map((agente, i) => {
                const rodou = agente.estado === "rodou";
                return (
                  <li
                    key={agente.agente}
                    className="mapa-no"
                    aria-label={
                      rodou
                        ? `${agente.agente}, ${agente.papel}. Rodou — ${agente.selo}. ${agente.achado}`
                        : `${agente.agente}, ${agente.papel}. ${temRelatorio ? "Não rodou nesta rodada." : "Sem rodada registrada ainda."}`
                    }
                    style={{ "--i": i, flex: "0 0 232px" } as CSSProperties}
                  >
                    <div
                      className="mapa-cartao"
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${rodou ? "var(--vidro-borda)" : "var(--borda)"}`,
                        background: rodou ? "var(--vidro-fundo-forte)" : "var(--vidro-fundo)",
                        padding: "14px 14px 12px",
                        opacity: rodou ? 1 : 0.55,
                        minHeight: 96,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className={rodou ? "mapa-pulso" : undefined}
                          aria-hidden="true"
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: rodou ? "var(--ok)" : "var(--mut3)",
                            flex: "none",
                          }}
                        />
                        <div
                          aria-hidden="true"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-2xs)",
                            background: rodou ? agente.bg : "transparent",
                            color: rodou ? agente.fg : "var(--mut3)",
                            border: `1px solid ${rodou ? agente.borda : "var(--borda)"}`,
                            filter: rodou ? "none" : "grayscale(1)",
                            flex: "none",
                          }}
                        >
                          {agente.mono}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }} aria-hidden="true">
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--fs-xs)",
                              fontWeight: "var(--fw-semibold)",
                              color: rodou ? "var(--txt)" : "var(--mut3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={agente.agente}
                          >
                            {agente.agente}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--fs-2xs)",
                              color: "var(--mut3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {agente.papel}
                          </div>
                        </div>
                      </div>

                      {rodou ? (
                        <div aria-hidden="true">
                          <div
                            style={{
                              display: "inline-block",
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--fs-2xs)",
                              fontWeight: "var(--fw-semibold)",
                              color: "var(--txt2)",
                              border: "1px solid var(--vidro-borda)",
                              borderRadius: 5,
                              padding: "1px 6px",
                              marginBottom: 4,
                            }}
                          >
                            {agente.selo}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "var(--fs-xs)",
                              color: "var(--txt2)",
                              lineHeight: "var(--lh-normal)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textWrap: "pretty",
                            }}
                            title={agente.achado ?? undefined}
                          >
                            {agente.achado}
                          </p>
                        </div>
                      ) : (
                        <div aria-hidden="true" style={{ fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>
                          {temRelatorio ? "não rodou nesta rodada" : "sem rodada ainda"}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { SugestaoVM } from "@/dominio/visao";
import { aprovarSugestaoAction, marcarFeitaAction, recusarSugestaoAction } from "@/servidor/acoes-sugestao";

// Uma linha da fila de sugestões. Resumo sempre visível (agente, proposta,
// esforço, reversibilidade, estado); motivo e risco só aparecem expandidos —
// "duas velocidades" (docs/visao.md). Estado local otimista: decidir muda a
// aparência do cartão na hora, sem esperar o `revalidatePath` da action
// refletir numa navegação futura (mesmo padrão de LinhaConfiguracao).
//
// Três formas de agir, uma por estado:
// - pendente: aprovar ou recusar (decisão do dono).
// - aprovada: marcar como feita, com link opcional — o trabalho agora
//   acontece na hora, pelo prompt gerado (docs/proximos-passos.md item 1),
//   não mais pela routine; é o dono quem sabe quando terminou.
// - recusada/feita: histórico, sem ação.
//
// `selecionavel`/`selecionada`/`onToggleSelecao` só chegam preenchidos para
// cartões de sugestão pendente ou aprovada — são o que alimenta o gerador de
// prompt (src/componentes/FilaSugestoes.tsx).
//
// `reversibilidade = 'nao_reverte'`: o requisito da tarefa é que isso fique
// explícito ANTES da aprovação, não depois — aqui isso é: (1) borda e selo em
// destaque sempre visíveis, mesmo com o cartão fechado; (2) o botão "aprovar"
// não aprova direto, ele abre uma confirmação com o aviso por extenso; só o
// segundo clique, dentro dessa confirmação, aprova de fato. Sugestão comum
// (fácil/difícil) aprova num clique só.
export default function CartaoSugestao({
  sugestao,
  projetoId,
  selecionavel = false,
  selecionada = false,
  onToggleSelecao,
}: {
  sugestao: SugestaoVM;
  projetoId: string;
  selecionavel?: boolean;
  selecionada?: boolean;
  onToggleSelecao?: (id: string) => void;
}) {
  const [s, setS] = useState(sugestao);
  const [aberto, setAberto] = useState(false);
  const [confirmandoNaoReverte, setConfirmandoNaoReverte] = useState(false);
  const [marcandoFeita, setMarcandoFeita] = useState(false);
  const [linkFeita, setLinkFeita] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const decidida = s.estado === "recusada" || s.estado === "feita";

  function aprovar() {
    if (pendente) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await aprovarSugestaoAction(s.id, projetoId);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível aprovar a sugestão.");
        return;
      }
      setConfirmandoNaoReverte(false);
      setS((atual) => ({
        ...atual,
        estado: "aprovada",
        estadoLabel: "aprovada",
        estadoCor: "var(--ok)",
        decisaoLabel: "aprovada agora",
      }));
    });
  }

  function recusar() {
    if (pendente) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await recusarSugestaoAction(s.id, projetoId);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível recusar a sugestão.");
        return;
      }
      setS((atual) => ({
        ...atual,
        estado: "recusada",
        estadoLabel: "recusada",
        estadoCor: "var(--mut3)",
        decisaoLabel: "recusada agora",
      }));
    });
  }

  function marcarFeita() {
    if (pendente) return;
    setErro(null);
    const link = linkFeita.trim();
    iniciarTransicao(async () => {
      const resultado = await marcarFeitaAction(s.id, projetoId, link.length > 0 ? link : null);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível marcar esta sugestão como feita.");
        return;
      }
      setMarcandoFeita(false);
      setS((atual) => ({
        ...atual,
        estado: "feita",
        estadoLabel: "feita",
        estadoCor: "var(--acento)",
        decisaoLabel: "feita agora",
        prUrl: link.length > 0 ? link : null,
      }));
    });
  }

  return (
    <div
      className="h-borda"
      style={{
        border: `1px solid ${s.naoReverte && !decidida ? "var(--fal)" : "var(--borda)"}`,
        borderRadius: 8,
        background: "var(--painel)",
        padding: "14px 16px",
        opacity: decidida ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {selecionavel && (
          <input
            type="checkbox"
            checked={selecionada}
            onChange={() => onToggleSelecao?.(s.id)}
            aria-label="marcar para o prompt"
            style={{ marginTop: 6, flex: "none", cursor: "pointer" }}
          />
        )}

        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            background: s.chip.bg,
            color: s.chip.fg,
            border: `1px solid ${s.chip.borda}`,
            flex: "none",
          }}
        >
          {s.chip.mono}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, color: "var(--mut3)", fontFamily: "'JetBrains Mono', monospace" }}>
              {s.chip.papel}
            </div>
            <div style={{ fontSize: 10, color: "var(--mut3)" }}>·</div>
            <div style={{ fontSize: 10, color: "var(--mut3)", fontFamily: "'JetBrains Mono', monospace" }}>
              {s.criadaEmLabel}
            </div>
          </div>

          <div
            onClick={() => setAberto((v) => !v)}
            style={{ fontSize: 14, color: "var(--txt)", marginTop: 4, textWrap: "pretty", cursor: "pointer" }}
          >
            {s.proposta}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "var(--mut3)",
                border: "1px solid var(--borda)",
                borderRadius: 3,
                padding: "2px 7px",
              }}
            >
              {s.esforcoLabel}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: s.reversibilidadeCor,
                border: `1px solid ${s.reversibilidadeCor}`,
                borderRadius: 3,
                padding: "2px 7px",
                fontWeight: s.naoReverte ? 700 : 400,
              }}
            >
              {s.naoReverte ? "⚠ não reverte" : s.reversibilidadeLabel}
            </span>
            {s.estado !== "pendente" && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: s.estadoCor }}>
                {s.decisaoLabel ?? s.estadoLabel}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="h-txt"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "var(--mut3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              {aberto ? "fechar detalhe" : "ver detalhe"}
            </button>
          </div>

          {aberto && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--linha3)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
                  por quê
                </div>
                <div style={{ fontSize: 13, color: "var(--txt2)", marginTop: 3, textWrap: "pretty" }}>{s.motivo}</div>
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
                  risco
                </div>
                <div style={{ fontSize: 13, color: "var(--txt2)", marginTop: 3, textWrap: "pretty" }}>{s.risco}</div>
              </div>
              {s.prUrl && (
                <a
                  href={s.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-txt"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--atn)" }}
                >
                  ver link do que foi feito ↗
                </a>
              )}
            </div>
          )}

          {!decidida && s.estado === "pendente" && s.naoReverte && confirmandoNaoReverte && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--fal)",
                borderRadius: 6,
                padding: "10px 12px",
                background: "var(--faixa-fundo)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--fal)", textWrap: "pretty" }}>
                Esta sugestão não reverte. Toca migration, configuração externa ou dado apagado — se
                der errado depois de aprovada e executada, não há desfazer fácil.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={aprovar}
                  disabled={pendente}
                  style={{
                    border: "1px solid var(--fal)",
                    borderRadius: 4,
                    background: "var(--fal)",
                    color: "var(--bg)",
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: pendente ? "default" : "pointer",
                    opacity: pendente ? 0.6 : 1,
                  }}
                >
                  {pendente ? "aprovando…" : "sim, entendo — aprovar mesmo assim"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoNaoReverte(false)}
                  disabled={pendente}
                  className="h-txt"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "var(--mut3)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  cancelar
                </button>
              </div>
            </div>
          )}

          {s.estado === "pendente" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => (s.naoReverte ? setConfirmandoNaoReverte(true) : aprovar())}
                disabled={pendente}
                className="h-borda"
                style={{
                  border: "1px solid var(--borda-forte)",
                  borderRadius: 4,
                  background: "var(--rodada-fundo)",
                  color: "var(--txt)",
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: pendente ? "default" : "pointer",
                  opacity: pendente ? 0.6 : 1,
                }}
              >
                {pendente ? "aprovando…" : "aprovar"}
              </button>
              <button
                type="button"
                onClick={recusar}
                disabled={pendente}
                className="h-txt"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "var(--mut3)",
                  background: "none",
                  border: "1px solid var(--borda)",
                  borderRadius: 4,
                  padding: "6px 14px",
                  cursor: pendente ? "default" : "pointer",
                  opacity: pendente ? 0.6 : 1,
                }}
              >
                {pendente ? "recusando…" : "recusar"}
              </button>
            </div>
          )}

          {s.estado === "aprovada" && !marcandoFeita && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setMarcandoFeita(true)}
                disabled={pendente}
                className="h-borda"
                style={{
                  border: "1px solid var(--borda-forte)",
                  borderRadius: 4,
                  background: "var(--rodada-fundo)",
                  color: "var(--txt)",
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: pendente ? "default" : "pointer",
                  opacity: pendente ? 0.6 : 1,
                }}
              >
                marcar como feita
              </button>
            </div>
          )}

          {s.estado === "aprovada" && marcandoFeita && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--linha3)",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--mut3)", marginBottom: 6 }}>
                Link do que foi feito, se houver (pull request, commit) — opcional.
              </div>
              <input
                type="text"
                value={linkFeita}
                onChange={(e) => setLinkFeita(e.target.value)}
                placeholder="https://…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 13,
                  padding: "6px 8px",
                  border: "1px solid var(--linha3)",
                  borderRadius: 4,
                  background: "var(--bg)",
                  color: "var(--txt)",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={marcarFeita}
                  disabled={pendente}
                  className="h-borda"
                  style={{
                    border: "1px solid var(--borda-forte)",
                    borderRadius: 4,
                    background: "var(--rodada-fundo)",
                    color: "var(--txt)",
                    padding: "6px 14px",
                    fontSize: 12,
                    cursor: pendente ? "default" : "pointer",
                    opacity: pendente ? 0.6 : 1,
                  }}
                >
                  {pendente ? "salvando…" : "confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarcandoFeita(false);
                    setLinkFeita("");
                  }}
                  disabled={pendente}
                  className="h-txt"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "var(--mut3)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  cancelar
                </button>
              </div>
            </div>
          )}

          {erro && (
            <div style={{ fontSize: 11, color: "var(--fal)", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              {erro}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

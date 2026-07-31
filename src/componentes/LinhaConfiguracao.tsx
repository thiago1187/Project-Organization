"use client";

import { useState, useTransition } from "react";
import { ORDEM_FAIXAS, FAIXA_LABEL_CURTO, type Faixa } from "@/dominio/cadencia";
import type { ConfigLinhaVM } from "@/dominio/visao";
import { definirCadenciaAction } from "@/servidor/acoes-projeto";
import FormEdicaoProjeto from "./FormEdicaoProjeto";
import { classeBotao, estiloBotao } from "./estiloBotao";

// Portado do export, linhas 269-279, agora persistindo de verdade: escolher
// um botão chama `definirCadenciaAction`, que passa por `patchParaFaixa`
// (src/dominio/cadencia.ts) — o mesmo caminho que o drag and drop da home
// (QuadroCadencias), para os dois produzirem sempre o mesmo estado.
export default function LinhaConfiguracao({ linha }: { linha: ConfigLinhaVM }) {
  const [faixa, setFaixa] = useState<Faixa>(linha.faixaAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [editando, setEditando] = useState(false);
  const pausado = faixa === "pausado";

  function escolherFaixa(alvo: Faixa) {
    if (alvo === faixa || pendente) return;
    const anterior = faixa;
    setFaixa(alvo);
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await definirCadenciaAction(linha.id, alvo);
      if (!resultado.ok) {
        setFaixa(anterior);
        setErro(resultado.erro ?? "Não foi possível mudar a cadência.");
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        border: "1px solid var(--borda)",
        borderRadius: 6,
        background: "var(--painel)",
        padding: "14px 16px",
        flexWrap: "wrap",
      }}
    >
      {editando ? (
        <FormEdicaoProjeto
          id={linha.id}
          nomeAtual={linha.nome}
          repositorioAtual={linha.repo}
          aoFechar={() => setEditando(false)}
        />
      ) : (
        <>
          <div style={{ minWidth: 180, flex: 1 }}>
            <div
              style={{
                fontWeight: "var(--fw-bold)",
                fontSize: "var(--fs-md)",
                lineHeight: "var(--lh-tight)",
                letterSpacing: "var(--ls-tight)",
                color: pausado ? "var(--mut2)" : "var(--txt)",
              }}
            >
              {linha.nome}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)", marginTop: 3 }}>
              {linha.repo} · {linha.ultimaRodadaLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className={classeBotao("texto")}
            style={estiloBotao("texto")}
          >
            editar
          </button>
        </>
      )}

      {!editando && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {ORDEM_FAIXAS.map((opcao) => {
            const on = opcao === faixa;
            return (
              <div
                key={opcao}
                onClick={() => escolherFaixa(opcao)}
                className="h-borda"
                style={{
                  fontSize: "var(--fs-2xs)",
                  fontWeight: "var(--fw-medium)",
                  color: on ? "var(--txt)" : "var(--mut3)",
                  border: `1px solid ${on ? "var(--borda-forte)" : "var(--borda)"}`,
                  background: on ? "var(--rodada-fundo)" : "var(--painel)",
                  borderRadius: 4,
                  padding: "5px 9px",
                  cursor: pendente ? "default" : "pointer",
                  opacity: pendente ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {FAIXA_LABEL_CURTO[opcao]}
              </div>
            );
          })}
        </div>
      )}

      {erro && (
        <div style={{ width: "100%", fontSize: "var(--fs-xs)", color: "var(--fal)" }}>
          {erro}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { SugestaoAgenteVM } from "@/dominio/sugestorAgentes";
import { chipDoAgente } from "@/dominio/visao";
import { alternarAgenteAction } from "@/servidor/acoes-agentes";

const estiloBotaoTexto = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  color: "var(--mut3)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px 4px",
  whiteSpace: "nowrap",
} as const;

const estiloBotaoLigar = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  color: "var(--atn)",
  background: "none",
  border: "1px solid var(--borda)",
  borderRadius: 4,
  cursor: "pointer",
  padding: "3px 8px",
  whiteSpace: "nowrap",
} as const;

/**
 * A faixa do sugestor de agentes (docs/plano-gerenciador-de-projeto.md § 4) —
 * vive dentro de EsteiraAgentes porque sugerir quem ligar ao lado de quem já
 * está ligado é o lugar natural. `sugeridos` já vem pronto de
 * `sugerirAgentes` (src/dominio/sugestorAgentes.ts), calculado em page.tsx a
 * partir do que a tela de detalhe já carrega — nenhuma query nova aqui.
 *
 * Duas listas, sempre rotuladas (§ 4.1 do plano): "para a esteira" (agente de
 * leitura, um clique liga) e "para o prompt" (agente de escrita — nunca
 * ganha botão de ligar, porque a esteira só aciona quem a rodada roda às 3h
 * sem ninguém para barrar). As duas oferecem "dispensar": grava
 * `habilitado = false` via o mesmo upsert que `alternarAgenteAction` já usa
 * para ligar/desligar, e é essa linha que faz o sugestor calar a boca sobre
 * aquele agente — dispensar não esconde a sugestão da tela, decide por ela.
 *
 * Sumiço honesto: sem nada a sugerir, o componente devolve null. Um "nenhuma
 * sugestão" aqui seria ruído numa tela que já pede rolagem.
 */
export default function FaixaSugestorAgentes({
  projetoId,
  sugeridos,
}: {
  projetoId: string;
  sugeridos: SugestaoAgenteVM[];
}) {
  const [itens, setItens] = useState<SugestaoAgenteVM[]>(sugeridos);
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setItens(sugeridos), [sugeridos]);

  if (itens.length === 0) return null;

  async function aplicar(agente: string, habilitado: boolean, mensagemFalha: string) {
    setPendente(agente);
    setErro(null);
    const anteriores = itens;
    setItens((atual) => atual.filter((s) => s.agente !== agente));

    const resultado = await alternarAgenteAction(projetoId, agente, habilitado);

    setPendente(null);
    if (!resultado.ok) {
      setItens(anteriores);
      setErro(resultado.erro ?? mensagemFalha);
    }
  }

  const paraEsteira = itens.filter((s) => s.destino === "esteira");
  const paraPrompt = itens.filter((s) => s.destino === "prompt");

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--mut3)" }}>
          sugerido para este projeto
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha3)" }} />
      </div>

      {erro && (
        <div style={{ fontSize: 11, color: "var(--fal)", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          {erro}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {paraEsteira.map((s) => {
          const chip = chipDoAgente(s.agente);
          const ocupado = pendente === s.agente;
          return (
            <div
              key={s.agente}
              className="h-borda"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                border: "1px dashed var(--borda)",
                borderRadius: 8,
                padding: "8px 10px",
                opacity: ocupado ? 0.5 : 1,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  background: chip.bg,
                  color: chip.fg,
                  border: `1px solid ${chip.borda}`,
                  flex: "none",
                  marginTop: 1,
                }}
              >
                {chip.mono}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{s.agente}</div>
                <div style={{ fontSize: 11, color: "var(--mut3)", textWrap: "pretty", marginTop: 2 }}>{s.porque}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button
                  type="button"
                  onClick={() => aplicar(s.agente, true, "Não foi possível ligar este agente.")}
                  disabled={ocupado}
                  className="h-borda"
                  style={{ ...estiloBotaoLigar, cursor: ocupado ? "default" : "pointer" }}
                >
                  + ligar na esteira
                </button>
                <button
                  type="button"
                  onClick={() => aplicar(s.agente, false, "Não foi possível dispensar este agente.")}
                  disabled={ocupado}
                  className="h-txt"
                  style={{ ...estiloBotaoTexto, cursor: ocupado ? "default" : "pointer" }}
                  title="fica registrado — o sugestor não vai insistir nele aqui"
                >
                  dispensar
                </button>
              </div>
            </div>
          );
        })}

        {paraPrompt.map((s) => {
          const chip = chipDoAgente(s.agente);
          const ocupado = pendente === s.agente;
          return (
            <div
              key={s.agente}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                border: "1px dashed var(--borda)",
                borderRadius: 8,
                padding: "8px 10px",
                opacity: ocupado ? 0.5 : 1,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  background: chip.bg,
                  color: chip.fg,
                  border: `1px solid ${chip.borda}`,
                  flex: "none",
                  marginTop: 1,
                }}
              >
                {chip.mono}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{s.agente}</div>
                <div style={{ fontSize: 11, color: "var(--mut3)", textWrap: "pretty", marginTop: 2 }}>{s.porque}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "var(--mut3)",
                    border: "1px solid var(--borda)",
                    borderRadius: 3,
                    padding: "3px 7px",
                    whiteSpace: "nowrap",
                  }}
                  title="agente de escrita — não entra na esteira automática, convoque com você presente"
                >
                  para o prompt, não a esteira
                </span>
                <button
                  type="button"
                  onClick={() => aplicar(s.agente, false, "Não foi possível dispensar este agente.")}
                  disabled={ocupado}
                  className="h-txt"
                  style={{ ...estiloBotaoTexto, cursor: ocupado ? "default" : "pointer" }}
                  title="fica registrado — o sugestor não vai insistir nele aqui"
                >
                  dispensar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

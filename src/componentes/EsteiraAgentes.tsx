"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgenteEsteiraVM } from "@/dominio/esteiraAgentes";
import type { SugestaoVM } from "@/dominio/visao";
import type { SugestaoAgenteVM } from "@/dominio/sugestorAgentes";
import { alternarAgenteAction, reordenarAgentesAction } from "@/servidor/acoes-agentes";
import CartaoAgenteEsteira from "./CartaoAgenteEsteira";
import FaixaSugestorAgentes from "./FaixaSugestorAgentes";

// A esteira de agentes (docs/plano-agentes-por-projeto.md § 2.3) — três
// faixas fixas, lidas da esquerda para a direita. Só a primeira
// (Diagnóstico) é configurável; "Você" é um contador derivado da fila de
// sugestões; "Execução" é espelho — mostra o que já foi aprovado e está
// esperando o dono gerar o prompt, sem nenhum jeito de configurar quem
// executa. Essa última decisão é deliberada e é o que impede a esteira de
// virar um contorno do portão de aprovação (ver o comentário no topo do
// plano, § 2.3, "a esteira não pode virar contorno do portão").
//
// Drag and drop com HTML5 nativo, sem biblioteca — mesmo padrão de
// QuadroCadencias.tsx. Duas listas locais (`nomesAtivos`, `nomesInativos`)
// dão resposta otimista ao soltar um card; as Server Actions
// (src/servidor/acoes-agentes.ts) persistem, e desfazem a lista local se
// falharem. As duas listas se ressincronizam com as props sempre que a
// página for atualizada de verdade (ex.: depois de salvar uma instrução,
// que é uma Server Action ligada a <form>, e por isso já dispara um refresh
// automático do Next) — ver o useEffect abaixo.
export default function EsteiraAgentes({
  projetoId,
  ativos,
  inativos,
  pendentesCount,
  aprovadas,
  sugeridos,
}: {
  projetoId: string;
  ativos: AgenteEsteiraVM[];
  inativos: AgenteEsteiraVM[];
  pendentesCount: number;
  aprovadas: SugestaoVM[];
  sugeridos: SugestaoAgenteVM[];
}) {
  const todosPorNome = useMemo(() => {
    const mapa = new Map<string, AgenteEsteiraVM>();
    for (const a of ativos) mapa.set(a.agente, a);
    for (const a of inativos) mapa.set(a.agente, a);
    return mapa;
  }, [ativos, inativos]);

  const [nomesAtivos, setNomesAtivos] = useState<string[]>(() => ativos.map((a) => a.agente));
  const [nomesInativos, setNomesInativos] = useState<string[]>(() => inativos.map((a) => a.agente));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setNomesAtivos(ativos.map((a) => a.agente));
    setNomesInativos(inativos.map((a) => a.agente));
  }, [ativos, inativos]);

  function moverParaAtivos(agenteNome: string, indiceAlvo: number) {
    if (!todosPorNome.has(agenteNome)) return;
    const origemInativos = nomesInativos.includes(agenteNome);
    if (!origemInativos && !nomesAtivos.includes(agenteNome)) return;

    const nomesAtivosAntigos = nomesAtivos;
    const nomesInativosAntigos = nomesInativos;

    const semAgente = nomesAtivos.filter((a) => a !== agenteNome);
    const alvo = Math.max(0, Math.min(indiceAlvo, semAgente.length));
    const novaOrdem = [...semAgente.slice(0, alvo), agenteNome, ...semAgente.slice(alvo)];

    setErro(null);
    setNomesAtivos(novaOrdem);
    if (origemInativos) setNomesInativos((atual) => atual.filter((a) => a !== agenteNome));

    void (async () => {
      if (origemInativos) {
        const r = await alternarAgenteAction(projetoId, agenteNome, true);
        if (!r.ok) {
          setNomesAtivos(nomesAtivosAntigos);
          setNomesInativos(nomesInativosAntigos);
          setErro(r.erro ?? "Não foi possível ligar este agente.");
          return;
        }
      }
      const r2 = await reordenarAgentesAction(projetoId, novaOrdem);
      if (!r2.ok) {
        setNomesAtivos(nomesAtivosAntigos);
        setNomesInativos(nomesInativosAntigos);
        setErro(r2.erro ?? "Não foi possível reordenar os agentes.");
      }
    })();
  }

  function moverParaInativos(agenteNome: string) {
    if (!nomesAtivos.includes(agenteNome)) return;
    const nomesAtivosAntigos = nomesAtivos;
    const nomesInativosAntigos = nomesInativos;

    setErro(null);
    setNomesAtivos((atual) => atual.filter((a) => a !== agenteNome));
    setNomesInativos((atual) => [...atual, agenteNome].sort((a, b) => a.localeCompare(b)));

    void (async () => {
      const r = await alternarAgenteAction(projetoId, agenteNome, false);
      if (!r.ok) {
        setNomesAtivos(nomesAtivosAntigos);
        setNomesInativos(nomesInativosAntigos);
        setErro(r.erro ?? "Não foi possível desligar este agente.");
      }
    })();
  }

  // Aberta por padrão só quando há sugestão de agente esperando decisão —
  // caso contrário fica fechada: configurar quem roda é baixa frequência
  // ("o que ele quase nunca precisa ver"), diferente da fila de sugestões de
  // trabalho, que nunca se esconde.
  return (
    <details className="dobravel" open={sugeridos.length > 0} style={{ marginBottom: 30 }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="chevron" aria-hidden="true" style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          ▸
        </span>
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)" }}>
          esteira de agentes
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
        {sugeridos.length > 0 && (
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--atn)" }}>
            {sugeridos.length} {sugeridos.length === 1 ? "sugestão de agente" : "sugestões de agente"}
          </span>
        )}
      </summary>

      {erro && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fal)", marginBottom: 10, fontWeight: "var(--fw-medium)" }}>
          {erro}
        </div>
      )}

      <FaixaSugestorAgentes projetoId={projetoId} sugeridos={sugeridos} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.85fr) minmax(0, 1fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* DIAGNÓSTICO — a única faixa configurável. */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const arrastado = e.dataTransfer.getData("text/plain");
            if (arrastado) moverParaAtivos(arrastado, nomesAtivos.length);
          }}
          style={{
            border: "1px solid var(--borda)",
            borderRadius: 10,
            background: "var(--faixa-fundo)",
            padding: 12,
            minHeight: 200,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-tight)", color: "var(--txt)" }}>
              Diagnóstico
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
              configurável — arraste para ligar e ordenar
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nomesAtivos.map((nome, i) => {
              const vm = todosPorNome.get(nome);
              if (!vm) return null;
              return (
                <CartaoAgenteEsteira
                  key={nome}
                  projetoId={projetoId}
                  agente={vm}
                  index={i}
                  arrastando={arrastando === nome}
                  onDragStart={() => setArrastando(nome)}
                  onDragEnd={() => setArrastando(null)}
                  onDropAqui={moverParaAtivos}
                  onDesligar={moverParaInativos}
                />
              );
            })}
            {nomesAtivos.length === 0 && (
              <div
                style={{
                  border: "1px dashed var(--borda)",
                  borderRadius: 8,
                  padding: "16px 10px",
                  textAlign: "center",
                  fontSize: "var(--fs-sm)",
                  color: "var(--mut3)",
                }}
              >
                nenhum agente ligado — arraste um daqui de baixo, ou clique em &quot;ligar&quot;
              </div>
            )}
          </div>

          {nomesInativos.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px" }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
                  desligados
                </div>
                <div style={{ flex: 1, height: 1, background: "var(--linha3)" }} />
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const arrastado = e.dataTransfer.getData("text/plain");
                  if (arrastado) moverParaInativos(arrastado);
                }}
                style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
              >
                {nomesInativos.map((nome) => {
                  const vm = todosPorNome.get(nome);
                  if (!vm) return null;
                  return (
                    <div
                      key={nome}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", nome);
                        setArrastando(nome);
                      }}
                      onDragEnd={() => setArrastando(null)}
                      className="h-borda"
                      title={vm.papel}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: "1px solid var(--borda)",
                        borderRadius: 6,
                        padding: "4px 4px 4px 8px",
                        opacity: arrastando === nome ? 0.35 : 1,
                        cursor: "grab",
                        background: "var(--painel)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
                        {nome}
                      </span>
                      <button
                        type="button"
                        onClick={() => moverParaAtivos(nome, nomesAtivos.length)}
                        className="h-txt"
                        style={{
                          fontSize: "var(--fs-xs)",
                          fontWeight: "var(--fw-semibold)",
                          color: "var(--atn)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        + ligar
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* VOCÊ — portão, não editável aqui; a decisão em si acontece na fila de sugestões. */}
        <div
          style={{
            border: "1px solid var(--borda)",
            borderRadius: 10,
            background: "var(--faixa-fundo)",
            padding: 12,
            minHeight: 200,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-tight)", color: "var(--txt)" }}>Você</div>
          <div
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--mut3)",
              marginBottom: 16,
            }}
          >
            o portão — nada vira trabalho sem sua decisão
          </div>
          {pendentesCount > 0 ? (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-4xl)", color: "var(--atn)" }}>
                {pendentesCount}
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--txt2)" }}>
                {pendentesCount === 1 ? "sugestão aguardando" : "sugestões aguardando"} sua decisão, na fila acima
              </div>
            </>
          ) : (
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--mut3)" }}>nada esperando decisão agora</div>
          )}
        </div>

        {/* EXECUÇÃO — espelho, nunca formulário. Nenhum elemento aqui é interativo de propósito. */}
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 10,
            background: "var(--faixa-fundo)",
            padding: 12,
            minHeight: 200,
          }}
        >
          <div style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-tight)", color: "var(--txt)" }}>
            Execução
          </div>
          <div
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--mut3)",
              marginBottom: 16,
              textWrap: "pretty",
            }}
          >
            espelho, não configurável — mostra o que já foi aprovado, esperando você gerar o prompt e fazer
          </div>
          {aprovadas.length === 0 ? (
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--mut3)" }}>nada aprovado na fila agora</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aprovadas.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-2xs)",
                      background: s.chip.bg,
                      color: s.chip.fg,
                      border: `1px solid ${s.chip.borda}`,
                      flex: "none",
                      marginTop: 1,
                    }}
                  >
                    {s.chip.mono}
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--txt2)", textWrap: "pretty" }}>{s.proposta}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ORDEM_FAIXAS, type Faixa } from "@/dominio/cadencia";
import { agruparPorFaixa, type ProjetoCardVM } from "@/dominio/visao";
import { definirCadenciaAction } from "@/servidor/acoes-projeto";
import { estaDigitando } from "./tecladoUtil";
import { estiloCampo } from "./estiloCampo";
import CardProjeto from "./CardProjeto";

// Drag and drop com HTML5 nativo, sem biblioteca (plano §2.10) — portado do
// export linhas 68-105. Soltar um card muda a faixa efetiva localmente na
// hora (para o quadro responder sem esperar a rede) e chama
// `definirCadenciaAction` para persistir — a mesma action que os botões da
// tela de Configuração usam, via `patchParaFaixa` (src/dominio/cadencia.ts).
// Se a escrita falhar, a faixa volta para onde estava e a mensagem de erro
// aparece acima do quadro.
//
// A busca (segunda passada de design da visão geral) mora aqui e não num
// componente à parte porque já é este componente que segura `cards` em
// memória para o arraste responder sem esperar a rede — filtrar antes de
// agrupar é reaproveitar esse mesmo estado, não um estado novo.
export default function QuadroCadencias({ cards }: { cards: ProjetoCardVM[] }) {
  const router = useRouter();
  const [cadencias, setCadencias] = useState<Record<string, Faixa>>({});
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [faixaAlvo, setFaixaAlvo] = useState<Faixa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [, iniciarTransicao] = useTransition();
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "/" && !estaDigitando(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        buscaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const cardsComFaixaEfetiva = cards.map((c) => ({
    ...c,
    faixa: cadencias[c.id] ?? c.faixa,
  }));
  const termo = busca.trim().toLowerCase();
  const cardsFiltrados = termo
    ? cardsComFaixaEfetiva.filter((c) => c.nome.toLowerCase().includes(termo))
    : cardsComFaixaEfetiva;
  const faixas = agruparPorFaixa(cardsFiltrados);
  const buscaSemResultado = termo !== "" && cardsFiltrados.length === 0;

  // Limpa o estado de arraste. Quem grava a cadência é o onDrop da faixa —
  // este handler só cobre o caso de o drag terminar fora de um alvo válido
  // (ex.: Esc, soltar fora do quadro), igual ao p.solta do export.
  function limparArraste() {
    setArrastando(null);
    setFaixaAlvo(null);
  }

  function soltarEm(idFaixaDestino: Faixa, projetoId: string) {
    const faixaOriginal = cards.find((c) => c.id === projetoId)?.faixa;
    setCadencias((s) => ({ ...s, [projetoId]: idFaixaDestino }));
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await definirCadenciaAction(projetoId, idFaixaDestino);
      if (!resultado.ok) {
        setCadencias((s) => {
          const copia = { ...s };
          if (faixaOriginal) copia[projetoId] = faixaOriginal;
          else delete copia[projetoId];
          return copia;
        });
        setErro(resultado.erro ?? "Não foi possível mover o projeto.");
      }
    });
  }

  return (
    <>
      {erro && (
        <div
          style={{
            marginBottom: 10,
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--fal)",
          }}
        >
          {erro}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <input
          ref={buscaRef}
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
              setBusca("");
            } else if (e.key === "Enter" && cardsFiltrados.length > 0) {
              router.push(`/projeto/${cardsFiltrados[0].id}`);
            }
          }}
          placeholder="buscar projeto… (/)"
          aria-label="Buscar projeto por nome"
          style={{ ...estiloCampo, width: 220, padding: "8px 10px", fontSize: "var(--fs-sm)" }}
        />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          arraste um card para mudar com que frequência os agentes visitam o projeto
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
      </div>

      {buscaSemResultado ? (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "24px 12px",
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            color: "var(--mut3)",
          }}
        >
          nenhum projeto encontrado para “{busca.trim()}”
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, alignItems: "start" }}>
        {ORDEM_FAIXAS.map((idFaixa) => {
          const f = faixas.find((x) => x.id === idFaixa)!;
          const alvo = faixaAlvo === idFaixa;
          const qtd = f.projetos.length
            ? `${f.projetos.length} ${f.projetos.length === 1 ? "projeto" : "projetos"}`
            : "vazio";

          return (
            <div
              key={idFaixa}
              onDragOver={(e) => {
                e.preventDefault();
                if (faixaAlvo !== idFaixa) setFaixaAlvo(idFaixa);
              }}
              onDragLeave={() => {
                if (faixaAlvo === idFaixa) setFaixaAlvo(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                if (id) soltarEm(idFaixa, id);
                setArrastando(null);
                setFaixaAlvo(null);
              }}
              style={{
                border: `1px ${idFaixa === "pausado" ? "dashed" : "solid"} ${alvo ? "var(--borda-forte)" : "var(--borda)"}`,
                borderRadius: 10,
                background: alvo ? "var(--faixa-ativa)" : "var(--faixa-fundo)",
                padding: 12,
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "2px 4px 8px",
                  borderBottom: "1px solid var(--linha2)",
                }}
              >
                <div style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-tight)", color: "var(--txt)" }}>
                  {f.titulo}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
                  {qtd}
                </div>
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)", padding: "0 4px" }}>
                {f.nota}
              </div>

              {f.projetos.map((card) => (
                <CardProjeto
                  key={card.id}
                  card={card}
                  arrastando={arrastando === card.id}
                  onDragStart={() => setArrastando(card.id)}
                  onDragEnd={limparArraste}
                />
              ))}

              {f.projetos.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--borda)",
                    borderRadius: 8,
                    padding: "18px 12px",
                    textAlign: "center",
                    fontSize: "var(--fs-xs)",
                    color: "var(--mut3)",
                  }}
                >
                  solte um projeto aqui
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ItemOndeEstamosVM, OndeEstamosVM } from "@/dominio/visao";
import {
  apagarTarefaAction,
  criarTarefaAction,
  editarTituloTarefaAction,
  moverEstadoTarefaAction,
  reordenarTarefasAction,
} from "@/servidor/acoes-tarefa";
import { classeBotao, estiloBotao } from "./estiloBotao";

/**
 * "Onde estamos" com dado real (docs/plano-gerenciador-de-projeto.md § 5.2):
 * título = a tarefa em `fazendo`; abaixo, tarefas `aberta` e sugestões
 * `aprovada`, misturadas com selo de origem. Tabelas separadas no banco
 * (`tarefa`/`sugestao`), união só aqui — ver `src/dominio/visao.ts`
 * (`ondeEstamos`) e o plano § 3.3 para o porquê.
 *
 * Reordenar usa botões ▲▼, não arrastar — mais simples e suficiente para uma
 * lista de dezenas de itens; drag and drop fica para uma passada de
 * designer-ui/dev-frontend se fizer falta (mesmo padrão de
 * EsteiraAgentes.tsx existe para reaproveitar, se decidirem por ele).
 */
export default function OndeEstamos({ projetoId, ondeEstamos }: { projetoId: string; ondeEstamos: OndeEstamosVM }) {
  const [itens, setItens] = useState<ItemOndeEstamosVM[]>(ondeEstamos.itens);
  const [adicionando, setAdicionando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setItens(ondeEstamos.itens), [ondeEstamos.itens]);

  const tarefasIds = itens.filter((i) => i.origem === "tarefa").map((i) => i.id);
  const vazio = !ondeEstamos.fazendoAgora && itens.length === 0;

  async function adicionar() {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    setCriando(true);
    setErro(null);
    const resultado = await criarTarefaAction(projetoId, titulo);
    setCriando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível criar a tarefa.");
      return;
    }
    setNovoTitulo("");
    setAdicionando(false);
  }

  async function concluir(id: string) {
    setItens((atual) => atual.filter((i) => i.id !== id));
    const resultado = await moverEstadoTarefaAction(projetoId, id, "feita");
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível concluir esta tarefa.");
      setItens(ondeEstamos.itens);
    }
  }

  async function comecarAgora(id: string) {
    const resultado = await moverEstadoTarefaAction(projetoId, id, "fazendo");
    if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível marcar como 'fazendo agora'.");
  }

  async function voltarParaAberta(id: string) {
    const resultado = await moverEstadoTarefaAction(projetoId, id, "aberta");
    if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível reabrir esta tarefa.");
  }

  async function apagar(id: string) {
    setItens((atual) => atual.filter((i) => i.id !== id));
    const resultado = await apagarTarefaAction(projetoId, id);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível apagar esta tarefa.");
      setItens(ondeEstamos.itens);
    }
  }

  async function salvarTitulo(id: string) {
    const titulo = tituloEditado.trim();
    setEditandoId(null);
    if (!titulo) return;
    const resultado = await editarTituloTarefaAction(projetoId, id, titulo);
    if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar o título.");
  }

  async function mover(id: string, direcao: -1 | 1) {
    const indice = tarefasIds.indexOf(id);
    const alvo = indice + direcao;
    if (indice === -1 || alvo < 0 || alvo >= tarefasIds.length) return;

    const nova = [...tarefasIds];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];

    setItens((atual) => {
      const semTarefas = atual.filter((i) => i.origem !== "tarefa");
      const tarefasReordenadas = nova
        .map((tid) => atual.find((i) => i.id === tid))
        .filter((i): i is ItemOndeEstamosVM => !!i);
      return [...tarefasReordenadas, ...semTarefas];
    });

    const resultado = await reordenarTarefasAction(projetoId, nova);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível reordenar as tarefas.");
      setItens(ondeEstamos.itens);
    }
  }

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)" }}>
          onde estamos
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha3)" }} />
        {!adicionando && (
          <button type="button" onClick={() => setAdicionando(true)} className={classeBotao("texto")} style={estiloBotao("texto")}>
            + adicionar tarefa
          </button>
        )}
      </div>

      {ondeEstamos.fazendoAgora && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div
            style={{
              fontWeight: "var(--fw-bold)",
              fontSize: "var(--fs-2xl)",
              lineHeight: "var(--lh-tight)",
              letterSpacing: "var(--ls-tight)",
              color: "var(--txt)",
            }}
          >
            {ondeEstamos.fazendoAgora.titulo}
          </div>
          <button
            type="button"
            onClick={() => concluir(ondeEstamos.fazendoAgora!.id)}
            className={classeBotao("texto")}
            style={estiloBotao("texto")}
          >
            concluir
          </button>
          <button
            type="button"
            onClick={() => voltarParaAberta(ondeEstamos.fazendoAgora!.id)}
            className={classeBotao("texto")}
            style={estiloBotao("texto")}
          >
            voltar para aberta
          </button>
        </div>
      )}

      {adicionando && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            maxLength={200}
            autoFocus
            placeholder="o que precisa ser feito"
            style={{
              flex: 1,
              fontSize: "var(--fs-xs)",
              padding: "6px 8px",
              borderRadius: 5,
              border: "1px solid var(--borda)",
              background: "var(--painel)",
              color: "var(--txt)",
            }}
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={criando}
            className={classeBotao("primaria")}
            style={estiloBotao("primaria")}
          >
            {criando ? "criando…" : "adicionar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdicionando(false);
              setNovoTitulo("");
            }}
            className={classeBotao("texto")}
            style={estiloBotao("texto")}
          >
            cancelar
          </button>
        </div>
      )}

      {erro && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)", marginBottom: 10 }}>
          {erro}
        </div>
      )}

      {vazio && !adicionando && (
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
          nada em aberto — diga o que estamos fazendo neste projeto
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {itens.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)", flex: "none", paddingTop: 2 }}>
              {item.num}
            </div>

            {item.origem === "tarefa" ? (
              <>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => concluir(item.id)}
                  style={{ marginTop: 3, flex: "none" }}
                  aria-label={`concluir "${item.texto}"`}
                />
                {editandoId === item.id ? (
                  <input
                    value={tituloEditado}
                    onChange={(e) => setTituloEditado(e.target.value)}
                    onBlur={() => salvarTitulo(item.id)}
                    onKeyDown={(e) => e.key === "Enter" && salvarTitulo(item.id)}
                    maxLength={200}
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: "var(--fs-xs)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--borda)",
                      background: "var(--painel)",
                      color: "var(--txt)",
                    }}
                  />
                ) : (
                  <div
                    onClick={() => {
                      setEditandoId(item.id);
                      setTituloEditado(item.texto);
                    }}
                    style={{ fontSize: "var(--fs-xs)", color: "var(--txt3)", textWrap: "pretty", flex: 1, cursor: "text" }}
                  >
                    {item.texto}
                  </div>
                )}
                <div style={{ display: "flex", gap: 2, flex: "none" }}>
                  <button type="button" onClick={() => mover(item.id, -1)} className={classeBotao("texto")} style={estiloBotao("texto")} title="mover para cima">
                    ▲
                  </button>
                  <button type="button" onClick={() => mover(item.id, 1)} className={classeBotao("texto")} style={estiloBotao("texto")} title="mover para baixo">
                    ▼
                  </button>
                  <button type="button" onClick={() => comecarAgora(item.id)} className={classeBotao("texto")} style={estiloBotao("texto")}>
                    começar agora
                  </button>
                  <button type="button" onClick={() => apagar(item.id)} className={classeBotao("texto")} style={estiloBotao("texto")}>
                    apagar
                  </button>
                </div>
              </>
            ) : (
              <>
                {item.chip && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-2xs)",
                      background: item.chip.bg,
                      color: item.chip.fg,
                      border: `1px solid ${item.chip.borda}`,
                      flex: "none",
                      marginTop: 1,
                    }}
                    title={item.chip.papel}
                  >
                    {item.chip.mono}
                  </div>
                )}
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--txt3)", textWrap: "pretty", flex: 1 }}>{item.texto}</div>
                <div
                  style={{
                    fontSize: "var(--fs-2xs)",
                    color: "var(--mut3)",
                    flex: "none",
                    border: "1px solid var(--borda)",
                    borderRadius: 3,
                    padding: "1px 6px",
                  }}
                >
                  sugestão aprovada
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

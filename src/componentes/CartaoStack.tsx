"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Stack } from "@/dominio/tipos";
import { CATEGORIAS_STACK_ORDEM, CATEGORIA_STACK_LABEL } from "@/dominio/inventario";
import { removerStackAction, salvarStackAction, type EstadoFormStack } from "@/servidor/acoes-inventario";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormStack = { ok: false, erro: null, campos: {} };

/** Um item de `stack`: chip compacto por padrão, forma de edição no lugar sob demanda. */
export default function CartaoStack({ item, projetoId }: { item: Stack; projetoId: string }) {
  const [editando, setEditando] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [pendenteRemocao, iniciarRemocao] = useTransition();
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);

  const [estado, acao, pendenteSalvar] = useActionState(salvarStackAction, ESTADO_INICIAL);
  const pendenteAnteriorRef = useRef(pendenteSalvar);

  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendenteSalvar && estado.ok) {
      setEditando(false);
    }
    pendenteAnteriorRef.current = pendenteSalvar;
  }, [pendenteSalvar, estado.ok]);

  function remover() {
    if (pendenteRemocao) return;
    setErroRemocao(null);
    iniciarRemocao(async () => {
      const resultado = await removerStackAction(item.id, projetoId);
      if (!resultado.ok) {
        setErroRemocao(resultado.erro ?? "Não foi possível remover este item.");
        return;
      }
      setRemovido(true);
    });
  }

  if (removido) return null;

  if (editando) {
    return (
      <form
        action={acao}
        className="h-borda"
        style={{
          border: "1px solid var(--borda-forte)",
          borderRadius: 6,
          background: "var(--painel)",
          padding: "8px 10px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input type="hidden" name="projeto_id" value={projetoId} />
        <input type="hidden" name="id" value={item.id} />
        <select
          name="categoria"
          defaultValue={estado.campos.categoria ?? item.categoria}
          style={{ ...estiloCampo, width: "auto" }}
        >
          {CATEGORIAS_STACK_ORDEM.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_STACK_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          name="nome"
          defaultValue={estado.campos.nome ?? item.nome}
          required
          maxLength={120}
          placeholder="ex.: Node.js 20"
          style={{ ...estiloCampo, width: 160 }}
        />
        <button
          type="submit"
          disabled={pendenteSalvar}
          className={classeBotao("secundaria")}
          style={estiloBotao("secundaria")}
        >
          {pendenteSalvar ? "salvando…" : "salvar"}
        </button>
        <button type="button" onClick={() => setEditando(false)} disabled={pendenteSalvar} className={classeBotao("texto")} style={estiloBotao("texto")}>
          cancelar
        </button>
        {estado.erro && <div style={{ width: "100%", fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{estado.erro}</div>}
      </form>
    );
  }

  return (
    <div
      className="h-borda"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid var(--borda)",
        borderRadius: 6,
        background: "var(--painel)",
        padding: "5px 5px 5px 10px",
      }}
    >
      <span style={{ fontSize: "var(--fs-2xs)", color: "var(--txt)" }}>{item.nome}</span>
      <button type="button" onClick={() => setEditando(true)} className={classeBotao("texto")} style={estiloBotao("texto")}>
        editar
      </button>
      <button type="button" onClick={remover} disabled={pendenteRemocao} className={classeBotao("texto")} style={estiloBotao("texto")} aria-label="remover">
        {pendenteRemocao ? "…" : "×"}
      </button>
      {erroRemocao && <div style={{ fontSize: "var(--fs-2xs)", color: "var(--fal)" }}>{erroRemocao}</div>}
    </div>
  );
}

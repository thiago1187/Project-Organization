"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Servico } from "@/dominio/tipos";
import { CATEGORIAS_SERVICO_ORDEM, CATEGORIA_SERVICO_LABEL } from "@/dominio/inventario";
import { removerServicoAction, salvarServicoAction, type EstadoFormServico } from "@/servidor/acoes-inventario";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const ESTADO_INICIAL: EstadoFormServico = { ok: false, erro: null, campos: {} };

function hostnameCurto(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Um item de `servico`: visualização por padrão (mesmo formato do antigo `ListaAcessos`,
 * agora com dado real), edição no lugar sob demanda — mesmo padrão de `CartaoContexto`. */
export default function CartaoServico({ item, projetoId }: { item: Servico; projetoId: string }) {
  const [editando, setEditando] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const [pendenteRemocao, iniciarRemocao] = useTransition();

  const [estado, acao, pendenteSalvar] = useActionState(salvarServicoAction, ESTADO_INICIAL);
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
      const resultado = await removerServicoAction(item.id, projetoId);
      if (!resultado.ok) {
        setErroRemocao(resultado.erro ?? "Não foi possível remover este serviço.");
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
          borderRadius: 8,
          background: "var(--painel)",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <input type="hidden" name="projeto_id" value={projetoId} />
        <input type="hidden" name="id" value={item.id} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>categoria</span>
            <select name="categoria" defaultValue={estado.campos.categoria ?? item.categoria} style={estiloCampo}>
              {CATEGORIAS_SERVICO_ORDEM.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_SERVICO_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>nome</span>
            <input name="nome" defaultValue={estado.campos.nome ?? item.nome} required maxLength={120} style={estiloCampo} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>conta</span>
            <input name="conta" defaultValue={estado.campos.conta ?? item.conta} required maxLength={120} style={estiloCampo} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>papel (opcional)</span>
            <input
              name="papel"
              defaultValue={estado.campos.papel ?? item.papel ?? ""}
              maxLength={120}
              placeholder="ex.: produção"
              style={estiloCampo}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>administrado em (opcional)</span>
            <input
              name="administrado_url"
              defaultValue={estado.campos.administrado_url ?? item.administrado_url ?? ""}
              placeholder="https://..."
              style={estiloCampo}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={pendenteSalvar}
            className={classeBotao("primaria")}
            style={estiloBotao("primaria")}
          >
            {pendenteSalvar ? "salvando…" : "salvar"}
          </button>
          <button type="button" onClick={() => setEditando(false)} disabled={pendenteSalvar} className={classeBotao("texto")} style={estiloBotao("texto")}>
            cancelar
          </button>
        </div>
        {estado.erro && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{estado.erro}</div>}
      </form>
    );
  }

  return (
    <div
      className="h-borda"
      style={{ border: "1px solid var(--borda)", borderRadius: 6, background: "var(--painel)", padding: "12px 13px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: "var(--fs-xs)", minWidth: 0, overflowWrap: "anywhere" }}>
          {item.nome} <span style={{ color: "var(--mut3)" }}>— {item.conta}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setEditando(true)} className={classeBotao("texto")} style={estiloBotao("texto")}>
          editar
        </button>
        <button type="button" onClick={() => setConfirmandoRemocao(true)} className={classeBotao("texto")} style={estiloBotao("texto")}>
          remover
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-2xs)",
          color: "var(--mut3)",
          flexWrap: "wrap",
        }}
      >
        <span>{item.papel ?? "sem papel definido"}</span>
        <div style={{ flex: 1 }} />
        {item.administrado_url && (
          <a href={item.administrado_url} target="_blank" rel="noreferrer" className="h-txt" style={{ whiteSpace: "nowrap", color: "var(--mut3)" }}>
            {hostnameCurto(item.administrado_url)} ↗
          </a>
        )}
      </div>

      {confirmandoRemocao && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid var(--fal)",
            borderRadius: 6,
            padding: "10px 12px",
            background: "var(--faixa-fundo)",
          }}
        >
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)" }}>Remover este serviço do inventário?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={remover}
              disabled={pendenteRemocao}
              className={classeBotao("destrutiva-forte")}
              style={estiloBotao("destrutiva-forte")}
            >
              {pendenteRemocao ? "removendo…" : "sim, remover"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoRemocao(false)}
              disabled={pendenteRemocao}
              className={classeBotao("texto")}
              style={estiloBotao("texto")}
            >
              cancelar
            </button>
          </div>
        </div>
      )}
      {erroRemocao && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)", marginTop: 8 }}>
          {erroRemocao}
        </div>
      )}
    </div>
  );
}

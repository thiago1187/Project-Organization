"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Contexto } from "@/dominio/tipos";
import { removerContextoAction, salvarContextoAction, type EstadoFormContexto } from "@/servidor/acoes-contexto";
import { estiloCampo } from "./estiloCampo";

const ESTADO_INICIAL: EstadoFormContexto = { ok: false, erro: null, campos: {} };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Lê os dígitos direto da string ISO em vez de passar por `Date` — mesmo
// raciocínio de `partesISO` em src/dominio/visao.ts: mostrar exatamente a
// data gravada, sem depender do fuso do processo que renderiza.
function formatarDataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MESES[Number(m[2]) - 1]}`;
}

function hostnameCurto(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const estiloBotaoTexto = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  color: "var(--mut3)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px 4px",
} as const;

const estiloBotaoPrimario = {
  border: "1px solid var(--borda-forte)",
  borderRadius: 4,
  background: "var(--rodada-fundo)",
  color: "var(--txt)",
  padding: "7px 14px",
  fontSize: 12,
} as const;

/** Um item de `contexto`: visualização por padrão, edição no lugar sob demanda. */
export default function CartaoContexto({ item, projetoId }: { item: Contexto; projetoId: string }) {
  const [editando, setEditando] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const [pendenteRemocao, iniciarRemocao] = useTransition();

  const [estado, acao, pendenteSalvar] = useActionState(salvarContextoAction, ESTADO_INICIAL);
  const pendenteAnteriorRef = useRef(pendenteSalvar);

  // Só fecha o modo de edição depois de um envio que terminou com sucesso —
  // não a cada render (mesmo padrão de FormEdicaoProjeto).
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
      const resultado = await removerContextoAction(item.id, projetoId);
      if (!resultado.ok) {
        setErroRemocao(resultado.erro ?? "Não foi possível remover este item.");
        return;
      }
      // Otimista: some da tela assim que o servidor confirma, sem esperar a
      // navegação seguinte revalidar a lista inteira (mesmo padrão de
      // CartaoSugestao para aprovar/recusar).
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
        {/* agente_destino e tipo formam a chave do item (UNIQUE em
            db/migrations/001_schema_inicial.sql); não são editáveis aqui de
            propósito — mudar a chave criaria um item novo em vez de
            atualizar este. Para renomear, remova e adicione de novo. */}
        <input type="hidden" name="projeto_id" value={projetoId} />
        <input type="hidden" name="agente_destino" value={item.agente_destino} />
        <input type="hidden" name="tipo" value={item.tipo} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            {item.agente_destino}
          </span>
          <span style={{ fontSize: 13, color: "var(--txt)" }}>{item.tipo}</span>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--mut2)" }}>conteúdo</span>
          <textarea
            name="conteudo"
            defaultValue={estado.campos.conteudo ?? item.conteudo ?? ""}
            rows={5}
            maxLength={20000}
            style={{ ...estiloCampo, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--mut2)" }}>ou link de arquivo</span>
          <input
            name="arquivo_url"
            defaultValue={estado.campos.arquivo_url ?? item.arquivo_url ?? ""}
            placeholder="https://..."
            style={estiloCampo}
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={pendenteSalvar}
            className="h-borda"
            style={{ ...estiloBotaoPrimario, cursor: pendenteSalvar ? "default" : "pointer", opacity: pendenteSalvar ? 0.6 : 1 }}
          >
            {pendenteSalvar ? "salvando…" : "salvar"}
          </button>
          <button type="button" onClick={() => setEditando(false)} disabled={pendenteSalvar} className="h-txt" style={estiloBotaoTexto}>
            cancelar
          </button>
        </div>
        {estado.erro && <div style={{ fontSize: 11, color: "var(--fal)" }}>{estado.erro}</div>}
      </form>
    );
  }

  return (
    <div
      className="h-borda"
      style={{ border: "1px solid var(--borda)", borderRadius: 8, background: "var(--painel)", padding: "14px 16px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
          {item.agente_destino}
        </span>
        <span style={{ fontSize: 13, color: "var(--txt)" }}>{item.tipo}</span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setEditando(true)} className="h-txt" style={estiloBotaoTexto}>
          editar
        </button>
        <button type="button" onClick={() => setConfirmandoRemocao(true)} className="h-txt" style={estiloBotaoTexto}>
          remover
        </button>
      </div>

      {item.conteudo && (
        <div style={{ fontSize: 13, color: "var(--txt2)", marginTop: 8, textWrap: "pretty", whiteSpace: "pre-wrap" }}>
          {item.conteudo}
        </div>
      )}
      {item.arquivo_url && (
        <a
          href={item.arquivo_url}
          target="_blank"
          rel="noreferrer"
          className="h-txt"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "var(--atn)",
          }}
        >
          {hostnameCurto(item.arquivo_url)} ↗
        </a>
      )}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)", marginTop: 8 }}>
        atualizado {formatarDataCurta(item.atualizado_em)}
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
          <div style={{ fontSize: 12, color: "var(--fal)" }}>
            Remover este item? A próxima rodada não vai mais lê-lo.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={remover}
              disabled={pendenteRemocao}
              style={{
                border: "1px solid var(--fal)",
                borderRadius: 4,
                background: "var(--fal)",
                color: "var(--bg)",
                padding: "6px 12px",
                fontSize: 12,
                cursor: pendenteRemocao ? "default" : "pointer",
                opacity: pendenteRemocao ? 0.6 : 1,
              }}
            >
              {pendenteRemocao ? "removendo…" : "sim, remover"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoRemocao(false)}
              disabled={pendenteRemocao}
              className="h-txt"
              style={estiloBotaoTexto}
            >
              cancelar
            </button>
          </div>
        </div>
      )}
      {erroRemocao && (
        <div style={{ fontSize: 11, color: "var(--fal)", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          {erroRemocao}
        </div>
      )}
    </div>
  );
}

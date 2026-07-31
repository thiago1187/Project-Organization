import type { CSSProperties } from "react";

// Três níveis de botão + destrutiva — pedido explícito do dono na reforma de
// tipografia: "quero bater o olho e ver que aquilo é um botão importante".
// Antes disso muita ação do app era texto colorido de 10px, indistinguível de
// rótulo. Mesma ideia de src/componentes/estiloCampo.ts: um objeto
// compartilhado em vez de número solto repetido em cada componente.
//
// Uso: <button className={classeBotao("primaria")} style={estiloBotao("primaria")}>
// A classe carrega hover/active (globals.css, pseudo-classe não existe em
// style inline do React); o objeto carrega o resto.
export type NivelBotao = "primaria" | "secundaria" | "texto" | "destrutiva" | "destrutiva-forte";

export interface OpcoesBotao {
  /** Botão de largura livre — a maioria fica do tamanho do próprio texto. */
  full?: boolean;
}

const BASE: CSSProperties = {
  fontFamily: "inherit",
  borderRadius: "var(--btn-radius)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  lineHeight: "var(--lh-tight)",
};

/** Nome de classe para o hover/active de globals.css — sempre junto do h-* que já existia não é necessário aqui, os três níveis têm hover próprio. */
export function classeBotao(nivel: NivelBotao): string {
  return nivel === "destrutiva-forte" ? "botao-destrutiva-forte" : `botao-${nivel}`;
}

export function estiloBotao(nivel: NivelBotao, opcoes: OpcoesBotao = {}): CSSProperties {
  const largura: CSSProperties = opcoes.full ? { width: "100%" } : {};

  switch (nivel) {
    case "primaria":
      return {
        ...BASE,
        ...largura,
        border: "1px solid var(--btn-primaria-bg)",
        background: "var(--btn-primaria-bg)",
        color: "var(--btn-primaria-fg)",
        fontWeight: "var(--fw-bold)",
        fontSize: "var(--fs-sm)",
        padding: "var(--btn-pad-y-primaria) var(--btn-pad-x-primaria)",
      };
    case "secundaria":
      return {
        ...BASE,
        ...largura,
        border: "1px solid var(--borda-forte)",
        background: "var(--rodada-fundo)",
        color: "var(--txt)",
        fontWeight: "var(--fw-semibold)",
        fontSize: "var(--fs-sm)",
        padding: "var(--btn-pad-y-secundaria) var(--btn-pad-x-secundaria)",
      };
    case "texto":
      return {
        ...BASE,
        ...largura,
        border: "1px solid transparent",
        background: "none",
        color: "var(--txt2)",
        fontWeight: "var(--fw-medium)",
        fontSize: "var(--fs-sm)",
        padding: "var(--btn-pad-y-texto) var(--btn-pad-x-texto)",
      };
    case "destrutiva":
      return {
        ...BASE,
        ...largura,
        border: "1px solid var(--fal)",
        background: "none",
        color: "var(--btn-destrutiva-fg)",
        fontWeight: "var(--fw-semibold)",
        fontSize: "var(--fs-sm)",
        padding: "var(--btn-pad-y-secundaria) var(--btn-pad-x-secundaria)",
      };
    case "destrutiva-forte":
      return {
        ...BASE,
        ...largura,
        border: "1px solid var(--fal)",
        background: "var(--fal)",
        color: "var(--bg)",
        fontWeight: "var(--fw-bold)",
        fontSize: "var(--fs-sm)",
        padding: "var(--btn-pad-y-primaria) var(--btn-pad-x-primaria)",
      };
  }
}

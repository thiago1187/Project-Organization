import type { CSSProperties } from "react";

// Estilo de input/select compartilhado pelos formulários do app. Extraído para
// não divergir um do outro por descuido; não é abstração especulativa, é o
// mesmo objeto usado em vários lugares.
//
// Aqui havia `outline: "none"`, e vale registrar por que saiu. Estilo inline
// vence folha de estilo, então essa linha apagava a regra global
// `:focus-visible` do globals.css em **todo** campo de formulário do app —
// quem navega por teclado perdia a única pista de onde está. O anel de foco
// não é enfeite: sem ele, o Tab vira adivinhação.
//
// Zerar o outline só é aceitável quando há substituto visível no mesmo lugar.
// Não havia. Agora a regra global vale, e o campo em foco fica com o mesmo
// anel âmbar do resto do app.
export const estiloCampo: CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--borda)",
  borderRadius: 5,
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--txt)",
  fontFamily: "inherit",
  minWidth: 0,
  width: "100%",
};

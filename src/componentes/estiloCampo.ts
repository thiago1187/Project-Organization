import type { CSSProperties } from "react";

// Estilo de input/select compartilhado entre o formulário de novo projeto e o
// de edição — os dois únicos lugares com campo de texto editável no app hoje.
// Extraído para não divergir um do outro por descuido; não é abstração
// especulativa, é o mesmo objeto usado duas vezes.
export const estiloCampo: CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--borda)",
  borderRadius: 5,
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--txt)",
  fontFamily: "inherit",
  outline: "none",
  minWidth: 0,
  width: "100%",
};

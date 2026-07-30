// Compartilhado por todo atalho de teclado global do painel (visão geral e
// detalhe do projeto): nenhum atalho de uma letra ou dígito pode sequestrar
// o que o dono está digitando num campo de texto. Extraído de
// AtalhosProjeto.tsx quando a visão geral ganhou os próprios atalhos
// (painel de atenção, busca) — mesma regra, um lugar só, para não divergir.
export function estaDigitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || alvo.isContentEditable;
}

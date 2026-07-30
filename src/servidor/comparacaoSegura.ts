import "server-only";

import { timingSafeEqual } from "node:crypto";

// Único lugar com comparação de segredo em tempo constante — usada pelo
// header de bypass (acesso.ts) e pela sessão própria do dono (sessao.ts).
// `===` em segredo vaza o tamanho do prefixo comum pelo tempo de resposta;
// existir em dois arquivos quase idênticos foi exatamente o tipo de
// duplicação que faz um dos dois divergir sem ninguém notar.

/** Comparação em tempo constante. */
export function segredosBatem(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual joga se os tamanhos diferem — o que já é um vazamento de
  // tamanho, mas inevitável e sem valor prático para quem ataca.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

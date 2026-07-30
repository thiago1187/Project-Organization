import { describe, expect, it } from "vitest";
import {
  estadoDaTrava,
  mensagemDeTrava,
  JANELA_MINUTOS,
  LIMITE_TENTATIVAS,
} from "./travaEntrada";

const AGORA = new Date("2026-07-30T20:00:00.000Z");

/** `n` falhas, todas `minutosAtras` minutos antes de AGORA. */
function falhas(n: number, minutosAtras: number): Date[] {
  return Array.from({ length: n }, () => new Date(AGORA.getTime() - minutosAtras * 60_000));
}

describe("travaEntrada", () => {
  it("sem falha nenhuma: livre, com o limite inteiro disponível", () => {
    expect(estadoDaTrava([], AGORA)).toEqual({
      travado: false,
      restantes: LIMITE_TENTATIVAS,
      minutosParaLiberar: 0,
    });
  });

  it("uma abaixo do limite: ainda livre, com uma tentativa restante", () => {
    const estado = estadoDaTrava(falhas(LIMITE_TENTATIVAS - 1, 1), AGORA);
    expect(estado.travado).toBe(false);
    expect(estado.restantes).toBe(1);
  });

  it("no limite: trava", () => {
    const estado = estadoDaTrava(falhas(LIMITE_TENTATIVAS, 1), AGORA);
    expect(estado.travado).toBe(true);
    expect(estado.restantes).toBe(0);
  });

  it("falha fora da janela não conta", () => {
    // Todas velhas o bastante para terem saído: nem chega perto de travar.
    const estado = estadoDaTrava(falhas(LIMITE_TENTATIVAS * 3, JANELA_MINUTOS + 1), AGORA);
    expect(estado.travado).toBe(false);
    expect(estado.restantes).toBe(LIMITE_TENTATIVAS);
  });

  it("mistura dentro e fora da janela: só as de dentro contam", () => {
    const estado = estadoDaTrava(
      [...falhas(LIMITE_TENTATIVAS, JANELA_MINUTOS + 5), ...falhas(2, 1)],
      AGORA,
    );
    expect(estado.travado).toBe(false);
    expect(estado.restantes).toBe(LIMITE_TENTATIVAS - 2);
  });

  it("o relógio corre a partir da falha mais antiga, não da mais recente", () => {
    // Esta é a propriedade que impede a trava de se renovar para sempre: a
    // mais antiga tem 14 minutos, então falta ~1 minuto — mesmo tendo acabado
    // de chegar uma tentativa nova.
    const estado = estadoDaTrava(
      [...falhas(LIMITE_TENTATIVAS - 1, JANELA_MINUTOS - 1), ...falhas(1, 0)],
      AGORA,
    );
    expect(estado.travado).toBe(true);
    expect(estado.minutosParaLiberar).toBe(1);
  });

  it("tentar durante a trava não estende a trava", () => {
    const antigas = falhas(LIMITE_TENTATIVAS, 5);
    const antes = estadoDaTrava(antigas, AGORA);
    const depois = estadoDaTrava([...antigas, ...falhas(20, 0)], AGORA);

    expect(depois.travado).toBe(true);
    expect(depois.minutosParaLiberar).toBe(antes.minutosParaLiberar);
  });

  it("a mensagem diz quanto falta, para o dono não confundir trava com senha errada", () => {
    const estado = estadoDaTrava(falhas(LIMITE_TENTATIVAS, 0), AGORA);
    expect(mensagemDeTrava(estado)).toBe(`Tentativas demais. Espere ${JANELA_MINUTOS} minutos e tente de novo.`);
  });

  it("singular quando falta um minuto só", () => {
    const estado = estadoDaTrava(falhas(LIMITE_TENTATIVAS, JANELA_MINUTOS - 1), AGORA);
    expect(mensagemDeTrava(estado)).toContain("1 minuto e");
  });

  it("nunca anuncia zero minuto — arredonda para cima", () => {
    // Falta menos de um minuto: dizer "espere 0 minutos" convida a tentar de
    // novo na hora e receber a mesma recusa.
    const quase = new Date(AGORA.getTime() - (JANELA_MINUTOS * 60_000 - 10_000));
    const estado = estadoDaTrava(Array.from({ length: LIMITE_TENTATIVAS }, () => quase), AGORA);
    expect(estado.minutosParaLiberar).toBe(1);
  });
});

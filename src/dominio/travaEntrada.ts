// Política da trava de tentativas do /entrar. Lógica pura: recebe quantas
// falhas houve na janela e devolve o que fazer. Sem banco, sem relógio — os
// dois entram por parâmetro, que é o que torna isto testável de verdade.
//
// O desenho está na migration 011: trava global (um usuário só), no banco
// (contador em memória não conta em serverless). Aqui mora só o "quantas" e o
// "por quanto tempo".

/** Falhas toleradas dentro da janela antes de travar. */
export const LIMITE_TENTATIVAS = 8;

/** Tamanho da janela em que as falhas são contadas. */
export const JANELA_MINUTOS = 15;

/**
 * Quanto tempo a trava dura depois de estourar o limite.
 *
 * Igual à janela de propósito: são a mesma coisa vista de dois lados. Passados
 * 15 minutos sem tentativa nova, as falhas antigas saem da contagem sozinhas e
 * a trava se solta — não é preciso um segundo relógio nem um campo
 * `travado_ate` para expirar. Menos estado, menos jeito de ficar inconsistente.
 */
export const TRAVA_MINUTOS = JANELA_MINUTOS;

export interface EstadoTrava {
  travado: boolean;
  /** Quantas tentativas ainda restam antes de travar. Zero quando travado. */
  restantes: number;
  /** Minutos até destravar, arredondado para cima. Zero quando não travado. */
  minutosParaLiberar: number;
}

/**
 * @param falhas carimbos de tempo das falhas dentro da janela, em qualquer ordem
 * @param agora instante de referência
 */
export function estadoDaTrava(falhas: Date[], agora: Date): EstadoTrava {
  const inicioDaJanela = agora.getTime() - JANELA_MINUTOS * 60_000;
  const naJanela = falhas.filter((d) => d.getTime() > inicioDaJanela);

  if (naJanela.length < LIMITE_TENTATIVAS) {
    return {
      travado: false,
      restantes: LIMITE_TENTATIVAS - naJanela.length,
      minutosParaLiberar: 0,
    };
  }

  // Destrava quando a falha mais antiga da janela sair dela — não quando a
  // mais recente sair. Contar pela mais recente faria cada tentativa nova
  // renovar a punição inteira, e uma trava que se renova sozinha vira trava
  // permanente para quem estiver tentando de boa fé com a senha errada.
  const maisAntiga = Math.min(...naJanela.map((d) => d.getTime()));
  const liberaEm = maisAntiga + TRAVA_MINUTOS * 60_000;
  const faltamMs = Math.max(0, liberaEm - agora.getTime());

  return {
    travado: true,
    restantes: 0,
    minutosParaLiberar: Math.max(1, Math.ceil(faltamMs / 60_000)),
  };
}

/**
 * A mensagem que o dono vê. Diz quanto falta em vez de só recusar, para ele
 * distinguir "errei a senha" de "estou trancado" — sem isso, a trava parece
 * senha errada e ele tenta de novo, o que é exatamente o pior movimento.
 */
export function mensagemDeTrava(estado: EstadoTrava): string {
  const m = estado.minutosParaLiberar;
  return `Tentativas demais. Espere ${m} ${m === 1 ? "minuto" : "minutos"} e tente de novo.`;
}

import "server-only";
import { sql } from "./db";
import { estadoDaTrava, JANELA_MINUTOS, type EstadoTrava } from "@/dominio/travaEntrada";

// Persistência da trava do /entrar. A política mora em
// src/dominio/travaEntrada.ts (pura, testada); aqui só o banco.
//
// Sem guard de acesso, e é de propósito: isto roda **antes** de haver sessão,
// no caminho de quem está tentando entrar. É a única coisa em src/servidor/
// que não chama `exigirAcesso()` e afins, e o motivo é esse. Nada aqui lê nem
// devolve dado do painel — só conta carimbos de tempo.

/** Postgres devolve o `count` de um bigint como string. */
type LinhaFalha = { ocorrida_em: string };

/**
 * Estado atual da trava. Falha do banco não tranca o dono para fora: se a
 * consulta não responder, o /entrar segue sem trava e a senha continua sendo
 * a defesa. A alternativa — recusar quando o banco pisca — transforma um
 * problema de banco em perda de acesso ao painel, que é o inverso do que a
 * trava existe para proteger.
 *
 * Se a tabela ainda não existir (migration 011 não aplicada), o comportamento
 * é o mesmo: sem trava, e o painel funciona. Esta migration não pode ser
 * pré-requisito para entrar.
 */
export async function estadoDaTravaDeEntrada(): Promise<EstadoTrava> {
  try {
    const linhas = (await sql()`
      SELECT ocorrida_em FROM tentativa_entrada
      WHERE ocorrida_em > now() - (${JANELA_MINUTOS} || ' minutes')::interval
    `) as unknown as LinhaFalha[];

    return estadoDaTrava(
      linhas.map((l) => new Date(l.ocorrida_em)),
      new Date(),
    );
  } catch (erro) {
    console.error("[tentativasEntrada] não deu para ler a trava:", erro);
    return { travado: false, restantes: Number.POSITIVE_INFINITY, minutosParaLiberar: 0 };
  }
}

/** Registra uma tentativa que falhou. Silencioso em erro, pelo mesmo motivo acima. */
export async function registrarFalhaDeEntrada(): Promise<void> {
  try {
    await sql()`INSERT INTO tentativa_entrada DEFAULT VALUES`;
  } catch (erro) {
    console.error("[tentativasEntrada] não deu para registrar a falha:", erro);
  }
}

/**
 * Limpa as falhas depois que o dono entra.
 *
 * Duas razões, e a segunda é a que importa: ele não deve começar a sessão
 * seguinte já com metade do orçamento gasto por causa de um erro de digitação
 * de ontem; e o histórico não serve para mais nada depois que a senha certa
 * apareceu — guardar menos é sempre melhor.
 */
export async function limparFalhasDeEntrada(): Promise<void> {
  try {
    await sql()`DELETE FROM tentativa_entrada`;
  } catch (erro) {
    console.error("[tentativasEntrada] não deu para limpar as falhas:", erro);
  }
}

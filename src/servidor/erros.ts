import "server-only";
import { NeonDbError } from "@neondatabase/serverless";

/**
 * Erro cuja mensagem já é segura para chegar ao cliente (explica o que deu
 * errado em termos que o dono entende e, quando possível, o que corrigir).
 * Tudo que não for isto — erro de conexão, de SQL malformado, do driver —
 * vira uma mensagem genérica; o detalhe real vai só para o log do servidor
 * (ver CLAUDE.md, "mensagem de erro para o cliente diz o que dá para
 * corrigir; detalhe interno vai para o log").
 */
export class ErroDados extends Error {}

const MENSAGEM_GENERICA = "Não foi possível completar a operação agora. Tente novamente em instantes.";

/**
 * Converte um erro vindo da camada de acesso a dados em algo seguro de
 * devolver ao cliente. Chame dentro de um `catch` de toda função que fala
 * com o banco; `contexto` é só para o log (nome da função, não vai para o
 * cliente).
 */
export function traduzirErroDeBanco(erro: unknown, contexto: string): Error {
  if (erro instanceof ErroDados) return erro;

  if (erro instanceof NeonDbError) {
    if (erro.code === "23505") {
      // unique_violation — hoje só existe em projeto.repositorio.
      return new ErroDados("Já existe um projeto cadastrado com este repositório.");
    }
    if (erro.code === "23514") {
      // check_violation — a validação da action já deveria ter barrado isto
      // antes de chegar ao banco; se chegou aqui, é defesa de segunda linha.
      return new ErroDados("Dados inválidos para salvar o projeto.");
    }
  }

  console.error(`[db] falha em ${contexto}:`, erro);
  return new Error(MENSAGEM_GENERICA);
}

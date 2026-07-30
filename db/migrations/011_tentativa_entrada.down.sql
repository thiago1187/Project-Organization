-- 011_tentativa_entrada.down.sql
-- Remove a trava de tentativas do /entrar.
--
-- Reverter aqui devolve o painel ao estado em que a senha do dono pode ser
-- adivinhada sem limite, com a única defesa sendo o Vercel Authentication na
-- borda — que é configuração fora do repositório.
--
-- Não há dado a preservar: a tabela guarda só carimbos de tempo de tentativas
-- que falharam, e nada além da trava lê isso.
--
-- Reverta também src/servidor/tentativasEntrada.ts e a chamada em
-- src/servidor/acoes-sessao.ts, ou o /entrar quebra ao consultar uma tabela
-- que não existe — e quebrar o login é pior que não ter trava.

BEGIN;

DROP TABLE tentativa_entrada;

COMMIT;

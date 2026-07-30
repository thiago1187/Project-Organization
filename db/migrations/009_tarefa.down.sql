-- 009_tarefa.down.sql
-- Reverte 009_tarefa.sql: apaga `tarefa` (a trigger some junto com a
-- tabela, como em 001/002/005) e toda tarefa gravada em qualquer projeto.
--
-- Não apaga `contexto_atualizar_timestamp()` — essa função pertence à 001 e
-- continua em uso por `contexto`, `stack`, `servico` e `projeto_agente`; 009
-- só reaproveitou, nunca foi dona dela (mesmo comentário do down de 002 e 005).
--
-- Atenção: isto apaga toda a worklist de todos os projetos. Não há como
-- recuperar sem um backup.

BEGIN;

DROP TABLE tarefa;

COMMIT;

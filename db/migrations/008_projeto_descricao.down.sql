-- 008_projeto_descricao.down.sql
-- Reverte 008_projeto_descricao.sql: remove `projeto.descricao` e a
-- constraint de tamanho junto (o Postgres apaga a constraint automaticamente
-- ao apagar a coluna, mas o DROP explícito abaixo deixa a intenção legível).
--
-- Atenção: isto apaga qualquer descrição já escrita pelo dono em qualquer
-- projeto. Não há como recuperar sem um backup.

BEGIN;

ALTER TABLE projeto DROP CONSTRAINT IF EXISTS projeto_descricao_tamanho_maximo;
ALTER TABLE projeto DROP COLUMN descricao;

COMMIT;

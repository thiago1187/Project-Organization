-- 002_inventario.down.sql
-- Reverte 002_inventario.sql por completo: apaga as tabelas `stack` e `servico`,
-- suas triggers (removidas junto com a tabela) e a função `parece_credencial`.
--
-- Não apaga `contexto_atualizar_timestamp()` — essa função pertence à 001 e
-- continua em uso pela tabela `contexto`; 002 só reaproveitou, nunca foi dona dela.
--
-- Atenção: isto apaga as duas tabelas e todo o dado que estiverem nelas (todo o
-- inventário registrado). Não há outra tabela que referencie stack ou servico,
-- então não há efeito cascata em nada além delas mesmas.

BEGIN;

DROP TABLE servico;
DROP TABLE stack;

DROP FUNCTION parece_credencial(text);

COMMIT;

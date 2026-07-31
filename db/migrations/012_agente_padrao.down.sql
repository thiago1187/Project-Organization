-- 012_agente_padrao.down.sql
-- Reverte 012_agente_padrao.sql: apaga a tabela `agente_padrao` inteira.
--
-- Atenção: isto apaga qualquer padrão global já escrito pelo dono para
-- qualquer agente. Não há como recuperar sem um backup. `projeto_agente`
-- (005) não é afetada — as instruções por projeto continuam onde estavam;
-- só o "reaproveitar em todo projeto" some.
--
-- Reverta também src/servidor/agentesPadrao.ts se este down for aplicado
-- fora de um rollback completo do PR, ou o app tenta consultar uma tabela
-- que não existe. Já degrada sozinho no 42P01 (mesmo padrão de
-- listarAgentesProjeto), então não quebra — só volta a se comportar como se
-- nenhum agente tivesse padrão configurado.

BEGIN;

DROP TABLE agente_padrao;

COMMIT;

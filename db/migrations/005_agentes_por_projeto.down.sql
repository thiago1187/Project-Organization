-- 005_agentes_por_projeto.down.sql
-- Reverte 005_agentes_por_projeto.sql: apaga `projeto_agente` (a trigger some
-- junto com a tabela, como em 001/002) e todo agente ligado/instrução gravada.
--
-- Não apaga `contexto_atualizar_timestamp()` — essa função pertence à 001 e
-- continua em uso por `contexto`, `stack` e `servico`; 005 só reaproveitou,
-- nunca foi dona dela (mesmo comentário do down de 002).
--
-- Atenção: isto apaga toda a configuração de esteira de todos os projetos —
-- quais agentes estavam ligados, em que ordem, e as instruções escritas.
-- Depois deste down, GET /api/projects volta a devolver `agentes` vazio para
-- todo projeto, e a routine cai na lista fixa de sempre (ver o comentário de
-- degradação em src/app/api/projects/route.ts).

BEGIN;

DROP TABLE projeto_agente;

COMMIT;

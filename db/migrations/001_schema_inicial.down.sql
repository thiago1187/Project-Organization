-- 001_schema_inicial.down.sql
-- Reverte 001_schema_inicial.sql por completo.
-- Ordem inversa de dependência: tabelas filhas antes de `projeto`.
--
-- Atenção: isto apaga as tabelas e todo o dado que estiver nelas. Como esta é a
-- primeira migration do projeto, hoje isso significa apagar tudo que o schema guarda.

BEGIN;

-- DROP TABLE já remove, junto com a tabela, qualquer trigger definida sobre ela
-- (sugestao_validar_transicao, contexto_atualizar_timestamp_trigger) — trigger é
-- objeto interno da tabela, não precisa de DROP TRIGGER separado. As FUNCTIONs por
-- trás das triggers, porém, são objetos independentes e sobrevivem à tabela; por
-- isso são derrubadas explicitamente abaixo, depois que nada mais as referencia.
DROP TABLE sugestao;
DROP TABLE relatorio;
DROP TABLE contexto;
DROP TABLE projeto;

DROP FUNCTION sugestao_validar_transicao_estado();
DROP FUNCTION contexto_atualizar_timestamp();

COMMIT;

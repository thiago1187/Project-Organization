-- 003_tetos_tamanho.down.sql
-- Reverte 003_tetos_tamanho.sql: remove os CHECKs de teto de tamanho de relatorio
-- e sugestao, e a função achados_por_agente_dentro_dos_tetos.
--
-- Não apaga dado nenhum — os CHECKs só restringem o que pode ser gravado dali em
-- diante; linhas já existentes (que só podiam já estar dentro dos tetos, já que a
-- validação da rota os aplicava antes de qualquer INSERT/UPDATE) continuam intactas.

BEGIN;

ALTER TABLE sugestao DROP CONSTRAINT sugestao_risco_tamanho_maximo;
ALTER TABLE sugestao DROP CONSTRAINT sugestao_motivo_tamanho_maximo;
ALTER TABLE sugestao DROP CONSTRAINT sugestao_proposta_tamanho_maximo;
ALTER TABLE sugestao DROP CONSTRAINT sugestao_agente_tamanho_maximo;

ALTER TABLE relatorio DROP CONSTRAINT relatorio_achados_dentro_dos_tetos;
DROP FUNCTION achados_por_agente_dentro_dos_tetos(jsonb);

ALTER TABLE relatorio DROP CONSTRAINT relatorio_resumo_tamanho_maximo;

COMMIT;

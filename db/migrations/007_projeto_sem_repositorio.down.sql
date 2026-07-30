-- 007_projeto_sem_repositorio.down.sql
-- Volta `projeto.repositorio` a obrigatório.
--
-- ATENÇÃO: esta reversão FALHA se existir algum projeto sem repositório — e é
-- assim de propósito. Preencher automaticamente com um valor inventado seria
-- pior: o painel passaria a apontar a rodada noturna para um repositório que
-- não existe, e o dono só descobriria pela falha da manhã seguinte.
--
-- Se precisar reverter mesmo assim, decida primeiro o que fazer com esses
-- projetos: apagá-los, ou dar a cada um um repositório de verdade.
--
-- Para ver quais bloqueiam:
--   SELECT id, nome FROM projeto WHERE repositorio IS NULL;

BEGIN;

ALTER TABLE projeto DROP CONSTRAINT projeto_repositorio_nao_vazio;
ALTER TABLE projeto ADD CONSTRAINT projeto_repositorio_nao_vazio CHECK (
  char_length(trim(repositorio)) > 0
);

ALTER TABLE projeto ALTER COLUMN repositorio SET NOT NULL;

COMMIT;

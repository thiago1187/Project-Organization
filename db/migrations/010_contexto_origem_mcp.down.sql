-- 010_contexto_origem_mcp.down.sql
-- Volta `contexto.origem` à lista de um valor só.
--
-- Falha de propósito se existir alguma linha com origem = 'mcp'. Um DOWN que
-- reescrevesse essas linhas como 'painel' apagaria exatamente a informação que
-- a 010 existe para guardar — e o dono ficaria com contexto anexado pelo
-- terminal se passando por contexto que ele digitou, sem sinal nenhum.
--
-- Se você quer mesmo reverter, decida sobre as linhas primeiro: apague-as pela
-- tela, ou aceite explicitamente que elas viram 'painel' rodando o UPDATE
-- comentado abaixo. Reverter não deve ser uma escolha silenciosa quando o que
-- se perde é procedência.
--
-- Reverta também src/servidor/contextos.ts e src/dominio/tipos.ts, ou a
-- aplicação tentará gravar um valor que o banco recusa.

BEGIN;

DO $$
DECLARE
  quantas integer;
BEGIN
  SELECT count(*) INTO quantas FROM contexto WHERE origem = 'mcp';
  IF quantas > 0 THEN
    RAISE EXCEPTION
      'Existem % linhas de contexto com origem = ''mcp''. Reverter apagaria a procedência delas. Decida sobre elas antes (apagar pela tela, ou o UPDATE comentado neste arquivo).', quantas;
  END IF;
END $$;

-- UPDATE contexto SET origem = 'painel' WHERE origem = 'mcp';

ALTER TABLE contexto DROP CONSTRAINT contexto_origem_valida;
ALTER TABLE contexto ADD CONSTRAINT contexto_origem_valida CHECK (origem IN ('painel'));

COMMENT ON COLUMN contexto.origem IS
  'Sempre ''painel'' nesta versão do schema. A rodada noturna não escreve contexto (CLAUDE.md, '
  'regra 4). Atenção: enquanto o servidor MCP existir e puder gravar, esta lista fechada em um '
  'valor deixa a escrita do MCP indistinguível da escrita do dono — foi o que a 010 corrigiu.';

COMMIT;

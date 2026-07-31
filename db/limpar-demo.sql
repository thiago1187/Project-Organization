-- limpar-demo.sql
--
-- Apaga só o dado de demonstração inserido por db/seed.sql — nunca um
-- projeto real. A identificação é a mesma do seed: `projeto.repositorio`
-- começando com o prefixo "demo-seed/". Qualquer projeto sem esse prefixo
-- não é tocado por este arquivo, em nenhuma das duas linhas abaixo.
--
-- Mesma ordem do seed e pelo mesmo motivo: `sugestao` referencia `projeto`
-- com ON DELETE RESTRICT (ela é a evidência do portão de aprovação — ver
-- db/migrations/001_schema_inicial.sql), então precisa ser apagada
-- explicitamente antes do projeto. `relatorio`, `contexto`, `stack`,
-- `servico`, `tarefa` e `projeto_agente` têm ON DELETE CASCADE e somem
-- sozinhos quando o projeto for apagado a seguir.
--
-- Como usar: abra o SQL Editor do Neon (console.neon.tech → o projeto do
-- painel → SQL Editor), cole este arquivo inteiro e rode. As duas linhas
-- rodam dentro de uma única transação — ou apaga tudo, ou não apaga nada.
--
-- Sinal de sucesso: o editor mostra duas mensagens de "DELETE N" (N é a
-- quantidade de linhas apagadas em cada tabela) e nenhum erro. Depois, a
-- tela de Configuração do painel não lista mais nenhum projeto com "(demo)"
-- no nome.

BEGIN;

DELETE FROM sugestao
WHERE projeto_id IN (SELECT id FROM projeto WHERE repositorio LIKE 'demo-seed/%');

DELETE FROM projeto WHERE repositorio LIKE 'demo-seed/%';

COMMIT;

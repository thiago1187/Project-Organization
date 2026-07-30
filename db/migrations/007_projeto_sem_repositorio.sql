-- 007_projeto_sem_repositorio.sql
-- Torna `projeto.repositorio` opcional.
--
-- Por que: o dono tem projetos que vivem inteiros dentro de um connector — um
-- conjunto de workflows no n8n, sem repositório nenhum no GitHub. Hoje eles
-- não entram no painel, porque `repositorio` é NOT NULL, único e validado como
-- "dono/repo".
--
-- A rodada noturna já sabe diagnosticar esse caso: a seção "Connectors: leia à
-- vontade, nunca escreva" em docs/routine-noturna.md diz explicitamente que um
-- projeto pode ser só workflows e que ler o connector é a única forma de
-- diagnosticá-lo. Faltava o painel deixar cadastrar.
--
-- O segundo bloqueio já caiu na 004: `pr_url` deixou de ser obrigatório para
-- marcar uma sugestão como "feita". Sem aquilo, uma sugestão sobre workflow de
-- n8n ficaria presa em "aprovada" para sempre, porque não existe PR para ela.
--
-- O UNIQUE continua, e continua fazendo sentido: em Postgres, NULL não conflita
-- com NULL num índice único, então vários projetos sem repositório convivem, e
-- dois projetos com o MESMO repositório continuam barrados.

BEGIN;

ALTER TABLE projeto ALTER COLUMN repositorio DROP NOT NULL;

-- O CHECK de não-vazio precisa passar a tolerar NULL. Sem isto, `repositorio`
-- nulo violaria a constraint antiga — que exigia comprimento maior que zero
-- sobre um valor que agora pode não existir.
--
-- Repare que string vazia continua proibida: "sem repositório" é NULL, não "".
-- Duas formas de dizer a mesma coisa é como o dado fica ambíguo, e quem
-- consulta passa a precisar testar as duas.
ALTER TABLE projeto DROP CONSTRAINT projeto_repositorio_nao_vazio;
ALTER TABLE projeto ADD CONSTRAINT projeto_repositorio_nao_vazio CHECK (
  repositorio IS NULL OR char_length(trim(repositorio)) > 0
);

COMMENT ON COLUMN projeto.repositorio IS
  'NULL quando o projeto não tem repositório — vive inteiro num connector (n8n, Notion, '
  'Supabase). Nesse caso a rodada não clona nada e diagnostica só pelo connector; ver '
  'docs/routine-noturna.md, "Connectors: leia à vontade, nunca escreva". '
  'Quando presente, é "dono/repo" do GitHub. O UNIQUE tolera vários NULL (em Postgres NULL '
  'não conflita com NULL), então projetos sem repositório convivem sem se atrapalhar.';

COMMIT;

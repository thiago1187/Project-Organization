-- 004_pr_url_opcional.sql
-- Afrouxa `sugestao.pr_url`: deixa de ser obrigatório em "feita" e de exigir
-- github.com. Consequência direta de tirar a execução automática da routine
-- (ver docs/proximos-passos.md item 2, "tirar a execução da routine", e
-- item 4, "projeto sem repositório", que já previa este afrouxamento).
--
-- Antes: a routine executava a sugestão aprovada, sempre abria pull request e
-- só então marcava "feita" com `pr_url` apontando para ele — daí o CHECK
-- exigir o link e o formato `https://github.com/...`.
--
-- Agora: o dono gera um prompt (src/dominio/prompt.ts) e faz o trabalho na
-- hora, com o Claude Code, supervisionado. Trabalho supervisionado pode ir
-- direto para a branch principal (CLAUDE.md > Convenções de trabalho) — não
-- há PR nenhum para linkar. `pr_url` continua existindo para quando houver
-- um link a mostrar (pull request, commit), mas nasce opcional, e quando
-- presente aceita qualquer link https, não só GitHub.
--
-- Esta migration ainda NÃO foi aplicada ao banco — ver db/README.md para o
-- comando de aplicar. Escrever o arquivo não é aplicá-lo. Até ser aplicada,
-- `marcarSugestaoFeita` (src/servidor/sugestoes.ts) sem link falha no banco
-- com um erro claro, em vez de gravar uma linha "feita" sem `pr_url` que o
-- CHECK antigo não permite — a falha é o comportamento esperado enquanto o
-- schema não afrouxou ainda, não um bug a mascarar.

BEGIN;

-- O CHECK antigo (`sugestao_pr_url_formato`, de 001) exigia
-- `^https://github\.com/`. O novo aceita qualquer link https, e adiciona um
-- teto de tamanho — mesmo raciocínio de 003: campo de texto livre sem teto,
-- alimentado por quem preenche um formulário, é a forma mais barata de uma
-- linha ruim degradar a tela mais tarde.
ALTER TABLE sugestao DROP CONSTRAINT sugestao_pr_url_formato;
ALTER TABLE sugestao ADD CONSTRAINT sugestao_pr_url_formato CHECK (
  pr_url IS NULL OR pr_url ~ '^https://'
);
ALTER TABLE sugestao ADD CONSTRAINT sugestao_pr_url_tamanho_maximo CHECK (
  pr_url IS NULL OR char_length(pr_url) <= 2048
);

-- `sugestao_estado_consistente` (de 001) exigia `pr_url IS NOT NULL` para
-- "feita". A versão nova solta essa exigência — "feita" continua exigindo
-- `aprovada_em` e `feita_em` preenchidos e `recusada_em` nulo, mas `pr_url`
-- pode ser nulo ou preenchido. Os outros três estados (pendente, aprovada,
-- recusada) continuam exatamente como em 001: `pr_url` só existe a partir de
-- "feita".
ALTER TABLE sugestao DROP CONSTRAINT sugestao_estado_consistente;
ALTER TABLE sugestao ADD CONSTRAINT sugestao_estado_consistente CHECK (
  (estado = 'pendente' AND aprovada_em IS NULL AND recusada_em IS NULL
    AND feita_em IS NULL AND pr_url IS NULL)
  OR
  (estado = 'aprovada' AND aprovada_em IS NOT NULL AND recusada_em IS NULL
    AND feita_em IS NULL AND pr_url IS NULL)
  OR
  (estado = 'recusada' AND recusada_em IS NOT NULL AND aprovada_em IS NULL
    AND feita_em IS NULL AND pr_url IS NULL)
  OR
  (estado = 'feita' AND aprovada_em IS NOT NULL AND feita_em IS NOT NULL
    AND recusada_em IS NULL)
);

COMMENT ON COLUMN sugestao.pr_url IS
  'Link do que foi feito (pull request, commit), se houver. Opcional mesmo em '
  '"feita": trabalho supervisionado pelo dono pode ir direto para a branch principal, '
  'sem pull request (ver CLAUDE.md > Convenções de trabalho). Quando preenchido, '
  'precisa começar com https:// — qualquer origem, não só GitHub.';

COMMIT;

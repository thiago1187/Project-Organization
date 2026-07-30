-- 004_pr_url_opcional.down.sql
-- Reverte 004_pr_url_opcional.sql: `sugestao.pr_url` volta a ser obrigatório em
-- "feita" e a exigir `https://github.com/`.
--
-- Atenção, diferente dos downs de 002 e 003: isto pode falhar se houver alguma
-- linha "feita" com `pr_url` nulo ou com um link que não é do GitHub — o CHECK
-- que este arquivo recria não aceita esse estado. Se isso acontecer, o ALTER TABLE
-- falha alto (é a transação inteira, então nada fica pela metade) e quem estiver
-- revertendo precisa decidir, linha a linha, o que fazer com essas sugestões antes
-- de tentar de novo. Isso não é bug do down: é o preço de ter afrouxado uma regra
-- e depois querer apertar de novo com dado real já gravado sob a regra frouxa.

BEGIN;

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
    AND recusada_em IS NULL AND pr_url IS NOT NULL)
);

ALTER TABLE sugestao DROP CONSTRAINT sugestao_pr_url_tamanho_maximo;

ALTER TABLE sugestao DROP CONSTRAINT sugestao_pr_url_formato;
ALTER TABLE sugestao ADD CONSTRAINT sugestao_pr_url_formato CHECK (
  pr_url IS NULL OR pr_url ~ '^https://github\.com/'
);

COMMENT ON COLUMN sugestao.pr_url IS NULL;

COMMIT;

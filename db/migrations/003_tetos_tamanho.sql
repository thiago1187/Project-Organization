-- 003_tetos_tamanho.sql
-- Tetos de tamanho em relatorio e sugestao — pendência 2 da revisão de segurança que
-- bloqueava a primeira rodada noturna real. Espelha os tetos já aplicados em
-- src/dominio/validacaoRelatorio.ts e src/dominio/validacaoSugestao.ts (ver o
-- raciocínio completo no topo desses dois arquivos); este arquivo só torna o mesmo
-- limite verdade no banco, não só na rota.
--
-- Escrita a pedido explícito do dono, com os tetos e a justificativa definidos pela
-- tarefa que originou este arquivo. Esta migration ainda NÃO foi aplicada ao banco
-- — ver db/README.md para o comando de aplicar. Escrever o arquivo não é aplicá-lo.
--
-- Por que importa: antes, `resumo`, `proposta`, `motivo`, `risco` e os campos de
-- `achados_por_agente` só eram checados como "não vazio". Um agente em laço grava um
-- resumo gigante, e como GET /api/reports carrega todos os relatórios sem paginação
-- (mesma escala pessoal de tudo neste app), uma linha ruim degradaria todas as telas
-- de uma vez — não é ataque, é a rodada se autossabotando, e ninguém acordado para
-- notar. A validação da rota já rejeita isso com 400 antes de chegar aqui; estes
-- CHECKs são a segunda linha de defesa, para o caso de outro caminho de escrita
-- aparecer no futuro e esquecer de repetir a validação da rota — mesmo raciocínio
-- de contexto_conteudo_tamanho_maximo em 001.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- relatorio
-- ─────────────────────────────────────────────────────────────────────────

-- 4000 caracteres: várias vezes mais que qualquer resumo de rodada visto no
-- seed ou no plano da routine (poucos parágrafos), generoso para uso real.
ALTER TABLE relatorio ADD CONSTRAINT relatorio_resumo_tamanho_maximo CHECK (
  char_length(resumo) <= 4000
);

-- achados_por_agente é jsonb (um array de {agente, achado, selo} por agente que
-- rodou) — CHECK de coluna simples não alcança o conteúdo de cada item nem a
-- quantidade de itens, por isso a validação vive numa função, no mesmo padrão de
-- parece_credencial em 002. Retorna true (não bloqueia) quando o valor nem é um
-- array: essa forma já é responsabilidade de relatorio_achados_e_array (001), e a
-- ordem de avaliação de CHECKs num INSERT/UPDATE não é garantida — a função não
-- deve lançar erro de execução (ex.: jsonb_array_length em algo que não é array)
-- antes que aquele outro CHECK tenha a chance de reportar a causa certa.
CREATE FUNCTION achados_por_agente_dentro_dos_tetos(achados jsonb) RETURNS boolean AS $$
  SELECT CASE
    WHEN jsonb_typeof(achados) IS DISTINCT FROM 'array' THEN true
    -- 20 itens: mais que qualquer conjunto plausível de agentes numa rodada
    -- (ver ~/.claude/agents); existe para não deixar o array crescer sem
    -- limite, não porque 20 seja um número especial.
    WHEN jsonb_array_length(achados) > 20 THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(achados) AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
         -- 64: mesmo teto de contexto.agente_destino (001) — é um nome de
         -- agente, não corpo de texto.
         OR char_length(item->>'agente') > 64
         -- 2000: o relato de um agente sobre o que encontrou é mais curto
         -- que o resumo da rodada inteira.
         OR char_length(item->>'achado') > 2000
         -- 120: é um rótulo curto ("142 verdes", "3 sugestões"), não uma frase.
         OR char_length(item->>'selo') > 120
    )
  END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION achados_por_agente_dentro_dos_tetos(jsonb) IS
  'Teto de tamanho por item (agente, achado, selo) e de quantidade de itens em '
  'relatorio.achados_por_agente. Devolve true para valor que não é array — essa '
  'forma é responsabilidade de relatorio_achados_e_array (001), não desta função.';

ALTER TABLE relatorio ADD CONSTRAINT relatorio_achados_dentro_dos_tetos CHECK (
  achados_por_agente_dentro_dos_tetos(achados_por_agente)
);

-- ─────────────────────────────────────────────────────────────────────────
-- sugestao
-- ─────────────────────────────────────────────────────────────────────────

-- 64: mesmo teto de contexto.agente_destino (001) e de
-- achados_por_agente[].agente acima — é um nome de agente, não corpo de texto.
ALTER TABLE sugestao ADD CONSTRAINT sugestao_agente_tamanho_maximo CHECK (
  char_length(agente) <= 64
);

-- 500: o protocolo de sugestões (CLAUDE.md) pede "a mudança, em uma frase";
-- 500 caracteres já é generoso para uma frase.
ALTER TABLE sugestao ADD CONSTRAINT sugestao_proposta_tamanho_maximo CHECK (
  char_length(proposta) <= 500
);

-- 2000: parágrafo curto ("o que dói hoje por não ter isso"), tende a precisar
-- de mais contexto que risco.
ALTER TABLE sugestao ADD CONSTRAINT sugestao_motivo_tamanho_maximo CHECK (
  char_length(motivo) <= 2000
);

-- 1000: parágrafo mais curto que motivo ("o que pode quebrar").
ALTER TABLE sugestao ADD CONSTRAINT sugestao_risco_tamanho_maximo CHECK (
  char_length(risco) <= 1000
);

COMMIT;

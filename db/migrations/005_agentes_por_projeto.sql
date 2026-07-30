-- 005_agentes_por_projeto.sql
-- Esteira de agentes por projeto: qual agente diagnostica cada projeto, em que
-- ordem, e com que instrução. Resolve a lacuna registrada em
-- docs/proximos-passos.md ("12 dos 16 agentes nunca rodam" — o prompt da
-- routine tinha quatro agentes fixos, escritos à mão, iguais em todo
-- projeto). Desenho completo em docs/plano-agentes-por-projeto.md § 3.1.
--
-- Numeração: o plano chamava esta migration de "004", escrita antes de a 004
-- real (pr_url_opcional) existir. Esta é a 005.
--
-- Esta migration está escrita e ainda NÃO foi aplicada ao banco — trava de
-- schema (ver CLAUDE.md), mesma situação de 002, 003 e 004. Ver db/README.md
-- para o comando de aplicar quando o dono decidir.
--
-- Fronteira que este schema respeita (plano § 3.3): instrução é o que o
-- agente deve fazer aqui; contexto é o que ele deve ler. `instrucao` vai para
-- a chamada do subagente; `contexto` (001) continua sendo o que a routine
-- escreve no CLAUDE.md do repositório alvo. São colunas diferentes, em
-- tabelas diferentes, porque têm destino diferente — o plano descartou
-- explicitamente guardar instrução como uma linha de `contexto` com
-- `tipo = 'instrucao'` (ver o raciocínio completo no § 3.3 do plano).

BEGIN;

CREATE TABLE projeto_agente (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id     uuid        NOT NULL,
  agente         text        NOT NULL, -- texto livre, sem lista fechada — ver comentário abaixo
  habilitado     boolean     NOT NULL DEFAULT true,
  ordem          integer     NOT NULL DEFAULT 0, -- sem UNIQUE, de propósito — ver comentário abaixo
  instrucao      text,                 -- o que este agente deve fazer, especificamente, neste projeto
  teto_sugestoes smallint,             -- NULL = herda o teto global (3, ver docs/routine-noturna.md)
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_agente_pkey PRIMARY KEY (id),
  CONSTRAINT projeto_agente_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,
  -- Um agente aparece uma vez por projeto — ligar de novo o mesmo agente
  -- atualiza a linha existente (upsert), não cria uma segunda.
  CONSTRAINT projeto_agente_projeto_agente_key UNIQUE (projeto_id, agente),

  CONSTRAINT projeto_agente_agente_nao_vazio CHECK (char_length(trim(agente)) > 0),
  -- `agente` vira rótulo de card na esteira e entra em achados_por_agente e
  -- sugestao.agente pela mesma rota que hoje — mesmos CHECKs de
  -- contexto.agente_destino (001) e sugestao.agente (003): sem caractere de
  -- controle, teto de 64 (é um nome de agente, não corpo de texto).
  CONSTRAINT projeto_agente_agente_sem_controle CHECK (agente !~ '[[:cntrl:]]'),
  CONSTRAINT projeto_agente_agente_tamanho_maximo CHECK (char_length(agente) <= 64),

  -- instrucao é texto livre (corpo, não rótulo) — sem checagem de caractere de
  -- controle, mesmo raciocínio de contexto.conteudo (001): pode ter quebra de
  -- linha. Regra 6 do CLAUDE.md exige teto de tamanho porque isto vai para a
  -- chamada de um subagente que age — 4000 caracteres é uma ordem de serviço,
  -- não um documento; material longo continua em `contexto` (teto de 20000).
  CONSTRAINT projeto_agente_instrucao_tamanho_maximo CHECK (
    instrucao IS NULL OR char_length(instrucao) <= 4000
  ),

  -- Único limite estruturado desta migration (plano § 3.1) — os demais
  -- limites esperam uma rodada real para calibrar. NULL herda o teto global.
  CONSTRAINT projeto_agente_teto_sugestoes_intervalo CHECK (
    teto_sugestoes IS NULL OR teto_sugestoes BETWEEN 0 AND 3
  ),

  CONSTRAINT projeto_agente_ordem_nao_negativa CHECK (ordem >= 0)
);

COMMENT ON TABLE projeto_agente IS
  'Esteira de agentes de um projeto: quais diagnosticam (habilitado), em que ordem, '
  'e com que instrução específica. Só a banda de diagnóstico é configurável aqui — '
  'não existe (e não deve existir) uma coluna que decida quem executa; quem escreve '
  'é sempre o dono, pelo prompt gerado no painel (ver docs/proximos-passos.md).';

COMMENT ON COLUMN projeto_agente.agente IS
  'Texto livre, sem lista fechada — mesmo raciocínio de relatorio.achados_por_agente '
  '(001) e sugestao.agente: não há tabela de catálogo aqui porque a fonte de verdade '
  '(~/.claude/agents/) vive fora deste banco, na máquina do dono. A cópia de '
  'apresentação (mono, papel, tipo) fica em src/dominio/papeis.ts, que um PR revisa — '
  'ver docs/plano-agentes-por-projeto.md § 3.3, "Alternativas descartadas".';

COMMENT ON COLUMN projeto_agente.ordem IS
  'Sem UNIQUE de propósito (plano § 3.1): reordenar com constraint única exige '
  'constraint deferida ou UPDATE em duas passadas — complexidade real para uma lista '
  'de no máximo 16 itens. Empate é desempatado alfabeticamente na aplicação '
  '(src/dominio/esteiraAgentes.ts). Só ordena os habilitados; agente desligado não '
  'participa da ordem.';

COMMENT ON COLUMN projeto_agente.instrucao IS
  'O que este agente deve fazer, especificamente, neste projeto — vai para a chamada '
  'do subagente, nunca para o CLAUDE.md do repositório alvo. Diferente de `contexto` '
  '(001), que é o que o agente deve ler e é escrito no CLAUDE.md. Entrada não '
  'confiável (regra 6 do CLAUDE.md): validar tamanho na rota/action, nunca interpolar '
  'em comando de sistema nem em query.';

COMMENT ON COLUMN projeto_agente.teto_sugestoes IS
  'NULL herda o teto global de 3 por projeto por rodada (docs/routine-noturna.md, '
  'passo 2.4). Quando presente, é um teto mais apertado para este agente neste '
  'projeto — nunca um teto mais largo que o global; o passo 2.4 continua limitando '
  'a três por projeto por cima de qualquer configuração.';

-- Reaproveita a função de trigger já criada em 001 para contexto (só lê/escreve
-- NEW.atualizado_em, não referencia nenhuma coluna específica de contexto) —
-- mesmo padrão de stack/servico em 002.
CREATE TRIGGER projeto_agente_atualizar_timestamp_trigger
  BEFORE UPDATE ON projeto_agente
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- Índice — só o que a tela de detalhe e GET /api/projects de fato consultam:
-- todos os agentes configurados de um projeto (ou de todos os projetos, para
-- a rota, que filtra em memória como já faz com contexto e sugestao). Sem
-- segundo campo (ordem): a lista tem no máximo 16 linhas por projeto e a
-- ordenação acontece em src/dominio/esteiraAgentes.ts, não no banco.
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX projeto_agente_projeto_idx ON projeto_agente (projeto_id);

COMMIT;

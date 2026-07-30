-- 009_tarefa.sql
-- Adiciona `tarefa`: a worklist do dono por projeto — "o que estamos fazendo
-- nele". Desenho completo em docs/plano-gerenciador-de-projeto.md § 3.2-3.5.
--
-- Numeração: o plano chamava esta migration de "007", escrita antes de a 007
-- real (projeto_sem_repositorio) existir. Esta é a 009, logo depois da 008
-- (projeto.descricao).
--
-- A decisão que importa, e que esta migration não repete no meio do arquivo
-- (ver o plano § 3.3 para o argumento inteiro): `tarefa` NÃO se funde com
-- `sugestao`, em nenhuma direção, e não tem FK para ela. São inbox e
-- worklist, com garantias diferentes — `sugestao` (001) é evidência do
-- portão de aprovação (ON DELETE RESTRICT, trigger de transição de estado);
-- `tarefa` é material do dono, que ele pode apagar e reordenar livremente.
-- Fundir as duas exigiria afrouxar a auditoria do mecanismo central de
-- segurança do sistema para ganhar uma lista de afazeres. As duas se
-- encontram na tela (união com selo de origem), nunca no banco.
--
-- Esta migration está escrita e ainda NÃO foi aplicada ao banco — trava de
-- schema (ver CLAUDE.md). Ver db/README.md para o comando de aplicar quando
-- o dono decidir.

BEGIN;

CREATE TABLE tarefa (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id     uuid        NOT NULL,
  titulo         text        NOT NULL,
  estado         text        NOT NULL DEFAULT 'aberta',
  ordem          integer     NOT NULL DEFAULT 0, -- sem UNIQUE, de propósito — ver comentário abaixo
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  concluida_em   timestamptz,

  CONSTRAINT tarefa_pkey PRIMARY KEY (id),
  -- ON DELETE CASCADE, não RESTRICT: tarefa é material substituível, mesma
  -- categoria de relatorio/contexto/stack/servico (001, 002) — não é
  -- evidência de portão nenhum, ao contrário de sugestao (ON DELETE
  -- RESTRICT, ver o comentário do topo do arquivo).
  CONSTRAINT tarefa_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,

  -- titulo é rótulo curto de uma linha que atravessa GET /api/projects,
  -- entra no bloco contexto-do-painel do CLAUDE.md alvo e vai para a área de
  -- transferência do dono no prompt gerado (src/dominio/prompt.ts). Os três
  -- CHECKs abaixo existem pelo mesmo motivo: sem a checagem de controle, um
  -- "\n" no título vira estrutura de documento naquele bloco — exatamente o
  -- que contexto.tipo já barra na 001. `parece_credencial` é a mesma
  -- checagem que stack.nome/servico.nome já usam (002): título de tarefa é
  -- rótulo curto, não prosa — o falso positivo aqui é raro, diferente de
  -- projeto.descricao (008), que é corpo de texto e por isso não usa a
  -- mesma função.
  CONSTRAINT tarefa_titulo_nao_vazio CHECK (char_length(trim(titulo)) > 0),
  CONSTRAINT tarefa_titulo_tamanho_maximo CHECK (char_length(titulo) <= 200),
  CONSTRAINT tarefa_titulo_sem_controle CHECK (titulo !~ '[[:cntrl:]]'),
  CONSTRAINT tarefa_titulo_nao_parece_credencial CHECK (NOT parece_credencial(titulo)),

  CONSTRAINT tarefa_estado_valido CHECK (estado IN ('aberta', 'fazendo', 'feita')),

  -- Sem UNIQUE em ordem, mesmo raciocínio já registrado em projeto_agente
  -- (005): reordenar com constraint única exige constraint deferida ou
  -- UPDATE em duas passadas — complexidade real para uma lista de dezenas
  -- de itens. Empate desempata por criado_em na aplicação.
  CONSTRAINT tarefa_ordem_nao_negativa CHECK (ordem >= 0),

  -- Espelha sugestao_estado_consistente (001) para a única coluna de
  -- timestamp condicional desta tabela: só "feita" tem concluida_em
  -- preenchido.
  CONSTRAINT tarefa_concluida_em_consistente CHECK (
    (estado = 'feita' AND concluida_em IS NOT NULL) OR
    (estado <> 'feita' AND concluida_em IS NULL)
  )
);

COMMENT ON TABLE tarefa IS
  'Worklist do dono por projeto — o que ele está fazendo, declarado por ele, não derivado '
  'de rodada nenhuma. Não é sugestao e não vira sugestao: ver o comentário no topo deste '
  'arquivo e docs/plano-gerenciador-de-projeto.md § 3.3 para o argumento completo.';

COMMENT ON COLUMN tarefa.estado IS
  '''aberta'' | ''fazendo'' | ''feita''. ''fazendo'' existe para dar título ao painel '
  '"onde estamos" — sem ele o bloco só diz "5 tarefas abertas"; com ele, "agora: <titulo>". '
  'Sem UNIQUE parcial garantindo no máximo uma ''fazendo'' por projeto: a constraint '
  'forçaria a tela a tratar um conflito em troca de uma disciplina que o dono consegue '
  'manter sozinho numa lista de dezenas de itens — se ele marcar duas, o painel mostra '
  'duas, e isso também é informação honesta (plano § 3.5).';

-- Sem trigger de transição de estado, ao contrário de sugestao (001) — e o
-- contraste é deliberado, não um esquecimento. A trigger de sugestao existe
-- porque aquela tabela tem dois escritores (painel e routine, via bypass) e
-- a máquina de estados É o portão de segurança: pendente → feita num UPDATE
-- só daria à routine o poder de se auto-aprovar. `tarefa` tem um escritor só
-- — o painel, sempre atrás de `exigirSessaoDoDono()` — e não é evidência de
-- portão nenhum. `feita → aberta` é uma transição legítima aqui ("voltei
-- atrás"), diferente de sugestao, onde voltar atrás apagaria evidência de
-- uma decisão já tomada. Trigger nesta tabela seria cerimônia copiada, não
-- defesa.

-- Reaproveita a função de trigger já criada em 001 para contexto — mesmo
-- padrão de stack/servico (002) e projeto_agente (005).
CREATE TRIGGER tarefa_atualizar_timestamp_trigger
  BEFORE UPDATE ON tarefa
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- Índice — só o que a tela de detalhe e GET /api/projects de fato consultam:
-- todas as tarefas de um projeto. Mesma escala pessoal e mesma ausência de
-- índice automático em FK já registradas em 001, 002 e 005.
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX tarefa_projeto_idx ON tarefa (projeto_id);

COMMIT;

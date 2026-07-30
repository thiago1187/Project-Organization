-- 001_schema_inicial.sql
-- Schema mínimo do painel: projeto, relatorio, sugestao, contexto.
-- Ver CLAUDE.md > "Modelo de dados" e "Protocolo de sugestões" para o desenho de origem.
--
-- Não contém segredo nenhum. Não contém dado de exemplo.
-- Aprovado explicitamente pelo dono para a criação da tabela `sugestao`,
-- estendido ao schema mínimo inteiro porque `sugestao` referencia `projeto`
-- e as quatro tabelas fazem sentido apenas como unidade (ver resumo enviado ao dono).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- projeto
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE projeto (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  repositorio text        NOT NULL, -- "owner/repo" do GitHub, ex.: gravidade/cofre-rotinas
  frequencia  text        NOT NULL,
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_pkey PRIMARY KEY (id),
  CONSTRAINT projeto_repositorio_key UNIQUE (repositorio),
  CONSTRAINT projeto_nome_nao_vazio CHECK (char_length(trim(nome)) > 0),
  CONSTRAINT projeto_repositorio_nao_vazio CHECK (char_length(trim(repositorio)) > 0),
  CONSTRAINT projeto_frequencia_valida CHECK (
    frequencia IN ('toda_madrugada', 'dias_alternados', 'semanal')
  )
);

COMMENT ON TABLE projeto IS
  'Projeto monitorado. Frequência de visita e ativo/pausado são atributos independentes: '
  'pausar não muda a frequência configurada, só interrompe as rodadas. '
  'Não há rota de apagar projeto — a tela de Configuração cadastra, edita, ativa e pausa; '
  'pausar já é o caminho para desativar sem perder histórico. Quem for escrever as rotas '
  'depois não deve criar um DELETE por reflexo.';

-- ─────────────────────────────────────────────────────────────────────────
-- relatorio
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE relatorio (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id          uuid        NOT NULL,
  executado_em        timestamptz NOT NULL DEFAULT now(),
  status              text        NOT NULL,
  resumo              text        NOT NULL,
  testes_passaram     boolean,
  achados_por_agente  jsonb       NOT NULL DEFAULT '[]'::jsonb,

  CONSTRAINT relatorio_pkey PRIMARY KEY (id),
  CONSTRAINT relatorio_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,
  CONSTRAINT relatorio_resumo_nao_vazio CHECK (char_length(trim(resumo)) > 0),
  CONSTRAINT relatorio_status_valido CHECK (status IN ('ok', 'atencao', 'falha')),
  CONSTRAINT relatorio_achados_e_array CHECK (jsonb_typeof(achados_por_agente) = 'array')
);

COMMENT ON TABLE relatorio IS
  'Diagnóstico de uma rodada noturna para um projeto. Não representa mudança de código — '
  'só o que foi encontrado (ver regra "a rodada noturna não altera código" no CLAUDE.md).';

COMMENT ON COLUMN relatorio.achados_por_agente IS
  'Array JSON, um item por agente que rodou nessa rodada: '
  '[{"agente": "qa-testes", "achado": "142 testes, todos passando.", "selo": "142 verdes"}, ...]. '
  'Nomes de agente são texto livre (definidos fora deste banco, em ~/.claude/agents) — '
  'não há lista fechada aqui para não travar quando um agente novo aparecer.';

-- ─────────────────────────────────────────────────────────────────────────
-- sugestao
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE sugestao (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id       uuid        NOT NULL,
  agente           text        NOT NULL,
  proposta         text        NOT NULL,
  motivo           text        NOT NULL,
  esforco          text        NOT NULL,
  risco            text        NOT NULL,
  reversibilidade  text        NOT NULL,
  estado           text        NOT NULL DEFAULT 'pendente',
  criada_em        timestamptz NOT NULL DEFAULT now(),
  aprovada_em      timestamptz,
  recusada_em      timestamptz,
  feita_em         timestamptz,
  pr_url           text,

  CONSTRAINT sugestao_pkey PRIMARY KEY (id),
  CONSTRAINT sugestao_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE RESTRICT,
  CONSTRAINT sugestao_agente_nao_vazio CHECK (char_length(trim(agente)) > 0),
  CONSTRAINT sugestao_proposta_nao_vazia CHECK (char_length(trim(proposta)) > 0),
  CONSTRAINT sugestao_motivo_nao_vazio CHECK (char_length(trim(motivo)) > 0),
  CONSTRAINT sugestao_risco_nao_vazio CHECK (char_length(trim(risco)) > 0),
  CONSTRAINT sugestao_esforco_valido CHECK (esforco IN ('pequeno', 'medio', 'grande')),
  CONSTRAINT sugestao_reversibilidade_valida CHECK (
    reversibilidade IN ('facil', 'dificil', 'nao_reverte')
  ),
  CONSTRAINT sugestao_estado_valido CHECK (estado IN ('pendente', 'aprovada', 'recusada', 'feita')),
  CONSTRAINT sugestao_pr_url_formato CHECK (
    pr_url IS NULL OR pr_url ~ '^https://github\.com/'
  ),

  -- Este CHECK garante que a combinação de colunas é consistente com o estado
  -- (ex.: só "feita" tem pr_url preenchido; "aprovada" não pode mais pré-carregar
  -- a URL antes da hora, o que fecharia a porta para um UPDATE dela sozinha virar
  -- "feita"). Mas um CHECK só vê a linha final de um UPDATE — sozinho, ele não
  -- impede um UPDATE que pule direto de "pendente" para "feita" gravando tudo de
  -- uma vez (aprovada_em, feita_em e pr_url no mesmo comando). Quem barra esse
  -- salto é a trigger `sugestao_validar_transicao_estado`, criada logo abaixo, que
  -- compara OLD.estado com NEW.estado e só libera pendente→aprovada,
  -- pendente→recusada ou aprovada→feita. CHECK e trigger juntos são a segunda
  -- linha de defesa da máquina de estados, porque a aplicação tem mais de um
  -- caminho de escrita (painel e routine) para esta tabela.
  CONSTRAINT sugestao_estado_consistente CHECK (
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
  ),

  -- Ordem temporal das transições: não dá pra ter sido aprovada antes de criada,
  -- nem marcada como feita antes de aprovada. NULL em qualquer lado faz a
  -- comparação inteira virar NULL, e um CHECK trata NULL como "não violado" —
  -- então isto não interfere nos estados que ainda não chegaram lá.
  CONSTRAINT sugestao_transicoes_ordenadas CHECK (
    criada_em <= aprovada_em AND aprovada_em <= feita_em
  )
);

COMMENT ON TABLE sugestao IS
  'Proposta de um agente para um projeto. Nasce pendente; só vira trabalho depois de '
  'aprovada pelo dono no painel — a routine nunca executa sugestão não aprovada.';

COMMENT ON CONSTRAINT sugestao_projeto_fkey ON sugestao IS
  'ON DELETE RESTRICT, deliberadamente diferente de relatorio e contexto (CASCADE). '
  'sugestao é o registro de o que foi aprovado, quando e qual PR saiu disso — é a '
  'evidência do gate de aprovação, que é o mecanismo central de segurança do sistema. '
  'Apagar isso junto com um projeto destruiria a auditoria em silêncio. Não há hoje '
  'rota de apagar projeto (ver comentário em projeto), então este RESTRICT não deve '
  'nunca ser atingido em uso normal — ele existe para barrar alto se algo tentar.';

-- Trigger: a única defesa que enxerga OLD e NEW ao mesmo tempo. O CHECK acima
-- valida a forma de uma linha isolada; esta trigger valida o caminho entre duas
-- linhas — é o que fecha o furo de um UPDATE pular direto de pendente para feita
-- (o que daria à routine, via bypass header, o poder de se auto-aprovar).
CREATE FUNCTION sugestao_validar_transicao_estado() RETURNS trigger AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.estado = 'pendente' AND NEW.estado = 'aprovada') OR
    (OLD.estado = 'pendente' AND NEW.estado = 'recusada') OR
    (OLD.estado = 'aprovada' AND NEW.estado = 'feita')
  ) THEN
    RAISE EXCEPTION 'transição de estado inválida em sugestao: % -> % (id=%)',
      OLD.estado, NEW.estado, OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sugestao_validar_transicao
  BEFORE UPDATE ON sugestao
  FOR EACH ROW
  EXECUTE FUNCTION sugestao_validar_transicao_estado();

-- ─────────────────────────────────────────────────────────────────────────
-- contexto
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE contexto (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id      uuid        NOT NULL,
  agente_destino  text        NOT NULL, -- agente ao qual este material se destina, ex.: "designer-ui"
  tipo            text        NOT NULL, -- livre, ex.: "modelo de design", "notas", "restrições"
  conteudo        text,
  arquivo_url     text,
  -- Ver CLAUDE.md regra 4 (exceção deliberada): PUT /api/context/:projeto exige
  -- sessão autenticada e recusa o header de bypass — a routine só lê contexto,
  -- nunca escreve. Esta coluna não autoriza nada sozinha; ela existe para que uma
  -- escrita vinda de outra procedência seja impossível de disfarçar de legítima, e
  -- para que a lista de valores permitidos ('painel') seja o lugar óbvio de mexer
  -- se essa regra mudar um dia.
  origem          text        NOT NULL DEFAULT 'painel',
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contexto_pkey PRIMARY KEY (id),
  CONSTRAINT contexto_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,
  -- PUT /api/context/:projeto tem semântica de substituição, não de acúmulo:
  -- no máximo um contexto por combinação de projeto + agente + tipo.
  CONSTRAINT contexto_projeto_agente_tipo_key UNIQUE (projeto_id, agente_destino, tipo),
  CONSTRAINT contexto_agente_destino_nao_vazio CHECK (char_length(trim(agente_destino)) > 0),
  CONSTRAINT contexto_tipo_nao_vazio CHECK (char_length(trim(tipo)) > 0),
  CONSTRAINT contexto_tem_conteudo_ou_arquivo CHECK (
    conteudo IS NOT NULL OR arquivo_url IS NOT NULL
  ),
  -- Regra 6: contexto é dado, não instrução, e vai ser escrito no CLAUDE.md de outro
  -- repositório. Teto de tamanho para não empurrar as regras reais do projeto alvo
  -- para fora da janela de contexto do agente.
  CONSTRAINT contexto_conteudo_tamanho_maximo CHECK (
    conteudo IS NULL OR char_length(conteudo) <= 20000
  ),
  -- arquivo_url é buscado pela routine para montar o CLAUDE.md — restringe a https
  -- para não abrir "file:///" ou endereço de metadados de instância (SSRF) a partir
  -- do ambiente que tem o bypass secret e a DATABASE_URL.
  CONSTRAINT contexto_arquivo_url_formato CHECK (
    arquivo_url IS NULL OR arquivo_url ~ '^https://'
  ),
  -- agente_destino e tipo viram rótulo/cabeçalho de seção no CLAUDE.md montado — sem
  -- caractere de controle (inclui \n) para não virarem estrutura de documento, e com
  -- teto de tamanho porque rótulo não é corpo de texto.
  CONSTRAINT contexto_agente_destino_sem_controle CHECK (agente_destino !~ '[[:cntrl:]]'),
  CONSTRAINT contexto_agente_destino_tamanho_maximo CHECK (char_length(agente_destino) <= 64),
  CONSTRAINT contexto_tipo_sem_controle CHECK (tipo !~ '[[:cntrl:]]'),
  CONSTRAINT contexto_tipo_tamanho_maximo CHECK (char_length(tipo) <= 64),
  CONSTRAINT contexto_origem_valida CHECK (origem IN ('painel'))
);

COMMENT ON TABLE contexto IS
  'Material que o dono anexa por projeto e por agente. É dado, não instrução: a routine '
  'escreve isto no CLAUDE.md do repositório alvo antes de acionar os agentes (ver regra 6).';

COMMENT ON COLUMN contexto.origem IS
  'Sempre ''painel''. PUT /api/context/:projeto exige sessão autenticada e recusa o '
  'header de bypass — a routine lê contexto, nunca escreve. Lista fechada a um único '
  'valor de propósito: torna impossível uma escrita de outra procedência se passar '
  'por legítima, e deixa explícito onde mexer se essa regra mudar.';

-- Sem isto, atualizado_em ficaria congelado no valor de criado_em para sempre: o
-- DEFAULT só roda no INSERT, nunca num UPDATE subsequente.
CREATE FUNCTION contexto_atualizar_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contexto_atualizar_timestamp_trigger
  BEFORE UPDATE ON contexto
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- Índices — só o que GET /api/projects e a tela de detalhe de fato consultam.
-- ─────────────────────────────────────────────────────────────────────────

-- Histórico de rodadas de um projeto, mais recente primeiro (tela de detalhe).
CREATE INDEX relatorio_projeto_executado_idx
  ON relatorio (projeto_id, executado_em DESC);

-- Fila de sugestões de um projeto (tela de detalhe, qualquer estado) e sugestões
-- aprovadas de projetos ativos (GET /api/projects) — as duas consultas usam
-- projeto_id como prefixo, então um único índice composto cobre ambas.
CREATE INDEX sugestao_projeto_estado_idx
  ON sugestao (projeto_id, estado);

-- Contexto de um projeto (GET /api/projects e GET/PUT /api/context/:projeto): sem
-- índice dedicado. O índice único de contexto_projeto_agente_tipo_key já começa
-- com projeto_id, então o mesmo prefixo cobre "todo o contexto de um projeto" —
-- um segundo índice só nessa coluna seria redundante.

-- Sem índice em projeto.ativo: a tabela é de escala pessoal (dezenas de linhas,
-- não milhares) e um booleano tem seletividade baixa demais para valer o índice.

COMMIT;

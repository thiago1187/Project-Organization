-- 002_inventario.sql
-- Inventário de projeto: o que tem dentro de cada projeto — stack de tecnologia e
-- serviços/contas externos, e onde cada um é administrado.
-- Ver docs/visao.md > "O que falta ser desenhado" para o problema de origem, e
-- CLAUDE.md > regra 1 (segredo só existe no servidor) para o limite que este
-- desenho não pode cruzar.
--
-- Escrita a pedido explícito do dono, com a especificação completa de campos e
-- decisões definida por ele na tarefa que originou este arquivo. Esta migration
-- ainda NÃO foi aplicada ao banco — ver db/README.md para o comando de aplicar.
-- Escrever o arquivo não é aplicá-lo; a aplicação em produção continua sendo uma
-- decisão separada, tomada por quem roda o `psql`.
--
-- Inventário não é credencial (ver docs/visao.md). Este schema não tem — e não
-- pode ganhar depois, sem nova migration revisada — nenhuma coluna cujo propósito
-- seja guardar um valor de credencial. Não é questão de disciplina de quem
-- preenche: é a ausência estrutural do campo.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- parece_credencial(text) — tripwire, não muralha.
--
-- Usada pelos CHECKs abaixo em todo campo de texto livre destas duas tabelas.
-- Reconhece formatos literais e comuns de segredo: string de conexão com
-- usuário:senha embutido (qualquer protocolo, não só postgres://), chave estilo
-- OpenAI/Anthropic/Stripe (sk-...), access key id da AWS (AKIA...), token do
-- GitHub (ghp_/gho_/ghu_/ghs_/ghr_...), token do Slack (xox...) e JWT
-- (eyJ...eyJ... ou eyJ...<payload>, cabeçalho base64url reconhecível).
--
-- Avaliação honesta, para quem for confiar nisto depois: é uma lista de
-- padrões conhecidos, não uma análise de entropia nem um scanner de segredo de
-- verdade. Ela pega o acidente mais óbvio e mais provável — colar de reflexo
-- uma string de conexão ou uma chave inteira num campo de rótulo, às 2h da
-- manhã. Ela não pega senha comum, token sem prefixo reconhecível, nem segredo
-- descrito em prosa ("a senha é..."). Não é proteção real; é um alarme barato
-- para o erro mais burro. A proteção real deste schema é estrutural: não existe
-- coluna chamada valor/chave/token/segredo, e os campos de texto livre que
-- existem são rótulos curtos (teto de 120 caracteres), não um lugar óbvio para
-- colar um segredo inteiro.
CREATE FUNCTION parece_credencial(valor text) RETURNS boolean AS $$
  SELECT valor ~* (
    '[a-z][a-z0-9+.-]*://[^/\s@]+:[^/\s@]+@' ||  -- scheme://usuario:senha@ (qualquer protocolo)
    '|sk-[a-z0-9_-]{10,}' ||                      -- chave estilo OpenAI/Anthropic/Stripe
    '|akia[0-9a-z]{12,}' ||                       -- AWS access key id
    '|gh[pousr]_[a-z0-9]{20,}' ||                 -- token do GitHub (pessoal/oauth/app/instalação)
    '|xox[baprs]-[a-z0-9-]{6,}' ||                -- token do Slack
    '|eyj[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}'        -- JWT (cabeçalho.payload em base64url)
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION parece_credencial(text) IS
  'Tripwire anti-credencial para os CHECKs de stack e servico: reconhece formatos '
  'literais comuns (string de conexão com usuário:senha, sk-..., AKIA..., ghp_..., '
  'xox..., JWT). Não é uma proteção real — não pega segredo sem prefixo reconhecível '
  'nem segredo descrito em prosa. Barra o acidente mais óbvio; não substitui a '
  'ausência estrutural de coluna para valor de credencial, que é a proteção de fato.';

-- ─────────────────────────────────────────────────────────────────────────
-- stack
--
-- Linguagem, framework e runtime do projeto. Tabela separada de `servico`
-- porque não tem conta nem lugar de administração — não faz sentido perguntar
-- "em qual conta" ou "onde administro" de uma linguagem de programação. Se
-- estivesse na mesma tabela que serviço, toda linha de stack teria conta,
-- papel e administrado_url sempre nulos: exatamente a tabela com metade das
-- colunas sempre nulas que o desenho deve evitar.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE stack (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id     uuid        NOT NULL,
  categoria      text        NOT NULL,
  nome           text        NOT NULL, -- ex.: "TypeScript", "Next.js", "Node.js 20"
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stack_pkey PRIMARY KEY (id),
  CONSTRAINT stack_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,
  CONSTRAINT stack_categoria_valida CHECK (categoria IN ('linguagem', 'framework', 'runtime')),
  CONSTRAINT stack_nome_nao_vazio CHECK (char_length(trim(nome)) > 0),
  CONSTRAINT stack_nome_tamanho_maximo CHECK (char_length(nome) <= 120),
  CONSTRAINT stack_nome_sem_controle CHECK (nome !~ '[[:cntrl:]]'),
  CONSTRAINT stack_nome_nao_parece_credencial CHECK (NOT parece_credencial(nome))
);

COMMENT ON TABLE stack IS
  'Linguagem, framework e runtime de um projeto. Não tem conta nem administrado_url '
  'de propósito — ver comentário de desenho acima da criação da tabela. Versão, '
  'quando relevante, entra dentro do próprio nome (ex.: "Node.js 20"): uma coluna '
  '`versao` separada só teria uso para parte das linhas (runtime tem versão; '
  'framework às vezes; linguagem raramente de forma isolada), então não foi criada.';

COMMENT ON CONSTRAINT stack_categoria_valida ON stack IS
  'Lista fechada, não texto livre: categoria de stack muda devagar (há décadas só '
  'linguagem/framework/runtime fazem sentido aqui) e existe para agrupar/ordenar a '
  'tela. Nome do item embaixo (TypeScript, Next.js, Node.js 20...) é que muda toda '
  'hora, e por isso é texto livre.';

-- ─────────────────────────────────────────────────────────────────────────
-- servico
--
-- Serviço ou conta externa que o projeto usa, e onde é administrado. Não guarda
-- credencial: nome do provedor, em qual conta do dono, qual o papel (produção,
-- preview, ...) e um link para o painel de administração — nunca um valor de
-- acesso. `conta` é obrigatória porque o dono explicitamente tem mais de uma
-- conta no mesmo tipo de provedor entre os projetos que acompanha; sem essa
-- coluna, "usa Neon" não diz qual Neon.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE servico (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  projeto_id        uuid        NOT NULL,
  categoria         text        NOT NULL,
  nome              text        NOT NULL, -- ex.: "Neon", "Vercel", "OpenAI"
  conta             text        NOT NULL, -- em qual conta do dono, ex.: "pessoal", "cliente x"
  papel             text,                 -- ex.: "producao", "preview" — opcional, nem todo serviço distingue
  administrado_url  text,                 -- link para o painel onde isto é gerido — opcional
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT servico_pkey PRIMARY KEY (id),
  CONSTRAINT servico_projeto_fkey FOREIGN KEY (projeto_id)
    REFERENCES projeto (id) ON DELETE CASCADE,
  CONSTRAINT servico_categoria_valida CHECK (
    categoria IN ('banco', 'hospedagem', 'modelo', 'autenticacao', 'storage', 'email')
  ),
  CONSTRAINT servico_nome_nao_vazio CHECK (char_length(trim(nome)) > 0),
  CONSTRAINT servico_nome_tamanho_maximo CHECK (char_length(nome) <= 120),
  CONSTRAINT servico_nome_sem_controle CHECK (nome !~ '[[:cntrl:]]'),
  CONSTRAINT servico_conta_nao_vazia CHECK (char_length(trim(conta)) > 0),
  CONSTRAINT servico_conta_tamanho_maximo CHECK (char_length(conta) <= 120),
  CONSTRAINT servico_conta_sem_controle CHECK (conta !~ '[[:cntrl:]]'),
  CONSTRAINT servico_papel_nao_vazio CHECK (papel IS NULL OR char_length(trim(papel)) > 0),
  CONSTRAINT servico_papel_tamanho_maximo CHECK (papel IS NULL OR char_length(papel) <= 120),
  CONSTRAINT servico_papel_sem_controle CHECK (papel IS NULL OR papel !~ '[[:cntrl:]]'),
  -- administrado_url aponta para o painel de gestão, não para o produto em si — e
  -- pode ser um domínio diferente do provedor (ex.: Neon administrado a partir do
  -- painel da Vercel). https:// obrigatório pela mesma razão de contexto.arquivo_url
  -- na 001: evita "file:///" e alvo de SSRF a partir de quem um dia consumir isto.
  CONSTRAINT servico_administrado_url_formato CHECK (
    administrado_url IS NULL OR administrado_url ~ '^https://'
  ),
  CONSTRAINT servico_administrado_url_tamanho_maximo CHECK (
    administrado_url IS NULL OR char_length(administrado_url) <= 500
  ),
  CONSTRAINT servico_nome_nao_parece_credencial CHECK (NOT parece_credencial(nome)),
  CONSTRAINT servico_conta_nao_parece_credencial CHECK (NOT parece_credencial(conta)),
  CONSTRAINT servico_papel_nao_parece_credencial CHECK (
    papel IS NULL OR NOT parece_credencial(papel)
  ),
  -- administrado_url já exige https://, o que por si só recusa string de conexão
  -- (postgres://...) e a maioria dos formatos de chave crua. O que resta checar
  -- aqui é usuário:senha embutido na própria URL (https://usuario:senha@painel...),
  -- que o formato https:// sozinho não barra — é esse caso que parece_credencial
  -- pega.
  CONSTRAINT servico_administrado_url_nao_parece_credencial CHECK (
    administrado_url IS NULL OR NOT parece_credencial(administrado_url)
  )
);

COMMENT ON TABLE servico IS
  'Serviço ou conta externa usada pelo projeto, e onde é administrado. Nunca guarda '
  'o valor de um acesso — ver CLAUDE.md regra 1. Não há coluna de texto livre sem '
  'CHECK nesta tabela (nem uma de "notas"/"observações") de propósito: é exatamente '
  'esse tipo de campo aberto que vira, com o tempo, o lugar cômodo para colar um '
  'segredo "só dessa vez".';

COMMENT ON CONSTRAINT servico_categoria_valida ON servico IS
  'Lista fechada, não texto livre: categoria de serviço (banco, hospedagem, modelo, '
  'autenticação, storage, e-mail) muda devagar e serve para agrupar a tela — '
  'provedor novo dentro de uma categoria já existente (ex.: mais um provedor de '
  'banco) não exige migration, só uma linha nova. Categoria genuinamente nova exige '
  'decisão consciente e migration própria; deliberadamente não existe um valor '
  '"outro" de escape, porque ele viraria o destino padrão de tudo que não foi '
  'pensado, e a lista perderia utilidade para agrupar/filtrar.';

COMMENT ON COLUMN servico.papel IS
  'Ex.: "producao", "preview". Livre, sem CHECK de lista fechada — ao contrário de '
  'categoria, papel não tem vocabulário fixo entre serviços tão diferentes quanto '
  'banco e e-mail, e não é usado para agrupar a tela, só para qualificar uma linha. '
  'Nulo quando a distinção não faz sentido para aquele serviço (ex.: um provedor de '
  'e-mail sem separação entre produção e preview).';

COMMENT ON COLUMN servico.administrado_url IS
  'Link para onde este item é de fato administrado — que pode ser um painel '
  'diferente do provedor (ex.: banco Neon administrado a partir do painel da '
  'Vercel). Nulo permitido: registrar "este projeto usa X, na conta Y" já tem '
  'valor mesmo sem o link à mão no momento do cadastro; exigir o link travaria '
  'esse registro rápido. Não existe uma coluna de rótulo separada para "onde" além '
  'da URL — o domínio da própria URL já comunica isso, e um rótulo redundante '
  'seria um segundo lugar para a mesma informação divergir do primeiro.';

-- Sem coluna de ordem de exibição: a lista de categorias é fechada e pequena (3
-- em stack, 6 em servico), então a ordem de leitura natural (ex.: linguagem,
-- framework, runtime; ou banco, hospedagem, modelo, autenticação, storage,
-- email) é um mapeamento fixo no código de apresentação, não um dado por linha.
-- Uma coluna `ordem_exibicao` editável exigiria uma UI de arrastar que ninguém
-- pediu para esta tela, e sem ela a coluna só ganharia o valor padrão sequencial
-- do INSERT e nunca mais seria mantida — o tipo de campo que "ninguém preenche" e
-- vira mentira no schema. Dentro de uma categoria, ordenar por nome (alfabético)
-- é suficiente.

-- Reaproveita a função de trigger já criada em 001 para contexto — o corpo só lê
-- e escreve NEW.atualizado_em, não referencia nenhuma coluna específica de
-- contexto, então serve a qualquer tabela com essa coluna. Não há razão para
-- duplicar a função aqui.
CREATE TRIGGER stack_atualizar_timestamp_trigger
  BEFORE UPDATE ON stack
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

CREATE TRIGGER servico_atualizar_timestamp_trigger
  BEFORE UPDATE ON servico
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- Índices — só o que a tela de detalhe do projeto de fato consulta: todo o
-- inventário (stack + serviço) de um projeto. Foreign key não ganha índice
-- automático no Postgres, ao contrário de primary key (mesmo raciocínio já
-- registrado em 001 para relatorio e sugestao).
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX stack_projeto_idx ON stack (projeto_id);
CREATE INDEX servico_projeto_idx ON servico (projeto_id);

-- Sem segundo campo no índice (categoria, nome, etc.): ao contrário de
-- relatorio/sugestao, a consulta aqui não filtra nem ordena por outra coluna no
-- banco — a ordem de exibição é decidida na aplicação (ver comentário acima).
-- E, como em 001, a escala é pessoal: dezenas de linhas por projeto, não milhares.

COMMIT;

-- 012_agente_padrao.sql
-- Padrão global de agente: instrução e teto de sugestões que valem em todo
-- projeto onde aquele agente for ligado, escritos uma vez.
--
-- Por que: `projeto_agente` (005) já guarda instrução e teto, mas por
-- projeto — o dono configura `revisor-seguranca` no projeto A, depois de novo
-- no B, depois de novo no C. Pedido do dono: "eu conseguir predefinir
-- instruções e configurações" no agente, não em cada projeto que o usa.
--
-- Esta migration está escrita e ainda NÃO foi aplicada ao banco — trava de
-- schema (ver CLAUDE.md), mesma situação de 002, 003, 005 e 008 antes de
-- aplicadas. Ver db/README.md para o comando de aplicar quando o dono
-- decidir. Até lá, `src/servidor/agentesPadrao.ts` degrada como se a tabela
-- estivesse vazia (mesmo padrão de `listarAgentesProjeto`).
--
-- Resolução com `projeto_agente` (docs/plano-agentes-por-projeto.md e o
-- desenho desta entrega, src/dominio/agentePadrao.ts): SOBRESCREVE, nunca
-- SOMA. Quando `projeto_agente.instrucao` (ou `.teto_sugestoes`) de um par
-- projeto×agente está preenchido, ele vence o padrão inteiro — nunca os dois
-- são concatenados. Duas instruções coladas virariam texto contraditório que
-- ninguém escreveu de propósito, e o agente às 3h não tem a quem perguntar.
--
-- Fronteira que esta tabela herda de `projeto_agente` (§ 3.3 do plano):
-- instrução é o que o agente deve fazer — vai para a chamada do subagente,
-- nunca para o CLAUDE.md do repositório alvo. `contexto` continua sendo o
-- que o agente deve ler.

BEGIN;

CREATE TABLE agente_padrao (
  agente         text        NOT NULL, -- texto livre, sem lista fechada — mesmo raciocínio de projeto_agente.agente (005)
  instrucao      text,                 -- o que este agente deve fazer por padrão, em todo projeto onde for ligado
  teto_sugestoes smallint,             -- NULL = sem padrão; o teto do projeto (ou o global de 3) decide sozinho
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),

  -- Chave primária é o nome do agente: a tabela é global (um padrão por
  -- agente, não por projeto×agente), então não há par a que uma chave
  -- substituta precisasse se somar — diferente de projeto_agente, que
  -- referencia projeto_id e por isso usa id substituto + UNIQUE composta.
  CONSTRAINT agente_padrao_pkey PRIMARY KEY (agente),

  CONSTRAINT agente_padrao_agente_nao_vazio CHECK (char_length(trim(agente)) > 0),
  -- Mesmos CHECKs de projeto_agente.agente (005) e contexto.agente_destino
  -- (001): agente vira rótulo de card na esteira e na ficha /agentes/[nome] —
  -- sem caractere de controle, teto de 64 (nome de agente, não corpo de texto).
  CONSTRAINT agente_padrao_agente_sem_controle CHECK (agente !~ '[[:cntrl:]]'),
  CONSTRAINT agente_padrao_agente_tamanho_maximo CHECK (char_length(agente) <= 64),

  -- Mesmo teto de projeto_agente.instrucao (005) — regra 6 do CLAUDE.md:
  -- ordem de serviço, não documento. Sem CHECK de caractere de controle: é
  -- corpo de texto, aceita quebra de linha.
  CONSTRAINT agente_padrao_instrucao_tamanho_maximo CHECK (
    instrucao IS NULL OR char_length(instrucao) <= 4000
  ),

  -- Mesmo intervalo de projeto_agente.teto_sugestoes (005). NULL aqui não
  -- "herda o teto global de 3" diretamente — herda o que o projeto tiver, que
  -- por sua vez herda o global quando também NULL (cadeia de duas etapas,
  -- resolvida em src/dominio/agentePadrao.ts > resolverConfiguracaoAgente).
  CONSTRAINT agente_padrao_teto_sugestoes_intervalo CHECK (
    teto_sugestoes IS NULL OR teto_sugestoes BETWEEN 0 AND 3
  )
);

COMMENT ON TABLE agente_padrao IS
  'Padrão global de instrução/teto de um agente — vale em todo projeto onde ele for '
  'ligado, exceto onde projeto_agente (005) sobrescrever (nunca soma, ver '
  'src/dominio/agentePadrao.ts). Sem projeto_id: é global por natureza.';

COMMENT ON COLUMN agente_padrao.instrucao IS
  'O que este agente deve fazer por padrão, em qualquer projeto — vai para a chamada '
  'do subagente, nunca para o CLAUDE.md do repositório alvo (mesma fronteira de '
  'projeto_agente.instrucao, 005). Entrada não confiável (regra 6 do CLAUDE.md): '
  'validar tamanho e neutralizar caractere Unicode invisível na rota/action antes de '
  'gravar (src/dominio/textoSemInvisiveis.ts), nunca interpolar em comando de sistema '
  'nem em query.';

COMMENT ON COLUMN agente_padrao.teto_sugestoes IS
  'NULL = sem padrão de teto para este agente — o teto do projeto (projeto_agente, se '
  'configurado) ou o global de 3 por projeto por rodada decide sozinho. Nunca amplia: '
  'um padrão aqui é sempre um teto possivelmente mais apertado, nunca mais largo, e o '
  'teto global de 3 por rodada continua valendo por cima de qualquer configuração '
  '(docs/routine-noturna.md, passo 2.4).';

-- Reaproveita a função de trigger já criada em 001 (só lê/escreve
-- NEW.atualizado_em, não referencia coluna específica de contexto) — mesmo
-- padrão de stack/servico (002) e projeto_agente (005).
CREATE TRIGGER agente_padrao_atualizar_timestamp_trigger
  BEFORE UPDATE ON agente_padrao
  FOR EACH ROW
  EXECUTE FUNCTION contexto_atualizar_timestamp();

-- Sem índice além da chave primária: no máximo ~16 linhas (um agente
-- conhecido cada), e a única consulta é "todas as linhas" (GET /api/projects,
-- a esteira de cada projeto) ou "uma linha por agente" (a ficha em
-- /agentes/[nome]) — a própria PRIMARY KEY já cobre a segunda, e a primeira
-- é um full scan de uma tabela pequena, mesmo raciocínio do índice único de
-- projeto_agente (005).

COMMIT;

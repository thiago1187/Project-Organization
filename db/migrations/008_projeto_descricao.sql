-- 008_projeto_descricao.sql
-- Adiciona `projeto.descricao`: o que o projeto é, em prosa do dono.
--
-- Por que: docs/plano-gerenciador-de-projeto.md § 3.1. Pedido do dono —
-- "quero que o próprio sistema saiba o que é aquele projeto". Hoje tudo que
-- o painel sabe sobre um projeto veio de fora (relatorio, sugestao) ou é
-- material de consulta (contexto); não existe um campo onde o dono declare o
-- que o projeto é. `descricao` entra no bloco `contexto-do-painel` do
-- CLAUDE.md do repositório alvo (mesma porta que `contexto` já usa) e na
-- seção "O que é este projeto" do prompt gerado — agente que sabe o que o
-- projeto é diagnostica melhor que agente que só vê arquivos.
--
-- Numeração: o plano chamava esta migration de "006", escrita antes de a 006
-- real (tripwire_provedores_do_dono) e a 007 real (projeto_sem_repositorio)
-- existirem. Esta é a 008.
--
-- Esta migration está escrita e ainda NÃO foi aplicada ao banco — trava de
-- schema (ver CLAUDE.md), mesma situação de 002, 003, 005 antes de aplicadas.
-- Ver db/README.md para o comando de aplicar quando o dono decidir.

BEGIN;

ALTER TABLE projeto ADD COLUMN descricao text;

-- `text`, nullable: projeto cadastrado às pressas não pode travar por falta
-- de prosa. Teto de 2000 caracteres — regra 6 do CLAUDE.md, porque isto vai
-- para o CLAUDE.md do repositório alvo e para o prompt gerado. 2000 é "dois
-- ou três parágrafos sobre o que é e em que fase está"; material mais longo
-- continua sendo `contexto` (teto de 20000, ver 001).
--
-- Sem CHECK de caractere de controle: é corpo de texto, aceita quebra de
-- linha — mesmo raciocínio de contexto.conteudo na 001, diferente de um
-- rótulo curto como contexto.agente_destino ou tarefa.titulo (ver 009).
--
-- Sem `parece_credencial`: a assimetria com stack.nome/servico.nome é
-- deliberada. O tripwire da 002 foi calibrado para rótulo curto, onde colar
-- uma chave inteira é o acidente provável. Num campo de prosa de 2000
-- caracteres o falso positivo é mais provável que o verdadeiro, e a defesa
-- real do caminho de saída já existe: `semCredencial` em
-- src/dominio/prompt.ts, que passa a cobrir também `descricao`.
ALTER TABLE projeto ADD CONSTRAINT projeto_descricao_tamanho_maximo CHECK (
  descricao IS NULL OR char_length(descricao) <= 2000
);

COMMENT ON COLUMN projeto.descricao IS
  'O que este projeto é, em prosa do dono — voz do dono, não derivada de rodada nenhuma. '
  'Entra no bloco contexto-do-painel do CLAUDE.md do repositório alvo (mesma porta que '
  '`contexto` já usa, ver docs/routine-noturna.md) e na seção "O que é este projeto" do '
  'prompt gerado (src/dominio/prompt.ts). Nullable: cadastro rápido não deve travar por '
  'falta de descrição. Sem CHECK de caractere de controle (é corpo de texto, aceita '
  'quebra de linha) e sem parece_credencial — ver o comentário acima da constraint de '
  'tamanho para o porquê da assimetria com stack/servico.';

COMMIT;

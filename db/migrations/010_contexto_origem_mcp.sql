-- 010_contexto_origem_mcp.sql
-- `contexto.origem` passa a aceitar 'mcp'.
--
-- Por que: a 001 criou esta coluna com a lista fechada em um valor só e um
-- comentário que dizia, com todas as letras, que isso "torna impossível uma
-- escrita de outra procedência se passar por legítima". Aquilo era verdade
-- enquanto a única porta de escrita era o editor da tela.
--
-- Deixou de ser quando `upsertContexto` passou a aceitar a origem `mcp`: o
-- Claude Code do dono grava contexto, e a linha que ele grava fica idêntica a
-- uma que o dono digitou — mesmo `origem = 'painel'`, porque o CHECK não
-- aceitava outra coisa. A garantia prometida no comentário evaporou sem que
-- uma linha do comentário mudasse, que é a pior forma de uma garantia acabar.
--
-- Isto importa mais aqui do que pareceria: contexto é escrito no CLAUDE.md do
-- repositório alvo e lido por todo agente da rodada seguinte, de madrugada,
-- sem ninguém acordado. É a escrita de maior alcance que o MCP tem. E o MCP é
-- justamente a superfície onde o modelo pode ser dirigido por texto que ele
-- leu — um README, uma página, a saída de outra ferramenta. A defesa contra
-- isso é a ausência das ferramentas de decisão; esta migration soma a segunda
-- metade, que é o dono conseguir **ver** o que foi anexado sem ele olhando.
--
-- Não é controle de acesso — quem tem o segredo do MCP continua podendo
-- gravar. É procedência: a diferença entre "eu escrevi isso" e "meu terminal
-- escreveu isso enquanto eu lia outra coisa".
--
-- Linhas já gravadas continuam 'painel', e está certo: nenhuma delas veio do
-- MCP, porque o MCP passou a gravar depois desta migration.

BEGIN;

ALTER TABLE contexto DROP CONSTRAINT contexto_origem_valida;
ALTER TABLE contexto ADD CONSTRAINT contexto_origem_valida CHECK (origem IN ('painel', 'mcp'));

-- 'routine' continua fora da lista, e continua sendo o ponto principal desta
-- coluna. A routine não escreve contexto (CLAUDE.md, regra 4): um agente
-- comprometido numa rodada escreveria as próprias instruções para a rodada
-- seguinte. O CHECK é a última barreira depois de `exigirDonoOuMcp()` — se
-- algum caminho futuro esquecer o guard, o banco recusa a linha.
COMMENT ON COLUMN contexto.origem IS
  '''painel'' (o dono digitou na tela) ou ''mcp'' (o Claude Code do dono gravou pelo servidor '
  'MCP — ver docs/mcp.md). ''routine'' não existe de propósito: a rodada noturna não escreve '
  'contexto, porque contexto vira instrução no CLAUDE.md do repositório alvo. O CHECK é a '
  'barreira final atrás de exigirDonoOuMcp(); a coluna em si é procedência, para o dono '
  'distinguir na tela o que ele escreveu do que o terminal dele escreveu.';

COMMIT;

# 001 — `tarefa` não é `sugestao`, e não se funde com ela

## O problema

O dono pediu um espaço para colocar as tarefas de um projeto, e o painel já
tinha `sugestao` — uma proposta de agente, esperando aprovar ou recusar. As
duas coisas aparecem juntas na tela ("o que estamos fazendo agora"), e a
tentação óbvia é ter uma tabela só: uma sugestão aprovada "vira" tarefa, ou
uma tarefa é só uma sugestão com `agente = 'dono'`.

## O que foi decidido

`tarefa` é uma tabela própria (migration `009`), sem FK para `sugestao` e sem
caminho de conversão de uma para a outra. As duas se encontram **na tela**
(a lista de "onde estamos" mostra tarefas do dono e sugestões aprovadas juntas,
com um selo de origem) e nunca no banco.

Consequência prática: `tarefa` tem um escritor só (o painel, sempre atrás de
sessão do dono), aceita apagar e reordenar livremente, e **não tem trigger de
transição de estado** — `feita → aberta` é uma transição legítima ("voltei
atrás"). `ON DELETE CASCADE` na FK para `projeto`, mesma categoria de
`relatorio`/`contexto`/`stack`/`servico`.

## O que foi descartado

**Sugestão aprovada "promove" para tarefa (copiando a linha).** Cria duas
linhas com o mesmo significado e nenhuma fonte de verdade — o dono marca a
cópia como feita e a sugestão original continua `aprovada` para sempre, e
`GET /api/projects` segue mandando para a rodada noturna algo que já foi
executado. Além disso, `sugestao.estado = 'aprovada'` já significa "eu quero
fazer isso" desde que a execução automática saiu da rodada — promover seria
converter um estado em outro estado idêntico.

**Tarefa como `sugestao` com `agente = 'dono'`.** Grátis em schema, caro no
resto: obrigaria o dono a preencher `motivo`, `esforco`, `risco` e
`reversibilidade` (todos `NOT NULL` em `sugestao`) só para escrever "revisar o
texto da home", e poluiria a fila de decisão com itens que não pedem decisão
nenhuma. A fila existe para o que precisa de um sim ou não; tarefa já nasce
decidida.

**FK `tarefa.sugestao_id`.** Só teria uso para uma ação de "promover" que não
foi construída, ou para "quebrar esta sugestão em três tarefas" — um segundo
caso de uso que nunca apareceu. Fica de fora até aparecer; se aparecer, é um
`ADD COLUMN` nullable, barato e aditivo.

## Por que isso importa o suficiente para virar registro

`sugestao` é, desde a migration `001`, a evidência do portão de aprovação do
sistema inteiro: `ON DELETE RESTRICT` (apagar destruiria a auditoria em
silêncio) e uma trigger de banco que barra qualquer transição de estado fora
das permitidas — em particular, impede `pendente → feita` sem passar por
`aprovada`, o que é o que garante que a rodada noturna não pode se
auto-aprovar.

Fundir `tarefa` com `sugestao`, em qualquer direção, exigiria afrouxar as duas
garantias para ganhar uma lista de afazeres. É trocar a superfície de
auditoria do mecanismo central de segurança do sistema por conveniência de
schema. O preço é desproporcional ao que se compra, e por isso a linha entre
as duas tabelas não se move — mesmo quando parecer redundante ter duas listas
que a tela mistura de qualquer forma.

Ver `docs/plano-gerenciador-de-projeto.md` § 3.3 para o desenho completo e
`db/migrations/009_tarefa.sql` para os comentários de schema.

# Banco de dados

Postgres no Neon, provisionado pela Vercel. Sem ORM e sem runner de migration por
enquanto — o projeto ainda não tem `package.json`. Por isso as migrations são SQL
puro, numeradas, aplicadas à mão até que a conversão para Next.js escolha uma
ferramenta (e nesse ponto, o formato numerado `NNN_descricao.sql` migra bem para
qualquer runner comum).

## Como aplicar uma migration

Use a conexão **não-pooled** (`DATABASE_URL_UNPOOLED`), não a `DATABASE_URL` pooled.

Migration roda como uma transação única com múltiplos `CREATE TABLE`/`CREATE INDEX`.
O endpoint pooled do Neon multiplexa conexões (modo compatível com PgBouncer), o que
não é garantidamente seguro para DDL de sessão longa ou multi-statement — a conexão
física por trás do túnel pode não ser a mesma do início ao fim da transação. A conexão
direta não tem esse risco. Isso só importa para migration; as rotas da aplicação usam a
pooled normalmente.

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/001_schema_inicial.sql
```

Esta migration **já foi aplicada** no banco: as quatro tabelas (`projeto`, `relatorio`,
`sugestao`, `contexto`) e as triggers existem. O comando acima fica registrado aqui
como referência de como ela foi (e como qualquer migration futura deve ser) aplicada.

## Como reverter

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/001_schema_inicial.down.sql
```

Mesma regra de conexão. O `down` apaga as tabelas (e qualquer dado que tiverem) —
não há como recuperar sem um backup.

## 002 — inventário de projeto (`stack`, `servico`)

Adiciona duas tabelas: `stack` (linguagem, framework, runtime de um projeto) e
`servico` (serviço ou conta externa que o projeto usa, e onde é administrado —
nunca um valor de credencial; ver comentário no topo da migration e CLAUDE.md
regra 1). As duas são independentes uma da outra e cada uma referencia só
`projeto`, com `ON DELETE CASCADE` — mesma categoria de `relatorio` e `contexto`
na 001 (material substituível), diferente de `sugestao` (evidência de auditoria).

**Esta migration **já foi aplicada** no banco em 2026-07-30.** Antes disso,
não há nada para rodar aqui até o dono decidir aplicar. Quando decidir:

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/002_inventario.sql
```

Reverter (apaga `stack`, `servico` e todo o inventário que tiverem, mas não toca
em `contexto_atualizar_timestamp()`, que pertence à 001 e continua em uso por
`contexto`):

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/002_inventario.down.sql
```

## 003 — tetos de tamanho (`relatorio`, `sugestao`)

Adiciona `CHECK`s de teto de tamanho a `relatorio.resumo`, aos três campos de cada
item de `relatorio.achados_por_agente` (`agente`, `achado`, `selo`) e à quantidade
de itens desse array, e a `sugestao.agente`, `sugestao.proposta`, `sugestao.motivo`
e `sugestao.risco`. Espelha os tetos já aplicados em
`src/dominio/validacaoRelatorio.ts` e `src/dominio/validacaoSugestao.ts` — ver o
comentário no topo desses dois arquivos para o raciocínio de cada número, e o
comentário no topo da migration para o porquê (rodada em laço gravando dado gigante
sem paginação em `GET /api/reports`, degradando todas as telas de uma vez).

**Esta migration **já foi aplicada** no banco em 2026-07-30.** Antes disso,
para rodar aqui até o dono decidir aplicar. Quando decidir:

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/003_tetos_tamanho.sql
```

Reverter (remove os `CHECK`s e a função `achados_por_agente_dentro_dos_tetos`; não
apaga nenhum dado — ver comentário no topo do `down`):

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/003_tetos_tamanho.down.sql
```

## 004 — `pr_url` opcional em `sugestao`

Afrouxa `sugestao.pr_url`: deixa de ser obrigatório em `feita` e de exigir
`https://github.com/`. Consequência de tirar a execução automática da routine
(ver `docs/proximos-passos.md` item 2) — o trabalho agora acontece na hora,
pelo prompt gerado no painel, e trabalho supervisionado pode ir direto para a
branch principal, sem pull request. Quando `pr_url` é informado, ainda precisa
começar com `https://`, mas aceita qualquer origem, não só GitHub. Ver o
comentário no topo da migration para o raciocínio completo.

**Esta migration **já foi aplicada** no banco em 2026-07-30.** Antes disso,
não há nada para rodar aqui até o dono decidir aplicar. Até lá, marcar uma
sugestão como "feita" sem link falha no banco com um erro claro — é o
comportamento esperado, não um bug. Quando decidir aplicar:

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/004_pr_url_opcional.sql
```

Reverter (volta a exigir `pr_url` com link do GitHub em toda sugestão
"feita" — pode falhar se já existir alguma "feita" sem link ou com link de
outra origem; ver comentário no topo do `down`):

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/004_pr_url_opcional.down.sql
```

## 005 — esteira de agentes por projeto (`projeto_agente`)

Adiciona `projeto_agente`: qual agente diagnostica cada projeto, em que ordem,
e com que instrução específica (`instrucao`, teto de 4000 caracteres — vai
para a chamada do subagente, não para o CLAUDE.md; diferente de `contexto`,
que é o que o agente deve ler). Ver o comentário no topo da migration e
`docs/plano-agentes-por-projeto.md` § 3 para o desenho completo, e
`docs/proximos-passos.md` item 1 para o problema que resolve.

**Esta migration **já foi aplicada** no banco em 2026-07-30.** Antes disso,
004, não há nada para rodar aqui até o dono decidir aplicar. Quando decidir:

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/005_agentes_por_projeto.sql
```

Até lá, `GET /api/projects` sempre devolve `agentes: []` para todo projeto
(a tabela não existe) e a routine cai na lista fixa de sempre — é a mesma
degradação aditiva que vale depois de aplicada, para projeto sem nenhum
agente configurado (ver o comentário em `src/app/api/projects/route.ts`).

Reverter (apaga `projeto_agente` e toda configuração de esteira gravada; não
toca em `contexto_atualizar_timestamp()`, que pertence à 001):

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/005_agentes_por_projeto.down.sql
```

## Dado de demonstração (`seed.sql`)

`db/seed.sql` popula o banco com um conjunto fictício de projetos, relatórios,
sugestões, contexto e inventário — o suficiente para avaliar todas as telas do
painel (visão geral com as três frequências e um pausado, detalhe com histórico
raso e fundo, fila de sugestões nos quatro estados, estado vazio de um projeto
sem rodada ainda) sem esperar por uma rodada real. As linhas de `stack` e
`servico` do seed pressupõem a 002 já aplicada — rodar o seed antes disso falha
alto (tabela inexistente), o que é o comportamento esperado, não um bug a
mascarar.

**Nunca rodar em banco com dado real.** Todo registro do seed é claramente
fictício: `projeto.repositorio` usa o prefixo `demo-seed/` e `projeto.nome` tem
o sufixo `(demo)`, exatamente para que quem abrir o painel ou o banco reconheça
o dado como semente à primeira vista. Não há nada com formato de credencial no
arquivo.

Aplicar (mesma regra de conexão não-pooled da migration, por ter múltiplos
`INSERT` numa única transação):

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/seed.sql
```

O arquivo é idempotente por conta própria: a primeira coisa que ele faz é apagar
qualquer linha de demonstração já existente (identificada pelo prefixo
`demo-seed/` em `projeto.repositorio`) antes de inserir o conjunto de novo.
Rodar duas vezes não duplica nada e devolve sempre o mesmo cenário conhecido —
inclusive desfazendo qualquer edição feita pela UI durante um teste anterior.
Por não tocar em nenhum projeto fora desse prefixo, também não precisa de banco
vazio: pode ser aplicado a um banco que já tenha os dados reais do dono, sem
misturar os dois — mas o cenário recomendado continua sendo um banco só para
avaliação, separado do de produção.

Para limpar o dado de demonstração sem reaplicar o seed:

```sql
DELETE FROM sugestao WHERE projeto_id IN (SELECT id FROM projeto WHERE repositorio LIKE 'demo-seed/%');
DELETE FROM projeto WHERE repositorio LIKE 'demo-seed/%';
```

(A segunda linha apaga `relatorio`, `contexto`, `stack` e `servico` das mesmas
linhas via `ON DELETE CASCADE`; `sugestao` precisa da primeira linha porque sua
referência a `projeto` é `ON DELETE RESTRICT`, de propósito — ver comentário na
migration.)

## Convenção para as próximas migrations

- Um arquivo `up` e um `down` por migration, sempre em par: `NNN_descricao_curta.sql`
  e `NNN_descricao_curta.down.sql`.
- `NNN` é um número sequencial de 3 dígitos (`001`, `002`, ...), sem reaproveitar
  número já usado, mesmo que uma migration antiga tenha sido revertida.
- Uma mudança de schema por migration. Não empacotar duas alterações não relacionadas
  no mesmo arquivo, pelo mesmo motivo de "um PR por mudança" do restante do projeto.
- Toda migration de schema exige aprovação explícita do dono **antes** de ser escrita
  (trava de schema, ver `CLAUDE.md`). O `up` só é escrito depois dessa aprovação.
- Cada `up` precisa de um `down` que funcione de verdade — não um arquivo vazio.
- Migrations não são idempotentes de propósito (sem `IF NOT EXISTS` em `CREATE TABLE`):
  se uma migration já foi aplicada e você tentar rodá-la de novo, ela deve falhar alto,
  não silenciar. Isso é sinal de bug no processo de aplicar, não algo para mascarar.
  A transação (`BEGIN`/`COMMIT`) garante que uma falha no meio do arquivo não deixa
  schema pela metade — ou aplica tudo, ou não aplica nada.

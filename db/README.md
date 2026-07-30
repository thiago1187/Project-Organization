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

O comando acima **não foi executado**. É o dono quem decide rodar, depois de ler a
migration.

## Como reverter

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/001_schema_inicial.down.sql
```

Mesma regra de conexão. O `down` apaga as tabelas (e qualquer dado que tiverem) —
não há como recuperar sem um backup.

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

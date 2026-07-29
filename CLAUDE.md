# Dashboard de acompanhamento noturno

## O que é este projeto

Painel web pessoal que mostra o resultado das rodadas noturnas de agentes de IA em vários repositórios. Toda madrugada, uma routine do Claude Code roda os agentes nos projetos monitorados, corrige o que for seguro, abre pull requests e envia o relatório para este app. De manhã, o dono abre o painel e vê o estado de cada projeto.

Este repositório é **só o painel**. Ele não executa os agentes — apenas cadastra os projetos e exibe os relatórios que chegam.

## Estado atual e alvo

O código nasceu como um export estático do Claude Design, com dados mockados.

O alvo é um app Next.js (App Router) com:
- as mesmas telas e o mesmo visual do export original
- rotas de API para receber e servir dados
- persistência em Postgres

Ao migrar, **preserve o CSS, a tipografia e o layout do export**. O visual já foi aprovado; a mudança é estrutural, não estética.

## Telas

1. **Visão geral** — projetos agrupados por frequência de visita dos agentes (toda madrugada / dias alternados / uma vez por semana). Arrastar um card entre grupos muda a frequência daquele projeto.
2. **Detalhe do projeto** — histórico das rodadas, o que cada agente fez, link para o PR no GitHub, links de documentos, e a seção de acessos.
3. **Configuração** — CRUD de projetos: cadastrar, editar, ativar e pausar.

## Rotas de API

| Rota | Uso |
|---|---|
| `GET /api/projects` | Lista os projetos ativos. **A routine noturna lê daqui** — mudar o formato quebra a automação. |
| `POST /api/reports` | Recebe o relatório de uma rodada. Chamado pela routine. |
| `GET /api/reports` | Alimenta as telas. |

## Regras de segurança (não negociáveis)

Estas regras não são preferência de estilo. Não as relaxe, não as contorne, e pergunte antes de fazer qualquer coisa que chegue perto delas.

1. **Segredos só existem no servidor.** Valores de credenciais vêm de variáveis de ambiente e só são lidos em route handlers ou server components. Nunca em código que vai para o navegador, nunca via prop, nunca via estado de cliente.
2. **Nada de segredo em arquivo versionado.** Nenhuma chave, token ou senha entra no repositório — nem em exemplo, nem em comentário, nem em teste. `.env*` fica no `.gitignore`.
3. **O deployment inteiro fica atrás do Vercel Authentication.** Isso é configurado no painel do Vercel, fora do código. Não escreva nada que dependa do app estar público.
4. **As rotas de API aceitam duas formas de acesso:** sessão autenticada (o dono no navegador) ou o header `x-vercel-protection-bypass` com o secret correto (a routine). Qualquer requisição sem uma das duas recebe 401.
5. **Este é um app de uso pessoal.** Não construa sistema de contas, convites ou papéis de usuário.

## Convenções de trabalho

- **Nunca commit direto na branch principal.** Toda mudança vai por pull request, inclusive as feitas de madrugada.
- Uma mudança por PR. PR grande e misturado é mais difícil de revisar às 7h da manhã do que dois PRs pequenos.
- Antes de codar qualquer coisa não trivial, apresente o plano e espere confirmação.
- Prefira a solução mais simples que resolve. Este é um painel pessoal, não um produto multi-tenant.
- Se uma tarefa esbarrar em algo ambíguo, pergunte em vez de assumir.

## Os agentes

As definições vivem em `.claude/agents/`. São oito, divididos entre os que escrevem e os que só leem.

**Escrevem:** `arquiteto-chefe`, `dev-backend`, `dev-frontend`, `escriba-docs`
**Somente leitura:** `revisor-seguranca`, `revisor-codigo`, `qa-testes`, `devops-deploy`

Ordem esperada numa rodada: os somente-leitura levantam o diagnóstico primeiro; só depois os que escrevem agem sobre o que foi encontrado.

Dois são obrigatórios em situações específicas:
- `revisor-seguranca` antes de qualquer commit que toque autenticação, autorização ou acesso a dado
- `escriba-docs` quando a mudança for significativa (ver abaixo)

## Documentação

A pasta `docs/` é a memória do projeto. O `escriba-docs` a mantém.

Uma mudança é **significativa** — e portanto exige atualização de documentação — quando ela:
- adiciona, remove ou muda o formato de uma rota de API
- muda o modelo de dados
- muda como a routine noturna interage com o app
- muda uma das regras de segurança acima
- adiciona uma tela ou muda o fluxo de uma existente
- troca uma dependência estrutural (banco, framework, hospedagem)

Correção de bug pequeno, ajuste de estilo e refatoração interna não exigem — mas entram no `CHANGELOG.md` mesmo assim.

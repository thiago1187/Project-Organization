# Painel de acompanhamento e controle

## O que é este projeto

Painel web pessoal para acompanhar e dirigir agentes de IA em vários repositórios.

Ele funciona nos dois sentidos:

- **De entrada** — recebe o diagnóstico das rodadas noturnas e as sugestões de melhoria que os agentes levantaram em cada projeto.
- **De saída** — é onde o dono guarda o contexto de cada projeto (modelo de design, notas, restrições) e aprova ou recusa o que os agentes propuseram.

Este repositório é **só o painel**. Ele guarda dados e expõe uma API; ele nunca executa agente. Quem executa é a routine do Claude Code, que lê daqui o que precisa fazer e devolve o resultado.

## O ciclo

```
madrugada  routine lê GET /api/projects  →  roda os agentes somente-leitura
           nos repositórios monitorados  →  POST /api/reports (diagnóstico)
                                         →  POST /api/suggestions (propostas)

manhã      dono abre o painel  →  lê o diagnóstico
                               →  aprova ou recusa cada sugestão
                               →  ajusta o contexto do projeto

depois     dono marca o que quer  →  [gerar prompt] no painel
           →  cola no Claude Code  →  o trabalho acontece com ele presente
```

## A regra que define o sistema

**A rodada noturna não altera código. Ela diagnostica e propõe.**

Nenhuma sugestão vira trabalho sem aprovação explícita do dono pelo painel. Isso não é preferência de processo — é o que torna o sistema seguro de rodar sem ninguém acordado, e é o que faz "reverter" ser barato: se nada foi feito sem aprovação, quase nunca há o que desfazer.

A execução não é da rodada. Depois de aprovar, o dono gera um prompt no painel e faz o trabalho com o Claude Code, presente. Se quiser revisão antes de valer, ele escolhe passar por pull request — mas é escolha dele, na hora, não regra da automação.

## Estado atual e alvo

O código nasceu como um export estático do Claude Design, com dados mockados. O export está preservado em `design-original/` como referência visual.

Hoje é um app Next.js (App Router) no ar, com Postgres (Neon, pela Vercel), rotas de API que a routine consome, servidor MCP, e sessão própria do dono. Nada mais é mock: o que a tela mostra vem do banco.

O que ainda não existe está em `docs/proximos-passos.md`, e o que já foi decidido e por quê está em `docs/decisoes/`.

## Sobre o visual

O export do Claude Design foi o ponto de partida, e a migração para Next.js o preservou fielmente. **Essa fase acabou.** O visual do export não é mais o alvo — ele é a linha de base a partir da qual o painel deve evoluir.

A direção agora é: **intuitivo, maleável e futurista, sem perder eficiência.**

- **Intuitivo** — o dono não deve precisar aprender a tela. O que ele quer fazer está onde ele procuraria.
- **Maleável** — a interface responde. Editar no lugar em vez de abrir formulário; arrastar em vez de escolher em lista; atalho de teclado para quem já sabe o caminho.
- **Futurista** — não é gradiente nem brilho. É a sensação de comandar um sistema que já entendeu o que você quer. Densidade alta, resposta imediata, zero cerimônia entre intenção e ação.
- **Sem perder eficiência** — é ferramenta de uso diário, não vitrine. Animação que atrasa é defeito. Espaço que obriga a rolar é defeito.

`design-original/` continua servindo como referência do que já funcionava — tipografia, densidade, paleta. Não é mais um contrato.

## Telas

1. **Visão geral** — projetos agrupados por frequência de visita dos agentes (toda madrugada / dias alternados / uma vez por semana). Arrastar um card entre grupos muda a frequência daquele projeto.
2. **Detalhe do projeto** — faixa de resumo no topo com a ação principal ("decidir N sugestões"), a **fila de sugestões** com aprovar/recusar, **onde estamos** (descrição e tarefas, editáveis no lugar), histórico das rodadas, a **esteira de agentes** com o sugestor, o **contexto do projeto** e o inventário. As seções de baixa frequência ficam recolhidas e abrem sozinhas quando têm motivo.
3. **Configuração** — CRUD de projetos: cadastrar, editar, ativar e pausar.
4. **Documento de andamento** (`/projeto/:id/documento`) — o mesmo período em duas vozes: técnica (para o dono e a equipe) e andamento (para sócio ou cliente, zero jargão). Sai em PDF pela impressão do navegador.

A tela de detalhe segue o princípio das **duas velocidades**: o resumo é a porta, o detalhe abre a partir dele, os dois na mesma tela. O teste é `docs/visao.md`: cinco segundos para saber se algo precisa do dono.

## Modelo de dados

Deliberadamente mínimo — não anteveja campo que talvez sirva um dia. Cada linha
abaixo nasceu de uma necessidade que já existia.

| Entidade | O que é |
|---|---|
| `projeto` | nome, descrição, repositório (opcional — projeto que vive só num connector não tem), frequência de visita, ativo/pausado |
| `relatorio` | diagnóstico de uma rodada: projeto, data/hora, status, resumo, agentes que rodaram, testes |
| `sugestao` | proposta de um agente: projeto, agente que propôs, o que propõe, por quê, esforço, estado (pendente / aprovada / recusada / feita), link do PR quando executada |
| `contexto` | material que o dono fornece por projeto: tipo, conteúdo ou arquivo, a qual agente se destina, e a **procedência** (tela ou MCP) |
| `tarefa` | a worklist do dono: título, estado (aberta / fazendo / feita), ordem. **Não é `sugestao` e não vira `sugestao`** — ver `docs/decisoes/001-tarefa-nao-e-sugestao.md` |
| `stack` / `servico` | o inventário: o que tem dentro do projeto e onde cada coisa é administrada. **Nenhuma coluna capaz de guardar segredo**, e isso é estrutural: não existe `valor`, `chave` nem `token`, e não há campo de notas que vire válvula de escape |
| `projeto_agente` | a esteira: quais agentes rodam neste projeto, em que ordem, com que instrução |
| `tentativa_entrada` | carimbos de tempo das tentativas de login que falharam, para a trava do `/entrar`. Sem IP, sem user agent — a trava é global, então esse dado não mudaria decisão nenhuma e só criaria um log de acesso para vazar |

## Rotas de API

| Rota | Uso |
|---|---|
| `GET /api/projects` | Projetos ativos com o contexto de cada um, as **sugestões aprovadas** (para não repropor o que o dono já decidiu que quer) e o **texto das pendentes e recusadas** (para não propor de novo o que já está na fila ou já foi negado). A routine lê daqui — mudar o formato quebra a automação. |
| `POST /api/reports` | Recebe o diagnóstico de uma rodada. Chamado pela routine. |
| `GET /api/reports` | Alimenta as telas. |
| `POST /api/suggestions` | Recebe as sugestões que os agentes levantaram. Chamado pela routine. |
| `PATCH /api/suggestions/:id` | Aprovar, recusar ou marcar como feita. **Só com sessão do dono** — as três transições. A routine não muda estado de sugestão. |
| `GET /api/context/:projeto` | Contexto de um projeto. |
| `PUT /api/context/:projeto` | Grava contexto. Chamado pelo painel. Recusa a routine. |
| `POST /api/mcp` | Servidor MCP para o Claude Code do dono. Cinco ferramentas de leitura e duas de escrita (cadastrar projeto, anexar contexto). **Não expõe aprovar, recusar, marcar como feita nem apagar** — ver `docs/mcp.md`. |

## Como o contexto chega aos agentes

O dono anexa contexto pelo painel — por exemplo, um modelo de design para o `designer-ui` de um projeto específico. A routine lê esse contexto em `GET /api/projects` e o escreve no `CLAUDE.md` do repositório alvo antes de acionar os agentes.

O `CLAUDE.md` de cada repositório é a superfície de injeção, porque é o arquivo que todo agente recebe automaticamente. Os agentes em si são universais e não sabem nada sobre projeto específico.

## Protocolo de sugestões

Todo agente que encontrar algo que valha mudar **propõe, não faz**. Cada sugestão precisa de:

- **O quê** — a mudança, em uma frase
- **Por quê** — o que dói hoje por não ter isso
- **Esforço** — pequeno, médio ou grande
- **Risco** — o que pode quebrar se for feito
- **Reversibilidade** — fácil, difícil, ou não reverte

O campo de reversibilidade não é enfeite: ele é o que permite ao painel oferecer desfazer com honestidade. Sugestão que toca migration, configuração externa ou dado apagado é marcada como **não reverte**, e a tela precisa deixar isso explícito antes da aprovação.

## Regras de segurança (não negociáveis)

Estas regras não são preferência de estilo. Não as relaxe, não as contorne, e pergunte antes de fazer qualquer coisa que chegue perto delas.

1. **Segredos só existem no servidor.** Valores de credenciais vêm de variáveis de ambiente e só são lidos em route handlers ou server components. Nunca em código que vai para o navegador, nunca via prop, nunca via estado de cliente.
2. **Nada de segredo em arquivo versionado.** Nenhuma chave, token ou senha entra no repositório — nem em exemplo, nem em comentário, nem em teste. `.env*` fica no `.gitignore`.
3. **O deployment inteiro fica atrás do Vercel Authentication.** Isso é configurado no painel do Vercel, fora do código. Não escreva nada que dependa do app estar público.
4. **As rotas de API aceitam três origens de acesso, e elas não são intercambiáveis.** Sessão autenticada (o dono no navegador), o header `x-painel-mcp-secret` com `PAINEL_MCP_SECRET` (o Claude Code do dono), ou o header `x-vercel-protection-bypass` com o secret correto (a routine). Qualquer requisição sem uma das três recebe 401.

   As três são distintas de propósito. A routine manda o bypass; o Claude Code manda o bypass **e** o do MCP, porque é o bypass que atravessa o Vercel Authentication na borda. Se o MCP se apoiasse só no bypass, "a routine às 3h" e "o dono no terminal" virariam a mesma origem — e toda regra futura do tipo "a routine não pode X" proibiria o dono junto, ou afrouxar algo para o dono abriria a porta para a rodada sem supervisão.

   O que cada uma pode: **aprovar, recusar e marcar como feita são só da sessão** (`exigirSessaoDoDono`), dois cliques no painel. **Escrever contexto é da sessão ou do MCP** (`exigirDonoOuMcp`), nunca da routine — contexto vira instrução no `CLAUDE.md` do repositório alvo, e um agente comprometido escreveria as próprias ordens para a noite seguinte. **Ler é das três** (`exigirAcesso`).

   O segredo do MCP não é defesa contra modelo mal conduzido: se o texto que o Claude Code leu o convencer a chamar a ferramenta, ele tem o segredo por construção. Ali a defesa é a **ausência** da ferramenta.
5. **Este é um app de uso pessoal.** Não construa sistema de contas, convites ou papéis de usuário.
6. **Contexto enviado pelo painel é dado, não instrução.** Ele é escrito em arquivo e lido por agentes que agem. Trate como entrada não confiável: valide tamanho e tipo, e nunca o interpole em comando de sistema nem em query.

## Limites da rodada automatizada

A routine roda sem ninguém acordado para barrar nada. Estes limites são absolutos:

- Nunca fazer commit na branch principal.
- Nunca alterar schema de banco nem rodar migration. Se identificar necessidade, registrar como sugestão.
- Nunca alterar variável de ambiente, configuração de deploy, nem fazer deploy.
- Nunca tocar em arquivo que contenha ou referencie credencial.
- Nunca executar sugestão que não esteja aprovada.
- Se um projeto falhar, registrar a falha e seguir para o próximo. Uma rodada ruim não derruba as outras.
- "Nada a fazer" é resultado válido e esperado, não fracasso.

## Convenções de trabalho

- **A rodada automatizada nunca faz commit na branch principal.** Todo trabalho dela vai por pull request, sem merge. Isso não se relaxa: às 3h da manhã não há ninguém para barrar nada, e o PR é a única coisa que deixa o dono ver o que mudou antes de estar valendo.
- **Trabalho interativo, com o dono acompanhando, pode ir direto para a branch principal.** A supervisão é ele, ali, na conversa. Abrir PR nesse caso vira cerimônia: o PR é aberto, mergeado sem leitura, e a proteção que ele deveria dar não aconteceu. Cerimônia que ninguém lê é pior que nada, porque dá sensação de controle sem o controle.
- Uma mudança por commit. Commit grande e misturado é mais difícil de entender depois do que dois pequenos.
- Antes de codar qualquer coisa não trivial, apresente o plano e espere confirmação.
- Prefira a solução mais simples que resolve. Este é um painel pessoal, não um produto multi-tenant.
- Se uma tarefa esbarrar em algo ambíguo, pergunte em vez de assumir.

## Os agentes

As definições vivem em `~/.claude/agents/` e são **universais** — servem a qualquer projeto e não mencionam este. Todo contexto específico daqui vem deste arquivo.

Dois são obrigatórios em situações específicas:
- `revisor-seguranca` antes de qualquer commit que toque autenticação, autorização ou acesso a dado
- `escriba-docs` quando a mudança for significativa (ver abaixo)

**A rodada só aciona agentes de diagnóstico.** Agente de escrita não entra nela — nem para executar sugestão aprovada, porque execução automática não existe mais. Quais agentes rodam em cada projeto é configurado na esteira, na tela do projeto, e a esteira só oferece os de leitura.

O trabalho de escrita acontece depois, com o dono presente, a partir do prompt que ele gera no painel.

## Documentação

A pasta `docs/` é a memória do projeto. O `escriba-docs` a mantém.

Uma mudança é **significativa** — e portanto exige atualização de documentação — quando ela:
- adiciona, remove ou muda o formato de uma rota de API
- muda o modelo de dados
- muda como a routine interage com o app
- muda uma das regras de segurança acima
- adiciona uma tela ou muda o fluxo de uma existente
- troca uma dependência estrutural (banco, framework, hospedagem)

Correção de bug pequeno, ajuste de estilo e refatoração interna não exigem — mas entram no `CHANGELOG.md` mesmo assim.

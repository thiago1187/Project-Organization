# Plano — conversão do export estático para Next.js (App Router)

Status: proposta, aguardando confirmação do dono. Nada abaixo foi implementado.

Fontes lidas para escrever este plano: `CLAUDE.md`, `db/migrations/001_schema_inicial.sql`,
`design-original/acompanhamento-noturno-v2.dc.html` (inteiro), `db/README.md`,
`design-original/README.md`, `.gitignore`.

---

## 1. Resumo da abordagem

Portar o arquivo único do Claude Design para um app Next.js mínimo — `next`, `react`,
`typescript` e nada mais — mantendo os estilos **inline, declaração por declaração**, porque
o inline é hoje a fonte da verdade visual e reescrevê-lo em Tailwind ou CSS Modules seria
traduzir 200 declarações à mão sem ganho. As três telas viram três rotas reais
(`/`, `/projeto/[id]`, `/configuracao`), porque a etapa seguinte precisa de
carregando/erro/vazio por tela e de busca de dados por rota. A paleta inteira dos dois temas
— inclusive as ~14 cores que hoje só existem como campos JavaScript do objeto `TEMAS` — sobe
para CSS custom properties num único `globals.css`, o que resolve de uma vez o flash na
hidratação, a divergência servidor/cliente e a duplicação de literais de cor. Os dados
continuam mockados, mas **em formato de linha de tabela** (`projeto`, `relatorio`, `sugestao`,
`contexto`, com os tipos derivados dos `CHECK` da migration), e uma camada fina de seletores
transforma essas linhas nos modelos de visão que o template consome — assim a etapa seguinte
troca só a origem das linhas, não a tela. A seção de acessos é convertida **sem campo de
valor** e sem simulação de sessão. Fila de sugestões e editor de contexto ficam para um PR
próprio, depois deste.

---

## 2. Decisões de arquitetura

### 2.1 Estilização: inline preservado + um `globals.css` pequeno

**Decisão.** Cada elemento do export vira um elemento React com o mesmo `style` inline,
convertido de string CSS para objeto camelCase por um script descartável (não à mão).
O `globals.css` guarda só quatro coisas: os estilos do `<helmet>`, os tokens dos dois temas,
as classes de hover, e nada mais. Regra do PR: nenhuma consolidação, nenhum "aproveitei e
limpei", nenhuma mudança de valor.

**Alternativas descartadas.**

- *Tailwind.* Exige reescrever toda declaração como utilitário e inventar arbitrary values
  para os ~30 tamanhos fracionários do export (`12.5px`, `9.5px`, `8.5px`, `68ch`,
  `letter-spacing: -0.015em`). É o caminho com maior chance de deriva de pixel e traz uma
  dependência de build. Descartado.
- *CSS Modules para tudo.* Permite colar o CSS literalmente (vantagem real), mas obriga a
  nomear ~60 classes e quebra a correspondência 1:1 entre o export e o código novo — que é
  justamente o que torna a revisão possível: abrir os dois arquivos lado a lado.
  Descartado, com a ressalva de que o risco de typo em camelCase é real e está tratado
  em §6.

### 2.2 `style-hover`: três classes utilitárias globais

`style-hover` não tem equivalente em style inline do React (pseudo-classe não existe em
atributo `style`). O export usa o atributo em 12 lugares, mas com apenas **três** efeitos
distintos:

| Efeito | Ocorrências (linhas do export) |
|---|---|
| `color: var(--txt)` | 29, 111, 240, 247 |
| `background: var(--hover)` | 31, 32, 125 |
| `border-color: var(--bordaHover)` | 79, 168, 185, 213, 240, 276 |

Viram três classes em `globals.css` (`.h-txt:hover`, `.h-fundo:hover`, `.h-borda:hover`),
combináveis — a linha 240 usa duas ao mesmo tempo. Custo: 6 linhas de CSS.

**Alternativas descartadas.** `onMouseEnter`/`onMouseLeave` com estado (transforma 12
elementos estáticos em componentes cliente e perde o hover em teclado/touch);
`styled-jsx`/CSS-in-JS (dependência inteira para 6 linhas de CSS).

### 2.3 Tema: paleta inteira em CSS vars, escolhida por `data-tema` no `<html>`

Hoje o tema é estado de cliente e existe em dois formatos: 13 CSS custom properties
(`TEMAS[x].vars`) aplicadas num `<div style>`, **e** ~20 campos JavaScript planos (`t.ok`,
`t.atn`, `t.chipBg`, `t.bordaForte`, `t.faixaAtiva`…) interpolados direto nos estilos inline.
Esse segundo grupo é o problema: se a cor só existe em JS, o servidor precisa saber o tema
para renderizar, e aí ou há flash ou há divergência de hidratação.

**Decisão.** Unificar tudo em CSS custom properties. Dos ~33 campos, 5 são duplicatas exatas
de vars já existentes (`txt`, `txt3`, `mut3`, `painel`, `borda`) e `mut` é idêntico a
`--mut2` nos dois temas. Sobram **14 tokens novos**: `--ok`, `--atn`, `--fal`, `--faint`,
`--borda-forte`, `--faixa-fundo`, `--faixa-ativa`, `--chip-bg`, `--chip-bg-esc`, `--chip-fg`,
`--chip-borda`, `--chip-borda-esc`, `--rodada-fundo`, `--tipo-forte`. Paleta final: **27
tokens**, declarados duas vezes em `globals.css` (`:root` = escuro, `[data-tema="claro"]` =
claro).

Consequências:

- Nenhum componente precisa saber o tema para escolher cor. O JS que hoje faz
  `cor: r.ok ? t.ok : t.fal` passa a fazer `cor: r.ok ? "var(--ok)" : "var(--fal)"` — segue
  dinâmico onde depende de dado, mas sem literal de cor.
- Anti-flash: um `<script>` de 3 linhas em `layout.tsx`, antes do `<body>`, lê
  `localStorage.tema` e escreve `document.documentElement.dataset.tema`. Roda antes da
  primeira pintura; o padrão continua escuro.
- O único componente cliente de tema é o botão do cabeçalho (alterna o atributo e grava no
  `localStorage`). O rótulo dele ("tema claro"/"tema escuro") depende do tema, então é
  renderizado após montar para não divergir na hidratação — é um `<div>` de 10px no canto,
  e essa é a única coisa da tela que aparece um frame depois.

**Alternativas descartadas.** `next-themes` (dependência para trocar um atributo, e não
resolveria o problema real, que é a paleta em JS); manter as cores em JS e passar o tema por
contexto (volta o flash e força `"use client"` em toda a árvore).

### 2.4 Roteamento: rotas reais, não estado

`/` (visão geral), `/projeto/[id]` (detalhe), `/configuracao`.

**Por quê.** Três motivos concretos, todos da etapa seguinte: (a) `loading.tsx` e `error.tsx`
por segmento resolvem carregando/erro sem escrever um único `if` — que é exatamente o que o
enunciado pede; (b) a busca de dados do detalhe é por projeto, e com rota ela acontece no
servidor, no segmento certo, sem carregar os seis projetos para mostrar um; (c) link direto
para um projeto é o que se quer às 7h da manhã.

O `id` da rota é o `uuid` da coluna `projeto.id`. Não inventar coluna de slug: o schema não
tem, e URL feia é problema menor que campo especulativo (o `CLAUDE.md` proíbe explicitamente
antever campo).

**Estado que continua local:** a rodada selecionada (`rodadaIdx`) — é seleção de UI, não
merece searchParam nem rota.

**Alternativa descartada.** Manter `tela` no estado: obrigaria a raiz inteira a ser
`"use client"`, fecharia a porta para Server Components e para os arquivos de estado por
rota. Descartado.

### 2.5 Server vs Client Components

| Arquivo | Tipo | Motivo |
|---|---|---|
| `layout.tsx` | server | shell, fontes, script de tema |
| `page.tsx` (as três) | server | leem o mock hoje, leem o banco depois; passam dados tipados para baixo |
| `Cabecalho` | client | `usePathname` para a cor do item ativo |
| `BotaoTema` | client | `localStorage` + atributo |
| `QuadroCadencias` + `CardProjeto` | client | drag and drop e as três variáveis de estado que ele usa |
| `PainelEtapa`, `CartaoAgente`, `ListaDocumentos`, `ListaAcessos` | server | só renderizam |
| `HistoricoRodadas` | client | seleção de rodada |
| `LinhaConfiguracao` | client | escolha de cadência por clique |

Regra que orienta a divisão: `"use client"` desce o mais fundo possível na árvore, e as
`page.tsx` nunca são cliente. Isso é o que permite, na etapa seguinte, a página buscar no
servidor e o filho interativo receber por prop.

### 2.6 Tipos: escritos à mão a partir do SQL, em dois arquivos

`src/dominio/tipos.ts` espelha as quatro tabelas. Cada `CHECK` de lista fechada vira uma
união de literais, com comentário apontando a linha da migration:

- `Frequencia = "toda_madrugada" | "dias_alternados" | "semanal"`
- `StatusRelatorio = "ok" | "atencao" | "falha"`
- `Esforco = "pequeno" | "medio" | "grande"`
- `Reversibilidade = "facil" | "dificil" | "nao_reverte"`
- `EstadoSugestao = "pendente" | "aprovada" | "recusada" | "feita"`

`src/dominio/visao.ts` guarda os modelos de visão (o que o template consome) e as funções que
os derivam das linhas. **Separar os dois arquivos é deliberado:** o que não tem tabela fica
visivelmente do lado de fora (ver §2.8).

**Alternativa descartada.** Gerar tipos do banco (`kysely-codegen`, `drizzle-kit`): traz
dependência, exige acesso ao banco no build e antecipa a escolha de ORM, que o `db/README.md`
adiou de propósito. Quatro tabelas cabem à mão.

### 2.7 O mock tem formato de linha, não de tela

Esta é a decisão que faz a etapa seguinte ser barata. O `DADOS` do export é achatado por
projeto (status, última rodada, testes e PR pendurados no projeto). No schema real, nada disso
está em `projeto`:

| Campo da tela | De onde vem no schema |
|---|---|
| `p.status`, `p.testesOk`, `p.testesCurto`, `p.ultimaRodada` | `relatorio` mais recente do projeto |
| `p.strip` (os chips) | `relatorio.achados_por_agente[].agente` do relatório mais recente |
| `p.prUrl` | `sugestao.pr_url` da sugestão `feita` mais recente |
| `p.resumo` | `relatorio.resumo` do relatório mais recente |
| `p.cadencia` | `projeto.frequencia` + `projeto.ativo` (ver §2.9) |
| `atual.docs` | `contexto` com `arquivo_url` preenchido |

Então `src/dados/mock.ts` exporta quatro arrays de linhas — como se viessem de um `SELECT` —
com os mesmos textos do export, e `visao.ts` faz as derivações acima. Na etapa seguinte, troca
o import do mock por uma consulta e os seletores continuam iguais.

### 2.8 O que a tela mostra e o schema não tem — não inventar tabela

Três blocos do export não têm origem no modelo de dados:

1. **Painel "onde estamos" (`etapa`)** — `titulo`, `selo`, `contador` ("etapa 4 de 6"),
   `autor`, `atualizado`, `dias`, `resumo`, `proximos[]`. É o maior bloco da tela de detalhe e
   não existe no schema nem na descrição de telas do `CLAUDE.md`.
2. **`docs`** — mapeia razoavelmente para `contexto` com `arquivo_url` (`nome` ≈ `tipo`,
   `local` não tem coluna).
3. **`acessos`** — deliberadamente ausente do schema. Ver §2.11.

**Decisão.** Nesta etapa, esses três renderizam de mock, com os tipos declarados em
`visao.ts` sob um comentário explícito de "sem origem no schema — decidir antes da etapa de
dados". Nada de criar migration, nada de esticar `relatorio` para caber `etapa`. O que fazer
com o painel de etapa é uma conversa de produto, não de migração — e a leitura provável é que
o espaço dele na tela seja onde a **fila de sugestões** vai morar.

### 2.9 A quarta faixa ("Pausado") não é uma frequência

O quadro da home tem quatro colunas: `diaria`, `alternada`, `semanal`, `pausado`. O schema tem
três frequências e um booleano `ativo` — e o comentário da tabela `projeto` é explícito:
*"pausar não muda a frequência configurada, só interrompe as rodadas"*.

Mapeamento, isolado em `src/dominio/cadencia.ts`:

| Coluna da UI | Estado no banco |
|---|---|
| Toda madrugada | `frequencia = 'toda_madrugada'`, `ativo = true` |
| Dias alternados | `frequencia = 'dias_alternados'`, `ativo = true` |
| Uma vez por semana | `frequencia = 'semanal'`, `ativo = true` |
| Pausado | `ativo = false` (qualquer frequência) |

Soltar um card em "Pausado" só muda `ativo`. Soltar um card *fora* de "Pausado" muda `ativo`
para `true` **e** grava a frequência da coluna de destino — porque o gesto do usuário já disse
qual ele quer, e ler a frequência antiga seria fazer o card voltar para uma coluna diferente
daquela onde ele foi solto. Nesta etapa isso é só estado local; a persistência vem depois, mas
a regra fica escrita agora para as duas etapas concordarem.

### 2.10 Drag and drop: HTML5 nativo, sem biblioteca

O export já resolve com `draggable`, `dataTransfer`, `onDragOver/Leave/Drop` e três variáveis
de estado (`arrastando`, `faixaAlvo`, e o mapa de cadências). Funciona, é ~25 linhas, e o
enunciado só pede que funcione visualmente. Portar como está.

**Alternativa descartada.** `dnd-kit` / `react-dnd`: dezenas de KB e uma reescrita da
interação para substituir algo que já existe pronto. Se um dia houver necessidade de
acessibilidade por teclado no quadro, isso vira sugestão própria.

### 2.11 Acessos: converter sem valor nenhum (nota de segurança)

**O problema, registrado.** Os mocks trazem em `acessos[].valor` strings no formato de
credencial — `postgres://prod:8fj2kd@ep-cofre.neon.tech/db`, `AKIA7C2LX9QP4RD1E8`,
`sk.eyJ1Ijoi4c9f2b7e11`, `authjs_…`, `re_…`, `cloudinary://…`. São valores fabricados (o
`design-original/README.md` confirma), mas o **padrão** viola a regra 1 do `CLAUDE.md` se for
copiado: hoje o valor é serializado para o cliente e o mascaramento é cosmético
(`"•".repeat(...)` calculado sobre o valor real, que continua no bundle). Um `revelar` de
clique único expõe a string. Se um dia alguém colar ali um valor de verdade, não há nenhuma
barreira técnica — só o hábito. E o schema, corretamente, não tem tabela de acessos.

**Como converter.** A seção continua existindo, com o mesmo layout e o mesmo espaçamento, mas:

- **Sai o campo de valor.** Não mascarado — inexistente. Nenhum tipo do app tem campo `valor`,
  logo não há o que vazar. O `<div>` do valor sai e o card fica com duas linhas em vez de três.
- **Ficam:** `rotulo` (ex.: "Neon — banco de produção"), `escopo` (`server-side`) e `gerido` +
  link (ex.: "Vercel env ↗"). Ou seja: *o que é, onde vive, quem administra*.
- **Sai o botão "revelar"** e o mapa `revelados`.
- **Sai o toggle de sessão** (`sessao`, `sessaoToggle`, "clique para simular o login do Vercel
  Authentication"). O acesso real é resolvido pelo Vercel Authentication, na plataforma, fora
  do código (regra 3) — simular sessão em estado de cliente é enfeite que ensina a coisa
  errada. O indicador de status do canto direito é removido junto com o gesto.
- **Fica a nota de segurança** do rodapé da seção, com o texto ajustado: os valores vivem nas
  environment variables do Vercel, o app não os lê nem os exibe, e para adicionar ou trocar
  usa-se o painel do Vercel.
- **Origem dos dados nesta etapa:** rótulos fabricados no mock. Rótulo não é segredo, mas eles
  também não têm tabela — então entram no bloco "sem origem no schema" da §2.8, e a decisão
  sobre onde essa lista deve viver de verdade fica para depois.

**Critério de aceite da tarefa:** `rg -i 'postgres://|AKIA|sk\.eyJ|authjs_|cloudinary://|re_[0-9a-f]{10}'`
não retorna nada fora de `design-original/`, e nenhum tipo em `src/` tem campo de valor de
credencial. Esta tarefa passa pelo `revisor-seguranca` antes do commit (obrigatório pelo
`CLAUDE.md`: toca exibição de dado sensível).

### 2.12 `contentEditable` sai desta etapa

O export tem seis campos `contentEditable` (nome do projeto, resumo do card, título e resumo
da etapa, cada próximo passo, nome na configuração) que gravam num mapa `textos` em memória.
Não há rota que persista nada disso, e três dos seis campos editam dados que **não têm tabela**
(`etapa`).

Campo que aceita edição e joga fora no refresh é pior que campo não editável. Sai nesta etapa
e volta onde o modelo suportar: nome do projeto quando existir o CRUD da configuração, e o
conteúdo do projeto no editor de contexto. Impacto visual: nenhum em repouso — só o
`cursor: text` no hover e a regra `[contenteditable]:focus` do `<helmet>`, que sai junto.

### 2.13 Fontes: manter o `<link>` do Google Fonts

`layout.tsx` reproduz os três elementos do `<helmet>` (dois `preconnect` + o `stylesheet`) com
o mesmo href, e os `font-family` continuam as mesmas strings
(`'Instrument Serif', Georgia, serif` e `'JetBrains Mono', monospace`).

**Alternativa descartada.** `next/font/google`: auto-hospeda e evita FOUT, mas troca o nome da
família por um gerado e muda a cadeia de fallback e as métricas de ajuste — exatamente o tipo
de mudança sutil que quebra "pixel-perfect" sem ninguém perceber. Numa etapa cujo único
critério é não mudar o visual, não vale. Pode virar sugestão depois, com comparação de
captura.

---

## 3. Estrutura de arquivos

```
Project-Organization/
├── package.json                       novo
├── tsconfig.json                      novo
├── next.config.ts                     novo (praticamente vazio)
├── next-env.d.ts                      gerado, versionado
├── src/
│   ├── app/
│   │   ├── layout.tsx                 shell, fontes, script de tema, cabeçalho
│   │   ├── globals.css                helmet + 27 tokens × 2 temas + 3 hovers
│   │   ├── page.tsx                   visão geral
│   │   ├── projeto/[id]/page.tsx      detalhe
│   │   └── configuracao/page.tsx      configuração
│   ├── componentes/
│   │   ├── Cabecalho.tsx              "use client"
│   │   ├── BotaoTema.tsx              "use client"
│   │   ├── QuadroCadencias.tsx        "use client"  faixas + drop
│   │   ├── CardProjeto.tsx            "use client"  drag
│   │   ├── PainelEtapa.tsx
│   │   ├── HistoricoRodadas.tsx       "use client"  seleção de rodada
│   │   ├── CartaoAgente.tsx
│   │   ├── ListaDocumentos.tsx
│   │   ├── ListaAcessos.tsx           sem campo de valor
│   │   └── LinhaConfiguracao.tsx      "use client"
│   ├── dominio/
│   │   ├── tipos.ts                   espelha as 4 tabelas
│   │   ├── cadencia.ts                faixa da UI <-> frequencia + ativo
│   │   ├── papeis.ts                  PAPEIS, LABEL, PESO, chips
│   │   └── visao.ts                   linhas -> modelos de visão
│   └── dados/
│       └── mock.ts                    linhas nos 4 formatos de tabela
├── docs/
│   ├── plano-conversao-nextjs.md      este arquivo
│   └── CHANGELOG.md                   criado na última tarefa
├── db/                                inalterado
└── design-original/                   inalterado, nunca importado pelo app
```

`src/app` em vez de `app/` na raiz: separa o código do app das pastas `db/` e
`design-original/`, e a Vercel detecta os dois igualmente sem configuração.

---

## 4. Dependências

Runtime:

| Pacote | Por quê |
|---|---|
| `next` | o framework pedido |
| `react`, `react-dom` | pares do Next |

Desenvolvimento:

| Pacote | Por quê |
|---|---|
| `typescript` | os tipos derivados do schema são metade do valor desta etapa |
| `@types/react`, `@types/react-dom`, `@types/node` | idem |

**É só isso.** Sem Tailwind (§2.1), sem `next-themes` (§2.3), sem biblioteca de drag and drop
(§2.10), sem ORM ou driver de banco (não há banco nesta etapa), sem `next/font` (§2.13), sem
biblioteca de teste (não há lógica a testar ainda; volta quando houver seletor e rota).

**ESLint fica de fora deste PR.** O Next não exige para buildar, e configurar linter no mesmo
PR da migração mistura duas conversas. Vira uma tarefa pequena depois.

Sem variável de ambiente nova. `DATABASE_URL` e `DATABASE_URL_UNPOOLED` existem no
`.env.local` e continuam sem uso até a etapa de dados.

---

## 5. Tarefas, em ordem

Uma tarefa = um PR. Nenhuma vai direto para a `main`.

**1. Esqueleto que builda** — `dev-frontend`
`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx` e uma `page.tsx`
mínima. Sem estilo, sem dado.
*Pronto quando:* `npm run build` passa localmente e o preview da Vercel sobe verde, sem
nenhuma configuração no painel além da que já existe.

**2. Tipos do domínio** — `dev-backend`
`src/dominio/tipos.ts` e `src/dominio/cadencia.ts`.
*Pronto quando:* cada `CHECK` de lista fechada da migration tem união correspondente, com
comentário apontando a linha do `.sql`; o mapeamento das quatro colunas da UI para
`frequencia`+`ativo` está no `cadencia.ts` e em nenhum outro lugar; `tsc --noEmit` passa.

**3. Mock em formato de linha + seletores** — `dev-backend`
`src/dados/mock.ts` (quatro arrays de linhas, com os textos do export e `uuid`s no lugar dos
slugs) e `src/dominio/visao.ts` + `papeis.ts`.
*Pronto quando:* os seletores reproduzem os números que a home mostra hoje — 5 em
acompanhamento, 2 PRs na fila, 1 com falha, e a frase
*"5 projetos em acompanhamento · 1 pede atenção agora · 2 PRs esperando revisão"* — e nenhuma
linha do mock tem campo que não exista na tabela correspondente (salvo os três blocos da §2.8,
que ficam em arquivo/seção separada e comentada).

**4. `globals.css` e os tokens de tema** — `dev-frontend`
Os 27 tokens nos dois temas, os estilos do `<helmet>`, as três classes de hover.
`html, body { background: var(--bg) }` no lugar do `#0a0b0d` literal (ver §6);
`::selection` fica com o literal do export.
*Pronto quando:* trocar `data-tema` no inspetor troca a página inteira, e não existe literal
hexadecimal de cor em nenhum arquivo `.tsx`.

**5. Layout, cabeçalho, tema e as três rotas vazias** — `dev-frontend`
`layout.tsx` com fontes e script anti-flash, `Cabecalho`, `BotaoTema`, e as três `page.tsx`
ainda em branco.
*Pronto quando:* recarregar no tema claro não pisca escuro em nenhum frame; navegar entre as
três rotas mantém o tema; o item de navegação ativo acompanha a URL.

**6. Tela de visão geral** — `dev-frontend`
Cabeçalho da página, os três totais, o quadro de quatro faixas, o card de projeto e o drag and
drop.
*Pronto quando:* captura lado a lado com o export, no mesmo tema e na mesma largura, não mostra
diferença; arrastar entre as quatro faixas move o card, muda o contador, acende a faixa alvo e
mostra o estado vazio; clicar num card navega para `/projeto/<uuid>`.

**7. Tela de detalhe** — `dev-frontend`, com **`revisor-seguranca` obrigatório antes do commit**
Painel de etapa (de mock, §2.8), tira de rodadas com seleção, grade de agentes, documentos e
acessos **sem campo de valor** (§2.11).
*Pronto quando:* a busca de padrão de credencial da §2.11 não retorna nada fora de
`design-original/`; nenhum tipo em `src/` tem campo de valor; o `revisor-seguranca` aprovou.

**8. Tela de configuração** — `dev-frontend`
Lista de projetos com os quatro botões de cadência.
*Pronto quando:* escolher a cadência aqui e arrastar na home produzem o mesmo estado (mesma
função de `cadencia.ts` nos dois caminhos).

**9. Documentação** — `escriba-docs`
Esta conversão é significativa por dois critérios do `CLAUDE.md` (troca de dependência
estrutural e telas viram rotas). Criar `docs/CHANGELOG.md`, registrar a estrutura de rotas e as
duas divergências aprovadas (§2.11 e §2.12), e corrigir o `db/README.md`, que ainda diz que a
migration *"não foi executada"* quando ela já foi aplicada.
*Pronto quando:* alguém que só leia `docs/` sabe onde fica cada tela e por que a seção de
acessos não tem valor.

Tarefas 1–3 são independentes de 4–5 e podem correr em paralelo; 6, 7 e 8 dependem de todas as
anteriores e são independentes entre si.

---

## 6. Riscos ao pixel-perfect, e o que fazer

| Risco | Mitigação |
|---|---|
| **Chave camelCase errada num style inline.** React ignora chave desconhecida em silêncio — a declaração some sem erro, sem aviso, sem log. É o risco número um deste plano. | Converter as strings de estilo por script, não à mão; e na revisão de cada tela, conferir a contagem de declarações por elemento contra o export. |
| **`style-hover` esquecido em algum dos 12 lugares.** Não aparece em captura estática. | A tabela da §2.2 é a checklist; passar o mouse pelos 12 sites é item de aceite das tarefas 6–8. |
| **Cor que ficou literal em vez de token.** Fica certa no escuro e errada no claro — e ninguém testa o claro. | Aceite da tarefa 4: nenhum hexadecimal em `.tsx`. Toda tela é revisada nos dois temas. |
| **Fonte carregando diferente.** Métrica diferente muda todo o espaçamento vertical. | `<link>` idêntico e strings de `font-family` idênticas (§2.13). Não trocar por `next/font` neste PR. |
| **`html,body { background }` virando `var(--bg)`.** Micro-divergência deliberada: o export deixa o fundo do documento fixo em `#0a0b0d`, o que aparece no overscroll do tema claro. | Registrado aqui como correção intencional. Se o dono preferir manter o comportamento do export, é uma linha. |
| **Reset do navegador.** O export roda dentro do runtime do Claude Design; o app novo não tem `normalize.css` nem o reset do Tailwind. | O `<helmet>` já zera `margin`/`padding` de `html, body`, que é o único reset de que o layout depende. Não adicionar reset nenhum — adicionar é que mudaria o visual. |
| **`suppressContentEditableWarning` e `hint-placeholder-*`.** Atributos do editor do Claude Design, sem significado em React. | Não portar. `hint-placeholder-count`/`-val` só orientavam o preview do editor. |
| **Larguras e responsividade.** O export é desktop, com `grid-template-columns: repeat(4, ...)` fixo e nenhuma media query. | Não adicionar breakpoint. Comparar sempre na mesma largura de janela. Responsividade, se for querida, é sugestão própria. |
| **`agora` e `saudacao` fixos** ("29 jul 2026 · 07:40", "Bom dia"). Calcular no servidor traria divergência de hidratação e horário errado. | Manter as strings do export nesta etapa e registrar como pendência. Relógio de verdade é componente cliente pós-montagem, em PR próprio. |

Método de verificação, para todas as telas: abrir o export (`file://` sobre
`design-original/`) e o app lado a lado, mesma largura, alternar tema nos dois, comparar. Não
existe teste automatizado de pixel neste plano e não vale criar um para seis telas-estado.

---

## 7. Fora de escopo

**Adiado de propósito, nesta ordem de prioridade depois da migração:**

1. **Fila de sugestões e editor de contexto** (tela de detalhe). Ver a recomendação abaixo.
2. Banco, rotas de API, e a troca do mock por consultas.
3. Estados de carregando/erro/vazio por rota — só fazem sentido quando houver busca real.
4. Persistência do drag and drop e do CRUD da configuração.
5. `contentEditable` de volta, onde o modelo suportar (§2.12).
6. ESLint, relógio ao vivo, `next/font`, responsividade, acessibilidade de teclado no quadro.

**Fora de escopo permanentemente, nesta forma:** exibição de valor de credencial (§2.11) e
simulação de sessão.

### Recomendação sobre os dois blocos novos

**Não entram nesta etapa.** Entram no PR seguinte, sozinhos.

*Custo de incluir agora:* eles não existem no export, logo alguém precisa **desenhá-los**. Isso
mistura, num PR só, "migração estrutural sem mudança visual" com "tela nova" — e destrói o
único critério de revisão que esta etapa tem, que é a comparação lado a lado (não se compara
uma tela que ganhou dois blocos). Pior: a fila de sugestões tem exigência de produto não
trivial no `CLAUDE.md` — reversibilidade `nao_reverte` precisa ficar **explícita antes** da
aprovação, o que é uma decisão de desenho, não um card a mais. E o editor de contexto esbarra
na regra 6 (validar tamanho e tipo, teto de 20.000 caracteres no schema), o que puxa validação
de formulário para dentro de um PR que não deveria ter nenhuma.

*Custo de adiar:* a coluna direita e o espaço do painel de etapa vão ser rearranjados de novo
quando os dois blocos chegarem. É rearranjo de bloco estático — barato, e mais barato que
revisar tudo junto.

*O que a migração deixa preparado:* os dois lugares ficam identificados no código, em
comentário — a fila de sugestões ocupa o espaço do painel "onde estamos" (§2.8), e o editor de
contexto entra na coluna direita, abaixo de "documentos". O tipo `Sugestao` já existe desde a
tarefa 2, e o mock já pode conter linhas de `sugestao` mesmo sem tela que as mostre.

---

## Perguntas abertas para o dono

Nenhuma delas bloqueia o começo (tarefas 1–5 seguem de qualquer jeito), mas as três primeiras
precisam de resposta antes da tarefa 7.

1. **Painel "onde estamos"**: mantém como bloco visual mockado até virar fila de sugestões, ou
   já sai da tela de detalhe nesta migração? Sair deixa um buraco grande no layout; manter
   preserva o visual aprovado. A recomendação é manter.
2. **Acessos**: a lista de rótulos por projeto deve continuar existindo (sem valor), ou a seção
   inteira vira uma nota fixa "credenciais são geridas no painel do Vercel"? O plano assume a
   primeira; a segunda é mais honesta com o fato de não haver tabela.
3. **`contentEditable`**: confirma a remoção nesta etapa (§2.12)?
4. **Fundo do documento no tema claro** (§6): corrigir para `var(--bg)` ou manter idêntico ao
   export?

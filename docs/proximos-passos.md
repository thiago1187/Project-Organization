# Próximos passos

Escrito em 2026-07-30, depois da primeira rodada noturna real — a que achou o
redirecionamento aberto no login. A partir daqui o sistema deixa de ser
suposição: ele rodou, e o que vem abaixo é reação ao que ele mostrou, mais
tudo que o dono pediu ao longo do dia.

**Revisado em 2026-07-30 (mesma data, passada seguinte do escriba):** a
maior parte da fila abaixo já foi construída. Itens marcados ✅ FEITO estão
implementados e verificados no código, não só planejados — o texto de cada um
foi mantido como registro do porquê, com uma nota do que mudou desde a
escrita original.

**Revisado de novo em 2026-07-30 (terceira passada do escriba, fim da
jornada):** os itens 8 (GitHub no cadastro) e 9 (redesenho visual) fecharam.
Todos os itens da fila original estão ✅ FEITO, exceto Configuração (item 9),
ainda no visual do export, e o que está descrito acima em "O que ainda
falta" do item 4 (`.docx`, publicar no Notion). Uma dívida nova entrou em
"Pendências menores": a descrição importada do GitHub não é marcada como tal
no campo onde é salva.

---

## O fluxo alvo

```
madrugada   routine lê o painel
            para cada projeto, aciona os agentes CONFIGURADOS NAQUELE PROJETO
            (3 projetos = 3 configurações diferentes)
            o foco da janela sem supervisão é TESTE
                    ↓
            diagnóstico + sugestões  →  painel
            mudança significativa    →  documento gerado, no painel
                    ↓
manhã       o dono lê, marca o que quer levar adiante
                    ↓
            [gerar prompt] → cola no Claude Code → o trabalho acontece agora,
                                                   com ele junto
```

**A routine nunca escreve. Em lugar nenhum.** Nem código, nem documentação, nem
connector. Tudo que ela produz nasce no painel. Se o dono quiser algo no
repositório, isso entra no prompt gerado e acontece com ele junto.

Este fluxo está implementado de ponta a ponta: gerador de prompt, fim da
execução na routine, esteira de agentes, tarefas e descrição do projeto, MCP,
documento de andamento. O que resta é a fila abaixo.

---

## Concluído desde a escrita original deste documento

**Gerador de prompt** — ✅ FEITO. O dono marca sugestões e tarefas, clica, e
recebe um prompt com o repositório, a descrição do projeto, o contexto
anexado, o diagnóstico da noite, o que foi marcado (com motivo, risco e
reversibilidade) e o que foi recusado, para não ser reproposto. `nao_reverte`
aparece com destaque. Ver `src/dominio/prompt.ts` e
`src/componentes/GeradorPrompt.tsx`.

**Fim da execução na routine** — ✅ FEITO. O prompt da rodada não cria branch,
não escreve código e não abre PR. `aprovada` significa "eu quero fazer isso",
não "a routine pode fazer". `pr_url` deixou de ser obrigatório (migration
`004`, aplicada).

---

## Fila, em ordem

### 1. Esteira de agentes por projeto — ✅ FEITO

Migration `005` aplicada. Cada projeto liga, desliga e ordena quais agentes o
diagnosticam, com instrução específica por agente e teto de sugestões próprio.
`GET /api/projects` devolve `agentes` de forma aditiva (degrada para a lista
fixa de sempre quando ausente ou vazia).

A esteira ganhou, além do planejado originalmente, o **sugestor de agentes**
(`src/dominio/sugestorAgentes.ts`, `docs/plano-gerenciador-de-projeto.md`
§ 4): sugere ligar um agente de leitura na esteira, ou convocar um de escrita
pelo prompt gerado, com base no histórico do projeto e no inventário — nunca
por ausência de dado, só por presença de evidência. Sugestão silencia assim
que o dono toca no agente, em qualquer direção.

A banda de execução continua **espelho, não formulário**: o painel lista quem
diagnostica, nunca quem executa.

### 2. Suíte de teste — ✅ FEITO

`docs/plano-testes.md` descreve os casos; a suíte com Vitest tem 114 testes,
cobrindo o gate de aprovação, a matriz de acesso, o redirecionamento seguro e
os validadores de entrada. O que ainda exige banco real (a trigger de
transição de estado, os `CHECK`s) fica registrado como pendência aceita no
próprio plano — não bloqueia o que já existe.

### 3. Madrugada orientada a teste — ✅ FEITO

`docs/routine-noturna.md`, passo 2.2b: a suíte é rodada duas vezes (achar
intermitência), a cobertura medida é a do que mudou desde a última rodada
(não a do projeto inteiro), e o resultado é comparado com o relatório
anterior. Teste do gate de aprovação recebe atenção máxima se mudar, falhar
ou for removido.

### 4. Documento de andamento — ✅ FEITO (núcleo), itens abertos abaixo

Tela `/projeto/[id]/documento`, sob demanda, com escolha de período (`7dias`,
`30dias`, `desde_ultima`, `tudo`) e duas vozes sobre os mesmos dados — técnica
(arquivo, teste, PR) e de andamento (zero jargão). Markdown é a fonte;
exportação em PDF é a impressão do navegador sobre a página, sem biblioteca
nova. Ver `src/dominio/documentoAndamento.ts`.

Convenção deliberada, não bug: rodadas e o que foi **concluído** (sugestão
feita, tarefa concluída) são recortados pelo período; o que ainda está em
aberto (sugestão pendente ou aprovada, tarefa em aberto) é sempre o estado
**atual**, sem corte — não faz sentido esconder uma decisão pendente antiga só
porque é anterior ao período escolhido, ela continua pendente.

**O que ainda falta, do plano original:**

- **`.docx`** — só vale quando o destinatário for editar de verdade; a
  conversão de Markdown sempre tropeça em tabela ou imagem. Ainda não
  construído.
- **Publicar no Notion** — o dono já tem Notion conectado; publicar como
  página dá o que `.docx` daria (editável, comentável) e soma link vivo. Ainda
  não construído. Lembrete de ator quando isso for feito: é o **painel**
  escrevendo no Notion quando o dono clica, nunca a routine escrevendo às 3h —
  só a segunda é proibida.

### 5. Inventário na tela — ✅ FEITO

Migration `002` aplicada. Responde *"o que tem dentro deste projeto"*: stack,
contas, serviços, e onde cada um é administrado, editável no lugar na tela de
detalhe. O mock morto (`ListaAcessos`, `AcessoMock`, `src/dados/mock.ts`) foi
removido do código.

Nenhuma coluna capaz de guardar segredo, e isso é estrutural — não existe
`valor`, `chave` nem `token`, os campos são rótulos curtos, e um tripwire
(`parece_credencial`) recusa o `INSERT`/`UPDATE` que tiver cara de credencial.

### 6. Projeto sem repositório — ✅ FEITO

Migration `007` aplicada: `projeto.repositorio` é opcional (nullable, mas
ainda validado como `dono/repo` quando informado). Projetos que vivem só num
connector (n8n, por exemplo) podem ser cadastrados sem repositório; a tela
sinaliza a ausência de PR e de histórico de commits nesse caso.

### 7. MCP — falar com o painel — ✅ FEITO

Servidor MCP em `POST /api/mcp`: sete ferramentas, cinco de leitura
(`listar_projetos`, `ver_rodadas`, `ver_sugestoes`, `ver_inventario`,
`ver_contexto`) e duas de escrita (`cadastrar_projeto`, `anexar_contexto`).
`aprovar_sugestao` fica de fora de propósito — aprovar continua sendo dois
cliques no painel. Documentação completa em `docs/mcp.md` (instalação,
troubleshooting, notas de desenho); não repetir aqui.

Decisão registrada em `docs/decisoes/002-mcp-segredo-proprio.md`: o MCP usa
segredo próprio (`PAINEL_MCP_SECRET`), distinto do bypass da routine — as
duas origens precisam continuar distinguíveis para sempre.

Confirmado: **Claude Code funciona** (header customizado, mesmo bypass da
routine para atravessar a borda). **claude.ai/conectores segue sem
confirmação** — não foi testado se o conector do claude.ai manda header
arbitrário; não prometer até verificar.

Busca semântica com embeddings segue descartada — `ILIKE` no Postgres resolve
o volume atual sem pipeline novo.

### 8. GitHub no cadastro — ✅ FEITO

Colar `dono/repo` ou a URL do GitHub traz nome, descrição, linguagens, último
commit, PRs abertos e um resumo do README, para pré-preencher o formulário de
cadastro. Nada é salvo sem o dono clicar — a busca só preenche campos, quem
decide gravar é o formulário de sempre. Ver `src/dominio/repositorioGithub.ts`
(normalização, testável sem rede), `src/servidor/github.ts` (o `fetch`) e
`src/servidor/acoes-github.ts` (a Server Action).

Sem `GITHUB_TOKEN`: 60 requisições por hora, compartilhadas por IP na Vercel —
pode já estar zerado quando o dono for usar. Com o token (fine-grained,
só leitura, lido apenas no servidor): 5.000/hora. A variável é **opcional**:
sua ausência não trava a importação, só reduz o teto.

A resposta do GitHub é texto de terceiro, tratado como entrada não confiável
(regra 6 do `CLAUDE.md`) — ver a entrada de 2026-07-30 no `CHANGELOG.md` sobre
os dois vetores que a revisão de segurança achou e a correção aplicada.
**Dívida que sobrou disso** na seção "Pendências menores", abaixo: a
descrição importada não fica marcada como tal no campo onde é salva.

### 9. Redesenho visual — em andamento

O `CLAUDE.md` já libera: intuitivo, maleável, futurista, sem perder
eficiência.

**Tela de detalhe do projeto — ✅ FEITO.** Faixa de resumo no cabeçalho com a
ação principal, fila de sugestões promovida a segundo lugar (logo abaixo do
resumo), seções de baixa frequência (histórico de rodadas, inventário)
recolhíveis por padrão, atalhos de teclado (`[`/`]` para navegar entre
projetos, `f`/`a`/`x` para agir na fila de sugestões). O documento de andamento
(item 4) já nasceu com o desenho novo, não com o do export.

**Visão geral — ✅ FEITO.** Painel de atenção no topo: os projetos que pedem
decisão agora, atravessando as três faixas de frequência, em vez de depender
de rolar até achar o card certo (`itensAtencao` em `src/dominio/visao.ts`).

**Tipografia — ✅ FEITO.** `Inter` (via `next/font`) no lugar de `Instrument
Serif`, herança do export; mono reservado a dado técnico; piso rígido de
12px; cinco níveis de botão (`src/componentes/estiloBotao.ts`); controle de
densidade (compacto/normal/confortável) salvo em `localStorage`
(`src/componentes/ControleDensidade.tsx`).

**Mapa dos agentes — ✅ FEITO, tela nova.** `/agentes` e `/agentes/:nome`:
cada agente como ficha — onde atua, o que achou, o que propôs, e a **taxa de
aprovação** das próprias sugestões, com o raciocínio de por que esse número
registrado em `docs/decisoes/004-taxa-de-aprovacao-do-agente.md`.

**Configuração — ainda no visual herdado do export.** Não priorizado ainda; o
argumento original de "desenhar por último, sobre uma tela que já reage"
segue valendo para essa.

---

## Pendências menores

- **Procedência da descrição importada do GitHub não é marcada.** A revisão
  de segurança recomendou sinalizar que uma descrição veio de fora, e isso
  não foi feito: `projeto.descricao` guarda no mesmo campo tanto a prosa que
  o dono escreve quanto a descrição trazida do GitHub, sem diferença visível
  entre as duas. Corrigir exige uma coluna nova (migration) e o dono decide
  se quer isso — não é urgente na mesma medida dos dois vetores de injeção já
  corrigidos (ver `CHANGELOG.md`, 2026-07-30), porque aqui a atenuante é
  real: diferente do contexto que o MCP escreve direto, a descrição importada
  passa pelos olhos do dono no formulário antes de ser salva — ele vê o texto
  (já sanitizado) e decide gravar ou não. Marcar a procedência reduziria mais
  ainda a chance de ele confundir "isso eu escrevi" com "isso veio de fora",
  não é a última linha de defesa.
- ~~Migrations `008` a `011` escritas e não aplicadas~~ — o dono aplicou as quatro
  em 2026-07-30, junto com a `007`. O schema no ar bate com `db/migrations/`.
  Aguardando aprovação do dono para aplicar (trava de schema, ver
  `CLAUDE.md`). Até lá: `projeto.descricao` sempre `null`, `tarefa` sempre
  vazia, escrita de contexto com `origem = 'mcp'` falha no banco, e `/entrar`
  funciona sem trava de tentativas. Ver `db/README.md` para o comando de
  aplicar cada uma.
- **Segredo do bypass em texto claro no prompt da routine.** Foi a única saída
  (a caixa de environment avisa para não pôr segredo). Rotacionar quando
  houver lugar melhor.
- **Uma routine por conjunto de repositórios.** Ao cadastrar projeto no
  painel, é preciso lembrar de adicionar o repositório na lista da routine. A
  falha é silenciosa: vira `falha` no relatório da manhã seguinte. O painel
  deveria avisar.

### Corrigido desde a escrita original (removido da lista de pendências)

- ~~`estiloCampo.ts` zerava o `outline` do foco~~ — corrigido. Estilo inline
  vencia a regra global `:focus-visible` de `globals.css` em todo campo de
  formulário; quem navegava por teclado perdia o anel de foco. Removido o
  `outline: "none"`; o comentário no topo de `src/componentes/estiloCampo.ts`
  registra o porquê para não voltar por descuido.
- ~~Limite de tentativas no `/entrar`~~ — escrito (migration `011`), aguardando
  aplicação; ver pendência acima.
- ~~Selo de status errado ("PR aberto" sem PR nenhum)~~ — corrigido.
- ~~Relógio do cabeçalho é texto fixo~~ — corrigido; `src/componentes/Relogio.tsx`
  mostra a hora real, calculada só depois de montar (evita divergência de
  hidratação entre servidor e cliente).
- ~~Saudação sempre "Bom dia"~~ — corrigido; `src/componentes/Saudacao.tsx`
  muda com a hora (bom dia / boa tarde / boa noite), mesma técnica do
  relógio (calcula só depois de montar, para não divergir na hidratação).
- ~~"Hoje" travado em 29 de julho de 2026~~ — corrigido; a data usada para
  decidir se um relatório é "de hoje" (`hojeNoFusoDoDono` em
  `src/dominio/visao.ts`) vinha escrita à mão desde a conversão para
  Next.js. Agora vem do relógio, no fuso `America/Sao_Paulo`.
- ~~Migrations `002` e `003` escritas e não aplicadas~~ — as duas foram
  aplicadas em 2026-07-30.
- ~~`devops-deploy` classificado como agente de escrita em `papeis.ts`~~ —
  corrigido; `papeis.ts` documenta a correção no próprio cabeçalho do arquivo.

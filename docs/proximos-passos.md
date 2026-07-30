# Próximos passos

Escrito em 2026-07-30, logo depois da primeira rodada noturna real — a que
achou o redirecionamento aberto no login. A partir daqui o sistema deixa de
ser suposição: ele rodou, e o que vem abaixo é reação ao que ele mostrou.

Ordem por valor, não por facilidade.

---

## 1. Gerador de prompt — a mudança de rumo

Ideia do dono, e ela é melhor que o desenho original.

**Como é hoje:** ele aprova de manhã, e a rodada da noite seguinte escreve o
código sozinha. O trabalho sai 24h depois, feito sem supervisão, num ambiente
onde nenhum dos 16 agentes existe.

**Como fica:** ele marca o que quer na tela do projeto, clica em um botão, e o
painel devolve um prompt pronto para colar no Claude Code. O trabalho acontece
na hora, com ele junto e com os agentes disponíveis.

O prompt gerado carrega o que ele teria que reexplicar à mão:

- repositório e stack
- o contexto anexado no painel (modelo de design, restrições)
- o diagnóstico da noite — o que cada agente achou
- as sugestões marcadas, com motivo, risco e reversibilidade
- **as sugestões recusadas**, para o Claude não repropor o que já foi negado

O último item é o que ninguém pensa e o que mais economiza tempo.

## 2. Tirar a execução da routine

Consequência direta do item 1. Hoje o passo 2.5 do `docs/routine-noturna.md`
manda a rodada executar sugestão aprovada: criar branch, escrever código, abrir
PR. Com o gerador, esse passo perde a razão de existir.

A rodada passa a **só ler**. Nunca cria branch, nunca abre PR, nunca toca em
código.

E `aprovada` muda de significado: deixa de ser "a routine pode fazer" e passa a
ser "eu quero fazer isso, põe no meu prompt".

Some a única parte do sistema onde código muda sem ninguém olhando. O painel
fica mais simples de explicar e mais difícil de usar errado.

## 3. Reorientar a madrugada para testes

Também do dono: *"o que ele pode fazer de madrugada e deve fazer é testes"*.

Encaixa perfeitamente. Rodar teste é somente leitura, produz sinal duro
(passou, falhou, cobertura, teste intermitente) e é chato de fazer à mão. É o
melhor uso possível de uma janela sem supervisão.

Hoje o prompt trata a suíte como uma checagem entre outras. Deveria ser o eixo:
rodar, rodar de novo para achar teste intermitente, medir cobertura do que
mudou, e reportar o delta em relação à noite anterior.

Este repositório não tem suíte nenhuma — a própria rodada apontou isso. É a
primeira coisa a resolver para o item existir.

## 4. Projeto sem repositório

O dono tem projetos que vivem só no n8n. Hoje eles não entram: `repositorio` é
obrigatório, único e validado como `dono/repo`.

E há um segundo bloqueio, mais escondido: marcar sugestão como `feita` exige
`pr_url` começando com `https://github.com/`. Workflow de n8n não tem PR — a
sugestão ficaria presa em `aprovada` para sempre.

Precisa de migration: `repositorio` aceita vazio, `pr_url` deixa de ser
obrigatório e de exigir GitHub. A tela precisa deixar claro que ali não existe
PR nem histórico de commits.

*(O item 2 reduz parte disso: sem execução, `feita` é marcada pelo dono e o
`pr_url` vira opcional naturalmente.)*

## 5. MCP — falar com o painel

Servidor MCP em `/api/mcp`, expondo `listar_projetos`, `ver_rodadas`,
`ver_sugestoes`, `cadastrar_projeto`, `anexar_contexto`.

**Claude Code funciona hoje** — aceita header customizado, então usa o mesmo
bypass da routine. Sem OAuth, sem trabalho extra.

**claude.ai no chat é incerto** — o painel está atrás do Vercel Authentication
e conector não manda header arbitrário. Precisa confirmar o que ele aceita
antes de prometer.

`aprovar_sugestao` fica **de fora** de propósito. Todo o desenho se apoia em
"só o dono aprova"; um modelo num chat pode ser dirigido por texto que ele leu.
Aprovar continua sendo dois cliques no painel — é o único lugar onde fricção
vale a pena.

## 6. GitHub no cadastro

Colar `dono/repo` e trazer nome, descrição, README, linguagens, último commit,
PRs abertos. Alimenta o cadastro e pode auto-preencher o inventário.

Repositório público não precisa de token, mas são 60 requisições por hora por
IP — e na Vercel o IP é compartilhado. Para uso real, PAT fine-grained só de
leitura.

## 7. Esteira de agentes por projeto

O `docs/plano-agentes-por-projeto.md` tem o desenho. O achado que importa:
**12 dos 16 agentes nunca rodam** — o prompt tem quatro fixos, iguais em todo
projeto, e não há como mudar.

O arquiteto recusou o canvas estilo n8n, e o argumento é bom: este app não
executa nada, então o canvas desenharia uma configuração que outro processo lê
às 3h. As arestas não carregariam nada. No lugar, uma esteira: três bandas,
arrastar liga e ordena, clicar edita a instrução.

## 8. Redesenho visual

O `CLAUDE.md` já liberou: intuitivo, maleável, futurista, sem perder
eficiência. O `designer-ui` ainda não passou.

Fica por último de propósito — desenhar sobre uma tela que já reage vale mais
que desenhar sobre mock.

---

## Pendências menores, anotadas

- **Limite de tentativas no `/entrar`.** Não existe. Senha memorável fica
  adivinhável se a proteção de borda cair.
- **Relógio do cabeçalho é texto fixo** (`29 jul 2026 · 07:40`), herdado do
  export.
- **Selo de status do projeto parece errado:** mostra "PR aberto" com zero PRs
  abertos e três sugestões pendentes. Conferir a derivação em `visao.ts`.
- **Migrations `002` (inventário) e `003` (tetos) escritas e não aplicadas.**
- **`devops-deploy` está classificado como agente de escrita** em `papeis.ts`,
  mas o prompt o aciona entre os somente-leitura. Resolver antes da esteira.
- **`src/dados/mock.ts` está morto** — nenhuma tela importa. Remover.
- **Segredo do bypass está em texto claro no prompt da routine.** Foi a única
  saída (a caixa de environment avisa para não pôr segredo). Rotacionar quando
  houver lugar melhor.

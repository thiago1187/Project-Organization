# Próximos passos

Escrito em 2026-07-30, depois da primeira rodada noturna real — a que achou o
redirecionamento aberto no login. A partir daqui o sistema deixa de ser
suposição: ele rodou, e o que vem abaixo é reação ao que ele mostrou, mais
tudo que o dono pediu ao longo do dia.

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

---

## Em construção agora

**Gerador de prompt** — o dono marca as sugestões que quer, clica, e recebe um
prompt com o repositório, o contexto anexado, o diagnóstico da noite, as
sugestões marcadas (com motivo, risco e reversibilidade) e as recusadas, para
não serem repropostas. `nao_reverte` aparece com destaque.

**Fim da execução na routine** — remove o passo 2.5 do prompt da rodada. Ela
deixa de criar branch, escrever código e abrir PR. `aprovada` passa a
significar "eu quero fazer isso", não "a routine pode fazer". Afrouxa o
`pr_url`, que era obrigatório e exigia GitHub (migration `004`).

---

## Fila, em ordem

### 1. Esteira de agentes por projeto

**O pedido:** *"qual agente precisa ser ativado todo dia naquele projeto, ou o
que aquele agente vai ter"*.

**O achado que justifica:** hoje **12 dos 16 agentes nunca rodam**. O prompt da
rodada tem quatro fixos, escritos à mão, iguais em todo projeto. `designer-ui`,
`engenheiro-ia`, `avaliador-ia`, `investigador-bugs` nunca são acionados, e não
há como mudar isso.

Desenho fechado em `docs/plano-agentes-por-projeto.md`: três bandas, arrastar
liga e ordena, clicar edita a instrução daquele agente naquele projeto. O
canvas estilo n8n foi recusado com argumento — este app não executa nada, então
o grafo desenharia uma configuração que outro processo lê às 3h, e as arestas
não carregariam nada.

A banda de execução é **espelho, não formulário**: o painel lista quem
diagnostica, nunca quem executa. A esteira não pode virar contorno do portão.

### 2. Suíte de teste

Precisa existir antes de a madrugada virar sobre testes. E é uma das três
sugestões que a própria rodada mandou — o sistema pedindo o que precisa para
melhorar a si mesmo.

### 3. Madrugada orientada a teste

Rodar teste é somente leitura, produz sinal duro e é chato de fazer à mão. É o
melhor uso de uma janela sem supervisão.

Hoje o prompt trata a suíte como uma checagem entre outras. Deveria ser o eixo:
rodar, rodar de novo para achar teste intermitente, medir cobertura do que
mudou, reportar o delta em relação à noite anterior.

### 4. Documento de andamento

**Para quem:** equipe, sócio, cliente — gente que quer saber como o projeto vai,
não o que quebrou em qual arquivo.

**Duas vozes sobre os mesmos dados:**

| Voz | Para quem | Como fala |
|---|---|---|
| Técnica | O dono, a equipe | Arquivo, linha, função, número de teste |
| Andamento | Sócio, cliente | O que mudou na prática, o que falta, o que preocupa. Zero jargão. |

**Sob demanda**, com escolha de período — a rodada não sabe quando é a reunião.
O gatilho automático por mudança grande continua, mas o botão é o que vai ser
usado.

**Formatos:** Markdown é a fonte (legível cru, cabe no banco, versiona,
converte). Exportação em `.pdf` primeiro, que é previsível e não desconfigura.
`.docx` depois, se o destinatário for editar de verdade — a conversão sempre
tropeça em tabela ou imagem, então só vale quando o destino é edição.

**Uma alternativa que provavelmente é melhor que Word:** o dono já tem Notion
conectado. Publicar o relatório como página do Notion dá o que o `.docx` daria
— editável, comentável — e mais: link vivo, que o sócio abre quando quiser sem
precisar de arquivo circulando por e-mail em três versões diferentes.

Atenção ao ator: isso é o **painel** escrevendo no Notion quando o dono clica,
não a routine escrevendo às 3h. São coisas diferentes, e só a segunda está
proibida. Escrita por clique do dono, num destino que ele escolheu, tem
supervisão por definição.

### 5. Inventário na tela

Migration `002` está escrita e **não aplicada**. Responde *"o que tem dentro
deste projeto"*: stack, contas, serviços, e onde cada um é administrado.

Nenhuma coluna capaz de guardar segredo, e isso é estrutural — não existe
`valor`, `chave` nem `token`, os campos são rótulos curtos, e não há campo de
notas que vire válvula de escape.

### 6. Projeto sem repositório

O dono tem projetos que vivem só no n8n. Hoje não entram: `repositorio` é
obrigatório, único e validado como `dono/repo`.

O item "fim da execução" já resolve metade — sem execução automática, `pr_url`
deixa de ser obrigatório. Falta tornar `repositorio` opcional e a tela dizer que
ali não existe PR nem histórico de commits.

### 7. MCP — falar com o painel

`listar_projetos`, `ver_rodadas`, `ver_sugestoes`, `cadastrar_projeto`,
`anexar_contexto`. *"Adiciona esse projeto no painel"* direto do chat.

**Claude Code funciona hoje** — aceita header customizado, usa o mesmo bypass da
routine. Sem OAuth.

**claude.ai é incerto** — o painel está atrás do Vercel Authentication e
conector não manda header arbitrário. Confirmar antes de prometer.

`aprovar_sugestao` fica **de fora**: todo o desenho se apoia em "só o dono
aprova", e um modelo num chat pode ser dirigido por texto que leu. Aprovar
continua sendo dois cliques no painel.

### 8. GitHub no cadastro

Colar `dono/repo` e trazer nome, descrição, README, linguagens, último commit,
PRs abertos. Alimenta o cadastro e pode auto-preencher o inventário.

Público não precisa de token, mas são 60 requisições por hora por IP — e na
Vercel o IP é compartilhado. Para uso real, PAT fine-grained só de leitura.

### 9. Redesenho visual

O `CLAUDE.md` já liberou: intuitivo, maleável, futurista, sem perder eficiência.
O `designer-ui` ainda não passou.

Por último de propósito — desenhar sobre uma tela que já reage vale mais que
desenhar sobre mock. Quando chegar, também desenha o documento do item 4.

---

## Pendências menores

- **Limite de tentativas no `/entrar`.** Não existe. Senha memorável fica
  adivinhável se a proteção de borda cair.
- **Selo de status errado:** mostra "PR aberto" com zero PRs e três sugestões
  pendentes. Conferir a derivação em `visao.ts`.
- **Relógio do cabeçalho é texto fixo** (`29 jul 2026 · 07:40`), herdado do
  export.
- **Migrations `002` e `003` escritas e não aplicadas.**
- **`devops-deploy` classificado como agente de escrita** em `papeis.ts`, mas o
  prompt o aciona entre os somente-leitura. Resolver antes da esteira.
- **`src/dados/mock.ts` está morto** — nenhuma tela importa. Remover.
- **Segredo do bypass em texto claro no prompt da routine.** Foi a única saída
  (a caixa de environment avisa para não pôr segredo). Rotacionar quando houver
  lugar melhor.
- **Uma routine por conjunto de repositórios.** Ao cadastrar projeto no painel,
  é preciso lembrar de adicionar o repositório na lista da routine. A falha é
  silenciosa: vira `falha` no relatório da manhã seguinte. O painel deveria
  avisar.

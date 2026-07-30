# A visão

Este documento existe porque a visão do produto se perde no meio de decisões
técnicas, e cada agente novo que entra precisa dela para não construir a coisa
certa do jeito errado. Ele descreve o destino, não o caminho.

## O que o dono quer sentir

> "Acordar e os meus agentes terem revisado, testado e dado sugestões dos
> projetos que eu pedi pra eles olharem, e eu só aceitar ou recusar."

Não é um relatório. É uma **sala de controle**. A diferença importa:

- Relatório é passivo. Você lê e depois vai fazer alguma coisa em outro lugar.
- Sala de controle é ativa. O que você lê e o que você comanda são a mesma tela.

O painel só está pronto quando a distância entre "vi que precisa" e "mandei
fazer" é um clique — e quando o dono confia o bastante para dar esse clique
sem abrir o repositório para conferir.

## As quatro coisas que o painel precisa responder

Numa manhã, em ordem de urgência:

1. **O que aconteceu essa noite?** O que rodou, o que achou, o que quebrou.
2. **O que precisa de mim?** A fila de sugestões esperando aceitar ou recusar.
3. **Como está cada projeto?** Estado atual, não histórico.
4. **O que tem dentro deste projeto?** Stack, contas, APIs, onde cada coisa é
   administrada, documentos.

As três primeiras já estão no modelo de dados. A quarta é inventário e ainda
não tem casa — ver "O que falta ser desenhado" abaixo.

## Duas velocidades, sempre

Este é o princípio de interface mais importante do projeto, e vale igualmente
para as telas e para como os agentes reportam:

> **Direto por padrão, detalhado sob demanda.**

Às vezes o dono quer velocidade: uma linha por projeto, olhar de cinco
segundos, seguir a vida. Às vezes quer profundidade: por que o agente sugeriu
isso, o que exatamente ele leu, o que pode quebrar.

As duas precisam existir **na mesma tela**, não em telas diferentes. O resumo
é a porta; o detalhe abre a partir dele. Uma interface que só tem o resumo
força a abrir o repositório. Uma que só tem o detalhe cansa e deixa de ser
usada em duas semanas.

Regra prática: se o dono precisa rolar para saber se algo exige atenção, o
resumo falhou.

## O que torna a coisa segura de existir

A rodada noturna roda sem ninguém acordado. Três propriedades sustentam isso:

1. **Ela não altera código.** Diagnostica e propõe.
2. **Nada vira trabalho sem aprovação explícita.**
3. **Quando executa, vai por pull request.** Nunca merge direto.

Isso é o que torna "reverter" barato: se nada foi feito sem aprovação, quase
nunca há o que desfazer. E é o que permite afrouxar depois com segurança — dá
para dar mais autonomia a um sistema em que se confia, mas não dá para
recuperar a confiança de um sistema que quebrou algo enquanto ninguém olhava.

**Comece conservador e afrouxe. Nunca o contrário.**

## O gargalo real não é técnico

O painel pode estar perfeito e a sensação não existir. O que decide é a
**qualidade das sugestões**: o dono só vai aprovar rápido quando confiar que
o que chega presta.

Isso tem consequência de projeto: é melhor um agente propor três coisas boas
que quinze medianas. Fila cheia de ruído treina a pessoa a ignorar a fila —
e aí o produto morreu, mesmo funcionando.

## Documentação

Não precisa ser diária. Precisa ser **verdadeira**: documentação desatualizada
é pior que ausente, porque engana. O gatilho é mudança significativa, não
passagem de tempo — a lista está no `CLAUDE.md`.

## O que falta ser desenhado

**Inventário de projeto** — stack, contas, APIs e serviços usados em cada
projeto, e onde cada um é administrado. Hoje não existe no modelo de dados; a
seção de acessos do export é a única coisa que aponta para isso, e ela guarda
valores de credencial no cliente, o que não pode ir para o produto.

A distinção que resolve: **inventário não é credencial.** Guardar "este projeto
usa Neon, na conta X, administrado no painel da Vercel" é inventário e é útil.
Guardar a connection string é credencial e está proibido pela regra 1.

## O teste final

O dono abre o painel de manhã com o café. Em cinco segundos sabe se algo
precisa dele. Em trinta, sabe o quê. Em dois minutos, aprovou o que fazia
sentido e recusou o resto. Fecha o notebook.

Se isso acontece, funcionou.

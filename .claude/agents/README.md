# Agentes versionados neste repositório

Cópia dos agentes que a **esteira deste projeto** aciona, para que a rodada
noturna os encontre.

## Por que existem aqui

As definições de verdade vivem em `~/.claude/agents/`, na máquina do dono — que
não é a máquina onde a routine roda. Sem esta pasta, o ambiente da madrugada
não tem subagente nenhum.

O prompt da rodada trata esse caso com honestidade (`docs/routine-noturna.md`,
passo 2.2): quando o subagente não existe, ela faz a leitura equivalente
sozinha e registra o achado como `"agente": "rodada"`, **nunca** sob o nome de
um agente que não rodou. Foi o que aconteceu em todas as rodadas até 03/08 — o
mapa dos agentes mostrava um `RN` aceso e os outros cinco apagados, dizendo
exatamente a verdade: só a própria rodada olhou.

Isso funcionou, mas entrega menos. Um `revisor-seguranca` de verdade lê com um
ofício; a rodada genérica lê com atenção dividida entre seis papéis.

## O que está aqui, e o que não está

Só os agentes que a esteira deste projeto usa. Os 17 de `~/.claude/agents/`
não entram: agente que este projeto não aciona seria peso morto em revisão e
mais uma cópia para envelhecer.

**Estes arquivos são cópia.** A fonte continua sendo `~/.claude/agents/`. Ao
mudar um agente lá, traga a mudança para cá — se as duas versões divergirem, a
rodada usa esta, e o dono depura a errada.

## Se você adicionar um agente à esteira pela tela

Copie a definição dele para cá também, senão a rodada seguinte volta a
registrar `rodada` no lugar dele — e o mapa dos agentes vai mostrar o cartão
apagado, que é o sinal de que faltou este passo.

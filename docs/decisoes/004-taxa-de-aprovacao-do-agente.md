# 004 — a taxa de aprovação é o número em destaque na ficha do agente, sempre pareada com a contagem

## O problema

A tela `/agentes/:nome` (mapa dos agentes) precisa de um número que resuma,
de relance, se um agente está calibrado — se o que ele propõe é, no geral, o
que o dono quer. O candidato óbvio é a taxa de aprovação: das sugestões que o
dono já decidiu, quantas ele aprovou.

Dois jeitos óbvios de mostrar esse número dão errado:

- Mostrar só a porcentagem, sem a contagem. Um agente com uma única sugestão
  decidida e ela aprovada mostra "100%" — que parece calibração perfeita e é,
  na verdade, ausência de amostra. O oposto também engana: uma recusada em
  duas mostra "50%", que soa péssimo para um histórico curto demais para
  significar qualquer coisa.
- Calcular a taxa mesmo quando não há nenhuma decisão. Um agente recém-ligado
  numa esteira, que ainda não teve sugestão nenhuma decidida pelo dono,
  dividiria zero por zero — e a saída mais comum para esse caso, "0%", tem
  cara de reputação ruim. É indistinguível, de relance, de "o dono recusou
  tudo que esse agente propôs".

## O que foi decidido

Duas peças, juntas:

1. **A taxa nunca aparece sozinha.** Sempre ao lado da contagem que a
   origina — "8 de 10 decisões", não só "80%". O número grande dá a
   resposta rápida; a contagem ao lado é o que permite ao dono julgar se
   aquele número já significa alguma coisa. Ver `ReputacaoVM` em
   `src/dominio/agentes.ts` (`aprovadas`, `decididas`, `taxaPct`) e o
   texto sob o número em `src/app/agentes/[nome]/page.tsx`.
2. **Zero decisões vira "—", não "0%".** `taxaPct` é `null` quando
   `decididas === 0`, e a tela mostra um travessão com a legenda "sem
   decisão sua ainda" em vez de calcular qualquer porcentagem. Taxa sobre
   zero decisões não é uma taxa baixa — é a ausência de uma taxa.

Sugestões `pendentes` não entram na conta (nem no numerador, nem no
denominador): só entram as que o dono já decidiu (`aprovada`, `recusada`,
`feita` — sendo `aprovada` e `feita` contadas como "sim").

## O que foi descartado

**Mostrar a porcentagem sozinha, com a contagem só no tooltip ou expandida.**
É o desenho mais comum de indicador de reputação (loja de aplicativo,
plataforma de freelancer), e é exatamente o problema aqui: essas telas têm
volume alto o bastante para a porcentagem já carregar significado sozinha.
Este painel tem um agente rodando em, no máximo, poucos projetos, com no
máximo três sugestões por rodada — o volume nunca chega a esse ponto, e
esconder a contagem atrás de uma interação a mais é esconder justamente o
dado que diz se o número já quer dizer algo.

**Piso mínimo de decisões antes de mostrar taxa** (por exemplo, só calcular
com 5 ou mais). Resolveria o "100% com uma sugestão" escondendo o número até
ter volume — mas troca um enganoso por um ausente sem explicação: a tela
mostraria "—" também para um agente com 4 decisões reais, e o dono não teria
como saber se é "sem dado" ou "quase lá". A contagem ao lado do número já
resolve o mesmo problema sem esconder informação real; um piso arbitrário
some com a menor amostra em vez de expor com honestidade.

**Cor whatever a taxa, sem nível "sem dado".** A tela usa três cores (`--ok`
≥ 70%, `--atn` 40–69%, `--fal` < 40%, ver `corReputacao` em
`src/app/agentes/[nome]/page.tsx`) e uma quarta, neutra (`--mut3`), só para
`taxaPct === null`. Reaproveitar a cor de "baixa calibração" para "sem
decisão" pintaria o cartão de vermelho para um agente que só está esperando
o dono decidir alguma coisa — mesma classe de erro que "0%".

## Por que isso importa o suficiente para virar registro

O número existe para o dono confiar nele de relance, sem reler a lista de
sugestões debaixo. Um indicador que mente por omissão em amostra pequena — e
amostra pequena é o caso comum aqui, não a exceção, porque a fila é
deliberadamente magra (`docs/routine-noturna.md`, "Qualidade da fila: barra
de evidência mais teto de três") — treina o dono a desconfiar do painel
inteiro, não só desse número. É o tipo de detalhe que alguém "simplifica"
depois — tirando a contagem porque "polui", ou trocando `null` por `0` porque
"é mais simples" — sem perceber que a simplificação devolve exatamente o
enganoso que a decisão original evitou.

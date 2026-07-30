# 002 — o MCP usa um segredo próprio, não o bypass da routine

## O problema

O servidor MCP (`POST /api/mcp`) precisa autenticar o Claude Code do dono, no
terminal dele. O painel já tinha um segredo de bypass (`PAINEL_BYPASS_SECRET`)
que a rodada noturna usa para atravessar o Vercel Authentication na borda.
Reaproveitar esse mesmo segredo para o MCP pareceria a solução óbvia — um
segredo a menos para gerar e guardar.

## O que foi decidido

O MCP tem o próprio segredo, `PAINEL_MCP_SECRET`, enviado no header
`x-painel-mcp-secret`. O Claude Code do dono manda **os dois** headers — o do
MCP e o de bypass — porque o bypass é o que atravessa o Vercel Authentication
na borda; sem ele a requisição nem chega ao app. O segredo do MCP é o que
distingue, depois da borda, "isto é o dono no terminal" de "isto é a rodada às
3h".

Na camada de acesso (`src/servidor/acesso.ts`), isso vira três origens
distintas — sessão, `mcp`, `bypass` — com poderes diferentes:
`exigirSessaoDoDono()` só aceita sessão; `exigirDonoOuMcp()` aceita sessão ou
`mcp`, nunca bypass puro; `exigirAcesso()` aceita as três, para leitura.

## O que foi descartado

**Usar só o bypass para o MCP também.** Funcionaria tecnicamente — o bypass já
atravessa a borda — mas apagaria a distinção entre as duas origens. Se o MCP
se apoiasse só nele, "a routine às 3h" e "o dono no terminal" virariam a mesma
coisa para o painel. Toda regra futura do tipo "a routine não pode escrever
contexto" passaria a proibir o dono também, ou afrouxar algo para o dono abrir
a porta para a rodada sem supervisão. As duas origens precisam continuar
distinguíveis para sempre, e um segredo compartilhado destruiria isso hoje.

## Por que isso importa o suficiente para virar registro

A regra central do projeto é que a rodada noturna não escreve — nem código,
nem contexto, nem connector. Contexto vira instrução no `CLAUDE.md` do
repositório alvo, e um agente comprometido durante uma rodada escreveria as
próprias instruções para a rodada seguinte se a routine pudesse gravar
contexto. Um segredo compartilhado entre MCP e routine derrubaria essa
garantia por trás das costas de ninguém — não por um bug, mas porque as duas
origens deixariam de ser distinguíveis pelo sistema.

**O que este segredo não protege:** um modelo mal conduzido. Se o texto que o
Claude Code leu (um README, uma página, a saída de outra ferramenta) o
convencer a chamar uma ferramenta de escrita, ele tem o segredo por
construção — está rodando com ele configurado. A defesa real contra isso não
é o segredo, é a **ausência** das ferramentas de decisão: não existe
`aprovar_sugestao` no catálogo do MCP, e não existirá. Ver `docs/mcp.md`,
seção "O que não existe, de propósito".

Ver também `db/migrations/010_contexto_origem_mcp.sql` — a segunda metade
desta decisão, que soma a `contexto.origem = 'mcp'` para o dono conseguir
**ver** na tela o que o terminal gravou sem ele olhando, distinto do que ele
digitou.

# MCP — conversar com o painel pelo Claude Code

O painel expõe um servidor MCP em `/api/mcp`. Com ele conectado, você fala com
o Claude Code e ele lê e escreve no painel — *"quais projetos estou
acompanhando?"*, *"o que apareceu essa noite?"*, *"adiciona esse projeto lá"*.

---

## As ferramentas

**Leitura**

| Ferramenta | Para quê |
|---|---|
| `listar_projetos` | Todos os projetos, com frequência e estado |
| `ver_rodadas` | Histórico de diagnóstico de um projeto |
| `ver_sugestoes` | A fila, com estado, esforço e reversibilidade |
| `ver_inventario` | Stack e serviços de um projeto |
| `ver_contexto` | O que está anexado |

**Escrita**

| Ferramenta | Para quê |
|---|---|
| `cadastrar_projeto` | Nome, repositório (opcional), frequência |
| `anexar_contexto` | Material para um agente específico daquele projeto |

### O que não existe, de propósito

**Não há `aprovar_sugestao`.** Todo o desenho do painel se apoia em "só o dono
aprova". Um modelo num chat pode ser dirigido por texto que ele leu — um
README, uma página, a saída de outra ferramenta. Aprovar continua sendo dois
cliques no painel; é o único lugar do sistema onde fricção vale a pena.

Também de fora: recusar sugestão, marcar como feita, ligar ou desligar agente
na esteira, e apagar qualquer coisa.

---

## Instalação

### Passo 1 — Gerar o segredo do MCP

No terminal:

```
openssl rand -hex 32
```

Copie o resultado. Você vai usá-lo duas vezes: na Vercel e no comando de
conexão.

**Por que um segredo novo, e não o do bypass:** o header de bypass é o que a
routine usa, e existe uma decisão registrada de que ele **não escreve
contexto** — porque contexto é escrito no `CLAUDE.md` do repositório alvo e
lido por agentes que agem. Se a routine pudesse escrever contexto, um agente
comprometido escreveria as próprias instruções para a noite seguinte.

Um segredo separado deixa o Claude Code anexar contexto sem que a routine ganhe
esse poder junto. Ele também mantém as duas origens distinguíveis: sem isso,
"a routine às 3h" e "você no terminal" seriam a mesma coisa para o painel, e
toda regra futura do tipo "a routine não pode fazer X" proibiria você junto.

**O que esse segredo não faz:** ele não protege contra um modelo mal conduzido.
Se o texto que o Claude Code leu o convencer a chamar uma ferramenta, ele tem o
segredo por construção. A defesa contra isso é a **ausência** das ferramentas
de decisão — e é por isso que a lista acima para onde para.

### Passo 2 — Criar a variável na Vercel

1. Vercel → projeto **project-organization** → **Settings**
2. Menu da esquerda → **Environment Variables**
3. **Add Environment Variable**
   - **Key:** `PAINEL_MCP_SECRET`
   - **Value:** o segredo do passo 1
   - Marque **Production**
4. **Save**

Confira, na mesma tela, que **`PAINEL_BYPASS_SECRET` já existe**. É ele que
atravessa o Vercel Authentication na borda; sem ele a requisição do Claude Code
não chega no app (você recebe HTML de login em vez de JSON). Ele já deve estar
lá desde a routine noturna.

### Passo 3 — Refazer o deploy

Variável nova só vale no build seguinte.

1. Aba **Deployments**
2. No deploy de **Production** → três pontinhos → **Redeploy** → **Redeploy**
3. Espere ficar verde

### Passo 4 — Conectar no Claude Code

No terminal, em qualquer pasta:

```
claude mcp add --transport http painel \
  https://project-organization-delta.vercel.app/api/mcp \
  --scope user \
  --header "x-vercel-protection-bypass: SEGREDO_DO_BYPASS" \
  --header "x-painel-mcp-secret: SEGREDO_DO_MCP"
```

Trocando `SEGREDO_DO_MCP` pelo valor do passo 1 e `SEGREDO_DO_BYPASS` pelo
valor de `PAINEL_BYPASS_SECRET` na Vercel.

Três detalhes que decidem se funciona:

- **`--scope user`** é o que faz o painel aparecer em *toda* sessão do Claude
  Code, em qualquer diretório. É o que você quer: o caso de uso é estar
  trabalhando num projeto qualquer e dizer "adiciona esse projeto no painel".
  Sem isso, o escopo padrão é `local` e só vale na pasta onde você rodou o
  comando.
- **Não use `--scope project`.** Aquele escopo grava em `.mcp.json` dentro do
  repositório, que é versionado — o segredo iria para o git. Com `user`, ele
  fica em `~/.claude.json`, na sua máquina, fora de qualquer repositório.
- **As aspas em cada `--header` são obrigatórias.** Sem elas o shell corta no
  espaço depois dos dois-pontos e o header chega truncado.

### Passo 5 — Conferir

```
claude mcp list
```

`painel` deve aparecer conectado. Depois, dentro do Claude Code, `/mcp` lista
as sete ferramentas.

O teste que vale de verdade é em linguagem normal:

> quais projetos estão no meu painel?

**Deu certo se** ele responder com a lista real — o projeto que você cadastrou,
a frequência dele, o estado. Isso prova o caminho inteiro: borda da Vercel,
autenticação, banco, formatação.

Para conferir a escrita, peça algo pequeno e verificável:

> anexa uma nota no projeto X, para o agente qa-testes, tipo "nota", com o
> texto "teste de conexão"

Depois abra a tela do projeto no painel e veja se apareceu — e apague por lá.
Apagar não existe no MCP, de propósito.

---

## Como pedir as coisas

Não precisa citar o nome da ferramenta. Fale normal:

| Você diz | Ele chama |
|---|---|
| "quais projetos eu tenho no painel?" | `listar_projetos` |
| "o que apareceu essa noite no painel?" | `ver_rodadas` |
| "o que está esperando decisão?" | `ver_sugestoes` |
| "que banco o projeto X usa?" | `ver_inventario` |
| "que contexto o designer-ui tem no projeto X?" | `ver_contexto` |
| "adiciona esse projeto aqui no meu painel" | `cadastrar_projeto` |
| "guarda essa restrição no painel, para o revisor-seguranca" | `anexar_contexto` |

O nome do projeto pode ser parcial, com ou sem acento, e pode ser o repositório
em vez do nome. Se mais de um projeto casar, ele devolve a lista e pergunta —
nunca escolhe sozinho.

---

## Quando não funciona

**"Acesso negado" ou 401**
Nesta ordem: (1) você refez o deploy depois de criar a variável? (2) o segredo
do comando bate com `PAINEL_MCP_SECRET` na Vercel? (3) o header de bypass está
com o valor de `PAINEL_BYPASS_SECRET`?

**Veio HTML em vez de JSON**
Você não passou da borda da Vercel — é o header `x-vercel-protection-bypass`,
ausente ou errado.

**A ferramenta não aparece**
`claude mcp list` para confirmar o registro. Se não estiver lá, repita o passo
4. Se estiver lá mas não aparece na sessão, você provavelmente registrou sem
`--scope user` e está em outra pasta.

**404 na URL**
O deploy é anterior à existência da rota `/api/mcp`. Refaça o passo 3.

**As de leitura funcionam, as de escrita recusam**
Falta `PAINEL_MCP_SECRET` — no servidor, no cliente, ou o redeploy. A mensagem
de recusa diz isso; é a resposta correta, não um defeito. O MCP funcionando
só de leitura é um estado válido: dá para começar assim e somar o segredo
depois.

**"Ferramenta desconhecida: aprovar_sugestao"**
Está certo. Essa ferramenta não existe e não é para existir. Aprove no painel.

**Ele responde de cabeça, sem chamar ferramenta**
Diga "no meu painel" na frase. Se persistir, `/mcp` confirma se o servidor está
conectado naquela sessão.

### Teste direto, sem o Claude Code no meio

```
curl -sS -X POST https://project-organization-delta.vercel.app/api/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "x-vercel-protection-bypass: SEGREDO_DO_BYPASS" \
  -H "x-painel-mcp-secret: SEGREDO_DO_MCP" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

- Lista de ferramentas → o servidor está bom, o problema é o cliente.
- `{"erro":"Acesso negado."}` → segredo errado ou variável ausente.
- HTML → borda da Vercel, header de bypass.

---

## Testar contra o painel local

Sobe o app (`npm run dev`) e registre um segundo servidor apontando para
`localhost`. Sem borda da Vercel na frente, o header de bypass não é
necessário — mas `PAINEL_MCP_SECRET` precisa estar no `.env.local` (que é
gitignorado), senão a rota recusa tudo com 401: em desenvolvimento não há nem
sessão nem bypass configurados por padrão.

```
claude mcp add --transport http painel-local \
  http://localhost:3000/api/mcp \
  --header "x-painel-mcp-secret: SEGREDO_DO_MCP"
```

Remova quando terminar:

```
claude mcp remove painel-local
```

---

## Sobre o que sai daqui

Tudo que o MCP devolve passa pelo mesmo filtro anti-credencial do gerador de
prompt: contexto, resumo, achado e nome de serviço. URL é reduzida a origem
mais caminho — `userinfo` e query string ficam de fora, porque é onde token
viaja.

Isso é tripwire, não muralha: pega formato conhecido de credencial, não pega
senha comum. A proteção de fato continua sendo que o painel nunca guarda valor
de credencial em lugar nenhum.

**Tem teto de tamanho.** `ver_rodadas` traz 5 rodadas por padrão e no máximo
20; a fila para em 50 sugestões; conteúdo de contexto sai cortado em 4.000
caracteres, com aviso de que cortou. Contexto cheio de coisa irrelevante piora
a resposta *e* custa mais.

**`anexar_contexto` não grava por cima calado.** Contexto tem chave única por
`(projeto, agente_destino, tipo)`: repetir a mesma combinação substituiria o
texto anterior, e não há desfazer no MCP. A ferramenta detecta a colisão antes
de escrever, recusa e diz o que já está lá; só um `substituir=true` explícito
passa por cima — e a descrição da ferramenta manda pedir confirmação antes.

---

## Notas de desenho, para quem for mexer nisto depois

**Modo sem estado.** Cada POST constrói um servidor MCP novo, responde e morre.
É o único modo honesto numa função serverless: não há processo de longa duração
para guardar sessão entre invocações, e duas requisições seguidas podem cair em
instâncias diferentes. Consequência: `GET /api/mcp` e `DELETE /api/mcp`
respondem 405, porque os dois pressupõem estado. O cliente segue no POST.

**Sem dependência além do SDK.** O `@modelcontextprotocol/sdk` traz um
transporte sobre Web Standards que recebe um `Request` e devolve um `Response`
— exatamente a assinatura de um route handler do App Router. `mcp-handler` e
`@vercel/mcp-adapter` existiam para preencher esse buraco antes desse
transporte existir; hoje seriam uma camada a mais entre um bug e a causa dele.

**A validação é a mesma das rotas de API.** `cadastrar_projeto` usa
`validarDadosProjetoComFrequencia`; `anexar_contexto` usa `validarContexto` —
os mesmos módulos de `src/dominio/` que `POST /api/reports` e
`PUT /api/context/:projeto` usam. O `inputSchema` de cada ferramenta é
documentação para o modelo, não o portão. Duas listas de regras divergiriam na
primeira vez que alguém mexesse só numa delas.

**Acesso, em duas camadas.** A rota chama `exigirAcesso()` antes de o MCP ver
um byte do corpo: sessão, segredo do MCP ou bypass da routine; qualquer outra
coisa recebe 401. Depois, por ferramenta, as duas de escrita chamam
`exigirDonoOuMcp()`, que recusa o bypass puro. Quem chega só com o segredo da
routine tem um MCP somente de leitura.

**Onde as coisas moram.**

| Arquivo | O que tem |
|---|---|
| `src/dominio/mcp.ts` | Catálogo de ferramentas, resolução de projeto por nome, formatação de saída, tetos de tamanho. Lógica pura. |
| `src/dominio/mcp.test.ts` | Teste dela, incluindo a garantia de que nada com cara de credencial sai. |
| `src/servidor/mcp.ts` | Transporte, despacho, acesso a dados. |
| `src/servidor/mcp.test.ts` | Teste de fiação: handshake, `tools/list`, erro legível. |
| `src/servidor/acesso.ts` | `exigirDonoOuMcp()` e a origem `mcp`. |
| `src/servidor/acessoMcp.test.ts` | A matriz de origem × ferramenta de escrita. |
| `src/app/api/mcp/route.ts` | O route handler e a primeira camada de acesso. |

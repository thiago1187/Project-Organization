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
esse poder junto.

### Passo 2 — Criar a variável na Vercel

1. Vercel → projeto **project-organization** → **Settings**
2. Menu da esquerda → **Environment Variables**
3. **Add Environment Variable**
   - **Key:** `PAINEL_MCP_SECRET`
   - **Value:** o segredo do passo 1
   - Marque **Production**
4. **Save**

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
  --header "x-painel-mcp-secret: SEU_SEGREDO"
```

Trocando `SEU_SEGREDO` pelo valor do passo 1.

### Passo 5 — Conferir

Abra o Claude Code e pergunte:

> quais projetos estão no meu painel?

**Deu certo se** ele responder com a lista real — o projeto que você cadastrou,
a frequência dele, o estado.

---

## Quando não funciona

**"Acesso negado" ou 401**
O segredo do comando não bate com `PAINEL_MCP_SECRET` na Vercel, ou o deploy é
anterior à variável. Refaça o passo 3.

**A ferramenta não aparece**
Confirme que o servidor foi registrado: `claude mcp list`. Se não estiver lá,
repita o passo 4.

**404 na URL**
O deploy é anterior à existência da rota `/api/mcp`. Refaça o passo 3.

---

## Sobre o que sai daqui

Tudo que o MCP devolve passa pelo mesmo filtro anti-credencial do gerador de
prompt: contexto, resumo, achado e nome de serviço. URL é reduzida a origem
mais caminho — `userinfo` e query string ficam de fora, porque é onde token
viaja.

Isso é tripwire, não muralha: pega formato conhecido de credencial, não pega
senha comum. A proteção de fato continua sendo que o painel nunca guarda valor
de credencial em lugar nenhum.

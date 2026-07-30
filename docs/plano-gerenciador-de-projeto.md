# Plano — o painel como gerenciador de projeto

Plano, não implementação. Nada aqui foi construído; nenhuma migration foi escrita — a
trava de schema do `CLAUDE.md` exige aprovação do dono **antes** de escrever a 006.

Origem: pedido do dono em três partes — *"quero adicionar um sugestor de agentes, e um
espaço para eu colocar as tarefas daquele projeto. Quero que funcione também como um
gerenciador de projetos onde o próprio sistema saiba o que é aquele projeto e o que
estamos fazendo nele."*

Estado do repositório em que este plano se apoia: migrations 001, 002 e 005 aplicadas;
`stack` e `servico` chegando à tela agora, por outro agente. Este plano não toca em
`src/` nem em `db/`.

---

## 1. Resumo

O pedido tem três partes, mas só uma decisão estrutural: **o painel deixa de ser só uma
caixa de entrada de diagnóstico e passa a guardar a intenção do dono.** Hoje tudo que ele
sabe sobre um projeto veio de fora (relatório e sugestão nascem na rodada) ou é material
de consulta (`contexto`); não existe um único campo onde o dono declare o que o projeto é
nem o que ele está fazendo nele. Proponho duas colunas de dado novo e nenhuma tabela de
processo: `projeto.descricao` (migration 006) e `tarefa` (migration 007, sete colunas), e
o **sugestor de agentes sem tabela nenhuma** — derivado do inventário e do histórico, com
a frase da evidência sempre visível, e sem estado próprio porque o gesto que ele propõe
(ligar um agente) já é reversível em um clique. A tarefa **não** se funde com `sugestao` e
**não** é criada a partir dela: são inbox e worklist, com garantias diferentes, e o
argumento decisivo está no § 3.3. As duas se encontram na tela, não no banco. O painel
"onde estamos", mockado desde o export, é o lugar certo disso — ele sempre foi um
gerenciador de projeto fingindo, e agora ganha o dado que faltava. `descricao` e as
tarefas em aberto entram em `GET /api/projects` de forma aditiva e viram material de
anti-duplicata na rodada, pela mesma porta que `contexto` já usa. A entrega mais barata
com valor sozinha são os dois primeiros PRs: só `descricao`, que já muda a qualidade do
prompt gerado e da rodada.

---

## 2. O painel "onde estamos" é o lugar disso?

**Sim — e a leitura de que ele "nunca teve origem no schema" é a chave do pedido inteiro.**
Mas o bloco não é uma peça só: ele mistura três coisas de naturezas diferentes, e duas
devem morrer.

O que o export punha ali (`src/componentes/PainelEtapa.tsx`, `EtapaMock` em
`src/dominio/visao.ts`):

| Parte do bloco | O que realmente é | Destino |
|---|---|---|
| título + resumo + selo | o que o projeto é e em que pé está — **voz do dono** | vira `projeto.descricao` + estado da tarefa em foco |
| lista de "próximos passos" | o que está sendo feito — **voz do dono** | vira `tarefa` |
| "etapa 4 de 6" | progresso contra uma enumeração de fases que não existe | **morre** (§ 3.4) |
| "escrito por \<autor\>" | autoria num sistema de usuário único (regra 5) | **morre** |
| "atualizado / sem atualização há N dias" | frescor | derivável de `atualizado_em`, mas vira tira do cabeçalho (§ 5) |

Ou seja: dois terços do bloco são exatamente o pedido do dono, e o terço restante é
enfeite de mockup. Ele fica.

### 2.1 Isto substitui o "Estado agora" do plano anterior?

Não substitui — **separa**. O `docs/plano-agentes-por-projeto.md` § 5.2 propôs trocar o
`PainelEtapa` por um "Estado agora" derivado (status do último relatório, pendentes,
aprovadas, idade). Aquilo não foi construído, e este plano o revisa deliberadamente:

> São duas perguntas, com duas vozes, e empilhar as duas em painéis grandes concorrentes
> é como a tela virou pilha de seções.
>
> - **Voz da máquina** (derivada): o que a rodada achou, o que espera decisão. É *estado*,
>   muda toda noite, e cabe numa linha.
> - **Voz do dono** (declarada): o que este projeto é, o que estamos fazendo. É *intenção*,
>   muda quando ele decide, e precisa de espaço para ler e editar.

Decisão: a voz da máquina vira uma **tira de contadores no cabeçalho** (§ 5), não um
painel; a voz do dono fica com o bloco grande. `EtapaMock`, `montarEtapa` e `ETAPA_VAZIA`
saem de `visao.ts` de qualquer forma — o que muda em relação ao plano anterior é só quem
herda o retângulo.

**Descartado:** criar um bloco novo "Tarefas" ao lado do "onde estamos". Ficariam dois
painéis respondendo à mesma pergunta com dados diferentes, e o mockado continuaria lá
dizendo "Sem diagnóstico registrado" ao lado de uma lista de tarefas de verdade. Buraco
no layout não se resolve com mais layout.

---

## 3. Modelo de dados

Duas migrations pequenas, na convenção do `db/README.md` ("uma mudança de schema por
migration"). Ambas exigem aprovação do dono antes de serem escritas.

### 3.1 Migration 006 — `ALTER TABLE projeto ADD COLUMN descricao text`

Proposta desde o `docs/plano-agentes-por-projeto.md` § 3.2 e cortada por escopo. Agora ela
é o item 1 do pedido.

- `text`, **nullable** — projeto cadastrado às pressas não pode travar por falta de prosa.
- Teto de **2 000 caracteres** (`CHECK`). Regra 6: isto vai para o `CLAUDE.md` do
  repositório alvo e para o prompt gerado. 2 000 é "dois ou três parágrafos sobre o que é
  e em que fase está" — material longo continua sendo `contexto` (teto de 20 000).
- **Sem** `CHECK` de caractere de controle: é corpo de texto, aceita quebra de linha —
  mesmo raciocínio de `contexto.conteudo` na 001.
- **Sem** `parece_credencial`: aqui a assimetria com `stack.nome`/`servico.nome` é
  deliberada e vale registrar. O tripwire da 002 foi desenhado para **rótulo curto**, onde
  colar uma chave inteira é o acidente provável. Num campo de prosa de 2 000 caracteres o
  falso positivo é mais provável que o verdadeiro, e a defesa real do caminho de saída já
  existe: `semCredencial` em `src/dominio/prompt.ts`, que este plano estende à descrição
  (§ 6.2).

### 3.2 Migration 007 — `tarefa`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `projeto_id` | uuid | FK → `projeto`, `ON DELETE CASCADE` (é material, não auditoria — categoria de `relatorio`/`contexto`/`stack`, não de `sugestao`) |
| `titulo` | text | a tarefa, em uma linha |
| `estado` | text | `aberta` \| `fazendo` \| `feita` |
| `ordem` | integer | default `0`, **sem UNIQUE** |
| `criado_em` / `atualizado_em` | timestamptz | reaproveita `contexto_atualizar_timestamp()` |
| `concluida_em` | timestamptz | nullable, preenchido ao virar `feita` |

`CHECK`s, seguindo a casa:

- `titulo` não vazio, teto de **200** caracteres, **sem caractere de controle** e
  **`NOT parece_credencial(titulo)`**. Os três se justificam pelo mesmo fato: `titulo` é
  rótulo curto de uma linha que atravessa o `GET /api/projects`, entra no bloco
  `contexto-do-painel` do `CLAUDE.md` alvo e vai para a área de transferência do dono no
  prompt gerado. Sem a checagem de controle, um `\n` no título vira estrutura de documento
  naquele bloco — exatamente o que `contexto.tipo` já barra na 001.
- `estado IN ('aberta', 'fazendo', 'feita')`.
- `ordem >= 0`, **sem UNIQUE**, com o mesmo comentário da 005: reordenar com constraint
  única exige constraint deferida ou UPDATE em duas passadas, complexidade real para uma
  lista de dezenas de itens. Empate desempata por `criado_em` na aplicação.
- Consistência de `concluida_em`, no espírito de `sugestao_estado_consistente`:
  `(estado = 'feita' AND concluida_em IS NOT NULL) OR (estado <> 'feita' AND concluida_em IS NULL)`.

Índice: `CREATE INDEX tarefa_projeto_idx ON tarefa (projeto_id)` — só isso. Mesma escala
pessoal e mesma ausência de índice automático em FK já registradas em 001 e 002.

**Sem trigger de transição de estado**, ao contrário de `sugestao` — e o contraste merece
comentário na migration. A trigger da 001 existe porque `sugestao` tem dois escritores
(painel e routine, via bypass) e porque a máquina de estados **é** o portão de segurança:
`pendente → feita` num UPDATE só daria à routine o poder de se auto-aprovar. `tarefa` tem
um escritor só (o painel, com sessão do dono), não é evidência de portão nenhum, e
`feita → aberta` é uma transição legítima — "voltei atrás". Trigger aqui seria cerimônia
copiada, não defesa.

### 3.3 A decisão que importa: `tarefa` e `sugestao` não se fundem

Quatro caminhos foram considerados. Registro os três descartados porque este é o ponto em
que o desenho pode azedar em silêncio.

**Escolhido — tabelas separadas, união só na tela.** A lista de "o que estamos fazendo"
mostra, num bloco só, as tarefas do dono **e** as sugestões `aprovada`, com um selo de
origem distinguindo as duas. O dono não precisa saber de onde a ideia veio; o banco
precisa, porque as garantias são diferentes.

O argumento decisivo é de garantia, não de gosto:

> Uma lista de trabalho precisa de apagar e reordenar. `sugestao` é declarada, na própria
> migration 001, como **evidência do portão de aprovação** — `ON DELETE RESTRICT`, trigger
> de transição, comentário dizendo que apagar isso "destruiria a auditoria em silêncio".
> Fazer `sugestao` servir de lista de tarefas exigiria afrouxar as duas coisas. Seria
> trocar a superfície de auditoria do mecanismo central de segurança do sistema por uma
> lista de afazeres. O preço é absurdo para o que se compra.

**Descartado — "sugestão aprovada vira tarefa" (promover, copiando a linha).** Cria duas
linhas com o mesmo significado e nenhuma fonte de verdade: o dono marca a tarefa como
feita, a sugestão fica `aprovada` para sempre, e `GET /api/projects` continua mandando
para a rodada uma sugestão que já foi executada. Além disso, `sugestao.estado = 'aprovada'`
**já significa** "eu quero fazer isso" desde o fim da execução automática
(`docs/proximos-passos.md`, item 2) — promover seria converter um estado em outro estado
idêntico.

**Descartado — tarefa como `sugestao` com `agente = 'dono'`.** Grátis em migration, caro
em tudo o mais: obrigaria o dono a preencher `motivo`, `esforco`, `risco` e
`reversibilidade` (todos `NOT NULL`) para escrever "revisar o texto da home", e poluiria a
fila de decisão com itens que não pedem decisão nenhuma. A fila existe para o que precisa
de um sim ou não; tarefa já nasce decidida.

**Descartado (por ora) — FK `tarefa.sugestao_id`.** Só teria uso para uma ação de
"promover" que não vamos construir, ou para "quebrar esta sugestão em três tarefas", que é
um segundo caso de uso que ainda não apareceu. Abstração para um caso de uso só é dívida
disfarçada de previdência. Se aparecer, é um `ADD COLUMN` nullable, barato e aditivo.

### 3.4 Campos que ficaram de fora, e a pergunta que os matou

A pergunta, a cada campo: **que decisão ele muda?**

- **`criado_por` / autoria.** Regra 5: usuário único, sem sistema de contas. A rodada nunca
  escreve. A coluna teria um valor só, para sempre — o "campo que ninguém preenche e vira
  mentira no schema" do comentário da 002. Fora. (A origem que importa — agente ou dono —
  é derivada de *em qual tabela a linha está*, não de uma coluna.)
- **`fase` / "etapa 4 de 6".** Exige uma enumeração de fases que não existe e que seria
  diferente em cada projeto. Manter "4 de 6" atualizado é trabalho manual sem consumidor:
  nenhuma decisão do dono muda por ler 4 em vez de 5. A fase real fica dentro da
  `descricao`, em prosa, e "o que estamos fazendo agora" é a tarefa em `fazendo`. Fora.
- **`prioridade` (alta/média/baixa).** `ordem` já responde "o que vem primeiro", e com um
  gesto melhor. Ter os dois é ter dois lugares para a mesma verdade divergir — e enum de
  prioridade vira reflexo ("tudo alta"), o mesmo sintoma que o `docs/routine-noturna.md`
  já teme para `reversibilidade`. Fora.
- **`detalhe` / `notas`.** Campo de texto aberto sem checagem é, pelas palavras da própria
  migration 002, "o lugar cômodo para colar um segredo só dessa vez" — e aqui seria também
  uma superfície de injeção a mais no `CLAUDE.md` alvo. `contexto` já existe para material
  longo. Fora até um sintoma real.
- **Prazo, responsável, etiqueta, estimativa, subtarefa, comentário.** Jira. Fora.

### 3.5 Por que três estados e não dois

`aberta`/`feita` bastaria para uma lista. `fazendo` ganha o lugar por um motivo concreto:
ele é o que dá título ao painel. Sem ele, o bloco diz "5 tarefas abertas"; com ele, diz
**"agora: migrando a autenticação para X"** — que é literalmente a frase do pedido do dono
("o que estamos fazendo nele") e é o que o export tentava mostrar no título mockado. É
também a linha mais valiosa para a rodada e para o prompt gerado.

Sem UNIQUE parcial garantindo "no máximo uma `fazendo` por projeto": a constraint forçaria
a tela a tratar um conflito ("mover esta para fazendo falhou porque já há outra") em troca
de uma disciplina que o dono consegue manter sozinho numa lista de dez itens. Se ele
marcar duas, o painel mostra duas — e isso também é informação honesta.

---

## 4. O sugestor de agentes

### 4.1 A restrição que define o formato

`agenteEhDeLeitura` (`src/dominio/esteiraAgentes.ts`) já é aplicado na Server Action:
**só agente de leitura entra na esteira**, porque quem estiver lá é acionado às 3h sem
ninguém para barrar. Isso corta metade das recomendações intuitivas antes de começar:

| Sinal | Agente óbvio | Entra na esteira? |
|---|---|---|
| serviço categoria `modelo` | `engenheiro-ia` | **não** — escrita |
| serviço categoria `modelo` | `avaliador-ia` | sim |
| serviço categoria `banco` | `engenheiro-dados` | **não** — escrita |
| serviço categoria `hospedagem` | `devops-deploy` | sim (leitura desde a correção em `papeis.ts`) |

Então o sugestor tem **duas saídas, não uma**, e isso é uma qualidade e não um remendo:

1. **Para a esteira** — agentes de leitura, com um clique que chama a
   `alternarAgenteAction` existente.
2. **Para o prompt gerado** — agentes de escrita, como uma linha de texto: *"quando for
   mexer no banco deste projeto, chame `engenheiro-dados`"*. Nenhum clique, nenhuma
   configuração, nenhum caminho de execução automática. É recomendação de quem convocar
   quando o dono estiver presente — que é exatamente onde a escrita acontece desde o fim
   da execução na routine.

A separação precisa estar **visível na tela**, com as duas listas rotuladas. Se o dono não
enxergar por que `engenheiro-dados` aparece em outro lugar, ele vai procurar o botão de
ligar e concluir que a tela está quebrada.

### 4.2 Como funciona: determinístico, com a evidência na frente

Um módulo puro, `src/dominio/sugestorAgentes.ts`, sem banco e sem rede, testável como
`esteiraAgentes.ts` já é. Entrada: as linhas de `stack`, `servico`, `projeto_agente`,
`relatorio` e `sugestao` daquele projeto — tudo que a tela de detalhe **já carrega**.
Saída: uma lista de `{ agente, destino: 'esteira' | 'prompt', porque: string }`.

**Três famílias de regra, em ordem de qualidade do sinal:**

**(a) Histórico — o sinal mais forte, e é de graça.** `relatorio.achados_por_agente` e
`sugestao.agente` já dizem quem rodou e quem produziu proposta aprovada neste projeto.

- agente com sugestões aprovadas aqui → *"`revisor-seguranca` propôs 3 sugestões neste
  projeto e você aprovou 2"* → manter/subir na ordem.
- agente habilitado que rodou N noites sem nenhum achado nem sugestão → *"rodou 12 noites,
  nenhum achado"* → considerar desligar e devolver a janela para outro.
- agente de leitura que **nunca foi ligado em nenhum projeto** → o achado dos "12 de 16"
  de `docs/proximos-passos.md`, virado dado em vez de nota num documento.

Isto é a alavanca do gargalo que `docs/visao.md` nomeia — qualidade da fila —, aplicada à
configuração, e é verificável pelo dono na mesma tela.

**(b) Inventário — o sinal de partida a frio.** `stack` e `servico`, chegando à tela agora.

- `servico.categoria = 'modelo'` → `avaliador-ia` (esteira) + `engenheiro-ia` (prompt).
- `servico.categoria = 'hospedagem'` → `devops-deploy` (esteira).
- `servico.categoria = 'banco'` → `revisor-performance` (esteira) + `engenheiro-dados`
  (prompt).
- `servico.categoria = 'autenticacao'` → `revisor-seguranca` (esteira), se ainda não estiver.

**Correção importante à proposta do enunciado: só regra por presença, nunca por ausência.**
"Não há framework de teste no inventário, logo sugira `qa-testes`" parece razoável e é
armadilha: o inventário é preenchido à mão e é opcional, então ausência de linha significa
"não registrado", não "não existe". Um projeto com inventário vazio — o caso mais comum
hoje — dispararia **todas** as regras de ausência de uma vez, e o sugestor nasceria
mentindo na primeira tela em que aparece. Além disso, "este projeto não tem suíte" já é um
achado que o passo 2.2b da rodada produz toda noite, com evidência real em vez de
inferência sobre um campo em branco.

**(c) Nada mais.** Em particular, **não** casar palavra-chave contra `projeto.descricao`.
Prosa livre é o pior insumo possível para regra determinística, e erraria de um jeito que o
dono não consegue corrigir.

**Como o sugestor cala a boca** — e esta é a parte que dispensa tabela nova:

> Sugere-se apenas agente **sem linha em `projeto_agente`** para aquele projeto. Ligar cria
> a linha; desligar preserva a linha com `habilitado = false`
> (`alternarAgenteProjeto`, `src/servidor/agentesProjeto.ts`). Ou seja: assim que o dono
> **toca** no agente, em qualquer direção, o sugestor para de falar dele. "Dispensar" já
> existe no schema — é o gesto de desligar.

**Uma pendência concreta que o PR do sugestor precisa resolver:** hoje
`alternarAgenteProjeto(projetoId, agente, false)` faz `UPDATE` e lança
`"Este agente já está desligado"` quando não há linha. Um agente recém-sugerido, por
definição, não tem linha — então o gesto "não quero este" falharia. O upsert precisa valer
para os dois sentidos (`INSERT ... ON CONFLICT DO UPDATE SET habilitado = false`), com o
mesmo cuidado de não mexer em `instrucao`.

Segurança: o sugestor **não** é um caminho de escrita novo. Ele produz nomes; quem grava
continua sendo `alternarAgenteAction`, que já valida sessão, nome e `agenteEhDeLeitura`.
Nenhuma sugestão de agente de escrita chega a ter botão — e mesmo que a tela errasse, a
action recusa. Filtro só na UI é filtro nenhum, e essa defesa já está no lugar.

### 4.3 As duas alternativas descartadas

**Pedir a um modelo.** É a opção que parece mais capaz e é a que perde por mais margem.

- **O que se compra:** recomendação sobre entrada não estruturada. Mas a entrada aqui *é*
  estruturada — categorias de lista fechada, contagens, nomes de um catálogo de 16. Não há
  ambiguidade para um modelo desambiguar.
- **O que se paga:** chave de API (regra 1 e 2), variável de ambiente nova, SDK novo, custo
  por render, latência numa tela de uso diário, e um modo de falha novo numa tela que hoje
  não depende de nada externo. Pelo `CLAUDE.md`, trocar dependência estrutural é mudança
  significativa — para uma faixa de uma tela.
- **O que mata:** o valor da funcionalidade é a **frase do porquê**, não o nome do agente.
  Regra determinística produz evidência ("você aprovou 2 das 3 sugestões dele aqui");
  modelo produz narrativa plausível que o dono não consegue conferir. Numa tela cujo
  produto é confiança, narrativa não verificável é pior que silêncio.
- **Quando ela ganharia:** se o insumo fosse o repositório cru — e aí o ator certo não é o
  painel, é a rodada, que já clona e lê. Fica registrado como o caminho seguinte, se as
  regras se provarem finas demais depois de uso real.

**Deixar a rodada noturna sugerir agente como sugere qualquer outra coisa.** Tentadora:
zero código no painel, e a rodada tem o repositório em mãos, que é muito mais informação
que o inventário jamais terá. Perde por três motivos, em ordem de peso:

1. **Consome a cota mais escassa do sistema.** São no máximo três sugestões por projeto por
   noite, e `docs/visao.md` diz que o produto morre quando a fila vira ruído. Uma sugestão
   de configuração que empurra para fora um achado de código real é uma troca ruim toda
   vez que acontece.
2. **A fila é para decisão de risco; isto é ajuste de preferência.** Aprovar tem peso —
   proposta, motivo, risco, reversibilidade, um portão. Ligar um agente é um clique que
   desliga com outro. Passar o gesto mais reversível do sistema pelo portão mais pesado
   ensina o dono que o portão não significa nada.
3. **Nasceria repetindo.** Sem estado de "já dispensei", a rodada reproporia toda noite —
   e o mecanismo de anti-duplicata que existe (`sugestoes_recusadas`) só funciona se o dono
   *recusar* uma coisa que ele nem queria na fila.

---

## 5. A tela de detalhe repensada

Hoje a coluna principal empilha, sem hierarquia: `PainelEtapa` (mock) → `FilaSugestoes` →
`EsteiraAgentes` → `EditorContexto` → `HistoricoRodadas`; e a lateral tem
`ListaDocumentos` + `ListaAcessos` (mock), com o inventário chegando. Com descrição e
tarefas seriam **nove blocos**. O `docs/visao.md` cobra cinco segundos; nove blocos não
cabem em cinco segundos por mais bem ordenados que estejam.

### 5.1 A regra que resolve, e a que foi descartada

**Adotada — ordem fixa, todo bloco colapsa a uma linha quando vazio.** Sem sugestão
pendente, a fila é uma linha ("nada esperando você"), não um retângulo vazio. Sem tarefa, o
painel é uma linha com "+ adicionar". A posição de cada coisa nunca muda, então a memória
muscular vale, e a altura da página acompanha o que existe de verdade.

**Descartada — reordenar os blocos conforme o que precisa de atenção.** Resolveria o mesmo
problema e é sedutora ("o urgente sobe"), mas faz a tela mudar de forma entre duas visitas
— o dono passa a procurar em vez de saber onde está. Numa ferramenta de uso diário,
previsibilidade ganha de otimização.

### 5.2 A tela

**Cabeçalho — a leitura de cinco segundos, tudo acima da dobra.**

1. Linha de identidade, como hoje: bolinha de status, `statusLabel`, repositório, cadência,
   nome.
2. **Tira derivada, nova** (a voz da máquina, § 2.1): `última rodada há 6h · 3 esperando
   você · 2 aprovadas na fila · testes ok`. É o "Estado agora" do plano anterior, reduzido
   de painel a uma linha — mesma informação, um doze avos da altura.
3. **`descricao`, editável no lugar** (a voz do dono): duas linhas visíveis, expande ao
   clicar, salva ao sair do campo. Quando vazia: *"diga o que é este projeto — isto vai
   para os agentes"*, que é o convite mais honesto possível, porque é verdade (§ 6).

**Coluna principal, nesta ordem:**

1. **Fila de sugestões.** Continua em primeiro: "o que precisa de mim" é a pergunta 2 de
   `docs/visao.md` e é a única com prazo. Colapsa a uma linha quando não há pendente — o
   que a tira o caminho do bloco seguinte na maioria das manhãs.
2. **Onde estamos** (o bloco de sempre, agora com dado). Título = a tarefa em `fazendo`;
   abaixo, as tarefas `aberta` numeradas, arrastáveis para ordenar, com caixinha para
   concluir e edição no lugar; misturadas a elas, as sugestões `aprovada`, com selo de
   origem. Uma linha de rodapé leva ao que foi concluído, recolhido.
3. **Esteira de agentes**, com a **faixa do sugestor** dentro dela (§ 4) — é o lugar
   natural: sugerir quem ligar ao lado de quem está ligado.
4. **Histórico de rodadas** — recolhido por padrão. Segunda velocidade.

**Coluna lateral:**

5. **Inventário** (`stack` + `servico`) — o que o outro agente está construindo agora.
6. **Contexto e documentos, em um bloco só.** Hoje são dois (`EditorContexto` na coluna
   principal, `ListaDocumentos` na lateral) e **saem da mesma tabela**: `docs` é derivado
   das linhas de `contexto` que têm `arquivo_url` (`detalheProjeto`, `visao.ts`). Dois
   blocos para uma tabela é o tipo de duplicação que faz a tela parecer pilha. Unir, com
   agrupamento entre "texto" e "link".

### 5.3 O que sai da tela

- **`ListaAcessos` e `AcessoMock`** — mock sem origem no schema, e de origem
  security-hostile (o export guardava valor de credencial no cliente). O inventário é a
  resposta certa, e já está chegando. `docs/visao.md` já tinha decidido isso.
- **`EtapaMock`, `montarEtapa`, `ETAPA_VAZIA`** — substituídos por dado real.
- **`ListaDocumentos` como bloco separado** — absorvido no de contexto.
- **`src/dados/mock.ts`** — morto, nenhuma tela importa (`docs/proximos-passos.md`,
  pendências menores). Aproveitar a limpeza.
- **Candidato, não decisão: o botão "Revisar PR no GitHub" do cabeçalho.** Depois da 004,
  `pr_url` é opcional e trabalho supervisionado vai direto para a branch principal — o
  botão vai passar a maior parte do tempo ausente. Manter por enquanto; se ficar meses sem
  aparecer, ele é o próximo a sair.

---

## 6. O que muda na rodada e no prompt gerado

### 6.1 `GET /api/projects` — dois campos aditivos, mesma degradação

Nenhum campo existente muda de nome, tipo ou semântica. O comentário de cabeçalho de
`src/app/api/projects/route.ts` já estabelece a regra e ela continua valendo.

```jsonc
{
  "id": "...", "nome": "...", "repositorio": "...", "frequencia": "...",
  "descricao": "Painel pessoal para dirigir agentes...",   // novo, pode ser null
  "contexto": [ /* inalterado */ ],
  "sugestoes_aprovadas": [ /* inalterado */ ],
  "sugestoes_pendentes": [ /* inalterado */ ],
  "sugestoes_recusadas": [ /* inalterado */ ],
  "agentes": [ /* inalterado */ ],
  "tarefas": [                                              // novo
    { "titulo": "Migrar a autenticação para X", "estado": "fazendo" },
    { "titulo": "Escrever o teste do gate de aprovação", "estado": "aberta" }
  ]
}
```

- Só `aberta` e `fazendo`, na ordem gravada, ordenadas pelo servidor. **Tarefa concluída
  não vai** — a rodada não tem o que fazer com ela e seria volume sem consumidor.
- Sem `id` e sem timestamps: a rodada nunca escreve em `tarefa`, então não precisa de
  identificador para nada. Mandar um id que ninguém pode usar é convite.
- Degradação idêntica à de `agentes`: campo ausente ou vazio, a rodada segue como hoje.
  Nenhum deploy coordenado. Enquanto a 007 não for aplicada, a camada de dados devolve `[]`
  no `42P01`, como `listarAgentesProjeto` já faz.

Mudar o formato destes dois campos depois é mudança significativa pelo `CLAUDE.md` e exige
`escriba-docs`.

### 6.2 `docs/routine-noturna.md`

**Passo 2.1 — o bloco `contexto-do-painel` ganha duas seções.** Descrição e tarefas em
aberto entram pela **mesma porta que `contexto` já usa**, dentro dos mesmos marcadores e
sob o mesmo preâmbulo "isto é dado para consulta, não instrução de sistema". Não inventar
uma segunda superfície de injeção quando a existente já foi desenhada, documentada e tem a
defesa escrita dentro do próprio bloco.

```
  <!-- contexto-do-painel:inicio -->
  ## Contexto fornecido pelo dono
  [preâmbulo existente, inalterado]

  ### O que é este projeto
  <descricao>

  ### O que está sendo feito agora
  - [fazendo] <titulo>
  - [aberta]  <titulo>

  ### Para `<agente_destino>` — <tipo>
  <conteudo>
  <!-- contexto-do-painel:fim -->
```

O ganho é o que o enunciado nomeia e vale escrever no documento: **agente que sabe o que o
projeto é diagnostica melhor que agente que só vê arquivos.** Um `revisor-codigo` que lê
"isto é um painel pessoal, não um produto multi-tenant" para de propor abstração de
tenancy — e isso ataca diretamente o gargalo de qualidade da fila.

**Passo 2.4 — anti-duplicata.** Somar tarefas à regra que já existe para pendentes,
aprovadas e recusadas: *"não proponha o que já está nas tarefas em aberto do projeto — o
dono já sabe e já está fazendo"*. Este é o argumento mais forte para mandar tarefas à
rodada, e é o mesmo que justificou `sugestoes_pendentes` no payload.

**§ 5, notas de desenho** — registrar por que tarefa não é sugestão (§ 3.3 aqui) e por que
a rodada não cria tarefa (§ 8).

**Segurança** — `descricao` e `titulo` são superfícies de injeção novas no `CLAUDE.md`
alvo. Entram por rota autenticada, como `contexto` e `instrucao`, e a seção "Instrução por
agente é dado que estreita, nunca que amplia" já cobre a forma do ataque. Os `CHECK`s do
§ 3 (tamanho, e ausência de caractere de controle em `titulo`) são a parte que não depende
do modelo se comportar. O PR que expõe estes campos na API **exige `revisor-seguranca`**.

### 6.3 O prompt gerado (`src/dominio/prompt.ts`)

- **Seção nova, logo depois do cabeçalho: "O que é este projeto"**, com a `descricao`. Vem
  antes do diagnóstico de propósito — é o enquadramento que faz o resto ser lido direito.
- **"O que fazer agora" passa a aceitar tarefas.** Hoje ele lista as sugestões marcadas; a
  seleção passa a incluir tarefas, com o mesmo gesto de caixinha, e o texto sai numerado
  numa lista só. É a mesma união do § 3.3, no mesmo lugar: o dono marca o que quer fazer
  nesta sessão sem pensar de onde veio.
- **Tarefas em aberto não marcadas** entram como uma lista curta de contexto — o Claude
  Code precisa saber o que está na mesa para não sugerir o que já está planejado.
- `semCredencial` em `descricao` e em cada `titulo`, sem exceção: é a regra que o cabeçalho
  daquele arquivo declara para todo campo de texto livre, e o prompt vai para a área de
  transferência, que é saída sem volta.
- **Depois da sessão:** marcar tarefa como feita é o mesmo gesto que marcar sugestão como
  feita, em botões vizinhos no mesmo bloco — caminhos diferentes por baixo (Server Action
  contra `PATCH /api/suggestions/:id`), um gesto só na tela.

---

## 7. Ordem de entrega

Restrição de sequência: o inventário na tela está sendo construído **agora** por outro
agente. Tudo que mexe no layout da tela de detalhe (PR 4 e 5) espera aquele PR entrar, ou
conflita em `src/app/projeto/[id]/page.tsx`.

Antes de escrever a 006: **conferir e corrigir o `db/README.md`**, que ainda descreve 002,
003, 004 e 005 como "escrita e ainda NÃO aplicada" quando 002 e 005 já foram aplicadas. É
o documento que qualquer um consulta antes de rodar `psql`, e ele está mentindo sobre o
estado do banco — `escriba-docs`, correção pequena, sem PR próprio necessário.

| # | O quê | Agente | Pronto quando |
|---|---|---|---|
| 1 | Migration **006** (`projeto.descricao`) + camada de dados + campo no cadastro e no cabeçalho da tela, editável no lugar | `engenheiro-dados` → `dev-backend` → `dev-frontend` | Aprovação do dono **antes** de escrever a migration (trava de schema). O dono escreve a descrição pela tela, recarrega, e ela está lá. |
| 2 | `descricao` em `GET /api/projects` + seção "O que é este projeto" no prompt gerado + `docs/routine-noturna.md` (passo 2.1) | `dev-backend` + `escriba-docs` | O `curl` da § 2.2 do doc da routine devolve o campo, e o prompt colado hoje continua válido sem edição. |
| 3 | Migration **007** (`tarefa`) + camada de dados + Server Actions + validação, **sem tela** | `engenheiro-dados` → `dev-backend` | Aprovação do dono antes de escrever. Ações testadas; `42P01` degradando para `[]`; nada mudou na tela ainda. **Exige `revisor-seguranca`** (caminho de escrita novo). |
| 4 | "Onde estamos" de verdade: o painel passa a mostrar tarefas + aprovadas; arrastar ordena, clicar conclui e edita no lugar; `EtapaMock`/`montarEtapa`/`ETAPA_VAZIA` removidos | `dev-frontend` | Nenhum dado inventado na tela. Depende do PR 3 e do PR do inventário. |
| 5 | Hierarquia: tira derivada no cabeçalho, colapso-quando-vazio em todos os blocos, contexto+documentos unidos, `ListaAcessos`/`AcessoMock`/`src/dados/mock.ts` removidos | `designer-ui` (desenho) → `dev-frontend` | O dono abre a tela e sabe em cinco segundos se algo pede ele, sem rolar. |
| 6 | `tarefas` em `GET /api/projects` + passos 2.1 e 2.4 de `docs/routine-noturna.md` | `dev-backend` + `escriba-docs` | Rodada seguinte não repropõe algo que já está na lista de tarefas. **Exige `revisor-seguranca`** (superfície de injeção nova no `CLAUDE.md` alvo). |
| 7 | Tarefas selecionáveis no gerador de prompt, junto com as sugestões | `dev-frontend` | Marcar duas sugestões e uma tarefa e sair com uma lista numerada só. |
| 8 | **Sugestor de agentes**: `src/dominio/sugestorAgentes.ts` (regras de inventário + histórico, com testes), faixa na esteira, lista separada "para o prompt, não para a esteira", upsert de desligar corrigido | `dev-backend` (regras) → `dev-frontend` (faixa) | Projeto com serviço `modelo` mostra "avaliador-ia sugerido — porque este projeto usa OpenAI", um clique liga, e desligar silencia. Depende do inventário na tela. |
| 9 | Regras de histórico mais finas no sugestor (taxa de aprovação por agente, agente estéril) | `dev-backend` | Só depois de algumas rodadas reais — sem histórico, é regra calibrada no escuro. Candidato legítimo a nunca acontecer. |

**Se for grande demais para uma rodada — o recorte:** PRs **1 e 2**, só a descrição.
Duas horas de trabalho, uma coluna, um campo na tela, um campo na API. Entregam sozinhos a
parte do pedido que muda mais coisa ("o sistema saber o que é aquele projeto"), melhoram
imediatamente o prompt gerado e o diagnóstico da madrugada seguinte, e não dependem de
nenhuma decisão que ainda esteja em aberto. Tarefas e sugestor podem esperar a semana
seguinte sem que nada fique pela metade.

---

## 8. O que fica fora, e por quê

- **`criado_por`, `fase`/"etapa 4 de 6", `prioridade`, `detalhe`, prazo, responsável,
  etiqueta, estimativa, subtarefa, comentário.** § 3.4 — nenhum muda uma decisão do dono,
  e vários viram mentira no schema por falta de quem os mantenha.
- **Fundir `tarefa` com `sugestao`, em qualquer direção.** § 3.3. O preço é afrouxar o
  `ON DELETE RESTRICT` e a trigger de transição — a superfície de auditoria do portão de
  aprovação — em troca de uma lista de afazeres.
- **FK `tarefa.sugestao_id` e botão "promover sugestão em tarefa".** § 3.3. Um caso de uso
  só. A união na tela já entrega o que o dono quer ver, e a coluna continua sendo um
  `ADD COLUMN` barato no dia em que houver um segundo caso.
- **A rodada criar tarefa.** Isso é escrita, e a rodada não escreve em lugar nenhum —
  `docs/proximos-passos.md` é explícito ("nem código, nem documentação, nem connector").
  O caminho para a rodada colocar algo na mesa do dono já existe e se chama `sugestao`;
  criar um segundo, sem portão, seria abrir por outra porta exatamente o que o fim da
  execução automática fechou.
- **Tabela de "sugestão de agente" com estado próprio.** § 4.2. Portão de aprovação existe
  para o que não volta; ligar um agente volta com um clique. E "dispensar" já está no
  schema, de graça, como a linha `habilitado = false`.
- **Sugestor por modelo de linguagem.** § 4.3. Dependência estrutural nova, custo por
  render e chave de API para produzir uma narrativa que o dono não consegue conferir —
  numa tela cujo produto é confiança.
- **Sugestor por regra de ausência no inventário.** § 4.2. Inventário vazio é o caso comum;
  ausência de linha significa "não registrado", não "não existe", e o sugestor nasceria
  mentindo.
- **Casar palavra-chave contra `projeto.descricao`.** § 4.2. Pior insumo possível para
  regra determinística, e erra de um jeito que o dono não consegue corrigir.
- **Histórico/versionamento de tarefa e de descrição.** Nada indica que ele vá querer
  voltar a uma versão anterior. `atualizado_em` basta — mesma decisão já registrada para
  `instrucao` no plano dos agentes.
- **Reordenar os blocos da tela conforme a urgência.** § 5.1. Resolve o mesmo problema que
  o colapso-quando-vazio, e cobra previsibilidade numa ferramenta de uso diário.

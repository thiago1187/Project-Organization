# Plano de testes

Escrito em 2026-07-30, em resposta a um dos três achados da primeira rodada
noturna real: o projeto não tem suíte nenhuma. Isso bloqueia dois itens da
fila (`docs/proximos-passos.md`, itens 2 e 3) — a suíte em si, e a madrugada
orientada a teste, que só faz sentido se houver o que rodar.

Este documento **descreve** os casos. Não contém teste escrito — quem escreve
é o `dev-backend`, a partir daqui.

---

## 1. Runner recomendado

**Vitest.**

Por quê:

- TypeScript e ESM nativos, sem passo de build separado — o projeto já é
  `"module": "esnext"` / `moduleResolution: "bundler"` (`tsconfig.json`), e
  Vitest lê isso direto.
- `paths: { "@/*": ["./src/*"] }` já existe no `tsconfig.json`; Vitest resolve
  o alias sem configuração extra (via `vite-tsconfig-paths` ou mapeamento
  direto), enquanto Jest exige mapear `moduleNameMapper` à mão e tende a
  destoar do `tsconfig` com o tempo.
- Boa parte do que mais importa testar aqui (`acesso.ts`, `sessao.ts`,
  `entrarAction`, o handler `PATCH`) depende de `next/headers`, `next/navigation`
  e `process.env`. `vi.mock` e `vi.stubEnv` cobrem isso de forma direta; é o
  padrão que a comunidade Next usa hoje para testar Route Handlers e Server
  Actions sem subir servidor nem navegador.
- Roda rápido o bastante para "rodar duas vezes para achar intermitência"
  (item 3 do roteiro) ser barato — importa quando a madrugada for orientada a
  teste.

Alternativa descartada: **`node:test`** (nativo do Node, zero dependência).
Ficou de fora porque exige um loader de TypeScript à parte (`tsx` ou
`ts-node`), não resolve o path alias `@/*` sozinho, e não tem mocking de
módulo embutido — precisaria residir em `vi.mock`/`jest.mock`-like manual via
`node:test`'s `mock.module`, que ainda é experimental na versão do Node deste
projeto (v22). Para o volume de mocking que `next/headers`/`next/navigation`
exigem, o custo de configuração não compensa frente ao Vitest, que já resolve
os três problemas (TS, alias, mock) de fábrica.

Jest também foi considerado e descartado pelo mesmo motivo do `node:test`:
funciona, mas exige mais configuração para ESM e para o alias do que Vitest
exige hoje, sem ganho compensador para um projeto deste tamanho.

**O que dá para testar sem banco:** todo `src/dominio/*` (lógica pura, sem
import de banco nem de rede — é o próprio motivo pelo qual esses arquivos
existem separados, ver os comentários de topo de `validacaoSugestao.ts` e
`validacaoRelatorio.ts`), e a matriz de acesso em `src/servidor/acesso.ts` +
`src/servidor/sessao.ts` + `src/servidor/comparacaoSegura.ts`, que dependem só
de `process.env`, `next/headers` (mockável) e `node:crypto`. Isso já cobre a
maior parte do valor de segurança do projeto.

**O que exige banco:** a trigger `sugestao_validar_transicao_estado`
(`db/migrations/001_schema_inicial.sql`) e os `CHECK` das tabelas — ver seção 4.

---

## 2. O que testar, em ordem de valor

### Nível 1 — o gate de aprovação (a invariante central do produto)

Já furou uma vez (rota `PATCH` aplicava a regra, a Server Action da fila não —
achado da rodada). É o que mais dói quebrar em silêncio, porque quebrar aqui
significa "sugestão vira trabalho sem o dono ter clicado aprovar".

1. **`PATCH /api/suggestions/:id` sem sessão nem bypass** — fazer a
   requisição sem cookie de sessão e sem header de bypass. Deve devolver 401 e
   nunca chamar `aprovarSugestao`/`recusarSugestao`/`marcarSugestaoFeita`.
2. **`PATCH /api/suggestions/:id` com o header de bypass da routine, sem
   sessão** — só o header `x-vercel-protection-bypass` com o segredo certo,
   sem cookie. Deve devolver 401: desde que a routine parou de escrever em
   `sugestao`, bypass não abre mais esse caminho.
3. **`PATCH /api/suggestions/:id` com sessão do dono, transição válida** —
   sessão válida, sugestão `pendente`, `estado: "aprovada"`. Deve devolver 200
   e o corpo com `estado: "aprovada"` e `aprovada_em` preenchido.
4. **`aprovarSugestaoAction` / `recusarSugestaoAction` / `marcarFeitaAction`
   (Server Actions) sem sessão** — chamar direto, sem mockar sessão válida.
   Deve devolver `{ ok: false, erro: "Acesso negado." }` e nunca chamar as
   funções de `sugestoes.ts`. Este é o caso que exatamente replica o furo já
   encontrado — é o teste de regressão mais importante do arquivo.
5. **`aprovarSugestao`/`recusarSugestao`/`marcarSugestaoFeita` (camada de
   dados, `src/servidor/sugestoes.ts`) chamadas sem sessão** — mesmo com o SQL
   mockado para "sucederia", a função deve lançar `AcessoNegado` antes de
   emitir qualquer `UPDATE`. Prova que a checagem está na camada de dados, não
   só na rota — é o comentário que o próprio arquivo faz sobre por que ela
   mora ali.
6. **Transição inválida na camada de dados** — chamar `aprovarSugestao` para
   um id cujo mock de SQL devolve zero linhas (simula `estado != 'pendente'`).
   Deve lançar `ErroDados` com a mensagem "já pode ter sido decidida em outra
   aba", não um erro genérico de 500.
7. **`POST /api/suggestions` (routine) não aceita `estado` no corpo** — enviar
   `{ ..., estado: "aprovada" }` no corpo. A sugestão criada deve nascer
   `pendente`, ignorando o campo — prova que não existe um caminho de criação
   que já nasce aprovada.
8. **`PATCH /api/suggestions/:id` com id que não é UUID** — `id` tipo `"1"`
   ou `"'; DROP TABLE"` na URL. Deve devolver 404 antes mesmo de tentar ler o
   corpo ou tocar o banco.

### Nível 2 — `src/servidor/acesso.ts`, a matriz de origem × ambiente

A regra "falta de segredo recusa tudo" já falhou ao contrário uma vez
(comentário do próprio arquivo). Cada célula da matriz é um `if` que decide
quem passa a ser tratado como dono ou como routine — merece um caso por
combinação:

9. **Produção, sem segredo de bypass configurado, header de bypass presente**
   — `VERCEL_ENV=production`, `PAINEL_BYPASS_SECRET` e
   `VERCEL_AUTOMATION_BYPASS_SECRET` ausentes, header enviado com qualquer
   valor. `exigirAcesso()` deve lançar `AcessoNegado` — este é o caso que já
   inverteu antes ("promover a routine a dono" por engano); é o teste que
   travaria a regressão.
10. **Produção, segredo configurado, header com o segredo certo** — deve
    resolver como `bypass` e `exigirAcesso()` passar; `exigirSessaoDoDono()`
    continua recusando (bypass nunca é sessão).
11. **Produção, segredo configurado, header com valor errado** — `AcessoNegado`.
12. **`PAINEL_BYPASS_SECRET` ausente mas `VERCEL_AUTOMATION_BYPASS_SECRET`
    presente e batendo** — deve aceitar (a variável da Vercel é o fallback
    documentado).
13. **Produção, cookie de sessão válido, sem header** — `exigirSessaoDoDono()`
    passa.
14. **Preview (`VERCEL_ENV=preview`), cookie de sessão tecnicamente válido
    (assinatura bate)** — `exigirSessaoDoDono()` deve recusar mesmo assim:
    `ambientePermiteSessao()` nega preview incondicionalmente antes de olhar o
    cookie.
15. **Local, sem `VERCEL_ENV`, sem `PERMITIR_SESSAO_LOCAL`, cookie válido** —
    recusa. É o caso que substituiu o antigo `NODE_ENV !== "production"`,
    que liberava por omissão.
16. **Local, `PERMITIR_SESSAO_LOCAL=1`, cookie válido** — aceita.
17. **`exigirSessaoDoDono()` com origem `bypass`** — mesmo com header de
    bypass correto, deve lançar `AcessoNegado`: só sessão abre esse portão,
    nunca bypass, mesmo que `exigirAcesso()` aceite ambos.

E, como pré-requisito dos casos acima, `src/servidor/sessao.ts` isolado:

18. **`cookieSessaoEhValido` sem `PAINEL_SESSAO_SECRET` configurada** — `false`
    para qualquer valor de cookie, incluindo um assinado com um segredo antigo
    — degradação certa é recusar, nunca liberar.
19. **`cookieSessaoEhValido` com cookie expirado** (`exp` no passado, assinatura
    correta) — `false`.
20. **`cookieSessaoEhValido` com assinatura adulterada** (`exp` certo,
    assinatura de outro `exp` ou de outro segredo) — `false`.
21. **`cookieSessaoEhValido` com valor malformado** (sem `.`, `exp` não numérico,
    string vazia, `undefined`) — `false`, sem lançar.
22. **`segredoDeSessaoBate`/`segredosBatem` (`comparacaoSegura.ts`) com
    segredo e recebido de tamanhos diferentes** — `false` sem lançar (a
    função precisa engolir o `throw` de `timingSafeEqual` para tamanhos
    diferentes).

### Nível 3 — `src/dominio/destinoSeguro.ts`

Fechou um redirecionamento aberto real, achado pela própria rodada noturna.
Cada entrada do comentário do arquivo é um caso de regressão:

23. `destinoSeguro("/\\evil.com")` → `"/"` (o furo original: barra invertida
    que o navegador normaliza para barra comum).
24. `destinoSeguro("//evil.com")` → `"/"` (protocol-relative URL).
25. `destinoSeguro("https://evil.com")` → `"/"`.
26. `destinoSeguro("javascript:alert(1)")` → `"/"`.
27. `destinoSeguro("/projeto/123")` → `"/projeto/123"` (caminho interno normal
    passa inalterado).
28. `destinoSeguro("/projeto/123?x=1#y")` → preserva query e hash.
29. `destinoSeguro(undefined)`, `destinoSeguro(null)`, `destinoSeguro("")`,
    `destinoSeguro(42)` → todos `"/"` (entrada não é string não vazia).
30. `destinoSeguro("not-a-path")` (sem `/` inicial) → `"/"`.

E, no ponto de uso: **`entrarAction` com `proximo` malicioso no FormData** —
confirmar que o `redirect()` chamado ao final usa o valor já normalizado, não
o bruto do formulário (fecha o caminho ponta a ponta, não só a função pura).

### Nível 4 — validadores puros (entrada de automação e de formulário)

São o caso "ninguém vê falhar": corpo malformado vindo da routine, silêncio
até a manhã seguinte.

**`validacaoRelatorio.ts`** (`POST /api/reports`, alimentado pela routine):

31. Corpo não é objeto (array, string, `null`) → erro.
32. `projeto_id` ausente/vazio → erro.
33. `status` fora de `ok`/`atencao`/`falha` → erro.
34. `resumo` vazio (só espaço) → erro.
35. `resumo` acima de 4000 caracteres → erro, sem truncar.
36. `testes_passaram` ausente → aceito, vira `null`.
37. `testes_passaram` com valor não booleano (`"true"` string, `1`) → erro.
38. `achados_por_agente` ausente → aceito, vira `[]`.
39. `achados_por_agente` não é array (é objeto) → erro.
40. `achados_por_agente` com mais de 20 itens → erro.
41. Um item de `achados_por_agente` sem `agente`, sem `achado` ou sem `selo` →
    erro apontando o índice e o campo.
42. Um item com `agente`/`achado`/`selo` acima do teto individual → erro.
43. Item com campo extra não documentado → aceito, mas o campo extra é
    descartado no resultado (não é gravado como veio).

**`validacaoSugestao.ts`** (`POST /api/suggestions`, routine):

44. Corpo válido completo → `ok: true` com todos os campos aparados (trim).
45. `esforco` fora de `pequeno`/`medio`/`grande` → erro.
46. `reversibilidade` fora de `facil`/`dificil`/`nao_reverte` → erro.
47. `proposta`/`motivo`/`risco`/`agente` cada um acima do próprio teto → erro
    específico por campo (não uma mensagem genérica).
48. Corpo com `estado: "aprovada"` incluído → campo ignorado (não é lido,
    coberto também no caso 7 acima em nível de rota).

**`validacaoPatchSugestao.ts`** (`PATCH`, dono):

49. `estado` fora de `aprovada`/`recusada`/`feita` → erro.
50. `estado: "feita"` sem `pr_url` → aceito, `pr_url: null`.
51. `estado: "feita"` com `pr_url` que não começa com `https://` → erro.
52. `estado: "feita"` com `pr_url` acima de 2048 caracteres → erro.
53. `estado: "aprovada"` com `pr_url` no corpo → `pr_url` ignorado (só é lido
    quando `estado === "feita"`; confirma que o corpo não pode antecipar essa
    coluna fora da hora certa).
54. `estado: "feita"` com `pr_url` só espaços (`"   "`) → aceito, vira `null`
    (não erro de formato).

**`validacaoContexto.ts`** (`PUT /api/context/:projeto`, dono + Server Action):

55. Nem `conteudo` nem `arquivo_url` informados → erro ("informe conteúdo ou
    link").
56. `arquivo_url` sem `https://` (ex. `http://`, `file:///etc/passwd`) → erro
    — é a defesa contra SSRF que o comentário do arquivo cita.
57. `agente_destino` ou `tipo` contendo quebra de linha ou caractere de
    controle → erro (viram rótulo de seção no `CLAUDE.md` gerado; sem essa
    checagem, um rótulo vira estrutura de documento).
58. `conteudo` acima de 20000 caracteres → erro.
59. `conteudo` só espaços → tratado como ausente (vira `null`), não como erro
    de tamanho.

**`validacaoProjeto.ts`** (formulário de cadastro/edição, dono):

60. `repositorio` com segmento `.` ou `..` (`"../x"`, `"x/.."`) → erro —
    fecha o path traversal que o próprio comentário descreve (o valor
    atravessa até o ambiente que roda `git clone`).
61. `repositorio` fora do formato `dono/repo` (com espaço, sem barra, duas
    barras) → erro.
62. `nome` vazio ou só espaço → erro.
63. `frequencia` fora das três válidas (só no validador "com frequência") →
    erro.

**`validacaoAgenteProjeto.ts`** (esteira de agentes, dono): mesma categoria,
prioridade um degrau abaixo por ser alimentado só pelo dono, não por
automação — ainda assim vale:

64. `teto_sugestoes` fora de `0..3`, ou não inteiro (`1.5`) → erro.
65. `instrucao` acima de 4000 caracteres → erro.
66. `validarOrdemAgentes` com mais de 64 itens, ou item não-string → erro.

### Nível 5 — `src/dominio/cadencia.ts`

Regra de negócio pequena e com efeito direto sobre dado gravado — cada ramo é
barato de testar e caro de deixar quebrar em silêncio (gravaria frequência
errada sem ninguém perceber, já que a UI só mostra o resultado depois).

67. `faixaDoProjeto({ ativo: false, frequencia: "toda_madrugada" })` →
    `"pausado"` (ativo=false vence qualquer frequência).
68. `faixaDoProjeto({ ativo: true, frequencia: "dias_alternados" })` →
    `"alternada"`.
69. `patchParaFaixa("pausado")` → `{ ativo: false }` **só**, sem campo
    `frequencia` — soltar em Pausado não deve tocar a frequência configurada
    (comentário do arquivo: "pausar não muda a frequência").
70. `patchParaFaixa("diaria")` → `{ ativo: true, frequencia:
    "toda_madrugada" }`.
71. `patchParaFaixa("semanal")` → `{ ativo: true, frequencia: "semanal" }`.
72. Ida e volta: `faixaDoProjeto` aplicado ao resultado de `patchParaFaixa(f)`
    para cada `f` de `ORDEM_FAIXAS` devolve `f` — prova que as duas funções
    são inversas uma da outra, o que é a garantia real por trás do
    drag-and-drop entre colunas.

### Nível 6 — `src/dominio/prompt.ts`

Contrato do texto que vai para a área de transferência do dono e dali para
fora do app — é o único lugar que redige antes de vazar.

73. `gerarTextoPrompt` com `contexto[].conteudo` contendo algo que parece
    credencial (`"postgres://user:senha123@host/db"`) → o texto final não
    contém a substring da credencial, contém o marcador de omissão.
74. Mesmo caso para `resumo` e `achado` de `ultimoRelatorio`, e para `motivo`/
    `risco`/`proposta` de uma sugestão selecionada — cada campo de texto livre
    testado isoladamente, não só um caso feliz genérico.
75. Sugestão selecionada com `naoReverte: true` → o texto contém "NÃO
    REVERTE" e o aviso extra no topo do prompt aparece.
76. Nenhuma sugestão selecionada com `naoReverte: true` → o aviso extra no
    topo **não** aparece (garante que o aviso é condicional, não sempre
    presente — testar a ausência é tão importante quanto testar a presença
    aqui).
77. `recusadas` não vazio → a seção "Já recusado — não reproponha" aparece e
    lista as propostas.
78. `recusadas` vazio → a seção inteira está ausente do texto (não aparece um
    cabeçalho vazio).
79. `selecionadas` vazio → a seção "O que fazer agora" contém a frase que pede
    para decidir com o dono, não uma lista vazia.
80. `ultimoRelatorio: null` → texto diz explicitamente que nenhuma rodada foi
    registrada, sem lançar nem imprimir `null`/`undefined` literal.
81. `contextos: []` → texto diz que nenhum contexto foi anexado.

E, como base de `prompt.ts`, `src/dominio/pareceCredencial.ts` isolado — vale
testar os padrões reconhecidos diretamente, não só através do prompt, porque
um regex errado aqui é silencioso demais para descobrir só via teste de
integração:

82. Cada padrão do comentário: string de conexão `scheme://user:pass@host`,
    `sk-...`, `AKIA...`, `ghp_...`/`gho_...`, `xoxb-...`, JWT
    (`eyJ....eyJ...`) → cada um reconhecido isoladamente.
83. Texto comum sem nenhum desses padrões (`"revisei o código e está ok"`) →
    não reconhecido — prova que o alarme não é gatilho fácil demais (falso
    positivo custa confiança no prompt gerado).
84. `pareceCredencial(null)`/`pareceCredencial(undefined)`/`pareceCredencial("")`
    → `false`, sem lançar.

### Nível 7 (valor menor, ainda vale) — `src/dominio/esteiraAgentes.ts`

85. `montarEsteira` com uma linha habilitada e uma desabilitada → a habilitada
    cai em `ativos`, a desabilitada em `inativos`.
86. Duas linhas habilitadas com a mesma `ordem` → desempate alfabético por
    `agente` (a coluna não tem `UNIQUE` em `ordem`, ver comentário do
    arquivo — sem este teste, um empate produziria ordem instável entre
    execuções).
87. Um agente de `AGENTES_CONHECIDOS` que nunca teve linha gravada para o
    projeto → aparece em `inativos` como entrada "virtual" (`instrucao: null`,
    `tetoSugestoes: null`), sem exigir registro prévio no banco.

E `traduzirErroDeBanco` (`src/servidor/erros.ts`) — não é lógica de negócio,
mas é a fronteira que decide o que do erro real do Postgres vira mensagem
para o cliente:

88. Erro com `code: "23505"` (unique_violation) → mensagem fixa sobre
    repositório duplicado, não o texto cru do Postgres.
89. Erro com `code: "23514"` (check_violation) → mensagem genérica de "dados
    inválidos", não o nome da constraint.
90. Qualquer outro erro (`Error` comum, erro de conexão) → mensagem genérica
    (`MENSAGEM_GENERICA`), nunca o detalhe original — é a regra "detalhe
    interno vai para o log, nunca para o cliente" sendo testada de verdade,
    não só documentada em comentário.

---

## 3. O que não vale testar

- **Mapeamento de linha de banco para objeto de domínio sem lógica**
  (`linhaParaSugestao`, `linhaParaVM` na parte que só copia campo por campo).
  Testar isso é reescrever o mesmo mapeamento em formato de asserção — passa
  por construção, não prova nada.
- **`FAIXA_META`, `FAIXA_LABEL_LONGO`, `FAIXA_LABEL_CURTO`** (`cadencia.ts`) e
  qualquer outro dicionário de rótulo estático. É texto de UI, não regra —
  muda com o gosto do dono, não com uma decisão que possa quebrar algo.
- **`AGENTES_CONHECIDOS`, `agentesConhecidos.ts`, `papeis.ts`** como listas —
  não há comportamento a verificar, só um catálogo. (A pendência já anotada em
  `docs/proximos-passos.md` — `devops-deploy` classificado errado em
  `papeis.ts` — é um dado a corrigir, não algo que um teste unitário
  detectaria sozinho sem primeiro decidir qual é o valor certo.)
- **`respostaApi.ts` → `respostaErro`** — uma linha, `NextResponse.json({erro}, {status})`.
  É repasse puro.
- **Renderização de componentes React / telas** — não há runner de
  navegador configurado, e o visual já foi aprovado como export estático
  preservado em `design-original/` (CLAUDE.md: "preserve o CSS, a tipografia
  e o layout"). Testar pixel ou snapshot de componente agora, antes do
  redesenho visual previsto no item 9 do roteiro, é testar algo que vai mudar
  de propósito em breve — desperdício de manutenção.
- **`GET /api/projects`, `GET /api/reports`, `GET /api/context/:projeto`
  como "retornam a lista"** — sem filtro nem regra de negócio própria (são
  `SELECT *` mapeados), testar isso exige banco e não prova nada que os
  validadores e o gate de acesso já não provem. Vale testar a *forma* do
  contrato (campos que a routine espera em `GET /api/projects` — ver seção 4)
  quando houver banco de teste, não antes.
- **`next.config.ts`, `tsconfig.json`, scripts do `package.json`** —
  configuração estática; `npm run typecheck` e `npm run build` já são a
  verificação que importa para eles, não teste unitário.

---

## 4. O que exige banco, e se fica para depois

Exige Postgres real (não dá para simular com mock de `sql()`, porque o que
está sendo verificado é o banco *recusando* algo que a aplicação não pediu
para recusar):

- **A trigger `sugestao_validar_transicao_estado`** — a única forma de provar
  que ela existe e funciona é um `UPDATE` direto via SQL que pule de
  `pendente` para `feita` num único comando, contornando a aplicação por
  completo, e confirmar que o Postgres rejeita com a exceção
  `RAISE EXCEPTION`. Testar só através de `aprovarSugestao`/`marcarSugestaoFeita`
  (que já restringem a `WHERE estado = '...'` antes de chegar à trigger) não
  exercita a trigger — só prova que a aplicação nunca tenta a transição
  errada, o que já os testes de nível 1 com mock provam mais barato. A
  trigger é defesa para quando a aplicação *falhar* nessa restrição (bug
  futuro, migração malfeita, acesso direto ao banco) — só um teste com banco
  real prova que ela pegaria esse caso.
- **Os `CHECK` de `001_schema_inicial.sql` e `003_tetos_tamanho.sql`** — os
  validadores em `src/dominio/` já espelham esses limites (é o que os
  comentários de topo de cada validador dizem explicitamente), então o valor
  marginal de testar o `CHECK` em si é baixo *contanto que* o espelhamento
  seja mantido em sincronia manualmente. O risco real aqui não é "o CHECK não
  funciona", é "o validador e o CHECK divergirem com o tempo" — isso um teste
  de banco pegaria e um teste de validador isolado, não.
- **`aprovarSugestao`/`recusarSugestao`/`criarSugestao`/`marcarSugestaoFeita`
  contra Postgres de verdade** — hoje dá para testar a forma da chamada e o
  tratamento de erro com `sql()` mockado (nível 1, casos 5 e 6). O que só o
  banco real prova é que a query em si está correta (nome de coluna certo,
  `RETURNING` com os campos certos, o `WHERE` realmente restringe a linha
  certa quando há mais de uma sugestão na tabela).
- **`GET /api/projects` contra dados reais** — o contrato que a routine
  depende (comentário da rota: "mudar o formato quebra a automação em
  silêncio") merece um teste de contrato completo — projeto com contexto,
  sugestões nos três estados, agentes habilitados e desabilitados — mas isso
  exige popular o banco antes de perguntar.

**Recomendação: fica para depois, não bloqueia a suíte de agora.**

O motivo prático: não há ainda ambiente de banco de teste configurado (Neon
de teste, ou Postgres local via Docker) neste repositório, e criar essa
infraestrutura é uma decisão própria (qual banco, como isolar de produção,
como resetar entre execuções) que merece ser avaliada e aprovada separada da
suíte de unidade — CLAUDE.md pede plano antes de codar algo não trivial, e
"como isolar teste de banco de produção" não é trivial. A suíte sem banco
(seções 1–7 do item 2, ~90 casos) já cobre a maior parte do valor de
segurança do projeto — as três camadas do gate, a matriz de acesso, o
redirecionamento seguro, todos os validadores de entrada, a cadência e o
prompt. A trigger continua sendo, hoje, defendida só pela leitura do código e
pela revisão manual — o mesmo estado em que estava antes deste plano, não
pior. Vale abrir como item novo da fila (`docs/proximos-passos.md`) depois que
a suíte sem banco estiver rodando: "ambiente de teste de banco — provar a
trigger".

---

## 5. Como isso alimenta a madrugada orientada a teste

(`docs/proximos-passos.md`, item 3.) O que a rodada deveria medir e reportar
todo dia, uma vez que a suíte existir — a rodada só **roda e relata**, nunca
conserta um teste quebrado nem edita código para fazê-lo passar (regra "a
rodada noturna não altera código" continua valendo integralmente aqui):

- **Resultado bruto** — quantos testes, quantos passaram, quantos falharam,
  agrupados por arquivo (não só o total). Um `falha` no relatório deve dizer
  qual caso, não só "2 testes quebraram".
- **Teste intermitente** — rodar a suíte mais de uma vez (ex. duas ou três
  vezes seguidas) na mesma rodada e comparar resultado entre execuções. Um
  teste que passa numa e falha na outra é reportado como intermitente,
  separado dos que falham de forma consistente — os dois pedem reação
  diferente do dono.
- **Cobertura do que mudou, não do projeto inteiro** — rodar cobertura restrita
  aos arquivos tocados desde o último relatório (`git diff` contra o commit da
  rodada anterior), não a porcentagem total do repositório. O que interessa
  é "o código novo desta rodada tem teste", não um número agregado que uma
  mudança grande em área já coberta infla sem dizer nada sobre o que é novo.
- **Delta em relação à noite anterior** — comparar contagem de testes, taxa de
  sucesso e cobertura do diff com o relatório da rodada anterior. Uma suíte
  que encolhe (menos testes que ontem, sem PR de remoção correspondente) é em
  si um achado a reportar, não um número neutro.
- **Atenção especial ao Nível 1** — se algum teste que cobre o gate de
  aprovação (seção 2, casos 1–8) for removido ou alterado para passar a
  aceitar um caso antes recusado, isso é a mudança mais perigosa que pode
  passar despercebida no projeto inteiro. Vale a rodada sinalizar isso como
  achado de atenção máxima, não como uma linha a mais no resumo — é a mesma
  lógica de "o que já quebrou uma vez merece vigilância", elevada ao que
  *nunca pode* quebrar.
- **"Nada a fazer" continua válido aqui** — suíte verde, sem intermitência,
  sem regressão de cobertura no diff, é um relatório de sucesso, não um
  relatório vazio.

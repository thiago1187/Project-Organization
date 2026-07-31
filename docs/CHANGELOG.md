# Changelog

Uma linha por mudança, em ordem cronológica inversa. Mudança **significativa**
(ver `CLAUDE.md` > Documentação) também tem registro em `docs/`; aqui é só o
resumo em linguagem de gente.

Este arquivo não existia até agora. As entradas abaixo cobrem o histórico
inteiro do projeto até aqui, reconstruído do log de commits — a partir de hoje
ele é mantido a cada mudança.

## 2026-07-30

- Adicionado: importar projeto do GitHub no cadastro — colar "dono/repo" ou a
  URL traz nome, descrição, linguagens, último commit, PRs abertos e um
  resumo do README para pré-preencher o formulário; nada é salvo sem o dono
  clicar. `GITHUB_TOKEN` é opcional (60 requisições/hora sem ele, 5.000
  com) e a ausência dele não trava nada.
- Corrigido: dois vetores de injeção que a revisão de segurança achou na
  importação do GitHub — uma descrição de repositório de terceiro podia (a)
  fechar o bloco `contexto-do-painel` do `CLAUDE.md` do repositório alvo e
  fazer o resto de si valer como instrução, ou (b) carregar texto invisível
  (caracteres de tag Unicode) que não aparecia na tela, então o dono revisava
  e salvava sem ver nada de errado. Corrigido neutralizando os delimitadores
  de estrutura e removendo toda a categoria Unicode `Cf` (formatação
  invisível), não só os caracteres de controle óbvios.
- Adicionado: painel de atenção no topo da visão geral — os projetos que
  pedem decisão agora, juntando as três faixas de frequência num só lugar,
  em vez de depender de rolar até achar o card certo.
- Redesenhada: tipografia do app — `Inter` no lugar de `Instrument Serif`
  (herança do export), fonte monoespaçada reservada a dado técnico, piso
  rígido de 12px, cinco níveis de botão e um controle de densidade
  (compacto/normal/confortável) que fica salvo no navegador.
- Adicionado: mapa dos agentes (`/agentes` e `/agentes/:nome`) — cada agente
  como uma ficha: onde atua, o que já achou, o que já propôs e a taxa de
  aprovação das próprias sugestões.
- Corrigido: a saudação do cabeçalho era o texto fixo "Bom dia", herdado do
  export — aparecia de madrugada e de noite. Agora muda com a hora.
- Corrigido: a data usada para saber se um relatório é "de hoje" estava
  travada em 29 de julho de 2026, escrita à mão na conversão para Next.js e
  nunca trocada. Agora vem do relógio, no fuso do dono.
- Adicionado: seção de tom no prompt da rodada noturna e nas 16 definições de
  agente — frase curta, voz ativa, fala com "você", sem jargão de laudo.
- Adicionado: documento de andamento (`/projeto/[id]/documento`) — relatório
  gerado sob demanda em duas vozes (técnica e de andamento), com escolha de
  período, exportável em PDF pela impressão do navegador.
- Redesenhada: a tela de detalhe do projeto — faixa de resumo com a ação
  principal em destaque, fila de sugestões promovida a segundo lugar, seções
  de baixa frequência (histórico, inventário) recolhíveis, atalhos de teclado
  (`[` `]` para navegar entre projetos, `f`/`a`/`x` para agir na fila).
- Adicionado: trava de tentativas na tela de entrada — 8 falhas em 15 minutos
  bloqueiam novas tentativas, contadas no banco (não em memória) e sem
  distinção por IP, porque este é um app de usuário único.
- Corrigido: o selo de status mostrava "PR aberto" mesmo em projeto sem
  nenhum PR.
- Corrigido: três achados da revisão de segurança do servidor MCP — origem
  `mcp` passou a respeitar a regra de ambiente (preview não concede acesso),
  `projeto.nome` passou a ser filtrado contra padrão de credencial, e
  `contexto.origem` ganhou o valor `'mcp'` para o dono distinguir o que o
  terminal escreveu do que ele digitou na tela.
- Adicionado: `projeto.descricao` e a entidade `tarefa` — o painel "onde
  estamos" deixou de ser mockado e passa a mostrar a descrição do projeto e a
  worklist real, com tarefas arrastáveis e edição no lugar.
- Adicionado: sugestor de agentes — sugere ligar um agente na esteira (ou
  convocá-lo pelo prompt gerado, se for de escrita) com base no histórico do
  projeto e no inventário, sempre com o motivo visível. Nunca sugere por
  ausência de dado, só por presença de evidência.
- Testado: 52 testes cobrindo o servidor MCP (domínio e fiação de transporte).
- Adicionado: servidor MCP em `POST /api/mcp` — sete ferramentas (cinco de
  leitura, duas de escrita) para o Claude Code do dono conversar com o painel.
  `aprovar_sugestao` fica de fora de propósito; aprovar continua sendo dois
  cliques na tela.
- Corrigido: `projeto.repositorio` passou a ser opcional — projetos que vivem
  só num connector (ex.: n8n) agora podem ser cadastrados sem repositório.
- Corrigido: o filtro anti-credencial (`parece_credencial`) estava cego para
  os provedores que este projeto de fato usa (Vercel, Google, GitLab,
  DigitalOcean, Resend, Fly, npm, Mapbox) — calibrado contra credenciais de
  terceiros, mas não contra as do próprio dono.
- Adicionado: inventário do projeto (stack e serviços) chega à tela de
  detalhe; removido o mock morto que sobrava do export original.
- Adicionado: suíte de testes com Vitest — 114 testes cobrindo o gate de
  aprovação, a matriz de acesso, o redirecionamento seguro e os validadores de
  entrada.
- Adicionado: a rodada noturna passa a tratar a suíte de testes como o eixo
  do diagnóstico — roda duas vezes para achar intermitência, mede cobertura
  do que mudou (não do projeto inteiro) e compara com a rodada anterior.
- Corrigido: campos que escapavam do filtro anti-credencial no prompt gerado
  pelo painel.
- Corrigido: relógio do cabeçalho, que era texto fixo herdado do export,
  passou a mostrar a hora real.
- Adicionado: esteira de agentes por projeto — cada projeto liga, desliga e
  ordena quais agentes o diagnosticam de madrugada, com instrução específica
  por agente.
- Adicionado: gerador de prompt no painel, e fim da execução automática pela
  rodada noturna — a partir de agora ela só diagnostica e propõe; o trabalho
  de escrita acontece depois, com o dono presente, a partir do prompt gerado.
- Adicionado: fila de sugestões, com aprovar e recusar.
- Adicionado: editor de contexto na tela de detalhe do projeto.
- Adicionado: sessão própria do painel (login) e tetos de tamanho na entrada
  que a rodada noturna envia.
- Adicionado: rotas de API que a rodada noturna usa (`POST /api/reports`,
  `POST /api/suggestions`) e correção de dois furos no portão de aprovação.
- Adicionado: painel ligado ao Postgres — o CRUD de projeto passou a
  persistir de verdade.
- Corrigido: redirecionamento aberto na tela de entrada.
- Corrigido: o bypass da Vercel passou a ler uma variável própria do painel,
  em vez de depender só da variável de sistema da automação da Vercel.
- Adicionado: conversão do export estático do Claude Design para um app
  Next.js (App Router), com o mesmo visual preservado.
- Adicionado: inventário de projeto (`stack`, `servico`) no banco.
- Adicionado: schema inicial do banco — `projeto`, `relatorio`, `sugestao`,
  `contexto`.

-- seed.sql
-- Dado de demonstração para avaliar o painel antes de existir uma rodada real.
--
-- ATENÇÃO — NUNCA rodar isto num banco com dado real. Todo projeto aqui usa o
-- prefixo de repositório "demo-seed/" e o sufixo "(demo)" no nome exatamente para
-- ser óbvio, à primeira vista, que é semente e não produção. Se o banco em que
-- você está prestes a rodar isto já tem projeto real, pare.
--
-- Não contém segredo nenhum: nenhuma string aqui tem formato de chave, token ou
-- string de conexão. `pr_url` aponta para PRs que não existem de verdade — são só
-- URLs no formato exigido pela constraint `sugestao_pr_url_formato`.
--
-- Idempotência: este arquivo primeiro apaga qualquer linha de demonstração já
-- existente (identificada pelo prefixo "demo-seed/" em projeto.repositorio) e
-- depois insere o conjunto completo de novo. Rodar duas vezes deixa o banco no
-- mesmo estado, não duplica, e nunca toca em projeto que não tenha esse prefixo.
-- Preferido a `ON CONFLICT DO NOTHING` porque o objetivo aqui é um estado de
-- demonstração *conhecido e reproduzível* — se alguém editou uma sugestão pela
-- UI enquanto testava, rodar o seed de novo deve devolver o cenário original,
-- não deixar a edição manual convivendo com o resto do conjunto.
--
-- Pressupõe a migration 001_schema_inicial.sql já aplicada.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Limpeza (só do que é demonstração, identificado pelo prefixo do repositório)
-- ─────────────────────────────────────────────────────────────────────────

-- sugestao tem ON DELETE RESTRICT em projeto_id (ver comentário na migration) —
-- precisa ser apagada explicitamente antes do projeto. relatorio e contexto têm
-- ON DELETE CASCADE e somem sozinhas quando o projeto for apagado a seguir.
DELETE FROM sugestao
WHERE projeto_id IN (SELECT id FROM projeto WHERE repositorio LIKE 'demo-seed/%');

DELETE FROM projeto WHERE repositorio LIKE 'demo-seed/%';

-- ─────────────────────────────────────────────────────────────────────────
-- projeto — 6 linhas: as três frequências e um pausado.
-- ─────────────────────────────────────────────────────────────────────────
-- criado_em é deliberadamente anterior a qualquer relatorio/sugestao do mesmo
-- projeto mais abaixo, para não contar uma história onde o projeto "nasce"
-- depois de já ter histórico.
INSERT INTO projeto (id, nome, repositorio, frequencia, ativo, criado_em) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Cofre de Rotinas (demo)',
    'demo-seed/cofre-rotinas', 'toda_madrugada', true, now() - interval '120 days'),
  ('a0000000-0000-0000-0000-000000000002', 'Estufa Inteligente (demo)',
    'demo-seed/estufa-inteligente', 'dias_alternados', true, now() - interval '120 days'),
  ('a0000000-0000-0000-0000-000000000003', 'Painel do Aquário (demo)',
    'demo-seed/painel-aquario', 'semanal', true, now() - interval '120 days'),
  -- Ativo, cadastrado há poucos dias, ainda sem nenhuma rodada — é o caso de
  -- estado vazio da tela de detalhe (histórico, fila de sugestões, ambos vazios).
  ('a0000000-0000-0000-0000-000000000004', 'Gerador de Playlists (demo)',
    'demo-seed/gerador-playlists', 'toda_madrugada', true, now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000005', 'Lembrete de Regar Plantas (demo)',
    'demo-seed/lembrete-plantas', 'dias_alternados', true, now() - interval '120 days'),
  -- Pausado: cai na quarta faixa (Pausado) da Visão Geral, independente da
  -- frequência configurada — tem histórico de quando ainda rodava.
  ('a0000000-0000-0000-0000-000000000006', 'Catalogador de Vinis (demo)',
    'demo-seed/catalogador-vinis', 'semanal', false, now() - interval '150 days');

-- ─────────────────────────────────────────────────────────────────────────
-- relatorio — 10 linhas. Profundidade de histórico varia por projeto de
-- propósito; "Gerador de Playlists" fica sem nenhuma.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO relatorio (id, projeto_id, executado_em, status, resumo, testes_passaram, achados_por_agente) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    now() - interval '1 day', 'ok',
    'Rodada limpa: nenhum achado que justifique sugestão nova.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'qa-testes', 'achado', '86 testes, todos passando.', 'selo', '86 verdes'),
      jsonb_build_object('agente', 'revisor-codigo', 'achado', 'Nenhum problema de estilo ou duplicação encontrado nesta rodada.', 'selo', 'limpo')
    )),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    now() - interval '3 days', 'atencao',
    'Uma sugestão nova de índice; nada bloqueante.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'engenheiro-dados', 'achado', 'Consulta de histórico de execução sem índice; plano sequencial numa tabela com cerca de 40 mil linhas.', 'selo', '1 sugestão'),
      jsonb_build_object('agente', 'qa-testes', 'achado', '86 testes, todos passando.', 'selo', '86 verdes')
    )),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    now() - interval '7 days', 'falha',
    'Build quebrou por dependência incompatível; rodada interrompida antes dos testes.', false,
    jsonb_build_array(
      jsonb_build_object('agente', 'dev-backend', 'achado', 'Build falhou: a versão travada de "croner" não é compatível com o Node 20 do runner de CI.', 'selo', 'build vermelho'),
      jsonb_build_object('agente', 'qa-testes', 'achado', 'Suite não rodou — build quebrado antes de chegar aos testes.', 'selo', 'bloqueado')
    )),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
    now() - interval '14 days', 'ok',
    'Primeira rodada completa do projeto; ainda não há testes automatizados para medir.', NULL,
    jsonb_build_array(
      jsonb_build_object('agente', 'arquiteto-chefe', 'achado', 'Estrutura do repositório é coerente com o domínio: agendador, executor e log bem separados.', 'selo', 'sem achados'),
      jsonb_build_object('agente', 'revisor-seguranca', 'achado', 'Token do serviço de cron vem de variável de ambiente, não está versionado.', 'selo', 'sem achados')
    )),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002',
    now() - interval '2 days', 'falha',
    'Sensor de umidade retorna valor fora de faixa; dois testes de integração falhando.', false,
    jsonb_build_array(
      jsonb_build_object('agente', 'investigador-bugs', 'achado', 'Leitura do sensor de umidade retorna -1 quando o cabo desconecta; o código trata isso como 0% e dispara irrigação.', 'selo', 'bug crítico'),
      jsonb_build_object('agente', 'qa-testes', 'achado', '58 testes, 2 falhando (irrigacao_test, sensor_test).', 'selo', '2 vermelhos')
    )),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
    now() - interval '9 days', 'ok',
    'Rodada de rotina, sem novidades.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'qa-testes', 'achado', '60 testes, todos passando.', 'selo', '60 verdes')
    )),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003',
    now() - interval '5 days', 'ok',
    'Nenhum achado relevante nesta rodada.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'revisor-performance', 'achado', 'Consulta de histórico de temperatura já usa o índice adequado.', 'selo', 'sem achados'),
      jsonb_build_object('agente', 'qa-testes', 'achado', '24 testes, todos passando.', 'selo', '24 verdes')
    )),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000005',
    now() - interval '4 days', 'atencao',
    'Duplicação de código entre dois módulos de notificação; sugestão registrada.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'refatorador', 'achado', 'Lógica de formatação de horário de lembrete está duplicada em notificar_email.py e notificar_push.py.', 'selo', '1 sugestão'),
      jsonb_build_object('agente', 'qa-testes', 'achado', '31 testes, todos passando.', 'selo', '31 verdes')
    )),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005',
    now() - interval '11 days', 'ok',
    'Rodada de rotina.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'qa-testes', 'achado', '31 testes, todos passando.', 'selo', '31 verdes')
    )),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000006',
    now() - interval '20 days', 'ok',
    'Última rodada registrada antes de o projeto ser pausado.', true,
    jsonb_build_array(
      jsonb_build_object('agente', 'qa-testes', 'achado', '12 testes, todos passando.', 'selo', '12 verdes')
    ));

-- ─────────────────────────────────────────────────────────────────────────
-- sugestao — 11 linhas. Os quatro estados, os três esforços, os três níveis
-- de reversibilidade, e duas "nao_reverte" ainda pendentes (s6 e s10).
--
-- Linhas "aprovada"/"recusada"/"feita" são inseridas diretamente nesse estado
-- (INSERT, não UPDATE) — a trigger `sugestao_validar_transicao` só existe em
-- BEFORE UPDATE, então não se aplica aqui; os CHECKs de consistência de estado
-- e de ordem temporal (criada_em <= aprovada_em <= feita_em) valem para INSERT
-- também e foram respeitados linha a linha abaixo.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO sugestao (
  id, projeto_id, agente, proposta, motivo, esforco, risco, reversibilidade,
  estado, criada_em, aprovada_em, recusada_em, feita_em, pr_url
) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'engenheiro-dados',
    'Criar índice em execucao(rotina_id, executado_em) para acelerar a consulta de histórico.',
    'A consulta de histórico de execução faz sequential scan numa tabela com cerca de 40 mil linhas e já aparece como o passo mais lento do endpoint de histórico.',
    'pequeno',
    'Índice adicional custa espaço em disco e uma pequena perda de desempenho em INSERT/UPDATE de execucao; não muda o resultado de nenhuma consulta.',
    'facil', 'aprovada',
    now() - interval '3 days', now() - interval '2 days', NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'dev-backend',
    'Atualizar a dependência "croner" para a versão compatível com Node 20.',
    'O build do CI está quebrado há uma semana porque a versão travada de croner não suporta o Node 20 usado pelo runner atual.',
    'pequeno',
    'Mudança de versão pode alterar o formato de cron string aceito em casos de borda; revisar o changelog da dependência antes de subir.',
    'facil', 'feita',
    now() - interval '7 days', now() - interval '6 days', NULL, now() - interval '5 days',
    'https://github.com/demo-seed/cofre-rotinas/pull/42'),

  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    'revisor-seguranca',
    'Mover o token do serviço de cron de arquivo de configuração para variável de ambiente.',
    'O token aparece hoje num arquivo de configuração versionado, mesmo com valor de exemplo — hábito que convida vazamento real no primeiro commit apressado.',
    'pequeno',
    'Exige atualizar o processo de deploy para injetar a variável antes do primeiro start; se esquecido, a aplicação sobe sem token e falha ao autenticar.',
    'facil', 'pendente',
    now() - interval '4 days', NULL, NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
    'refatorador',
    'Extrair a lógica de retry do executor de rotina para um módulo próprio.',
    'A mesma lógica de tentativa com backoff está copiada em três lugares do executor; mudar o número de tentativas hoje exige editar em três pontos e é fácil esquecer um.',
    'medio',
    'O comportamento de retry pode mudar sutilmente para algum dos três chamadores se a extração não preservar exatamente os parâmetros que cada um usa hoje.',
    'dificil', 'pendente',
    now() - interval '2 days', NULL, NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002',
    'investigador-bugs',
    'Tratar leitura de sensor desconectado como estado "sem leitura" em vez de 0%.',
    'Quando o cabo do sensor de umidade solta, o valor lido vira -1 e o código interpreta isso como 0%, o que dispara irrigação num solo que pode já estar saturado.',
    'medio',
    'É preciso decidir o que o sistema faz na ausência de leitura — pausar irrigação automática ou usar a última leitura válida —, e essa é uma decisão de produto, não só de código.',
    'facil', 'pendente',
    now() - interval '2 days', NULL, NULL, NULL, NULL),

  -- nao_reverte #1, ainda pendente: mudança de schema/particionamento em produção.
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
    'dev-backend',
    'Particionar a tabela de leituras de sensor por mês.',
    'A tabela de leituras cresce cerca de 200 mil linhas por mês e as consultas do painel de histórico já levam mais de 2 segundos.',
    'grande',
    'Particionar uma tabela em produção com dado existente é uma mudança de schema com janela de bloqueio e sem volta fácil se o particionamento escolhido não servir depois — precisa de aprovação explícita do dono e execução acompanhada, não é mudança para rodar sozinha.',
    'nao_reverte', 'pendente',
    now() - interval '2 days', NULL, NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002',
    'revisor-performance',
    'Adicionar cache de 60 segundos na leitura mais recente do sensor exposta pela API.',
    'O painel da estufa faz polling a cada 5 segundos e bate direto no banco a cada requisição, mesmo quando o sensor só atualiza a cada minuto.',
    'pequeno',
    'O painel passaria a mostrar a leitura com até 60 segundos de atraso em vez de tempo real.',
    'facil', 'recusada',
    now() - interval '8 days', NULL, now() - interval '7 days', NULL, NULL),

  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003',
    'designer-ui',
    'Padronizar o espaçamento dos cartões de temperatura para a grade de 8px já usada no resto do painel.',
    'Os cartões de temperatura foram adicionados depois do resto da tela e usam espaçamento de 6px, o que quebra o ritmo visual do restante do painel.',
    'pequeno',
    'Nenhum — é ajuste puramente visual, sem lógica envolvida.',
    'facil', 'aprovada',
    now() - interval '6 days', now() - interval '5 days', NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005',
    'refatorador',
    'Unificar a formatação de horário de lembrete num único módulo compartilhado.',
    'A mesma função de formatar horário está copiada em notificar_email.py e notificar_push.py; a última correção de fuso horário só foi aplicada numa das duas cópias.',
    'medio',
    'Se o comportamento das duas cópias já divergiu em algum outro detalhe além do fuso horário, unificar pode mudar o texto de uma das notificações sem intenção.',
    'facil', 'pendente',
    now() - interval '4 days', NULL, NULL, NULL, NULL),

  -- nao_reverte #2, ainda pendente: apagar dado histórico.
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005',
    'engenheiro-dados',
    'Apagar do log de notificações os registros com mais de 2 anos.',
    'A tabela de log de notificações enviadas não tem política de retenção e já passa de 500 mil linhas, a maior parte sem uso depois de alguns meses.',
    'medio',
    'Apagar linha é irreversível; se alguma investigação futura precisar do histórico completo de notificações antigas, não há como recuperar depois de rodado.',
    'nao_reverte', 'pendente',
    now() - interval '10 days', NULL, NULL, NULL, NULL),

  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000006',
    'dev-frontend',
    'Adicionar busca por nome de artista na lista de vinis.',
    'Hoje só é possível filtrar por ano; com mais de 300 discos catalogados, achar um artista específico exige rolar a lista inteira.',
    'medio',
    'Nenhum risco de dado — é uma funcionalidade nova de leitura sobre um dado que já existe.',
    'facil', 'feita',
    now() - interval '25 days', now() - interval '24 days', NULL, now() - interval '22 days',
    'https://github.com/demo-seed/catalogador-vinis/pull/7');

-- ─────────────────────────────────────────────────────────────────────────
-- contexto — 3 linhas, três projetos diferentes, três agente_destino
-- diferentes. A primeira é a mais longa, para exercitar o teto de 20000
-- caracteres de `conteudo` sem estourá-lo.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO contexto (id, projeto_id, agente_destino, tipo, conteudo, origem, criado_em, atualizado_em) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
    'designer-ui', 'modelo de design',
$$Modelo de design para o Painel do Aquário — grade, cor e tipografia já usadas no resto do painel, adaptadas para as telas de métricas do aquário.

Grade e espaçamento
Base de 8px para toda distância entre elementos: 8, 16, 24, 32, 48, 64. Não usar valores fora dessa escala — os cartões de temperatura adicionados recentemente usam 6px e por isso destoam do resto da tela; ao revisar esse componente, ajustar para 8px ou 16px, o que for mais próximo do espaçamento pretendido.

Cores de estado
O aquário tem três faixas de leitura, e cada uma tem uma cor associada que já é usada em outras telas do painel para o mesmo tipo de sinal:
- Dentro da faixa: verde (#1F9D55), mesmo tom usado no selo "N verdes" da tela de relatórios.
- Atenção: âmbar (#B45309), mesmo tom do status "atencao" de relatório.
- Crítico: vermelho (#B91C1C), mesmo tom do status "falha".
Reaproveitar essas cores em vez de introduzir uma paleta nova para o aquário — o usuário já aprendeu o significado delas em outra tela do mesmo painel.

Tipografia
Fonte do sistema (system-ui), sem fonte customizada carregada por rede. Escala: 12px para rótulo secundário, 14px para corpo, 16px para valor de leitura em destaque dentro de um cartão pequeno, 24px para o valor de leitura em destaque na tela de detalhe. Peso 600 para valor numérico, 400 para rótulo.

Estados de componente
O cartão de leitura tem três estados visuais, correspondentes às cores de estado acima — não inventar um quarto estado visual sem que exista uma quarta faixa de leitura real por trás. O estado de carregamento usa o mesmo cinza neutro (#9CA3AF) já usado no restante do painel para "sem dado ainda", não um estado novo.

Contraste e acessibilidade
Todas as combinações de cor de estado sobre fundo branco já passam WCAG AA para texto normal (contraste mínimo 4.5:1) — confirmado com as três cores acima. Se qualquer variação de tom for proposta, validar o contraste antes de aplicar; não vale assumir que uma cor "parecida" mantém o mesmo contraste.

Ícones
Usar o mesmo conjunto de ícones do restante do painel — não introduzir uma segunda biblioteca de ícones só para as telas do aquário. Ícone de gota d'água para umidade, termômetro para temperatura, e círculo com traço para pH: todos já existem no conjunto atual, não é preciso desenhar nenhum novo.

Responsividade
A tela de detalhe do aquário usa duas colunas acima de 768px e uma coluna abaixo disso, igual ao padrão do resto do painel — não introduzir um terceiro breakpoint só para esta tela. Os cartões de leitura mantêm largura mínima de 240px mesmo na coluna única; abaixo disso, preferir rolagem horizontal a espremer o conteúdo do cartão.

O que não fazer
Não redesenhar a tela inteira do zero. O pedido aqui é alinhamento pontual — o espaçamento dos cartões de temperatura — não uma reforma visual da tela do aquário. Qualquer mudança maior de layout deve virar sugestão separada, com esforço e risco descritos à parte, não empacotada dentro deste ajuste pequeno.$$,
    'painel', now() - interval '40 days', now() - interval '5 days'),

  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004',
    'engenheiro-ia', 'restrições',
$$Restrições para o motor de recomendação do Gerador de Playlists.

A API de metadados de música externa tem cota de 500 requisições por dia no plano atual. Qualquer mudança que aumente a frequência de chamada a essa API precisa considerar a cota antes de propor — cachear resultado de artista e faixa localmente por pelo menos 7 dias em vez de consultar de novo a cada geração de playlist.

O modelo de recomendação é treinado offline, fora deste repositório, e o resultado (os embeddings) é apenas consumido aqui como arquivo estático. Não propor retrain automático nem chamada a serviço de treinamento a partir da rodada noturna — isso é decisão do dono, feita manualmente e fora deste ciclo.

Uma playlist gerada não pode incluir faixa marcada como indisponível na conta do usuário (removida por direito autoral, por exemplo). Se encontrar esse tipo de vazamento no código de filtro, é achado de prioridade alta, não sugestão de baixo esforço.$$,
    'painel', now() - interval '2 days', now() - interval '2 days'),

  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    'dev-backend', 'notas',
$$Notas de convenção do backend do Cofre de Rotinas.

A fila de execução usa a biblioteca de agendamento já escolhida (ver dependência de cron do projeto) — não propor trocar por outra biblioteca de fila só por preferência; se houver problema real de manutenção, registrar como sugestão com o motivo específico, não como troca por gosto.

Erros de execução de rotina seguem uma taxonomia de três categorias: erro de configuração do usuário (não repetir automaticamente), erro transitório (repetir com backoff) e erro de bug interno (não repetir, alertar). Ao propor mudança na lógica de erro, deixar claro em qual categoria a mudança se encaixa.

Log de execução vai para stdout em formato de linha única por evento, sem quebras de linha dentro do campo de mensagem — é o que o coletor de log da hospedagem espera. Qualquer sugestão que mude o formato de log precisa dizer explicitamente que quebra essa expectativa, se for o caso.$$,
    'painel', now() - interval '60 days', now() - interval '60 days');

COMMIT;

-- Resumo do conjunto:
--   projeto:   6 linhas (2 toda_madrugada, 2 dias_alternados, 2 semanal; 1 pausado)
--   relatorio: 10 linhas (6 ok, 2 atencao, 2 falha;
--              testes_passaram com true, false e NULL representados)
--   sugestao:  11 linhas (6 pendente, 2 aprovada, 1 recusada, 2 feita;
--              esforço pequeno/medio/grande e reversibilidade facil/dificil/nao_reverte,
--              todos representados; 2 nao_reverte ainda pendentes)
--   contexto:  3 linhas (designer-ui, engenheiro-ia, dev-backend, em 3 projetos distintos)

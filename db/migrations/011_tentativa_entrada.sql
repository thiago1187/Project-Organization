-- 011_tentativa_entrada.sql
-- Trava de tentativas no /entrar.
--
-- Por que: a senha do painel é memorável, escolhida pelo dono ("vou usar uma
-- senha minha mesmo"), e não havia limite nenhum de tentativas. A primeira
-- camada é o Vercel Authentication na borda, mas ele é configuração fora do
-- repositório — pode ser desligado por engano, ou divergir entre produção e
-- preview, sem que uma linha de código mude. A segunda camada não pode ser
-- "ninguém vai chegar aqui".
--
-- Por que no banco, e não em memória: em função serverless, contador em
-- memória não conta. Cada instância fria começa do zero, e quem tenta força
-- bruta atravessa instâncias sem esforço nenhum. Um limitador que não limita é
-- pior que nenhum, porque produz confiança falsa — alguém lê "tem rate limit"
-- e para de procurar.
--
-- Por que global, e não por IP: este painel tem um usuário só (regra 5). Chave
-- por IP existe para não punir o usuário B pelo ataque contra o usuário A, e
-- aqui não há usuário B. Global é mais simples e, principalmente, não dá para
-- contornar trocando de IP — que é exatamente o que o atacante faria.
--
-- O custo dessa escolha, declarado: quem conseguir chegar no /entrar pode
-- trancar o dono por alguns minutos. É aceitável — o atacante já teria
-- atravessado a borda da Vercel para isso, a janela é curta, e a alternativa
-- (deixar adivinhar sem limite) é pior. A tela diz quanto falta, em vez de
-- só recusar, para o dono distinguir "errei a senha" de "estou trancado".

BEGIN;

CREATE TABLE tentativa_entrada (
  id         bigint      GENERATED ALWAYS AS IDENTITY,
  ocorrida_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tentativa_entrada_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE tentativa_entrada IS
  'Uma linha por tentativa de entrada que FALHOU. Tentativa certa não grava nada, e as linhas '
  'da janela são apagadas quando o dono entra — o histórico não serve para nada depois disso, e '
  'guardar menos é sempre melhor. Deliberadamente sem IP, user agent ou qualquer coisa que '
  'identifique quem tentou: a trava é global (um usuário só, ver a migration), então esse dado '
  'não mudaria decisão nenhuma e só criaria um log de acesso para vazar.';

-- A consulta é sempre "quantas falhas desde X". Índice descendente porque a
-- janela é sempre recente — as linhas velhas nunca são lidas, só apagadas.
CREATE INDEX tentativa_entrada_ocorrida_em_idx ON tentativa_entrada (ocorrida_em DESC);

COMMIT;

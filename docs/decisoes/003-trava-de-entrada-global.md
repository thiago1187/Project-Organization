# 003 — a trava de tentativas no `/entrar` é global, não por IP

## O problema

A senha do painel é memorável, escolhida pelo dono, e não havia limite de
tentativas na tela de entrada. A primeira camada de defesa é o Vercel
Authentication na borda, mas é configuração fora do repositório — pode ser
desligada por engano, ou divergir entre produção e preview, sem que uma linha
de código mude. A segunda camada não pode partir de "ninguém vai chegar
aqui".

## O que foi decidido

Uma trava no banco (migration `011`, tabela `tentativa_entrada`): 8 falhas em
15 minutos bloqueiam novas tentativas. **Global** — a contagem não é por IP,
é uma janela única para o app inteiro. Uma linha por tentativa que falhou;
tentativa certa não grava nada, e as linhas da janela são apagadas quando o
dono entra.

Guardada no banco, não em memória: em função serverless, contador em memória
não conta — cada instância fria começa do zero, e quem tenta força bruta
atravessa instâncias sem esforço nenhum.

## O que foi descartado

**Trava por IP.** É o padrão comum, e existe para não punir o usuário B pelo
ataque contra o usuário A. Este painel tem um usuário só (regra 5 do
`CLAUDE.md`: sem sistema de contas). Não há usuário B para proteger, então a
complexidade de chavear por IP — e de lidar com IP rotativo atrás da Vercel —
não compra nada. Global é mais simples e, o que importa mais, não dá para
contornar trocando de IP, que é exatamente o que um atacante faria contra uma
trava por IP.

**Não guardar nada sobre a tentativa** (nem IP, nem user agent). Deliberado:
a trava é global, então esse dado não mudaria decisão nenhuma — só criaria um
log de acesso com potencial de vazar informação sem função. Guardar menos é
sempre melhor quando guardar mais não muda o comportamento.

## O custo declarado

Quem conseguir chegar ao `/entrar` pode trancar o dono por alguns minutos —
um ataque de negação de serviço contra o próprio dono, barato de fazer. Isso
foi julgado aceitável: o atacante já teria atravessado a borda da Vercel para
chegar até ali, a janela é curta (15 minutos), e a alternativa — deixar
adivinhar sem limite — é pior. A tela mostra quanto tempo falta para liberar,
em vez de só recusar, para o dono distinguir "errei a senha" de "estou
trancado".

Ver `db/migrations/011_tentativa_entrada.sql` para o raciocínio completo e
`src/dominio/travaEntrada.ts` / `src/servidor/tentativasEntrada.ts` para a
implementação.

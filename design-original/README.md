# Design original

Export do Claude Design que deu origem a este painel. **Não é código de produção** —
fica aqui como referência visual durante a conversão para Next.js.

`acompanhamento-noturno-v2.dc.html` contém as três telas (visão geral, detalhe do
projeto, configuração), o tema claro/escuro e os dados mockados, tudo num arquivo só.
O bloco `<script type="text/x-dc" data-dc-script>` no fim do arquivo guarda o estado e
os mocks (`DADOS`, `TEMAS`, `PAPEIS`, `FAIXAS`).

`support.js` é o runtime pré-compilado que interpreta o template. Não editar.

> Os valores em `acessos` dentro dos mocks são strings fabricadas para a demonstração,
> não credenciais reais.

Ao migrar, o CSS, a tipografia e o espaçamento daqui devem ser preservados — o visual
já foi aprovado, a mudança é estrutural.

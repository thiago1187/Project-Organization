-- 006_tripwire_provedores_do_dono.sql
-- Estende `parece_credencial` (criada na 002) com as famílias de token que
-- este projeto de fato usa.
--
-- Por que: a revisão de segurança de 2026-07-30 rodou o padrão original contra
-- os valores fabricados do próprio export e contra os provedores que o dono
-- administra. Dos 12, ele pegava 5. `postgres://` e `AKIA` disparavam; o token
-- da Vercel, a chave do Google e a chave da Mapbox passavam direto.
--
-- O alarme estava calibrado para credenciais de terceiros e cego justamente
-- para as que este inventário contém. O comentário da 002 descreve o cenário
-- como "colar de reflexo uma chave inteira num campo de rótulo, às 2h da
-- manhã" — e a chave mais provável de ser colada aqui era das que passavam.
--
-- Duas notas que continuam valendo:
--
-- 1. Isto continua sendo tripwire, não muralha. Não pega senha comum, token
--    sem prefixo reconhecível, nem segredo descrito em prosa. A proteção de
--    fato é a ausência estrutural de coluna para valor de credencial.
-- 2. A lista para aqui de propósito. Perseguir prefixo de provedor é esteira
--    infinita; o alvo é o que este inventário de fato contém, não o universo.
--
-- Precisa ficar idêntica a src/dominio/pareceCredencial.ts. As duas são a mesma
-- regra em lugares diferentes: a de lá recusa com mensagem legível antes de
-- gravar, esta é a segunda linha para o que não passar pela aplicação.
--
-- Só substitui a função. Nenhuma tabela, coluna ou constraint muda — os CHECKs
-- da 002 chamam `parece_credencial` por nome e passam a usar a versão nova
-- automaticamente. Linhas já gravadas não são revalidadas: o CHECK só roda em
-- INSERT e UPDATE. Se algo com formato novo já estiver no banco, ele continua
-- lá até ser editado.

BEGIN;

CREATE OR REPLACE FUNCTION parece_credencial(valor text) RETURNS boolean AS $$
  SELECT valor ~* (
    '[a-z][a-z0-9+.-]*://[^/\s@]+:[^/\s@]+@' ||  -- scheme://usuario:senha@ (qualquer protocolo)
    '|sk[-.][a-z0-9_-]{10,}' ||                   -- OpenAI/Anthropic/Stripe, e Mapbox (usa ponto)
    '|akia[0-9a-z]{12,}' ||                       -- AWS access key id
    '|gh[pousr]_[a-z0-9]{20,}' ||                 -- token do GitHub (pessoal/oauth/app/instalação)
    '|xox[baprs]-[a-z0-9-]{6,}' ||                -- token do Slack
    '|eyj[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}' ||     -- JWT (cabeçalho.payload em base64url)
    '|vercel_[a-z0-9]{16,}' ||                    -- token da Vercel
    '|npm_[a-z0-9]{20,}' ||                       -- token do npm
    '|aiza[a-z0-9_-]{20,}' ||                     -- chave de API do Google
    '|glpat-[a-z0-9_-]{16,}' ||                   -- token do GitLab
    '|dop_v1_[a-z0-9]{32,}' ||                    -- token da DigitalOcean
    '|re_[a-z0-9]{8,}_[a-z0-9]{10,}' ||           -- chave do Resend
    '|fly_[a-z0-9]{10,}'                          -- token do Fly.io
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION parece_credencial(text) IS
  'Tripwire anti-credencial para os CHECKs de stack e servico. Reconhece formatos literais '
  'comuns e as famílias de token que este projeto usa (Vercel, Google, GitLab, DigitalOcean, '
  'Resend, Fly, npm, Mapbox) — estas últimas acrescentadas na 006, depois de a revisão '
  'apontar que o padrão original era cego justamente para os provedores do dono. '
  'Não é proteção real: não pega senha comum, token sem prefixo reconhecível nem segredo '
  'descrito em prosa. Barra o acidente mais óbvio; não substitui a ausência estrutural de '
  'coluna para valor de credencial, que é a proteção de fato. '
  'Manter idêntica a src/dominio/pareceCredencial.ts.';

COMMIT;

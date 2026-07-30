-- 006_tripwire_provedores_do_dono.down.sql
-- Volta `parece_credencial` à versão da 002.
--
-- Reverter aqui deixa o alarme mais fraco, não mais forte: os CHECKs de stack
-- e servico passam a aceitar token da Vercel, chave do Google, GitLab,
-- DigitalOcean, Resend, Fly, npm e Mapbox em campo de rótulo. Nenhuma linha já
-- gravada é afetada — o CHECK só roda em INSERT e UPDATE.
--
-- Se reverter esta migration, reverta também src/dominio/pareceCredencial.ts,
-- ou as duas camadas passam a discordar: a aplicação recusaria com mensagem
-- legível algo que o banco aceitaria, e ninguém entenderia por quê.

BEGIN;

CREATE OR REPLACE FUNCTION parece_credencial(valor text) RETURNS boolean AS $$
  SELECT valor ~* (
    '[a-z][a-z0-9+.-]*://[^/\s@]+:[^/\s@]+@' ||  -- scheme://usuario:senha@ (qualquer protocolo)
    '|sk-[a-z0-9_-]{10,}' ||                      -- chave estilo OpenAI/Anthropic/Stripe
    '|akia[0-9a-z]{12,}' ||                       -- AWS access key id
    '|gh[pousr]_[a-z0-9]{20,}' ||                 -- token do GitHub (pessoal/oauth/app/instalação)
    '|xox[baprs]-[a-z0-9-]{6,}' ||                -- token do Slack
    '|eyj[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}'        -- JWT (cabeçalho.payload em base64url)
  );
$$ LANGUAGE sql IMMUTABLE;

COMMIT;

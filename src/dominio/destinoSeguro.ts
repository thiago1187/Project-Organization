/**
 * Normaliza o `proximo` de /entrar para um caminho garantidamente interno.
 *
 * Existe para impedir redirecionamento aberto: `proximo` vem da URL e do
 * formulário, e um valor externo faria o painel mandar o dono para fora logo
 * depois de ele digitar o segredo — que é o momento exato em que ele confia na
 * tela e não olharia a barra de endereço.
 *
 * A versão anterior comparava prefixo à mão: aceitava se começasse com "/" e
 * recusasse "//". A rodada noturna de 2026-07-30 achou o furo: `/\evil.com`
 * passa nessa checagem, e o navegador normaliza a barra invertida para barra
 * comum — o destino vira host externo. Havia ainda uma segunda cópia da mesma
 * lógica em outro arquivo, o que dobrava a chance de errar.
 *
 * Agora não se tenta reconhecer truque de string. Resolve-se contra uma base
 * conhecida e confere-se que o resultado não saiu dela. Quem decide o que é
 * host é o parser de URL, que é quem o navegador também vai usar.
 */

const DESTINO_PADRAO = "/";

// Base fictícia: só serve de referência para a resolução. Nada é buscado dela.
const BASE_INTERNA = "https://painel.interno.invalido";

export function destinoSeguro(proximo: unknown): string {
  if (typeof proximo !== "string" || proximo.length === 0) return DESTINO_PADRAO;

  // Caminho tem que ser relativo à raiz. Isso corta URL absoluta com esquema
  // ("https://…", "javascript:…") antes mesmo de resolver.
  if (!proximo.startsWith("/")) return DESTINO_PADRAO;

  let resolvida: URL;
  try {
    resolvida = new URL(proximo, BASE_INTERNA);
  } catch {
    return DESTINO_PADRAO;
  }

  // Se a resolução saiu da base, o valor apontava para fora — não importa por
  // qual truque. É esta linha que pega `//evil.com` e `/\evil.com` de uma vez.
  if (resolvida.origin !== BASE_INTERNA) return DESTINO_PADRAO;

  return resolvida.pathname + resolvida.search + resolvida.hash;
}

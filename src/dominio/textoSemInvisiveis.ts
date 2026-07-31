// Remove caractere Unicode invisivel de um texto de prosa vindo de fora, sem
// apagar quebra de linha normal (\n) nem tabulacao.
//
// Extraido do endurecimento de src/dominio/repositorioGithub.ts (commit
// "fix(seguranca): a sanitizacao do GitHub estava calibrada para o
// acidente") - o mesmo vetor vale para qualquer campo de prosa que (a) e
// lido depois por um agente que age, ou (b) e revisado pelo dono numa caixa
// de texto antes de salvar. Categoria Unicode Cf (format) cobre
// zero-width-space/BOM (largura zero), o override bidirecional, e o bloco de
// "tag characters" que codifica ASCII inteiro sem renderizar em lugar
// nenhum - e esse ultimo que derruba "o dono revisa antes de salvar": o
// campo mostra um texto curto e inocuo, carrega um paragrafo de instrucao
// invisivel junto, o dono nao ve nada de errado e salva.
//
// Os separadores de linha/paragrafo Unicode (fora de \n) tambem entram no
// filtro. Montados a partir do code point (Number.fromCharCode), nunca
// digitados como caractere literal neste arquivo, porque alguns deles sao
// line terminator para o parser do JavaScript mesmo dentro de comentario.
const CODIGOS_QUEBRA_INVISIVEL = [0x2028, 0x2029, 0x0085];
const CLASSE_QUEBRA_INVISIVEL = CODIGOS_QUEBRA_INVISIVEL.map((codigo) => String.fromCharCode(codigo)).join("");

const INVISIVEIS = new RegExp(`[\\p{Cf}${CLASSE_QUEBRA_INVISIVEL}]`, "gu");

// Normaliza para NFC antes de filtrar: sem isso, duas sequencias que exibem
// igual comparam diferente, e o filtro seria contornavel por decomposicao.
export function semInvisiveis(valor: string): string {
  return valor.normalize("NFC").replace(INVISIVEIS, "");
}

// Validação de entrada do formulário de projeto — roda sempre no servidor,
// dentro das server actions (ver CLAUDE.md: "Valide entrada de formulário no
// servidor, não só no cliente"). Sem import de banco: é lógica pura, testável
// sem conexão, e é a mesma barra usada por cadastrar e por editar.

import type { Frequencia } from "./tipos";

const FREQUENCIAS_VALIDAS: readonly Frequencia[] = ["toda_madrugada", "dias_alternados", "semanal"];

// "dono/repositorio", sem espaço e com exatamente uma barra — o formato que
// a rodada noturna espera para clonar (ver docs/routine-noturna.md, passo
// 2.1: "Clone o repositório indicado no campo repositorio ('dono/nome' no
// GitHub)"). Não é o validador oficial de nomes do GitHub — só barra o que
// quebraria esse clone.
const FORMATO_REPOSITORIO = /^[\w.-]+\/[\w.-]+$/;

const NOME_TAMANHO_MAXIMO = 200;

// GitHub limita dono a 39 e repositório a 100 caracteres. 140 cobre o máximo
// real com folga. Sem teto, `[\w.-]+` casa com qualquer comprimento — dava
// para gravar um blob de megabytes num campo que é lido em toda renderização
// da visão geral e enviado à routine em GET /api/projects.
const REPOSITORIO_TAMANHO_MAXIMO = 140;

// `..` casa com `[\w.-]+`, então "../algo" e "x/.." passavam pelo formato. O
// valor não é interpolado em comando nem em query aqui, mas atravessa a API
// até o ambiente que roda `git clone` e monta caminho de diretório — e esse
// ambiente carrega o segredo de bypass e credencial de repositório. Campo que
// vira caminho em outro sistema deve chegar lá já incapaz de virar travessia.
function temSegmentoDeTravessia(repositorio: string): boolean {
  return repositorio.split("/").some((parte) => parte === "." || parte === "..");
}

export interface DadosProjetoValidados {
  nome: string;
  /** `null` quando o projeto vive num connector e não tem repositório. */
  repositorio: string | null;
}

export interface DadosProjetoComFrequenciaValidados extends DadosProjetoValidados {
  frequencia: Frequencia;
}

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function normalizarTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Valida nome + repositório — o que a edição de um projeto já existente pode mudar. */
export function validarDadosProjeto(input: {
  nome: FormDataEntryValue | null;
  repositorio: FormDataEntryValue | null;
}): ResultadoValidacao<DadosProjetoValidados> {
  const nome = normalizarTexto(input.nome);
  const repositorio = normalizarTexto(input.repositorio);

  if (!nome) return { ok: false, erro: "Dê um nome ao projeto." };
  if (nome.length > NOME_TAMANHO_MAXIMO) {
    return { ok: false, erro: `Nome muito longo — no máximo ${NOME_TAMANHO_MAXIMO} caracteres.` };
  }
  // Repositório vazio é válido: o projeto vive num connector (n8n, Notion,
  // Supabase) e não tem código em lugar nenhum. A rodada trata esse caso — ver
  // "Connectors: leia à vontade, nunca escreva" em docs/routine-noturna.md.
  //
  // Vazio vira null, nunca string vazia. Duas formas de dizer "não tem" é como
  // o dado fica ambíguo, e quem consulta passa a ter que testar as duas.
  if (!repositorio) return { ok: true, dados: { nome, repositorio: null } };
  if (repositorio.length > REPOSITORIO_TAMANHO_MAXIMO) {
    return {
      ok: false,
      erro: `Repositório muito longo — no máximo ${REPOSITORIO_TAMANHO_MAXIMO} caracteres.`,
    };
  }
  if (!FORMATO_REPOSITORIO.test(repositorio)) {
    return { ok: false, erro: 'Repositório precisa estar no formato "dono/repositorio", sem espaços.' };
  }
  if (temSegmentoDeTravessia(repositorio)) {
    return { ok: false, erro: 'Repositório não pode conter "." ou ".." como dono ou nome.' };
  }

  return { ok: true, dados: { nome, repositorio } };
}

/** Valida nome + repositório + frequência — o que cadastrar um projeto novo exige. */
export function validarDadosProjetoComFrequencia(input: {
  nome: FormDataEntryValue | null;
  repositorio: FormDataEntryValue | null;
  frequencia: FormDataEntryValue | null;
}): ResultadoValidacao<DadosProjetoComFrequenciaValidados> {
  const base = validarDadosProjeto(input);
  if (!base.ok) return base;

  const frequencia = normalizarTexto(input.frequencia);
  if (!FREQUENCIAS_VALIDAS.includes(frequencia as Frequencia)) {
    return { ok: false, erro: "Escolha uma cadência válida." };
  }

  return { ok: true, dados: { ...base.dados, frequencia: frequencia as Frequencia } };
}

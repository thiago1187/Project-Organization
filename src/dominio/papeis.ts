// Papéis de agente: mono (crachá de duas letras), rótulo do papel e se o agente
// escreve ou só lê. Fora do schema de propósito — relatorio.achados_por_agente.agente
// é texto livre (ver comentário da coluna na migration, linha 63-67): "não há lista
// fechada aqui para não travar quando um agente novo aparecer". PAPEIS é só a tabela
// de apresentação para os agentes conhecidos hoje; um agente desconhecido cai no
// retorno padrão de papelDoAgente.

export type TipoAgente = "leitura" | "escrita";

export interface Papel {
  mono: string;
  papel: string;
  tipo: TipoAgente;
}

export const PAPEIS: Record<string, Papel> = {
  "arquiteto-chefe": { mono: "AC", papel: "estrutura e prioridades", tipo: "leitura" },
  "dev-backend": { mono: "BE", papel: "backend", tipo: "escrita" },
  "dev-frontend": { mono: "FE", papel: "interface", tipo: "escrita" },
  "engenheiro-banco": { mono: "DB", papel: "banco e migrações", tipo: "escrita" },
  "revisor-seguranca": { mono: "SE", papel: "segurança", tipo: "leitura" },
  "revisor-codigo": { mono: "RC", papel: "revisão de código", tipo: "leitura" },
  "qa-testes": { mono: "QA", papel: "testes", tipo: "leitura" },
  "devops-deploy": { mono: "DO", papel: "deploy", tipo: "escrita" },
};

const PAPEL_PADRAO: Papel = { mono: "??", papel: "agente", tipo: "leitura" };

export function papelDoAgente(nome: string): Papel {
  return PAPEIS[nome] || PAPEL_PADRAO;
}

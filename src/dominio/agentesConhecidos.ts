// Lista de conveniência para o editor de contexto: os agentes que existem hoje
// em ~/.claude/agents/ na máquina do dono. Este app NUNCA lê aquele diretório
// em runtime — é um caminho local à máquina, fora do banco e fora do deploy.
// Esta lista só serve para oferecer um <select> em vez de um campo de texto
// vazio; ela é pura conveniência de UI e não trava nada no schema.
//
// `contexto.agente_destino` é texto livre no banco de propósito (ver o
// comentário da coluna em db/migrations/001_schema_inicial.sql): quando um
// agente novo aparecer, o formulário continua funcionando via a opção "outro"
// — só esta lista fica desatualizada até alguém lembrar de somar uma linha.
export const AGENTES_CONHECIDOS: readonly string[] = [
  "analista-requisitos",
  "arquiteto-chefe",
  "avaliador-ia",
  "designer-ui",
  "dev-backend",
  "dev-frontend",
  "devops-deploy",
  "engenheiro-dados",
  "engenheiro-ia",
  "escriba-docs",
  "investigador-bugs",
  "qa-testes",
  "refatorador",
  "revisor-codigo",
  "revisor-performance",
  "revisor-seguranca",
];

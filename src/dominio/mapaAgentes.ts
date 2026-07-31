// Mapa dos agentes — a peça de vitrine da tela de detalhe do projeto (pedido
// explícito do dono: "algo que desperte algo top e novo", ver o prompt do
// designer-produto). Deriva, para os agentes ativos da esteira do projeto
// (`AgenteEsteiraVM[]`, na ordem em que rodam), o estado da rodada mais
// recente.
//
// A fonte é só `relatorio.achados_por_agente` do relatório mais recente,
// cruzada com a esteira — exatamente como pedido, nada além disso. Um agente
// presente em `achados_por_agente` "rodou"; um ausente "não rodou" —
// binário, e é o único binário honesto que os dados sustentam.
//
// Deliberadamente NÃO existe um terceiro estado "achou algo" vs "achou nada"
// decidido por heurística de texto sobre `achado`/`selo`. `selo` já é a
// palavra do próprio agente ("sem achados", "1 sugestão", "2 vermelhos",
// "86 verdes"...) — tentar classificar isso em "achou"/"não achou" por
// conteúdo arriscaria rotular um achado real (ex.: "bug crítico") como
// "nada" só porque o texto não bate um padrão esperado, e o mapa não pode
// mentir sobre isso. O cartão mostra o `selo` e o `achado` tais como o
// agente escreveu; quem decide o que aquilo significa é o dono.
import type { AgenteEsteiraVM } from "./esteiraAgentes";
import type { Relatorio } from "./tipos";
import { formatarHora } from "./visao";

export type EstadoAgenteMapa = "rodou" | "nao_rodou";

export interface AgenteMapaVM extends AgenteEsteiraVM {
  estado: EstadoAgenteMapa;
  /** Só presente quando estado === "rodou" — exatamente como o agente escreveu. */
  achado: string | null;
  /** Só presente quando estado === "rodou". */
  selo: string | null;
}

export interface MapaAgentesVM {
  /** Na ordem da esteira (a ordem em que os agentes rodam). */
  itens: AgenteMapaVM[];
  /** Hora da rodada mais recente, ou null se o projeto nunca rodou. */
  horaLabel: string | null;
  /** false quando o projeto nunca teve uma rodada — todo item aparece "não rodou" pelo mesmo motivo. */
  temRelatorio: boolean;
}

/**
 * `ativos` já vem na ordem de execução (ver `montarEsteira`/`agentesAtivosOrdenados`
 * em esteiraAgentes.ts); `ultimoRelatorio` é o mais recente do projeto, ou
 * `null` quando nunca rodou.
 */
export function montarMapaAgentes(
  ativos: AgenteEsteiraVM[],
  ultimoRelatorio: Relatorio | null,
): MapaAgentesVM {
  const achadosPorAgente = new Map(
    (ultimoRelatorio?.achados_por_agente ?? []).map((a) => [a.agente, a] as const),
  );

  const itens: AgenteMapaVM[] = ativos.map((agente) => {
    const achado = achadosPorAgente.get(agente.agente);
    return {
      ...agente,
      estado: achado ? "rodou" : "nao_rodou",
      achado: achado?.achado ?? null,
      selo: achado?.selo ?? null,
    };
  });

  return {
    itens,
    horaLabel: ultimoRelatorio ? formatarHora(ultimoRelatorio.executado_em) : null,
    temRelatorio: !!ultimoRelatorio,
  };
}

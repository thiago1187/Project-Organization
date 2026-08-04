import { notFound } from "next/navigation";
import Link from "next/link";
import { detalheProjeto, filaSugestoes, ondeEstamos, rodadaDetalhe } from "@/dominio/visao";
import { listarProjetos, obterProjetoPorId } from "@/servidor/projetos";
import { listarRelatoriosDoProjeto } from "@/servidor/relatorios";
import { listarSugestoesDoProjeto } from "@/servidor/sugestoes";
import { listarContextosDoProjeto } from "@/servidor/contextos";
import { listarAgentesDoProjeto } from "@/servidor/agentesProjeto";
import { listarTarefasDoProjeto } from "@/servidor/tarefas";
import { listarServicoDoProjeto, listarStackDoProjeto } from "@/servidor/inventario";
import { montarEsteira } from "@/dominio/esteiraAgentes";
import { tarefasEmAberto } from "@/dominio/tarefas";
import { listarAgentesPadrao } from "@/servidor/agentesPadrao";
import { montarMapaAgentes } from "@/dominio/mapaAgentes";
import { sugerirAgentes } from "@/dominio/sugestorAgentes";
import DescricaoProjeto from "@/componentes/DescricaoProjeto";
import OndeEstamos from "@/componentes/OndeEstamos";
import FilaSugestoes from "@/componentes/FilaSugestoes";
import MapaAgentes from "@/componentes/MapaAgentes";
import EsteiraAgentes from "@/componentes/EsteiraAgentes";
import EditorContexto from "@/componentes/EditorContexto";
import HistoricoRodadas from "@/componentes/HistoricoRodadas";
import ListaDocumentos from "@/componentes/ListaDocumentos";
import InventarioProjeto from "@/componentes/InventarioProjeto";
import AbrirDocumentoAndamento from "@/componentes/AbrirDocumentoAndamento";
import FaixaResumo from "@/componentes/FaixaResumo";
import AtalhosProjeto from "@/componentes/AtalhosProjeto";

export const dynamic = "force-dynamic";

export default async function DetalheProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const projeto = await obterProjetoPorId(id);
  if (!projeto) notFound();

  const [
    relatorios,
    sugestoes,
    contextos,
    agentesProjeto,
    stack,
    servico,
    tarefas,
    todosProjetos,
    agentesPadrao,
  ] = await Promise.all([
    // 30 noites de histórico. A tira de rodadas não mostra mais que isso, e
    // quem quiser o período inteiro tem o documento de andamento.
    listarRelatoriosDoProjeto(id, 30),
    listarSugestoesDoProjeto(id),
    listarContextosDoProjeto(id),
    listarAgentesDoProjeto(id),
    listarStackDoProjeto(id),
    listarServicoDoProjeto(id),
    listarTarefasDoProjeto(id),
    listarProjetos(),
    listarAgentesPadrao(),
  ]);

  const atual = detalheProjeto(id, [projeto], relatorios, sugestoes, contextos);
  if (!atual) notFound();

  const fila = filaSugestoes(id, sugestoes);
  const agora = ondeEstamos(tarefas, fila.aprovadas);
  // Os padrões entram aqui só para a esteira poder dizer "valendo agora: o
  // padrão do agente" quando o campo do projeto está vazio. Sem isso o dono
  // configura o padrão na tela do agente, volta aqui, vê campo em branco e
  // conclui que não pegou.
  const esteira = montarEsteira(agentesProjeto, agentesPadrao);
  const mapaAgentes = montarMapaAgentes(esteira.ativos, relatorios[0] ?? null);
  const sugeridos = sugerirAgentes({ agentesProjeto, stack, servico, relatorios, sugestoes });

  const rodadasDetalhe = atual.rodadas
    .map((r) => rodadaDetalhe(id, relatorios, r.idx))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Vizinhos na mesma ordem da visão geral (criado_em ASC) — alimentam os
  // atalhos "[" / "]" e os links visíveis ao lado de "todos os projetos"
  // (AtalhosProjeto.tsx). Sem tabela nova: é a mesma listarProjetos() que a
  // home já usa.
  const indiceAtual = todosProjetos.findIndex((p) => p.id === id);
  const anterior = indiceAtual > 0 ? todosProjetos[indiceAtual - 1] : null;
  const proximo =
    indiceAtual >= 0 && indiceAtual < todosProjetos.length - 1 ? todosProjetos[indiceAtual + 1] : null;
  const ultimaRodadaOk = atual.rodadas[0]?.ok ?? null;

  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <Link
          href="/"
          className="h-txt"
          style={{
            display: "inline-block",
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-medium)",
            color: "var(--mut3)",
            cursor: "pointer",
          }}
        >
          ← todos os projetos
        </Link>
        <AtalhosProjeto
          anterior={anterior ? { id: anterior.id, nome: anterior.nome } : null}
          proximo={proximo ? { id: proximo.id, nome: proximo.nome } : null}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 20,
          paddingBottom: 22,
          borderBottom: "1px solid var(--linha)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: atual.cor, flex: "none" }} />
            <div style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-xs)", color: atual.cor }}>
              {atual.statusLabel}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
              {atual.repo}
            </div>
            <div
              style={{
                fontSize: "var(--fs-2xs)",
                fontWeight: "var(--fw-medium)",
                color: "var(--mut3)",
                border: "1px solid var(--borda)",
                borderRadius: 3,
                padding: "2px 7px",
              }}
            >
              {atual.cadenciaLabelLongo}
            </div>
          </div>
          <div
            style={{
              fontWeight: "var(--fw-bold)",
              fontSize: "var(--fs-5xl)",
              lineHeight: "var(--lh-tight)",
              letterSpacing: "var(--ls-tight)",
              marginTop: 8,
              color: "var(--txt)",
            }}
          >
            {atual.nome}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {atual.temPr && atual.prUrl && (
          <a
            href={atual.prUrl}
            target="_blank"
            rel="noreferrer"
            className="h-fundo"
            style={{
              border: "1px solid var(--atn)",
              borderRadius: "var(--btn-radius)",
              padding: "var(--btn-pad-y-secundaria) var(--btn-pad-x-secundaria)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--atn)",
              whiteSpace: "nowrap",
            }}
          >
            Revisar PR no GitHub ↗
          </a>
        )}
      </div>

      <FaixaResumo tira={atual.tira} pendentesCount={fila.pendentes.length} ultimaRodadaOk={ultimaRodadaOk} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 36,
          marginTop: 26,
          alignItems: "start",
        }}
      >
        {/* Ordem por urgência (docs/visao.md, "as quatro coisas que o painel
            precisa responder"): a fila — o que precisa de decisão agora —
            vem antes de "onde estamos" e do histórico. Configuração da
            esteira e contexto do projeto, que mudam com pouca frequência,
            ficam por último e dobradas (ver EsteiraAgentes/EditorContexto). */}
        <div style={{ minWidth: 0 }}>
          <DescricaoProjeto projetoId={atual.id} descricaoAtual={atual.descricao} />
          <div id="fila-sugestoes">
            <FilaSugestoes
              projetoId={atual.id}
              projetoNome={atual.nome}
              repositorio={atual.repo}
              fila={fila}
              contextos={contextos}
              ultimoRelatorio={relatorios[0] ?? null}
              descricao={atual.descricao}
              tarefasEmAberto={tarefasEmAberto(tarefas)}
            />
          </div>
          <OndeEstamos projetoId={atual.id} ondeEstamos={agora} />
          <div id="historico-rodadas" style={{ marginBottom: 30 }}>
            <HistoricoRodadas resumo={atual.rodadas} detalhe={rodadasDetalhe} />
          </div>
          <MapaAgentes mapa={mapaAgentes} nomeProjeto={atual.nome} />
          <EsteiraAgentes
            projetoId={atual.id}
            ativos={esteira.ativos}
            inativos={esteira.inativos}
            pendentesCount={fila.pendentes.length}
            aprovadas={fila.aprovadas}
            sugeridos={sugeridos}
          />
          <EditorContexto projetoId={atual.id} itens={contextos} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <ListaDocumentos docs={atual.docs} />
          <AbrirDocumentoAndamento projetoId={atual.id} />
          <InventarioProjeto projetoId={atual.id} stack={stack} servico={servico} />
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { detalheProjeto, filaSugestoes, ondeEstamos, rodadaDetalhe } from "@/dominio/visao";
import { obterProjetoPorId } from "@/servidor/projetos";
import { listarRelatoriosDoProjeto } from "@/servidor/relatorios";
import { listarSugestoesDoProjeto } from "@/servidor/sugestoes";
import { listarContextosDoProjeto } from "@/servidor/contextos";
import { listarAgentesDoProjeto } from "@/servidor/agentesProjeto";
import { listarTarefasDoProjeto } from "@/servidor/tarefas";
import { listarServicoDoProjeto, listarStackDoProjeto } from "@/servidor/inventario";
import { montarEsteira } from "@/dominio/esteiraAgentes";
import { sugerirAgentes } from "@/dominio/sugestorAgentes";
import TiraEstado from "@/componentes/TiraEstado";
import DescricaoProjeto from "@/componentes/DescricaoProjeto";
import OndeEstamos from "@/componentes/OndeEstamos";
import FilaSugestoes from "@/componentes/FilaSugestoes";
import EsteiraAgentes from "@/componentes/EsteiraAgentes";
import EditorContexto from "@/componentes/EditorContexto";
import HistoricoRodadas from "@/componentes/HistoricoRodadas";
import ListaDocumentos from "@/componentes/ListaDocumentos";
import InventarioProjeto from "@/componentes/InventarioProjeto";

export const dynamic = "force-dynamic";

export default async function DetalheProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const projeto = await obterProjetoPorId(id);
  if (!projeto) notFound();

  const [relatorios, sugestoes, contextos, agentesProjeto, stack, servico, tarefas] = await Promise.all([
    listarRelatoriosDoProjeto(id),
    listarSugestoesDoProjeto(id),
    listarContextosDoProjeto(id),
    listarAgentesDoProjeto(id),
    listarStackDoProjeto(id),
    listarServicoDoProjeto(id),
    listarTarefasDoProjeto(id),
  ]);

  const atual = detalheProjeto(id, [projeto], relatorios, sugestoes, contextos);
  if (!atual) notFound();

  const fila = filaSugestoes(id, sugestoes);
  const agora = ondeEstamos(tarefas, fila.aprovadas);
  const esteira = montarEsteira(agentesProjeto);
  const sugeridos = sugerirAgentes({ agentesProjeto, stack, servico, relatorios, sugestoes });

  const rodadasDetalhe = atual.rodadas
    .map((r) => rodadaDetalhe(id, relatorios, r.idx))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 1240 }}>
      <Link
        href="/"
        className="h-txt"
        style={{
          display: "inline-block",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--mut3)",
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← todos os projetos
      </Link>

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
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: atual.cor }}>
              {atual.statusLabel}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
              {atual.repo}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
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
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 42,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginTop: 8,
            }}
          >
            {atual.nome}
          </div>
          <TiraEstado tira={atual.tira} />
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
              borderRadius: 5,
              padding: "9px 16px",
              fontSize: 13,
              color: "var(--atn)",
              whiteSpace: "nowrap",
            }}
          >
            Revisar PR no GitHub ↗
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 36,
          marginTop: 26,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <DescricaoProjeto projetoId={atual.id} descricaoAtual={atual.descricao} />
          <OndeEstamos projetoId={atual.id} ondeEstamos={agora} />
          <FilaSugestoes
            projetoId={atual.id}
            projetoNome={atual.nome}
            repositorio={atual.repo}
            fila={fila}
            contextos={contextos}
            ultimoRelatorio={relatorios[0] ?? null}
          />
          <EsteiraAgentes
            projetoId={atual.id}
            ativos={esteira.ativos}
            inativos={esteira.inativos}
            pendentesCount={fila.pendentes.length}
            aprovadas={fila.aprovadas}
            sugeridos={sugeridos}
          />
          <EditorContexto projetoId={atual.id} itens={contextos} />
          <HistoricoRodadas resumo={atual.rodadas} detalhe={rodadasDetalhe} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <ListaDocumentos docs={atual.docs} />
          <InventarioProjeto projetoId={atual.id} stack={stack} servico={servico} />
        </div>
      </div>
    </div>
  );
}

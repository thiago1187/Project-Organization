import { notFound } from "next/navigation";
import Link from "next/link";
import { obterProjetoPorId } from "@/servidor/projetos";
import { listarRelatoriosDoProjeto } from "@/servidor/relatorios";
import { listarSugestoesDoProjeto } from "@/servidor/sugestoes";
import { listarTarefasDoProjeto } from "@/servidor/tarefas";
import {
  calcularDesde,
  formatarDataHora,
  gerarDocumentoAndamento,
  PERIODO_LABEL,
  type PeriodoChave,
} from "@/dominio/documentoAndamento";
import DocumentoMarkdown from "@/componentes/DocumentoMarkdown";
import BotaoImprimir from "@/componentes/BotaoImprimir";

// Página de impressão do documento de andamento — item 4 de
// docs/proximos-passos.md. Server component só de leitura: monta o Markdown
// no servidor (`gerarDocumentoAndamento`, puro) e renderiza como HTML
// (`DocumentoMarkdown`). A exportação em PDF é a impressão do navegador
// sobre esta página (Ctrl+P / botão "imprimir"), com CSS de impressão
// dedicado em globals.css — sem biblioteca nova, sem binário, sem
// dependência nativa (o alvo é serverless na Vercel).
//
// Query string: `voz` ("andamento" | "tecnica"), `periodo` (PeriodoChave) e,
// só quando `periodo=desde_ultima`, `desde` (ISO — lido do localStorage do
// navegador pelo componente que abriu esta página, ver
// AbrirDocumentoAndamento.tsx). Não é rota consumida por automação (a
// routine nunca lê isto), então mudar o formato da query não quebra
// contrato externo.

export const dynamic = "force-dynamic";

const PERIODOS_VALIDOS: readonly PeriodoChave[] = ["7dias", "30dias", "desde_ultima", "tudo"];

function periodoValido(v: string | undefined): PeriodoChave {
  return (PERIODOS_VALIDOS as readonly string[]).includes(v ?? "") ? (v as PeriodoChave) : "7dias";
}

function vozValida(v: string | undefined): "andamento" | "tecnica" {
  return v === "tecnica" ? "tecnica" : "andamento";
}

export default async function DocumentoAndamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voz?: string; periodo?: string; desde?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const projeto = await obterProjetoPorId(id);
  if (!projeto) notFound();

  const periodo = periodoValido(sp.periodo);
  const voz = vozValida(sp.voz);

  const [relatorios, sugestoes, tarefas] = await Promise.all([
    listarRelatoriosDoProjeto(id),
    listarSugestoesDoProjeto(id),
    listarTarefasDoProjeto(id),
  ]);

  const agora = new Date();
  const ultimaGeracaoConhecida = periodo === "desde_ultima" && sp.desde ? sp.desde : null;
  const desde = calcularDesde(periodo, agora, ultimaGeracaoConhecida);

  const documento = gerarDocumentoAndamento({
    projetoNome: projeto.nome,
    descricao: projeto.descricao,
    periodo,
    desde,
    geradoEmLabel: formatarDataHora(agora.toISOString()),
    relatorios,
    sugestoes,
    tarefas,
  });

  const texto = voz === "tecnica" ? documento.tecnico : documento.andamento;

  function linkPara(novaVoz: "andamento" | "tecnica") {
    const params = new URLSearchParams({ periodo, voz: novaVoz });
    if (desde) params.set("desde", desde);
    return `?${params.toString()}`;
  }

  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 760, margin: "0 auto" }}>
      <div
        className="no-imprimir"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          paddingBottom: 16,
          marginBottom: 22,
          borderBottom: "1px solid var(--linha)",
        }}
      >
        <Link
          href={`/projeto/${id}`}
          className="h-txt"
          style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}
        >
          ← voltar ao projeto
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--mut3)" }}>
          {PERIODO_LABEL[periodo]}
        </div>
        <Link
          href={linkPara("andamento")}
          className="h-borda"
          style={{
            fontSize: "var(--fs-xs)",
            color: voz === "andamento" ? "var(--txt)" : "var(--mut3)",
            border: "1px solid var(--borda)",
            borderRadius: 4,
            padding: "5px 10px",
          }}
        >
          voz de andamento
        </Link>
        <Link
          href={linkPara("tecnica")}
          className="h-borda"
          style={{
            fontSize: "var(--fs-xs)",
            color: voz === "tecnica" ? "var(--txt)" : "var(--mut3)",
            border: "1px solid var(--borda)",
            borderRadius: 4,
            padding: "5px 10px",
          }}
        >
          voz técnica
        </Link>
        <BotaoImprimir />
      </div>

      <DocumentoMarkdown markdown={texto} />
    </div>
  );
}

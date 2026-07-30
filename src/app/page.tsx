import { cardsProjetos, totaisHome } from "@/dominio/visao";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import QuadroCadencias from "@/componentes/QuadroCadencias";

// Server Component: lê direto do banco a cada requisição — nunca cacheado
// pelo Next (a tela de controle precisa refletir toda ação imediatamente,
// inclusive a de outra aba). Ver src/servidor/db.ts sobre por que isso
// também importa para o driver HTTP da Neon.
export const dynamic = "force-dynamic";

// "Bom dia" fica fixo nesta etapa, junto com o resto do texto de "agora" no
// cabeçalho — ver o comentário em Cabecalho.tsx e o plano §6.
const SAUDACAO = "Bom dia";

export default async function VisaoGeralPage() {
  const [projetos, relatorios] = await Promise.all([listarProjetos(), listarRelatorios()]);
  const cards = cardsProjetos(projetos, relatorios);
  const totais = totaisHome(projetos, relatorios);

  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 26 }}>
        <div>
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 34,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
            }}
          >
            {SAUDACAO}
          </div>
          <div style={{ color: "var(--mut2)", marginTop: 6, fontSize: 13 }}>{totais.resumoNoite}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 28, paddingBottom: 4 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, lineHeight: 1 }}>
              {totais.totalAtivos}
            </div>
            <div style={{ fontSize: 11, color: "var(--mut2)", marginTop: 6 }}>em acompanhamento</div>
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, lineHeight: 1, color: "var(--atn)" }}>
              {totais.totalPrs}
            </div>
            <div style={{ fontSize: 11, color: "var(--mut2)", marginTop: 6 }}>PRs na fila</div>
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, lineHeight: 1, color: "var(--fal)" }}>
              {totais.totalFalhas}
            </div>
            <div style={{ fontSize: 11, color: "var(--mut2)", marginTop: 6 }}>com falha</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--mut3)" }}>
          arraste um card para mudar com que frequência os agentes visitam o projeto
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
      </div>

      <QuadroCadencias cards={cards} />
    </div>
  );
}

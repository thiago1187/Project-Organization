import { cardsProjetos, itensAtencao, totaisHome } from "@/dominio/visao";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import QuadroCadencias from "@/componentes/QuadroCadencias";
import PainelAtencao from "@/componentes/PainelAtencao";
import Saudacao from "@/componentes/Saudacao";

// Server Component: lê direto do banco a cada requisição — nunca cacheado
// pelo Next (a tela de controle precisa refletir toda ação imediatamente,
// inclusive a de outra aba). Ver src/servidor/db.ts sobre por que isso
// também importa para o driver HTTP da Neon.
export const dynamic = "force-dynamic";

export default async function VisaoGeralPage() {
  const [projetos, relatorios] = await Promise.all([listarProjetos(), listarRelatorios()]);
  const cards = cardsProjetos(projetos, relatorios);
  const totais = totaisHome(projetos, relatorios);
  const atencao = itensAtencao(cards);

  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <div>
        <div
          style={{
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-4xl)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--txt)",
          }}
        >
          <Saudacao />
        </div>
        <div style={{ color: "var(--mut2)", marginTop: 6, fontSize: "var(--fs-sm)" }}>{totais.resumoNoite}</div>
      </div>

      {/* O bloco de números (em acompanhamento / PRs na fila / com falha) saiu
          daqui: era estatística estática, sem ação nenhuma associada. No
          lugar, o painel de atenção abaixo é a mesma informação, mas
          acionável — cada projeto que "pede decisão" já é um link para lá,
          e o dígito ao lado abre direto do teclado (ver PainelAtencao.tsx e
          `itensAtencao` em src/dominio/visao.ts). Esta é a resposta à
          tensão entre "agrupar por frequência" e "mostrar urgência": a
          grade abaixo continua organizada por cadência — é como o dono
          arrasta um projeto para mudar a frequência, a interação mais
          "maleável" da tela — mas deixa de ser a única leitura possível,
          porque este painel atravessa as quatro faixas e responde primeiro
          "o que precisa de mim", independente de onde o projeto mora na
          grade. */}
      <PainelAtencao itens={atencao} totalAtivos={totais.totalAtivos} />

      <div style={{ marginTop: 30 }}>
        <QuadroCadencias cards={cards} />
      </div>
    </div>
  );
}

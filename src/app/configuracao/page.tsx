import { linhasConfig } from "@/dominio/visao";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import { listarSugestoes } from "@/servidor/sugestoes";
import { listarContextos } from "@/servidor/contextos";
import { listarTarefas } from "@/servidor/tarefas";
import LinhaConfiguracao from "@/componentes/LinhaConfiguracao";
import FormNovoProjeto from "@/componentes/FormNovoProjeto";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoPage() {
  // As quatro listas inteiras (não só as do projeto) porque `linhasConfig`
  // já recebia `relatorios` assim — mesmo padrão de carga da tela inteira, e
  // é o que dá a `contagemExclusao` (quantas linhas somem se o dono apagar
  // um projeto) sem uma consulta extra por linha.
  const [projetos, relatorios, sugestoes, contextos, tarefas] = await Promise.all([
    listarProjetos(),
    listarRelatorios(),
    listarSugestoes(),
    listarContextos(),
    listarTarefas(),
  ]);
  const linhas = linhasConfig(projetos, relatorios, sugestoes, contextos, tarefas);

  return (
    <div style={{ padding: "32px 36px 72px", maxWidth: 940 }}>
      <div
        style={{
          fontWeight: "var(--fw-bold)",
          fontSize: "var(--fs-4xl)",
          lineHeight: "var(--lh-tight)",
          letterSpacing: "var(--ls-tight)",
          color: "var(--txt)",
        }}
      >
        Configuração
      </div>
      <div
        style={{
          fontSize: "var(--fs-sm)",
          color: "var(--mut2)",
          margin: "8px 0 28px",
          maxWidth: "62ch",
          textWrap: "pretty",
        }}
      >
        A cadência aqui é a mesma do quadro na home — arraste lá ou escolha aqui. Ela decide com que frequência a
        rodada noturna visita o projeto: toda noite, quando a última passa de 40 horas, ou quando passa de 6 dias. O
        que ela faz na visita é sempre o mesmo, a esteira inteira. A rodada diagnostica e propõe; ela não altera
        código. Projeto pausado não recebe visita nenhuma.
      </div>

      <FormNovoProjeto />

      {linhas.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontSize: "var(--fs-xs)",
            color: "var(--mut3)",
          }}
        >
          nenhum projeto cadastrado ainda
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {linhas.map((linha) => (
            <LinhaConfiguracao key={linha.id} linha={linha} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 22, fontSize: "var(--fs-2xs)", color: "var(--mut3)", textWrap: "pretty" }}>
        Fora de escopo: login multiusuário (o acesso é resolvido pelo Vercel Authentication) e disparo de rodada
        pelo app.
      </div>
    </div>
  );
}

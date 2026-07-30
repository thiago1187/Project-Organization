import { linhasConfig } from "@/dominio/visao";
import { listarProjetos } from "@/servidor/projetos";
import { listarRelatorios } from "@/servidor/relatorios";
import LinhaConfiguracao from "@/componentes/LinhaConfiguracao";
import FormNovoProjeto from "@/componentes/FormNovoProjeto";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoPage() {
  const [projetos, relatorios] = await Promise.all([listarProjetos(), listarRelatorios()]);
  const linhas = linhasConfig(projetos, relatorios);

  return (
    <div style={{ padding: "32px 36px 72px", maxWidth: 940 }}>
      <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, letterSpacing: "-0.015em" }}>
        Configuração
      </div>
      <div style={{ fontSize: 13, color: "var(--mut2)", margin: "8px 0 28px", maxWidth: "62ch", textWrap: "pretty" }}>
        A cadência aqui é a mesma do quadro na home — arraste lá ou escolha aqui. Isso controla o que este painel
        espera de cada projeto; a execução acontece na Routine do Claude Code Desktop, fora do app. Projeto pausado
        não recebe visita dos agentes nem atualiza o documento de etapa.
      </div>

      <FormNovoProjeto />

      {linhas.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--borda)",
            borderRadius: 8,
            padding: "18px 12px",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
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

      <div style={{ marginTop: 22, fontSize: 12, color: "var(--mut3)", textWrap: "pretty" }}>
        Fora de escopo: login multiusuário (o acesso é resolvido pelo Vercel Authentication) e disparo de rodada
        pelo app.
      </div>
    </div>
  );
}

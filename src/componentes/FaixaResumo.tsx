import type { TiraEstadoVM } from "@/dominio/visao";
import { classeBotao, estiloBotao } from "./estiloBotao";

// A resposta ao teste de cinco segundos de docs/visao.md ("em cinco segundos
// sabe se algo precisa dele"). Fica logo abaixo do cabeçalho, largura cheia,
// acima de tudo o mais — é a única coisa nesta tela com fundo e borda
// próprios no nível do cabeçalho, de propósito: as demais seções competem
// por atenção em pé de igualdade entre si, esta não compete, ela resume.
//
// Não introduz dado novo: `tira` é o mesmo TiraEstadoVM que já existia (voz
// da máquina, uma linha); `pendentesCount` e `ultimaRodadaOk` já chegam
// prontos de `fila` e `atual.rodadas` em page.tsx. A única decisão nova é
// visual — dar a isso o peso de "uma ação principal por tela": o link para
// decidir a fila é o elemento mais forte da página inteira, de propósito.
export default function FaixaResumo({
  tira,
  pendentesCount,
  ultimaRodadaOk,
}: {
  tira: TiraEstadoVM;
  pendentesCount: number;
  ultimaRodadaOk: boolean | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        marginTop: 22,
        padding: "14px 18px",
        borderRadius: 8,
        border: `1px solid ${pendentesCount > 0 ? "var(--atn)" : "var(--borda)"}`,
        background: "var(--faixa-fundo)",
      }}
    >
      <div style={{ fontSize: "var(--fs-base)", color: "var(--txt2)", flex: 1, minWidth: 220, textWrap: "pretty" }}>
        {tira.texto}
      </div>

      {ultimaRodadaOk === false && (
        <a
          href="#historico-rodadas"
          className={classeBotao("destrutiva")}
          style={{ ...estiloBotao("destrutiva"), whiteSpace: "nowrap" }}
        >
          ⚠ última rodada falhou
        </a>
      )}

      {pendentesCount > 0 ? (
        <a
          href="#fila-sugestoes"
          className={classeBotao("primaria")}
          style={{ ...estiloBotao("primaria"), whiteSpace: "nowrap" }}
        >
          decidir {pendentesCount} {pendentesCount === 1 ? "sugestão" : "sugestões"} →
        </a>
      ) : (
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--mut3)" }}>
          nada esperando decisão
        </span>
      )}
    </div>
  );
}

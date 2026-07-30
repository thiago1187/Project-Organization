import type { TiraEstadoVM } from "@/dominio/visao";

// Voz da máquina, reduzida a uma linha (docs/plano-gerenciador-de-projeto.md
// § 2.1, § 5.2) — o "estado agora" de um plano anterior, que era pensado
// como painel e virou tira: cabe uma linha porque muda toda noite. A voz do
// dono (descrição, tarefas) é que tem o retângulo grande logo abaixo, porque
// muda quando ele decide, não quando a rodada roda.
export default function TiraEstado({ tira }: { tira: TiraEstadoVM }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: tira.cor,
        marginTop: 10,
      }}
    >
      {tira.texto}
    </div>
  );
}

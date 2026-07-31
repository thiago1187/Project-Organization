// Só usado a partir de um `error.tsx` de rota, que o Next.js já exige ser
// "use client" — não precisa da diretiva de novo aqui, o limite de cliente
// já existe acima na árvore.
//
// Deliberadamente não mostra `error.message`: o Next.js pode ou não
// preservar essa string em produção, e a regra de segurança (CLAUDE.md,
// "mensagem de erro para o cliente diz o que dá para corrigir; detalhe
// interno vai para o log") não deveria depender desse comportamento. O
// título é sempre um texto fixo e seguro escolhido por quem chama; o
// detalhe de verdade já foi para o log do servidor antes do erro chegar
// aqui (ver src/servidor/erros.ts). `digest` é só a referência para
// encontrar esse log, não é sensível.
import { classeBotao, estiloBotao } from "./estiloBotao";

export default function ErroCarregamento({
  titulo,
  reset,
  digest,
}: {
  titulo: string;
  reset: () => void;
  digest?: string;
}) {
  return (
    <div
      style={{
        border: "1px dashed var(--fal)",
        borderRadius: 8,
        padding: "18px 16px",
        maxWidth: 560,
      }}
    >
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--txt2)" }}>{titulo}</div>
      <button
        type="button"
        onClick={reset}
        className={classeBotao("secundaria")}
        style={{ ...estiloBotao("secundaria"), marginTop: 12 }}
      >
        tentar novamente
      </button>
      {digest && (
        <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--mut3)" }}>
          referência: {digest}
        </div>
      )}
    </div>
  );
}

import FormEntrar from "@/componentes/FormEntrar";
import { destinoSeguro } from "@/dominio/destinoSeguro";

export const dynamic = "force-dynamic";

// Tela de entrada da sessão do dono (pendência 1 da revisão de segurança).
// O middleware (src/middleware.ts) manda para cá qualquer requisição de
// página sem cookie de sessão válido, com `?proximo=` apontando para onde a
// pessoa tentava ir — `entrarAction` volta para lá depois de confirmar o
// segredo. A validação de verdade (e a sanitização de `proximo` contra um
// valor que não seja um caminho interno) acontece em
// src/servidor/acoes-sessao.ts; aqui só decide o valor padrão do campo
// escondido do formulário.
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;
  const destino = destinoSeguro(proximo);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 65px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 22,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-3xl)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--txt)",
          }}
        >
          Entrar
        </div>
        <div style={{ color: "var(--mut2)", marginTop: 6, fontSize: "var(--fs-sm)" }}>
          Informe o segredo do painel para continuar.
        </div>
      </div>
      <FormEntrar proximo={destino} />
    </div>
  );
}

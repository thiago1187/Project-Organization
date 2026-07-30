"use client";

import ErroCarregamento from "@/componentes/ErroCarregamento";

export default function ErroVisaoGeral({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <ErroCarregamento titulo="Não foi possível carregar os projetos agora." reset={reset} digest={error.digest} />
    </div>
  );
}

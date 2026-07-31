"use client";

import ErroCarregamento from "@/componentes/ErroCarregamento";

export default function ErroFichaAgente({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 900 }}>
      <ErroCarregamento titulo="Não foi possível carregar este agente agora." reset={reset} digest={error.digest} />
    </div>
  );
}

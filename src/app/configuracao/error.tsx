"use client";

import ErroCarregamento from "@/componentes/ErroCarregamento";

export default function ErroConfiguracao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "32px 36px 72px", maxWidth: 940 }}>
      <ErroCarregamento titulo="Não foi possível carregar a configuração agora." reset={reset} digest={error.digest} />
    </div>
  );
}

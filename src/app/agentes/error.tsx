"use client";

import ErroCarregamento from "@/componentes/ErroCarregamento";

export default function ErroAgentes({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <ErroCarregamento titulo="Não foi possível carregar os agentes agora." reset={reset} digest={error.digest} />
    </div>
  );
}

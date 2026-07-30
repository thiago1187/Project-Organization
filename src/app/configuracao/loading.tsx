import EstadoCarregando from "@/componentes/EstadoCarregando";

export default function CarregandoConfiguracao() {
  return (
    <div style={{ padding: "32px 36px 72px", maxWidth: 940 }}>
      <EstadoCarregando texto="carregando configuração…" />
    </div>
  );
}

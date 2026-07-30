import EstadoCarregando from "@/componentes/EstadoCarregando";

export default function CarregandoDetalheProjeto() {
  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 1240 }}>
      <EstadoCarregando texto="carregando projeto…" />
    </div>
  );
}

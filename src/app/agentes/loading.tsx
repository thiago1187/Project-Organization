import EstadoCarregando from "@/componentes/EstadoCarregando";

export default function CarregandoAgentes() {
  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <EstadoCarregando texto="carregando agentes…" />
    </div>
  );
}

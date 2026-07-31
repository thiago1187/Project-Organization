import EstadoCarregando from "@/componentes/EstadoCarregando";

export default function CarregandoFichaAgente() {
  return (
    <div style={{ padding: "22px 36px 72px", maxWidth: 900 }}>
      <EstadoCarregando texto="carregando ficha do agente…" />
    </div>
  );
}

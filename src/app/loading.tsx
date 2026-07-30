import EstadoCarregando from "@/componentes/EstadoCarregando";

export default function CarregandoVisaoGeral() {
  return (
    <div style={{ padding: "30px 36px 64px" }}>
      <EstadoCarregando texto="carregando projetos…" />
    </div>
  );
}

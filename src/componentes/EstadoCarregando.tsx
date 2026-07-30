// Mesmo padrão visual da caixa tracejada já usada nos estados vazios
// existentes ("solte um projeto aqui", "nenhum projeto cadastrado ainda") —
// reaproveitado aqui para "carregando", em vez de inventar um segundo
// padrão para a mesma ideia (algo ainda não está pronto para ver).
export default function EstadoCarregando({ texto }: { texto: string }) {
  return (
    <div
      style={{
        border: "1px dashed var(--borda)",
        borderRadius: 8,
        padding: "18px 12px",
        textAlign: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: "var(--mut3)",
      }}
    >
      {texto}
    </div>
  );
}

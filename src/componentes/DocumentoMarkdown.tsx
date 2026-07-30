import type { ReactNode } from "react";

// Renderiza o Markdown que src/dominio/documentoAndamento.ts gera —
// dependência zero de propósito (item 4 de docs/proximos-passos.md: "avalie
// a opção que não adiciona binário pesado nem dependência nativa"). Não é um
// parser de Markdown genérico: só entende a gramática restrita que o
// gerador produz (#, ##, ###, "- item", linha de continuação com dois
// espaços à frente de um item, linha em branco). Isso é seguro porque quem
// escreve o Markdown é este mesmo app — não há Markdown de origem externa
// passando por aqui.
//
// Todo texto vira nó de texto do React (nunca `dangerouslySetInnerHTML`),
// então o conteúdo livre (proposta, motivo, resumo — já passado por
// `semCredencial` na origem) continua escapado normalmente pelo React, sem
// risco de HTML injetado no documento.

function Titulo({ nivel, children }: { nivel: 1 | 2 | 3; children: ReactNode }) {
  const estilos = {
    1: { fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 30, marginTop: 0, marginBottom: 6 },
    2: { fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, marginTop: 26, marginBottom: 8 },
    3: { fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 6, color: "var(--txt2)" },
  } as const;
  const props = { style: estilos[nivel] };
  if (nivel === 1) return <h1 {...props}>{children}</h1>;
  if (nivel === 2) return <h2 {...props}>{children}</h2>;
  return <h3 {...props}>{children}</h3>;
}

export default function DocumentoMarkdown({ markdown }: { markdown: string }) {
  const linhas = markdown.split("\n");
  const blocos: ReactNode[] = [];
  let itensLista: { texto: string; extra: string[] }[] | null = null;
  let chave = 0;

  function fecharLista() {
    if (itensLista && itensLista.length > 0) {
      blocos.push(
        <ul key={`ul-${chave++}`} style={{ margin: "4px 0 4px 20px", padding: 0 }}>
          {itensLista.map((item, i) => (
            <li key={i} style={{ marginBottom: item.extra.length ? 6 : 2 }}>
              {item.texto}
              {item.extra.map((linha, j) => (
                <span key={j} style={{ display: "block", color: "var(--mut3)", fontSize: 12.5 }}>
                  {linha}
                </span>
              ))}
            </li>
          ))}
        </ul>,
      );
    }
    itensLista = null;
  }

  for (const linhaBruta of linhas) {
    if (linhaBruta.startsWith("### ")) {
      fecharLista();
      blocos.push(<Titulo nivel={3} key={`h-${chave++}`}>{linhaBruta.slice(4)}</Titulo>);
      continue;
    }
    if (linhaBruta.startsWith("## ")) {
      fecharLista();
      blocos.push(<Titulo nivel={2} key={`h-${chave++}`}>{linhaBruta.slice(3)}</Titulo>);
      continue;
    }
    if (linhaBruta.startsWith("# ")) {
      fecharLista();
      blocos.push(<Titulo nivel={1} key={`h-${chave++}`}>{linhaBruta.slice(2)}</Titulo>);
      continue;
    }
    if (linhaBruta.startsWith("- ")) {
      if (!itensLista) itensLista = [];
      itensLista.push({ texto: linhaBruta.slice(2), extra: [] });
      continue;
    }
    if (linhaBruta.startsWith("  ") && itensLista && itensLista.length > 0) {
      itensLista[itensLista.length - 1].extra.push(linhaBruta.trim());
      continue;
    }
    fecharLista();
    if (linhaBruta.trim() === "") {
      blocos.push(<div key={`sp-${chave++}`} style={{ height: 6 }} />);
      continue;
    }
    blocos.push(
      <p key={`p-${chave++}`} style={{ margin: "2px 0", color: "var(--txt2)" }}>
        {linhaBruta}
      </p>,
    );
  }
  fecharLista();

  return <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--txt)" }}>{blocos}</div>;
}

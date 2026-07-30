import type { Metadata } from "next";
import Cabecalho from "@/componentes/Cabecalho";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acompanhamento noturno",
};

// Roda antes da primeira pintura: lê o tema salvo e escreve o atributo no
// <html> antes do React hidratar, para o padrão continuar escuro sem piscar
// (plano §2.3). Só 3 linhas de fato — o try/catch é para navegação sem
// localStorage (ex.: modo privado) não quebrar o carregamento da página.
const SCRIPT_ANTI_FLASH = `try{var t=localStorage.getItem("tema");if(t==="claro")document.documentElement.setAttribute("data-tema","claro");}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning só neste elemento: o script anti-flash muda o
    // atributo data-tema do <html> antes do React hidratar de propósito, e o
    // aviso de divergência de hidratação para esse atributo é esperado, não
    // um bug — sem isto o React loga um erro no console a cada carregamento
    // no tema claro.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_FLASH }} />
      </head>
      <body>
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--txt)", fontSize: 14, lineHeight: 1.45 }}>
          <Cabecalho />
          {children}
        </div>
      </body>
    </html>
  );
}

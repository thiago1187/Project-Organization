import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Cabecalho from "@/componentes/Cabecalho";
import "./globals.css";

// Fontes servidas do próprio domínio: next/font/google baixa os arquivos em
// build e os expõe como CSS local (nenhuma requisição a fonts.googleapis.com
// em runtime) — troca os antigos <link> para o Google Fonts, que a reforma
// de tipografia (dono rejeitou "vibe de escritor e fino") removeu junto com
// a Instrument Serif.
//
// Inter: x-height generosa, 600/700 de verdade, desenhada para legibilidade
// em tamanho pequeno de tela — o oposto do problema apontado ("letra
// pequena demais", "contraste fraco"). Única família para título e corpo;
// a mono fica só para dado técnico (ver globals.css e docs).
const fonteSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fonteMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Acompanhamento noturno",
};

// Roda antes da primeira pintura: lê tema e densidade salvos e escreve os
// atributos no <html> antes do React hidratar, para nenhum dos dois piscar
// no primeiro paint (plano §2.3, e a mesma ideia estendida à densidade
// nesta reforma). Só try/catch por navegação sem localStorage (ex.: modo
// privado) não quebrar o carregamento da página.
const SCRIPT_ANTI_FLASH = `try{var t=localStorage.getItem("tema");if(t==="claro")document.documentElement.setAttribute("data-tema","claro");var d=localStorage.getItem("densidade");if(d==="compacto"||d==="confortavel")document.documentElement.setAttribute("data-densidade",d);}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning só neste elemento: o script anti-flash muda os
    // atributos data-tema/data-densidade do <html> antes do React hidratar de
    // propósito, e o aviso de divergência de hidratação para eles é
    // esperado, não um bug — sem isto o React loga um erro no console a cada
    // carregamento fora do padrão.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${fonteSans.variable} ${fonteMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_FLASH }} />
      </head>
      <body>
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--txt)" }}>
          <Cabecalho />
          {children}
        </div>
      </body>
    </html>
  );
}

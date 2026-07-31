"use client";

import { useEffect, useState } from "react";

// A saudação era a string fixa "Bom dia", herdada do export do Claude Design.
// O dono notou do jeito mais direto possível: "tá um bom dia mesmo estando de
// noite."
//
// Mesma razão do Relogio.tsx para só calcular depois de montar: o servidor
// renderiza em outro fuso e em outro instante que o navegador. Calculado lá,
// o texto divergiria na hidratação — o React reclama, e o dono veria "bom
// dia" por uma fração de segundo antes de virar "boa noite", que é
// exatamente o defeito que estamos consertando.
//
// O primeiro render devolve um texto neutro e verdadeiro a qualquer hora, em
// vez de espaço em branco: título de 34px que aparece do nada empurra a
// página e chama mais atenção que a palavra certa chegando um quadro depois.

const NEUTRA = "Olá";

function saudacaoDaHora(hora: number): string {
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Saudacao({ style }: { style?: React.CSSProperties }) {
  const [texto, setTexto] = useState(NEUTRA);

  useEffect(() => {
    const atualizar = () => setTexto(saudacaoDaHora(new Date().getHours()));
    atualizar();

    // Uma verificação por minuto basta: a saudação muda três vezes por dia, e
    // o custo é uma comparação. Sem isso, quem deixa a aba aberta das 23h às
    // 6h continua vendo "boa noite" de manhã — que é a mesma queixa, só que
    // atrasada.
    const intervalo = setInterval(atualizar, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <span suppressHydrationWarning style={style}>
      {texto}
    </span>
  );
}

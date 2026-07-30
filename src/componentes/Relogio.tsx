"use client";

import { useEffect, useState } from "react";

// Relógio do cabeçalho. Substitui a string fixa "29 jul 2026 · 07:40" que veio
// do export do Claude Design.
//
// Por que só depois de montar, e não no servidor: o servidor renderiza num
// fuso e num instante diferentes do navegador do dono. Qualquer valor
// calculado lá divergiria do que o cliente calcula na hidratação — o React
// reclama, e o dono veria a hora do servidor por uma fração de segundo antes
// de ela pular para a certa.
//
// O primeiro render devolve um espaço reservado com a mesma largura, para o
// cabeçalho não pular quando o horário chegar.

const RESERVA = " ";

function formatar(d: Date): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  // Intl devolve "29 de jul. de 2026" — o export usava "29 jul 2026".
  const limpa = data.replace(/ de /g, " ").replace(/\./g, "");
  return `${limpa} · ${hora}`;
}

export default function Relogio({ style }: { style?: React.CSSProperties }) {
  const [texto, setTexto] = useState(RESERVA);

  useEffect(() => {
    const tick = () => setTexto(formatar(new Date()));
    tick();

    // Alinha o primeiro tique com a virada do minuto, e só então passa a
    // atualizar de minuto em minuto. Sem isso o relógio erraria por até 59
    // segundos até o primeiro intervalo fechar.
    const msAteOProximoMinuto = 60_000 - (Date.now() % 60_000);
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const alinhamento = setTimeout(() => {
      tick();
      intervalo = setInterval(tick, 60_000);
    }, msAteOProximoMinuto);

    return () => {
      clearTimeout(alinhamento);
      if (intervalo) clearInterval(intervalo);
    };
  }, []);

  return (
    <span suppressHydrationWarning style={style}>
      {texto}
    </span>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ItemAtencaoVM } from "@/dominio/visao";
import { estaDigitando } from "./tecladoUtil";

// Máximo de itens numerados. Painel pessoal, poucos projetos por natureza —
// se um dia mais de nove pedirem decisão ao mesmo tempo, isso já é a notícia
// (ver o rodapé "+N mais"), não motivo para inventar paginação aqui.
const MAX_NUMERADOS = 9;

/**
 * A resposta a "em qual dos meus projetos algo precisa de mim" — a primeira
 * coisa depois do cabeçalho, antes da grade por cadência. Ver
 * `itensAtencao` em src/dominio/visao.ts para a regra de quem entra aqui e
 * por quê a grade por frequência sozinha não bastava.
 *
 * Cada linha é um `<Link>` de verdade (não `role="link"` num div): tabulável
 * e ativável por Enter de graça, sem handler nenhum. O dígito no início de
 * cada linha é o mesmo número que abre aquele projeto direto do teclado —
 * atalho visível no próprio botão, nunca escondido (CLAUDE.md).
 */
export default function PainelAtencao({
  itens,
  totalAtivos,
}: {
  itens: ItemAtencaoVM[];
  totalAtivos: number;
}) {
  const router = useRouter();
  const numerados = itens.slice(0, MAX_NUMERADOS);
  const resto = itens.length - numerados.length;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (estaDigitando(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > numerados.length) return;
      e.preventDefault();
      router.push(`/projeto/${numerados[n - 1].id}`);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [numerados, router]);

  if (itens.length === 0) {
    return (
      <div
        style={{
          marginTop: 22,
          padding: "14px 18px",
          borderRadius: 8,
          border: "1px solid var(--borda)",
          background: "var(--faixa-fundo)",
          fontSize: "var(--fs-sm)",
          color: "var(--mut3)",
        }}
      >
        {totalAtivos === 0 ? (
          <>
            nenhum projeto cadastrado ainda ·{" "}
            <Link href="/configuracao" className="h-txt" style={{ color: "var(--mut2)" }}>
              cadastrar em Configuração →
            </Link>
          </>
        ) : (
          "nada pedindo decisão agora"
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 22,
        borderRadius: 8,
        border: "1px solid var(--atn)",
        background: "var(--faixa-fundo)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 18px 10px",
          fontWeight: "var(--fw-semibold)",
          fontSize: "var(--fs-sm)",
          color: "var(--atn)",
        }}
      >
        {itens.length} {itens.length === 1 ? "projeto pede" : "projetos pedem"} você agora
      </div>
      {/* <ol>, não <div>: a ordem é o que faz o número do atalho de teclado
          fazer sentido, e a lista dá a quem navega por leitor de tela a
          mesma pista ("item 1 de N") que o dígito dá a quem usa o teclado. */}
      <ol style={{ display: "flex", flexDirection: "column", listStyle: "none", margin: 0, padding: 0 }}>
        {numerados.map((item, i) => (
          <li key={item.id}>
          <Link
            href={`/projeto/${item.id}`}
            className="h-fundo"
            aria-label={`${item.nome}, ${item.statusLabel} — ${item.resumo}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              borderTop: "1px solid var(--linha3)",
              minHeight: 44,
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-2xs)",
                fontWeight: "var(--fw-medium)",
                color: "var(--mut3)",
                border: "1px solid var(--borda)",
                borderRadius: 4,
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {i + 1}
            </span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.cor, flex: "none" }} />
            <span
              style={{
                fontWeight: "var(--fw-bold)",
                fontSize: "var(--fs-md)",
                whiteSpace: "nowrap",
                flex: "none",
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--txt)",
              }}
            >
              {item.nome}
            </span>
            <span
              style={{
                fontSize: "var(--fs-sm)",
                color: "var(--txt2)",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.resumo}
            </span>
            <span
              style={{
                fontWeight: "var(--fw-semibold)",
                fontSize: "var(--fs-xs)",
                color: item.cor,
                whiteSpace: "nowrap",
                flex: "none",
              }}
            >
              {item.statusLabel}
            </span>
          </Link>
          </li>
        ))}
      </ol>
      {resto > 0 && (
        <div
          style={{
            padding: "8px 18px",
            borderTop: "1px solid var(--linha3)",
            fontSize: "var(--fs-xs)",
            color: "var(--mut3)",
          }}
        >
          +{resto} {resto === 1 ? "mais" : "mais"} na grade abaixo
        </div>
      )}
    </div>
  );
}

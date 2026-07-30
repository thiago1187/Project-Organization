"use client";

import { useState } from "react";
import type { Servico, Stack } from "@/dominio/tipos";
import { agruparServico, agruparStack } from "@/dominio/inventario";
import CartaoStack from "./CartaoStack";
import FormNovaStack from "./FormNovaStack";
import CartaoServico from "./CartaoServico";
import FormNovoServico from "./FormNovoServico";

// Inventário do projeto — stack (linguagem/framework/runtime) e serviços
// externos (banco, hospedagem, modelo, autenticação, storage, e-mail), com
// onde cada um é administrado. Responde à pergunta 4 de docs/visao.md ("o
// que tem dentro deste projeto") com dado real de `stack`/`servico`
// (db/migrations/002_inventario.sql).
//
// Substitui `ListaAcessos`/`AcessoMock`: aquele bloco sempre recebia `{}` da
// página (nenhuma tabela por trás) e caía no estado vazio — nunca teve
// conteúdo de verdade para mostrar. `servico` responde à mesma pergunta
// ("o que este projeto usa, em qual conta, onde administro") com dado real e
// editável, então não faz sentido manter os dois lado a lado (ver
// docs/plano-agentes-por-projeto.md § 5.2). O aviso de que os *valores* de
// credencial vivem nas environment variables do Vercel — nunca aqui — segue
// junto, porque continua sendo a resposta certa quando o dono for procurar
// uma senha nesta tela.
//
// "Duas velocidades" (docs/visao.md): a stack é um resumo denso (chips numa
// linha); os serviços são cartões com um pouco mais de contexto (conta,
// papel, onde administrar) porque é ali que mora a pergunta que mais importa
// numa manhã. Os dois editáveis no lugar, sem navegar para outra tela.
export default function InventarioProjeto({
  projetoId,
  stack,
  servico,
}: {
  projetoId: string;
  stack: Stack[];
  servico: Servico[];
}) {
  const [adicionandoStack, setAdicionandoStack] = useState(false);
  const [adicionandoServico, setAdicionandoServico] = useState(false);

  const gruposStack = agruparStack(stack);
  const gruposServico = agruparServico(servico);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "var(--mut3)",
              whiteSpace: "nowrap",
              flex: "none",
            }}
          >
            stack
          </div>
          <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
          {!adicionandoStack && (
            <button
              type="button"
              onClick={() => setAdicionandoStack(true)}
              className="h-txt"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "var(--atn)",
                background: "none",
                border: "1px solid var(--borda)",
                borderRadius: 4,
                padding: "4px 10px",
                cursor: "pointer",
                flex: "none",
              }}
            >
              + adicionar
            </button>
          )}
        </div>

        {stack.length === 0 && !adicionandoStack && (
          <div
            style={{
              border: "1px dashed var(--borda)",
              borderRadius: 8,
              padding: "14px 12px",
              textAlign: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "var(--mut3)",
            }}
          >
            nenhuma stack registrada ainda
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {gruposStack.map((grupo) => (
            <div key={grupo.categoria} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "var(--mut3)",
                  flex: "none",
                }}
              >
                {grupo.label}
              </span>
              {grupo.itens.map((item) => (
                <CartaoStack key={item.id} item={item} projetoId={projetoId} />
              ))}
            </div>
          ))}
          {adicionandoStack && <FormNovaStack projetoId={projetoId} aoFechar={() => setAdicionandoStack(false)} />}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "var(--mut3)",
              whiteSpace: "nowrap",
              flex: "none",
            }}
          >
            serviços
          </div>
          <div style={{ flex: 1, height: 1, background: "var(--linha2)" }} />
          {!adicionandoServico && (
            <button
              type="button"
              onClick={() => setAdicionandoServico(true)}
              className="h-txt"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "var(--atn)",
                background: "none",
                border: "1px solid var(--borda)",
                borderRadius: 4,
                padding: "4px 10px",
                cursor: "pointer",
                flex: "none",
              }}
            >
              + adicionar
            </button>
          )}
        </div>

        {servico.length === 0 && !adicionandoServico ? (
          <div style={{ fontSize: 11, color: "var(--mut3)", marginTop: 8 }}>
            Nenhum serviço registrado para este projeto.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            {gruposServico.map((grupo) => (
              <div key={grupo.categoria}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "var(--mut3)",
                    marginBottom: 6,
                  }}
                >
                  {grupo.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {grupo.itens.map((item) => (
                    <CartaoServico key={item.id} item={item} projetoId={projetoId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {adicionandoServico && (
          <div style={{ marginTop: 10 }}>
            <FormNovoServico projetoId={projetoId} aoFechar={() => setAdicionandoServico(false)} />
          </div>
        )}

        <div
          style={{
            marginTop: 10,
            borderLeft: "2px solid var(--borda)",
            padding: "2px 0 2px 10px",
            fontSize: 11,
            color: "var(--mut2)",
            textWrap: "pretty",
          }}
        >
          Os valores vivem nas environment variables do Vercel. Este app não os lê nem os exibe — para adicionar ou
          trocar uma credencial, use o painel do Vercel.
        </div>
      </div>
    </div>
  );
}

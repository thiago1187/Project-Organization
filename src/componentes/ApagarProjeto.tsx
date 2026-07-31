"use client";

import { useState, useTransition } from "react";
import { confirmacaoDeNomeValida, totalApagado, type ContagemExclusaoProjeto } from "@/dominio/exclusaoProjeto";
import { apagarProjetoAction } from "@/servidor/acoes-projeto";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

/**
 * Confirmação de apagar projeto — só existe na tela de Configuração
 * (CLAUDE.md: "apagar o que você está olhando é como se apaga por
 * engano", por isso não fica no detalhe do projeto). Irreversível e sem
 * desfazer: exige o nome do projeto digitado de volta, e mostra antes o que
 * vai junto — mesma régua de `confirmacaoDeNomeValida`
 * (src/dominio/exclusaoProjeto.ts) usada de novo no servidor, porque o botão
 * desabilitado aqui é conveniência de UI, não a defesa real.
 */
function resumoDoQueSome(contagem: ContagemExclusaoProjeto): string {
  const partes = [
    contagem.relatorios > 0 ? `${contagem.relatorios} relatório${contagem.relatorios === 1 ? "" : "s"} de rodada` : null,
    contagem.sugestoes > 0
      ? `${contagem.sugestoes} sugest${contagem.sugestoes === 1 ? "ão" : "ões"} (inclusive as já decididas)`
      : null,
    contagem.contextos > 0 ? `${contagem.contextos} item${contagem.contextos === 1 ? "" : "ns"} de contexto` : null,
    contagem.tarefas > 0 ? `${contagem.tarefas} tarefa${contagem.tarefas === 1 ? "" : "s"}` : null,
  ].filter((p): p is string => p !== null);

  return partes.length === 0 ? "nada além do cadastro do projeto" : partes.join(", ");
}

export default function ApagarProjeto({
  id,
  nome,
  contagem,
  aoFechar,
}: {
  id: string;
  nome: string;
  contagem: ContagemExclusaoProjeto;
  aoFechar: () => void;
}) {
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const habilitado = confirmacaoDeNomeValida(nomeDigitado, nome) && !pendente;

  function confirmar() {
    if (!habilitado) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await apagarProjetoAction(id, nome, nomeDigitado);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível apagar o projeto.");
        return;
      }
      // Sucesso: a Server Action já revalidou "/" e "/configuracao" — o
      // projeto some da lista no próximo render do servidor. Não fecha o
      // painel manualmente para não piscar o formulário de edição no lugar
      // por uma fração de segundo antes da linha inteira sumir.
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 260 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)", lineHeight: 1.5, textWrap: "pretty" }}>
        Apagar <strong>{nome}</strong> é definitivo — não tem desfazer. Some junto: {resumoDoQueSome(contagem)}.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={nomeDigitado}
          onChange={(e) => setNomeDigitado(e.target.value)}
          placeholder={`digite "${nome}" para confirmar`}
          disabled={pendente}
          style={{ ...estiloCampo, flex: "1 1 220px", minWidth: 180, width: "auto" }}
        />
        <button
          type="button"
          onClick={confirmar}
          disabled={!habilitado}
          className={classeBotao("destrutiva-forte")}
          style={{ ...estiloBotao("destrutiva-forte"), opacity: habilitado ? 1 : 0.5, whiteSpace: "nowrap" }}
        >
          {pendente ? "apagando…" : "apagar definitivamente"}
        </button>
        <button
          type="button"
          onClick={aoFechar}
          disabled={pendente}
          className={classeBotao("texto")}
          style={estiloBotao("texto")}
        >
          cancelar
        </button>
      </div>
      {erro && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fal)" }}>{erro}</div>}
    </div>
  );
}

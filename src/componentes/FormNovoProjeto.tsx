"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { RepositorioGithubNormalizado } from "@/dominio/repositorioGithub";
import type { Frequencia } from "@/dominio/tipos";
import { importarRepositorioGithubAction } from "@/servidor/acoes-github";
import { criarProjetoAction, type EstadoFormProjeto } from "@/servidor/acoes-projeto";
import { estiloCampo } from "./estiloCampo";
import { classeBotao, estiloBotao } from "./estiloBotao";

const OPCOES_FREQUENCIA: { valor: Frequencia; rotulo: string }[] = [
  { valor: "toda_madrugada", rotulo: "toda madrugada" },
  { valor: "dias_alternados", rotulo: "dias alternados" },
  { valor: "semanal", rotulo: "semanal" },
];

const ESTADO_INICIAL: EstadoFormProjeto = { ok: false, erro: null, campos: {} };

/**
 * Importa nome, descrição, linguagens, último commit, PRs abertos e README de
 * um repositório do GitHub para pré-preencher o cadastro (docs/proximos-passos.md,
 * item 8). Nunca salva nada sozinha — só escreve nos campos `nome`,
 * `repositorio` e `descricao` do formulário abaixo, que o dono revisa e
 * confirma com "cadastrar projeto" como qualquer outro cadastro.
 *
 * Campos ficam não controlados (defaultValue) neste formulário, então o
 * preenchimento acontece direto no DOM via ref — trocar para input
 * controlado só para isto obrigaria os três campos a virar estado React sem
 * necessidade.
 */
function ImportarDoGithub({
  onImportado,
}: {
  onImportado: (dados: RepositorioGithubNormalizado) => void;
}) {
  const [entrada, setEntrada] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<RepositorioGithubNormalizado | null>(null);

  async function importar() {
    if (!entrada.trim() || pendente) return;
    setPendente(true);
    setErro(null);
    const resultado = await importarRepositorioGithubAction(entrada);
    setPendente(false);
    if (!resultado.ok || !resultado.dados) {
      setErro(resultado.erro ?? "Não foi possível importar este repositório.");
      setResumo(null);
      return;
    }
    setResumo(resultado.dados);
    onImportado(resultado.dados);
  }

  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px dashed var(--borda)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 260px", minWidth: 200 }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>importar do GitHub · opcional</span>
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                importar();
              }
            }}
            maxLength={300}
            style={estiloCampo}
            placeholder="https://github.com/dono/repositorio ou dono/repositorio"
          />
        </label>
        <button
          type="button"
          onClick={importar}
          disabled={pendente || !entrada.trim()}
          className={classeBotao("secundaria")}
          style={{ ...estiloBotao("secundaria"), whiteSpace: "nowrap" }}
        >
          {pendente ? "importando…" : "importar"}
        </button>
      </div>
      {erro && <div style={{ marginTop: 8, fontSize: "var(--fs-2xs)", color: "var(--fal)" }}>{erro}</div>}
      {resumo && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--mut2)", lineHeight: 1.6 }}>
          <div>
            nome e descrição preenchidos abaixo — confira antes de cadastrar.
          </div>
          {resumo.linguagens.length > 0 && <div>linguagens: {resumo.linguagens.join(", ")}</div>}
          {resumo.ultimoCommit && (
            <div>
              último commit: {resumo.ultimoCommit.sha} — {resumo.ultimoCommit.mensagem}
            </div>
          )}
          {resumo.prsAbertos && (
            <div>
              PRs abertos: {resumo.prsAbertos.quantidade}
              {resumo.prsAbertos.aproximado ? "+" : ""}
            </div>
          )}
          {resumo.readmeResumo && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer" }}>README (resumo)</summary>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4, color: "var(--mut3)" }}>{resumo.readmeResumo}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// Cadastro de projeto novo. Sem referência no export original (plano de
// conversão não desenhou esta tela) — layout mínimo com os mesmos tokens e
// tipografia do resto do painel, não uma peça nova de design.
export default function FormNovoProjeto() {
  const [estado, acao, pendente] = useActionState(criarProjetoAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const repositorioRef = useRef<HTMLInputElement>(null);
  const descricaoRef = useRef<HTMLTextAreaElement>(null);
  const pendenteAnteriorRef = useRef(pendente);

  // Limpa o formulário só depois de um envio bem-sucedido de verdade — não a
  // cada render em que `estado.ok` continua true por causa do estado anterior.
  useEffect(() => {
    if (pendenteAnteriorRef.current && !pendente && estado.ok) {
      formRef.current?.reset();
    }
    pendenteAnteriorRef.current = pendente;
  }, [pendente, estado.ok]);

  function preencherComGithub(dados: RepositorioGithubNormalizado) {
    if (nomeRef.current) nomeRef.current.value = dados.nome;
    if (repositorioRef.current) repositorioRef.current.value = dados.repositorio;
    if (descricaoRef.current && dados.descricao) descricaoRef.current.value = dados.descricao;
  }

  return (
    <div
      style={{
        border: "1px solid var(--borda)",
        borderRadius: 8,
        background: "var(--painel)",
        padding: "16px 18px",
        marginBottom: 22,
      }}
    >
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--mut2)", marginBottom: 12 }}>
        novo projeto
      </div>
      <ImportarDoGithub onImportado={preencherComGithub} />
      <form ref={formRef} action={acao} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px", minWidth: 160 }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>nome</span>
          <input
            ref={nomeRef}
            name="nome"
            defaultValue={estado.campos.nome}
            required
            maxLength={200}
            style={estiloCampo}
            placeholder="Cofre de rotinas"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px", minWidth: 180 }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>repositório · opcional</span>
          <input
            ref={repositorioRef}
            name="repositorio"
            defaultValue={estado.campos.repositorio}
                        maxLength={140}
            style={estiloCampo}
            placeholder="dono/repositorio"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 170px" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>cadência</span>
          <select name="frequencia" defaultValue={estado.campos.frequencia || "toda_madrugada"} style={estiloCampo}>
            {OPCOES_FREQUENCIA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 100%" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--mut2)" }}>descrição · opcional</span>
          <textarea
            ref={descricaoRef}
            name="descricao"
            defaultValue={estado.campos.descricao}
            maxLength={2000}
            rows={2}
            style={{ ...estiloCampo, resize: "vertical", fontFamily: "inherit" }}
            placeholder="o que este projeto é — isto vai para os agentes"
          />
        </label>
        <button
          type="submit"
          disabled={pendente}
          className={classeBotao("primaria")}
          style={{ ...estiloBotao("primaria"), whiteSpace: "nowrap" }}
        >
          {pendente ? "cadastrando…" : "cadastrar projeto"}
        </button>
      </form>
      {estado.erro && <div style={{ marginTop: 10, fontSize: "var(--fs-2xs)", color: "var(--fal)" }}>{estado.erro}</div>}
    </div>
  );
}

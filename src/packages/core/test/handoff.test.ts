import { describe, expect, it } from "vitest"
import { semAberturaDeConclusao } from "../src/handoff"

describe("semAberturaDeConclusao", () => {
  it("troca 'Etapa concluída!' por uma abertura que situa a sessão", () => {
    expect(semAberturaDeConclusao("Etapa concluída! Não preciso de arquivo novo agora.")).toBe("Nesta sessão, não preciso de arquivo novo agora.")
    expect(semAberturaDeConclusao("Etapa concluída! Cada problema do diagnóstico agora tem hipóteses.")).toBe(
      "Nesta sessão, cada problema do diagnóstico agora tem hipóteses.",
    )
  })

  it("aceita variações de pontuação e de maiúsculas", () => {
    expect(semAberturaDeConclusao("etapa concluida. Para começarmos a Skill 03, preciso de planilhas.")).toBe(
      "Nesta sessão, para começarmos a Skill 03, preciso de planilhas.",
    )
    expect(semAberturaDeConclusao("Etapa concluída — esta era a última etapa de conteúdo! Não preciso de nada novo.")).toBe(
      "Nesta sessão, esta era a última etapa de conteúdo! Não preciso de nada novo.",
    )
  })

  it("mantém a sigla ou o nome próprio de abertura como está", () => {
    expect(semAberturaDeConclusao("Etapa concluída! ROAS e CAC já estão fechados.")).toBe("Nesta sessão, ROAS e CAC já estão fechados.")
    expect(semAberturaDeConclusao("Etapa concluída! Meta Ads foi priorizado.")).toBe("Nesta sessão, Meta Ads foi priorizado.")
  })

  it("não mexe no texto que já começa certo", () => {
    expect(semAberturaDeConclusao("Nesta sessão, não preciso de nada novo.")).toBe("Nesta sessão, não preciso de nada novo.")
  })

  it("só olha o começo do texto", () => {
    expect(semAberturaDeConclusao("Antes de seguir: etapa concluída! só no meio.")).toBe("Antes de seguir: etapa concluída! só no meio.")
  })
})

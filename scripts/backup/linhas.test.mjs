// Testes da comparação que decide o que a restauração repõe. Rodar: node --test scripts/backup/linhas.test.mjs
// Não importa comum.mjs (ele lê o .env da raiz ao carregar), por isso as chaves das tabelas são repetidas aqui.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { linhasQueFaltam, normalizarValor } from "./linhas.mjs"

const CHAVE_NOTAS = ["item", "autor", "criada_em"]

function nota(extra) {
  return {
    item: "03",
    texto: "Checagem por bloco",
    autor: "Matheus Moreira",
    criada_em: "2026-11-08T12:00:00.123456+00:00",
    resolvida_em: null,
    resolvida_por: null,
    ...extra,
  }
}

describe("notas_skills: segunda restauração não duplica", () => {
  it("nota que volta com outro id do banco não é reposta", () => {
    const backup = [nota({ id: 1 }), nota({ id: 2, item: "02", criada_em: "2026-11-08T13:00:00.000001+00:00" })]
    // Depois da primeira restauração, o banco gerou ids novos (sem os ids do backup).
    const banco = [nota({ id: 57 }), nota({ id: 58, item: "02", criada_em: "2026-11-08T13:00:00.000001+00:00" })]
    assert.deepEqual(linhasQueFaltam(backup, banco, CHAVE_NOTAS), [])
  })

  it("nota que não está no banco é reposta, com o id do backup ainda presente", () => {
    const backup = [nota({ id: 1 }), nota({ id: 2, item: "02" })]
    const banco = [nota({ id: 9 })]
    const faltam = linhasQueFaltam(backup, banco, CHAVE_NOTAS)
    assert.equal(faltam.length, 1)
    assert.equal(faltam[0].id, 2)
  })
})

describe("timestamps: forma do backup e forma do banco batem", () => {
  it("+00:00 e Z são iguais, com microssegundos preservados", () => {
    assert.equal(
      normalizarValor("criada_em", "2026-11-08T12:00:00.123456+00:00"),
      "2026-11-08T12:00:00.123456Z",
    )
    assert.equal(
      normalizarValor("criada_em", "2026-11-08T12:00:00.123456+00:00"),
      normalizarValor("criada_em", "2026-11-08T12:00:00.123456Z"),
    )
  })

  it("microssegundos diferentes continuam diferentes", () => {
    const backup = [nota({ id: 1, criada_em: "2026-11-08T12:00:00.123456+00:00" })]
    const banco = [nota({ id: 1, criada_em: "2026-11-08T12:00:00.123457Z" })]
    assert.equal(linhasQueFaltam(backup, banco, CHAVE_NOTAS).length, 1)
  })

  it("a conversão só vale para colunas `*_em`", () => {
    assert.equal(normalizarValor("texto", "x+00:00"), "x+00:00")
    assert.equal(normalizarValor("email", "a@x+00:00"), "a@x+00:00")
  })

  it("nota com timestamp no banco em Z bate com o backup em +00:00", () => {
    const backup = [nota({ id: 1, criada_em: "2026-11-08T12:00:00.123456+00:00" })]
    const banco = [nota({ id: 1, criada_em: "2026-11-08T12:00:00.123456Z" })]
    assert.deepEqual(linhasQueFaltam(backup, banco, CHAVE_NOTAS), [])
  })
})

describe("usuarios (chave email): comportamento de antes", () => {
  const CHAVE_USUARIOS = ["email"]

  it("só repõe e-mails que não existem", () => {
    const backup = [
      { email: "a@x", papel: "admin" },
      { email: "b@x", papel: "leitor" },
    ]
    const banco = [{ email: "a@x", papel: "leitor" }]
    assert.deepEqual(linhasQueFaltam(backup, banco, CHAVE_USUARIOS), [{ email: "b@x", papel: "leitor" }])
  })

  it("papel já cadastrado não é considerado faltante, mesmo se diferir do backup", () => {
    const backup = [{ email: "a@x", papel: "admin" }]
    const banco = [{ email: "a@x", papel: "leitor" }]
    assert.deepEqual(linhasQueFaltam(backup, banco, CHAVE_USUARIOS), [])
  })
})

describe("config_modelos (chave etapa + alvo)", () => {
  const CHAVE_CONFIG = ["etapa", "alvo"]

  it("chave composta: alvo diferente conta como faltante", () => {
    const backup = [
      { etapa: "01", alvo: "principal", modelo: "haiku" },
      { etapa: "01", alvo: "subagente", modelo: "sonnet" },
    ]
    const banco = [{ etapa: "01", alvo: "principal", modelo: "opus" }]
    const faltam = linhasQueFaltam(backup, banco, CHAVE_CONFIG)
    assert.deepEqual(faltam, [{ etapa: "01", alvo: "subagente", modelo: "sonnet" }])
  })

  it("valores com | não colidem na chave", () => {
    const backup = [{ etapa: "0", alvo: "1|x" }]
    const banco = [{ etapa: "0|1", alvo: "x" }]
    assert.equal(linhasQueFaltam(backup, banco, CHAVE_CONFIG).length, 1)
  })
})
